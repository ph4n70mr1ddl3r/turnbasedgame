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
  WS_DEFAULT_URL,
  RECONNECT_MAX_ATTEMPTS,
  RECONNECT_INITIAL_DELAY_MS,
  RECONNECT_MAX_DELAY_MS,
  RECONNECT_BACKOFF_FACTOR,
} from "@/lib/constants/game";

export interface ConnectionOptions {
  url?: string;
  autoReconnect?: boolean;
  reconnectOptions?: ReconnectOptions;
  heartbeatInterval?: number;
}

const DEFAULT_OPTIONS: Required<ConnectionOptions> = {
  url: process.env.NEXT_PUBLIC_WS_URL || WS_DEFAULT_URL,
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
  private connectionResolved = false;
  
  constructor(options: ConnectionOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };

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

          useConnectionStore.getState().setStatus(connectionStatus);
        },
        this.options.reconnectOptions
      );
    }
  }

  async connect(): Promise<boolean> {

    this.disconnect();
    this.connectionResolved = false;
    
    return new Promise((resolve) => {
      try {
        this.socket = new WebSocket(this.options.url);
        
        let timeoutId: ReturnType<typeof setTimeout> | null = null;
        
        const handleTimeout = () => {
          if (!this.connectionResolved && this.socket?.readyState !== WebSocket.OPEN) {
            this.connectionResolved = true;
            this.handleConnectionTimeout();
            resolve(false);
          }
        };
        
        timeoutId = setTimeout(handleTimeout, WS_CONNECTION_TIMEOUT_MS);
        
        const handleOpen = () => {
          if (this.connectionResolved) {
            return;
          }
          this.connectionResolved = true;
          if (timeoutId !== null) {
            clearTimeout(timeoutId);
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
        useConnectionStore.getState().setConnected(false);
        this.connectionResolved = true;
        resolve(false);
      }
    });
  }

  disconnect(): void {
    // Stop reconnection attempts
    this.reconnectHandler?.stop();
    
    // Clear heartbeat
    if (this.heartbeatIntervalId) {
      clearInterval(this.heartbeatIntervalId);
      this.heartbeatIntervalId = null;
    }
    
    // Close socket
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

    useConnectionStore.getState().setConnected(false);
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
    useConnectionStore.getState().updateHeartbeat();

    const message = MessageParser.parseMessage(event.data);
    if (!message) return;

    // Update latency for heartbeat messages
    if (message.type === "heartbeat") {
      const latency = Date.now() - message.data.timestamp;
      useConnectionStore.getState().setLatency(latency);
      return;
    }

    // Handle different message types
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
      default:
        break;
    }
  }

  private handleError(event: Event): void {
    logError("WebSocket error:", event);
    useGameStore.getState().setError("Connection error");
  }
  
  private handleClose(event: CloseEvent): void {
    useConnectionStore.getState().setConnected(false);

    // Clear heartbeat
    if (this.heartbeatIntervalId) {
      clearInterval(this.heartbeatIntervalId);
      this.heartbeatIntervalId = null;
    }

    // Handle reconnection
    if (this.options.autoReconnect && this.reconnectHandler) {
      if (ReconnectHandler.shouldReconnect(event)) {
        this.reconnectHandler.start();
      }
    }
  }
  
  private handleConnectionTimeout(): void {
    logError("WebSocket connection timeout");
    this.disconnect();

    if (this.options.autoReconnect && this.reconnectHandler) {
      this.reconnectHandler.start();
    }
  }
  
  private handleGameStateUpdate(message: GameStateUpdateMessage): void {
    useGameStore.getState().setGameState(message.data);

    if (!useConnectionStore.getState().sessionToken && message.data.players.length > 0) {
      const myPlayer = useGameStore.getState().getMyPlayer();
      if (myPlayer) {
        try {
          const token = SessionManager.generateToken();
          useConnectionStore.getState().setSession(token, myPlayer.player_id);
        } catch (error) {
          logError("Failed to generate session token:", error);
        }
      }
    }
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
      }
    }
  }
  
  private startHeartbeat(): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      const heartbeat = MessageParser.createHeartbeat();
      this.sendMessage(heartbeat);
    }

    if (this.heartbeatIntervalId) {
      clearInterval(this.heartbeatIntervalId);
    }

    this.heartbeatIntervalId = setInterval(() => {
      if (this.socket?.readyState === WebSocket.OPEN) {
        const heartbeat = MessageParser.createHeartbeat();
        this.sendMessage(heartbeat);
      }
    }, this.options.heartbeatInterval);
  }
}