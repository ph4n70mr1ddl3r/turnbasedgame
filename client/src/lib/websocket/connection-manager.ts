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

export class ConnectionManager {
  private socket: WebSocket | null = null;
  private options: Required<ConnectionOptions>;
  private reconnectHandler: ReconnectHandler | null = null;
  private heartbeatIntervalId: ReturnType<typeof setInterval> | null = null;
  private connectionTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private connectionResolved = false;
  private connectionLock: Promise<boolean> | null = null;
  private wasIntentionallyDisconnected = false;
  private connectionGeneration = 0;
  private pendingHeartbeatTimestamps: Map<number, number> = new Map();
  private lastMessageTime = 0;
  private pendingResolve: ((value: boolean) => void) | null = null;
  private storeUpdateLock: Promise<void> | null = null;
  
  constructor(options: ConnectionOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };

    if (!this.validateWebSocketUrl(this.options.url)) {
      throw new Error(`Invalid WebSocket URL: ${this.options.url}`);
    }

    if (this.options.autoReconnect) {
      this.reconnectHandler = new ReconnectHandler(
        () => this.connect(),
        (state: ReconnectState) => {
          let connectionStatus: ConnectionStatus;

          if (state === "connected") {
            connectionStatus = "connected";
          } else if (state === "disconnected" || state === "stopped" || state === "failed") {
            connectionStatus = "disconnected";
          } else {
            connectionStatus = "reconnecting";
          }

          this.safeStoreUpdate(() => {
            useConnectionStore.getState().setStatus(connectionStatus);
          });
        },
        this.options.reconnectOptions
      );
    }
  }

  private safeStoreUpdate(updateFn: () => void): void {
    if (this.storeUpdateLock) {
      this.storeUpdateLock.then(updateFn);
    } else {
      updateFn();
    }
  }

  private enforceHeartbeatBounds(): void {
    while (this.pendingHeartbeatTimestamps.size > WS_MAX_PENDING_HEARTBEATS) {
      const oldestKey = this.pendingHeartbeatTimestamps.keys().next().value;
      if (oldestKey !== undefined) {
        this.pendingHeartbeatTimestamps.delete(oldestKey);
      } else {
        break;
      }
    }
  }

  private validateWebSocketUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      if (!['ws:', 'wss:'].includes(parsed.protocol)) {
        return false;
      }
      if (process.env.NODE_ENV === 'production' && parsed.protocol !== 'wss:') {
        logError('WebSocket must use wss:// in production');
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
    if (this.connectionLock) {
      return this.connectionLock;
    }

    if (this.pendingResolve) {
      this.pendingResolve(false);
      this.pendingResolve = null;
    }

    this.connectionGeneration++;
    const currentGeneration = this.connectionGeneration;
    this.cleanupSocket();
    this.connectionResolved = false;

    this.connectionLock = new Promise((resolve) => {
      this.pendingResolve = resolve;
      
      try {
        this.socket = new WebSocket(this.options.url);

        const handleTimeout = (): void => {
          if (!this.connectionResolved && this.socket?.readyState !== WebSocket.OPEN) {
            this.connectionResolved = true;
            this.connectionLock = null;
            this.connectionTimeoutId = null;
            this.pendingResolve = null;
            this.handleConnectionTimeout();
            resolve(false);
          }
        };

        this.connectionTimeoutId = setTimeout(handleTimeout, WS_CONNECTION_TIMEOUT_MS);

        const handleOpen = (): void => {
          if (this.connectionGeneration !== currentGeneration) {
            this.socket?.close();
            return;
          }
          if (this.connectionResolved) {
            return;
          }
          this.connectionResolved = true;
          this.connectionLock = null;
          this.pendingResolve = null;
          if (this.connectionTimeoutId !== null) {
            clearTimeout(this.connectionTimeoutId);
            this.connectionTimeoutId = null;
          }
          this.handleOpen();
          resolve(true);
        };

        this.socket.onopen = handleOpen;
        this.socket.onmessage = (event) => this.handleMessage(event);
        this.socket.onerror = (event) => this.handleError(event);
        this.socket.onclose = (event) => this.handleClose(event);
      } catch (error) {
        logError("Error creating WebSocket:", error);
        this.cleanupSocket();
        useConnectionStore.getState().setConnected(false);
        useGameStore.getState().setError("Failed to create WebSocket connection");
        this.connectionResolved = true;
        this.connectionLock = null;
        this.pendingResolve = null;
        resolve(false);
      }
    });

    return this.connectionLock;
  }

  disconnect(): void {
    this.wasIntentionallyDisconnected = true;
    this.connectionLock = null;
    this.connectionResolved = true;
    this.reconnectHandler?.stop();
    this.cleanupHeartbeat();
    this.cleanupConnectionTimeout();
    this.cleanupSocket();
    this.pendingHeartbeatTimestamps.clear();
    this.lastMessageTime = 0;
    this.connectionGeneration = 0;
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
      if (typeof amount !== 'number' || !Number.isFinite(amount) || isNaN(amount)) {
        logError("Cannot send bet action: invalid amount type", amount);
        return false;
      }
      if (amount < 0) {
        logError("Cannot send bet action: negative amount", amount);
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

  private handleOpen(): void {
    this.wasIntentionallyDisconnected = false;
    useConnectionStore.getState().setConnected(true);

    // Start heartbeat
    this.startHeartbeat();

    // Send session init message
    const session = SessionManager.getSession();
    if (session) {
      // Reconnection with existing token
      this.sendMessage(MessageParser.createSessionInit(session.token));
    } else {
      // New session
      this.sendMessage(MessageParser.createSessionInit());
    }

    // Reset reconnection handler
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

  private handleError(event: Event): void {
    const errorEvent = event as ErrorEvent;
    const errorDetails = errorEvent.message 
      ? `${errorEvent.message}${errorEvent.filename ? ` (${errorEvent.filename}:${errorEvent.lineno}:${errorEvent.colno})` : ''}`
      : 'Unknown WebSocket error';
    logError("WebSocket error:", errorDetails);
    this.connectionLock = null;
    useGameStore.getState().setError("Connection error");
  }
  
  private handleClose(event: CloseEvent): void {
    const wasConnecting = this.connectionLock !== null;
    useConnectionStore.getState().setConnected(false);
    this.connectionLock = null;
    this.cleanupHeartbeat();
    this.cleanupConnectionTimeout();

    if (wasConnecting && this.pendingResolve) {
      this.connectionResolved = true;
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
    logError("WebSocket connection timeout");
    this.connectionLock = null;
    this.connectionResolved = true;
    this.cleanupHeartbeat();
    this.cleanupConnectionTimeout();
    this.cleanupSocket();
    this.pendingHeartbeatTimestamps.clear();
    this.lastMessageTime = 0;
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
    useGameStore.getState().setGameState(message.data);
    SessionManager.updateSessionExpiry();
  }
  
  private handleErrorMessage(message: ErrorMessage): void {
    logError("Server error:", message.data);
    useGameStore.getState().setError(message.data.message);

    // Handle specific error codes
    switch (message.data.code) {
      case "invalid_token":
        SessionManager.clearSession();
        useConnectionStore.getState().clearSession();
        break;
      case "game_not_active":
        // Maybe show game lobby
        break;
    }
  }
  
  private handleConnectionStatus(message: ConnectionStatusMessage): void {
    useConnectionStore.getState().setStatus(message.data.status);
    if (message.data.player_id) {
      const currentToken = useConnectionStore.getState().sessionToken;
      if (currentToken) {
        useConnectionStore.getState().setSession(currentToken, message.data.player_id);
      } else if (SessionManager.isValidSession()) {
        const existingSession = SessionManager.getSession();
        if (existingSession) {
          useConnectionStore.getState().setSession(existingSession.token, message.data.player_id);
        }
      } else {
        try {
          const token = SessionManager.generateToken();
          useConnectionStore.getState().setSession(token, message.data.player_id);
        } catch (error) {
          logError("Failed to generate session token:", error);
          useGameStore.getState().setError("Failed to establish session. Please refresh the page.");
        }
      }
    }
  }
  
  private startHeartbeat(): void {
    if (this.heartbeatIntervalId) {
      clearInterval(this.heartbeatIntervalId);
    }

    this.lastMessageTime = Date.now();

    const cleanupStaleHeartbeats = (): void => {
      const now = Date.now();
      for (const [id, timestamp] of this.pendingHeartbeatTimestamps) {
        if (now - timestamp > WS_HEARTBEAT_TIMEOUT_MS) {
          this.pendingHeartbeatTimestamps.delete(id);
        }
      }
      while (this.pendingHeartbeatTimestamps.size > WS_MAX_PENDING_HEARTBEATS) {
        const oldestKey = this.pendingHeartbeatTimestamps.keys().next().value;
        if (oldestKey !== undefined) {
          this.pendingHeartbeatTimestamps.delete(oldestKey);
        }
      }
    };

    const sendHeartbeat = (): void => {
      if (this.socket?.readyState === WebSocket.OPEN) {
        cleanupStaleHeartbeats();
        
        const clientTimestamp = Date.now();
        const heartbeatId = clientTimestamp;
        this.enforceHeartbeatBounds();
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
      }
    };

    sendHeartbeat();

    this.heartbeatIntervalId = setInterval(sendHeartbeat, this.options.heartbeatInterval);
  }
}