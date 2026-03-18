import { MessageParser } from "./message-parser";
import { ReconnectHandler, ReconnectOptions, ReconnectState } from "./reconnect-handler";
import { SessionManager } from "./session-manager";
import { useConnectionStore } from "@/lib/stores/connection-store";
import { useGameStore } from "@/lib/stores/game-store";
import { WebSocketMessage, GameStateUpdateMessage, ErrorMessage, BetAction, ConnectionStatus, ConnectionStatusInfo, ConnectionStatusMessage } from "@/types/game-types";
import { logError } from "@/lib/utils/logger";
import {
  WS_CONNECTION_TIMEOUT_MS,
  WS_HEARTBEAT_INTERVAL_MS,
  WS_HEARTBEAT_TIMEOUT_MS,
  getDefaultWebSocketUrl,
  RECONNECT_MAX_ATTEMPTS,
  RECONNECT_INITIAL_DELAY_MS,
  RECONNECT_MAX_DELAY_MS,
  RECONNECT_BACKOFF_FACTOR,
  WS_MAX_PENDING_HEARTBEATS,
  WS_MAX_MESSAGE_SIZE,
} from "@/lib/constants/game";

export interface ConnectionOptions {
  url?: string;
  autoReconnect?: boolean;
  reconnectOptions?: ReconnectOptions;
  heartbeatInterval?: number;
}

const DEFAULT_OPTIONS: Required<ConnectionOptions> = {
  url: process.env.NEXT_PUBLIC_WS_URL || getDefaultWebSocketUrl(),
  autoReconnect: true,
  reconnectOptions: {
    maxAttempts: RECONNECT_MAX_ATTEMPTS,
    initialDelay: RECONNECT_INITIAL_DELAY_MS,
    maxDelay: RECONNECT_MAX_DELAY_MS,
    backoffFactor: RECONNECT_BACKOFF_FACTOR,
    jitter: true,
  },
  heartbeatInterval: WS_HEARTBEAT_INTERVAL_MS,
};

export type ConnectionState = 'idle' | 'connecting' | 'connected' | 'disconnecting';

export class ConnectionManager {
  private socket: WebSocket | null = null;
  private options: Required<ConnectionOptions>;
  private reconnectHandler: ReconnectHandler | null = null;
  private heartbeatIntervalId: ReturnType<typeof setInterval> | null = null;
  private connectionTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private connectionState: ConnectionState = 'idle';
  private connectionLock: Promise<boolean> | null = null;
  private wasIntentionallyDisconnected = false;
  private connectionGeneration = 0;
  private pendingHeartbeatTimestamps: Map<number, number> = new Map();
  private lastMessageTime = 0;
  private pendingResolve: ((value: boolean) => void) | null = null;
  private abortController: AbortController | null = null;
  private heartbeatCounter = 0;

  constructor(options: ConnectionOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };

    if (!this.validateWebSocketUrl(this.options.url)) {
      throw new Error(`Invalid WebSocket URL: ${this.options.url}`);
    }

    if (this.options.autoReconnect) {
      this.reconnectHandler = new ReconnectHandler(
        () => () => this.connect(),
        (state: ReconnectState) => {
          let connectionStatus: ConnectionStatus;

          if (state === "connected") {
            connectionStatus = "connected";
          } else if (state === "disconnected" || state === "stopped" || state === "failed") {
            connectionStatus = "disconnected";
          } else {
            connectionStatus = "reconnecting";
          }

          useConnectionStore.getState().setStatus(connectionStatus);
        },
        this.options.reconnectOptions
      );
    }
  }

  private enforceHeartbeatBounds(): void {
    const now = Date.now();
    const entriesToDelete: number[] = [];
    
    for (const [id, timestamp] of this.pendingHeartbeatTimestamps) {
      if (now - timestamp > WS_HEARTBEAT_TIMEOUT_MS) {
        entriesToDelete.push(id);
      }
    }
    
    for (const id of entriesToDelete) {
      this.pendingHeartbeatTimestamps.delete(id);
    }
    
    while (this.pendingHeartbeatTimestamps.size > WS_MAX_PENDING_HEARTBEATS) {
      const oldestKey = this.pendingHeartbeatTimestamps.keys().next().value;
      if (oldestKey !== undefined) {
        this.pendingHeartbeatTimestamps.delete(oldestKey);
      } else {
        break;
      }
    }
  }

  private generateHeartbeatId(): number {
    this.heartbeatCounter = (this.heartbeatCounter + 1) & 0xFFFF;
    const clientTimestamp = Date.now();
    const id = (clientTimestamp % 0xFFFFFFFF) * 0x10000 + this.heartbeatCounter;
    if (this.pendingHeartbeatTimestamps.has(id)) {
      this.heartbeatCounter = (this.heartbeatCounter + 1) & 0xFFFF;
      return ((Date.now() % 0xFFFFFFFF) * 0x10000) + this.heartbeatCounter;
    }
    return id;
  }

  private validateWebSocketUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      if (!['ws:', 'wss:'].includes(parsed.protocol)) {
        return false;
      }
      if (process.env.NODE_ENV === 'production' && parsed.protocol !== 'wss:') {
        logError('Security: WebSocket must use wss:// protocol in production. Configure NEXT_PUBLIC_WS_URL environment variable.');
        return false;
      }
      const localhostHosts = ['localhost', '127.0.0.1', '::1', '[::1]'];
      if (parsed.protocol === 'ws:' && !localhostHosts.includes(parsed.hostname)) {
        logError('Non-secure WebSocket (ws://) only allowed on localhost');
        return false;
      }
      return true;
    } catch (error) {
      logError('Failed to parse WebSocket URL:', error);
      return false;
    }
  }

  async connect(): Promise<boolean> {
    if (this.connectionLock && this.connectionState === 'connecting') {
      return this.connectionLock;
    }

    if (this.socket) {
      this.cleanupSocket();
    }

    if (this.abortController) {
      this.abortController.abort();
    }
    this.abortController = new AbortController();
    const signal = this.abortController.signal;

    this.connectionGeneration++;
    const currentGeneration = this.connectionGeneration;

    this.resetConnectionState();
    this.connectionState = 'connecting';

    this.connectionLock = new Promise((resolve) => {
      this.pendingResolve = resolve;

      if (signal.aborted) {
        this.connectionState = 'idle';
        this.connectionLock = null;
        resolve(false);
        return;
      }

      try {
        const socket = new WebSocket(this.options.url);
        this.socket = socket;

        const cleanupAndResolve = (result: boolean): void => {
          if (currentGeneration !== this.connectionGeneration) return;
          if (this.connectionState === 'idle') return;

          this.connectionState = result ? 'connected' : 'idle';
          this.connectionLock = null;
          this.pendingResolve = null;
          this.cleanupConnectionTimeout();
          resolve(result);
        };

        const handleTimeout = (): void => {
          if (currentGeneration !== this.connectionGeneration) return;
          if (this.connectionState === 'idle') return;

          this.handleConnectionTimeout();
          cleanupAndResolve(false);
        };

        this.connectionTimeoutId = setTimeout(handleTimeout, WS_CONNECTION_TIMEOUT_MS);

        const handleOpen = (): void => {
          if (currentGeneration !== this.connectionGeneration) {
            socket.close();
            return;
          }
          if (signal.aborted) {
            socket.close();
            return;
          }
          if (this.connectionState === 'idle') return;

          this.handleOpen();
          cleanupAndResolve(true);
        };

        socket.onopen = handleOpen;
        socket.onmessage = (event) => {
          if (currentGeneration === this.connectionGeneration && !signal.aborted) {
            this.handleMessage(event);
          }
        };
        socket.onerror = (event) => {
          if (currentGeneration === this.connectionGeneration && !signal.aborted) {
            this.handleError(event);
          }
        };
        socket.onclose = (event) => {
          if (currentGeneration === this.connectionGeneration && !signal.aborted) {
            this.handleClose(event);
          }
        };
      } catch (error) {
        logError("Error creating WebSocket:", error);
        this.cleanupSocket();
        useConnectionStore.getState().setConnected(false);
        useGameStore.getState().setError("Failed to create WebSocket connection");
        this.connectionState = 'idle';
        this.connectionLock = null;
        this.pendingResolve = null;
        resolve(false);
      }
    });

    return this.connectionLock;
  }

  private performCleanup(): void {
    this.cleanupHeartbeat();
    this.cleanupConnectionTimeout();
    this.cleanupSocket();
    this.pendingHeartbeatTimestamps.clear();
    this.lastMessageTime = 0;
  }

  private resetConnectionState(): void {
    if (this.pendingResolve) {
      this.pendingResolve(false);
      this.pendingResolve = null;
    }

    this.wasIntentionallyDisconnected = false;
    this.performCleanup();
    this.connectionState = 'idle';
    this.connectionLock = null;
  }

  disconnect(): void {
    this.wasIntentionallyDisconnected = true;
    this.connectionState = 'disconnecting';
    this.connectionLock = null;

    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }

    if (this.reconnectHandler) {
      this.reconnectHandler.destroy();
    }
    this.performCleanup();
    this.connectionGeneration = 0;
    this.connectionState = 'idle';

    if (this.pendingResolve) {
      this.pendingResolve(false);
      this.pendingResolve = null;
    }
    useConnectionStore.getState().setConnected(false);
  }

  private cleanupConnectionTimeout(): void {
    if (this.connectionTimeoutId) {
      clearTimeout(this.connectionTimeoutId);
      this.connectionTimeoutId = null;
    }
  }

  private cleanupSocket(): void {
    this.cleanupConnectionTimeout();
    if (this.socket) {
      this.socket.onopen = null;
      this.socket.onmessage = null;
      this.socket.onerror = null;
      this.socket.onclose = null;

      if (this.socket.readyState === WebSocket.OPEN) {
        this.socket.close(1000, "Client disconnect");
      }

      this.socket = null;
    }
  }

  private cleanupHeartbeat(): void {
    if (this.heartbeatIntervalId) {
      clearInterval(this.heartbeatIntervalId);
      this.heartbeatIntervalId = null;
    }
  }

  sendMessage(message: WebSocketMessage): boolean {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      logError("Cannot send message: WebSocket not connected");
      return false;
    }

    try {
      const messageStr = MessageParser.stringifyMessage(message);
      
      if (messageStr.length > WS_MAX_MESSAGE_SIZE) {
        logError(`Message too large: ${messageStr.length} bytes (max: ${WS_MAX_MESSAGE_SIZE})`);
        return false;
      }
      
      this.socket.send(messageStr);
      return true;
    } catch (error) {
      logError("Error sending message:", error);
      return false;
    }
  }

  sendBetAction(action: BetAction, amount?: number): boolean {
    const token = useConnectionStore.getState().sessionToken;
    if (!token) {
      logError("Cannot send bet action: no session token");
      return false;
    }

    if (amount !== undefined) {
      if (typeof amount !== 'number' || !Number.isFinite(amount)) {
        logError("Cannot send bet action: invalid amount type", amount);
        return false;
      }
      if (!Number.isInteger(amount)) {
        logError("Cannot send bet action: amount must be an integer", amount);
        return false;
      }
      if (amount < 0) {
        logError("Cannot send bet action: negative amount", amount);
        return false;
      }
      if (amount > Number.MAX_SAFE_INTEGER) {
        logError("Cannot send bet action: amount exceeds safe integer range", amount);
        return false;
      }
      
      const gameState = useGameStore.getState().gameState;
      if (gameState && amount > gameState.max_bet) {
        logError("Cannot send bet action: amount exceeds max_bet", { amount, maxBet: gameState.max_bet });
        return false;
      }
    }

    return this.sendMessage({
      type: "bet_action",
      data: { action, ...(amount !== undefined && { amount }) },
      token,
    });
  }

  getStatus(): ConnectionStatusInfo {
    const connectionStore = useConnectionStore.getState();
    return {
      isConnected: connectionStore.isConnected,
      status: connectionStore.status,
      latency: connectionStore.latency,
      sessionToken: connectionStore.sessionToken,
      playerId: connectionStore.playerId,
    };
  }

  getState(): ConnectionState {
    return this.connectionState;
  }

  private handleOpen(): void {
    this.wasIntentionallyDisconnected = false;
    useConnectionStore.getState().setConnected(true);

    this.startHeartbeat();

    const session = SessionManager.getSession();
    if (session) {
      this.sendMessage(MessageParser.createSessionInit(session.token));
    } else {
      this.sendMessage(MessageParser.createSessionInit());
    }

    this.reconnectHandler?.reset();
  }
  
  private handleMessage(event: MessageEvent): void {
    this.lastMessageTime = Date.now();
    useConnectionStore.getState().updateHeartbeat();

    const message = MessageParser.parseMessage(event.data);
    if (!message) {
      useGameStore.getState().setError("Received invalid message from server");
      return;
    }

    if (message.type === "heartbeat") {
      const clientTimestamp = this.pendingHeartbeatTimestamps.get(message.data.timestamp);
      if (clientTimestamp !== undefined) {
        const latency = Date.now() - clientTimestamp;
        useConnectionStore.getState().setLatency(latency);
        this.pendingHeartbeatTimestamps.delete(message.data.timestamp);
      }
      SessionManager.updateSessionExpiry();
      return;
    }

    switch (message.type) {
      case "game_state_update":
        this.handleGameStateUpdate(message);
        break;
      case "error":
        this.handleErrorMessage(message);
        break;
      case "connection_status":
        this.handleConnectionStatus(message);
        break;
    }
  }

  private handleError(event: Event | ErrorEvent): void {
    let errorDetails = 'Unknown WebSocket error';

    if (event instanceof ErrorEvent) {
      const parts: string[] = [];
      if (event.message) parts.push(event.message);
      if (event.filename) parts.push(`(${event.filename}:${event.lineno}:${event.colno})`);
      errorDetails = parts.length > 0 ? parts.join(' ') : 'Unknown ErrorEvent';
    } else if (event instanceof DOMException) {
      errorDetails = `DOMException: ${event.name} - ${event.message}`;
    } else if (event.type === 'error') {
      const target = event.target;
      if (target instanceof WebSocket) {
        const url = target.url || 'unknown';
        const readyState = target.readyState;
        errorDetails = `WebSocket error event (url: ${url}, readyState: ${readyState})`;
      } else {
        errorDetails = 'WebSocket error event';
      }
    }

    logError("WebSocket error:", errorDetails);
    
    if (this.connectionState === 'idle') {
      return;
    }
    
    this.connectionState = 'idle';
    this.connectionLock = null;
    this.pendingHeartbeatTimestamps.clear();
    this.heartbeatCounter = 0;
    this.cleanupHeartbeat();
    this.cleanupConnectionTimeout();
    this.cleanupSocket();
    
    if (this.pendingResolve) {
      this.pendingResolve(false);
      this.pendingResolve = null;
    }
    useConnectionStore.getState().setConnected(false);
    useGameStore.getState().setError("Connection error");
  }
  
  private handleClose(event: CloseEvent): void {
    if (this.connectionState === 'idle') {
      return;
    }
    
    this.connectionState = 'idle';
    useConnectionStore.getState().setConnected(false);
    this.connectionLock = null;
    this.cleanupHeartbeat();
    this.cleanupConnectionTimeout();

    if (this.pendingResolve) {
      this.pendingResolve(false);
      this.pendingResolve = null;
    }

    if (!this.wasIntentionallyDisconnected && this.options.autoReconnect && this.reconnectHandler) {
      if (ReconnectHandler.shouldReconnect(event)) {
        this.reconnectHandler.start();
      }
    }
  }
  
  private handleConnectionTimeout(): void {
    if (this.connectionState === 'idle') {
      return;
    }
    
    logError("WebSocket connection timeout");
    this.connectionState = 'idle';
    this.connectionLock = null;
    this.pendingHeartbeatTimestamps.clear();
    this.heartbeatCounter = 0;
    this.cleanupHeartbeat();
    this.cleanupConnectionTimeout();
    this.cleanupSocket();
    
    if (this.pendingResolve) {
      this.pendingResolve(false);
      this.pendingResolve = null;
    }
    useConnectionStore.getState().setConnected(false);

    if (this.options.autoReconnect && this.reconnectHandler) {
      this.reconnectHandler.start();
    }
  }
  
  private handleGameStateUpdate(message: GameStateUpdateMessage): void {
    if (!message?.data) {
      logError("handleGameStateUpdate: Invalid message structure");
      return;
    }
    useGameStore.getState().setGameState(message.data);
    SessionManager.updateSessionExpiry();
  }
  
  private handleErrorMessage(message: ErrorMessage): void {
    if (!message?.data?.message) {
      logError("handleErrorMessage: Invalid error message structure");
      return;
    }
    
    logError("Server error:", message.data);
    useGameStore.getState().setError(message.data.message);

    switch (message.data.code) {
      case "invalid_token":
        SessionManager.clearSession();
        useConnectionStore.getState().clearSession();
        break;
      case "game_not_active":
        break;
      default:
        logError("Unhandled error code:", message.data.code);
    }
  }
  
  private handleConnectionStatus(message: ConnectionStatusMessage): void {
    useConnectionStore.getState().setStatus(message.data.status);
    if (!message.data.player_id) return;

    const currentToken = useConnectionStore.getState().sessionToken;
    let token = currentToken;

    if (!token) {
      const existingSession = SessionManager.getSession();
      token = existingSession?.token ?? null;
    }

    if (!token) {
      try {
        token = SessionManager.generateToken();
      } catch (error) {
        logError("Failed to generate session token:", error);
        useGameStore.getState().setError("Failed to establish session. Please refresh the page.");
        return;
      }
    }

    useConnectionStore.getState().setSession(token, message.data.player_id);
  }
  
  private startHeartbeat(): void {
    if (this.heartbeatIntervalId) {
      clearInterval(this.heartbeatIntervalId);
    }

    this.lastMessageTime = Date.now();

    const sendHeartbeat = (): void => {
      if (this.connectionState !== 'connected') {
        return;
      }
      if (this.socket?.readyState !== WebSocket.OPEN) {
        return;
      }
      
      this.enforceHeartbeatBounds();
      
      const heartbeatId = this.generateHeartbeatId();
      const clientTimestamp = Date.now();
      this.pendingHeartbeatTimestamps.set(heartbeatId, clientTimestamp);
      const heartbeat = {
        type: "heartbeat" as const,
        data: { timestamp: heartbeatId },
      };
      this.sendMessage(heartbeat);

      if (Date.now() - this.lastMessageTime > WS_HEARTBEAT_TIMEOUT_MS) {
        logError("Connection stale - no message received recently");
        this.handleConnectionTimeout();
      }
    };

    sendHeartbeat();

    this.heartbeatIntervalId = setInterval(sendHeartbeat, this.options.heartbeatInterval);
  }
}