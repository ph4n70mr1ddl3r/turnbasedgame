/**
 * Enhanced WebSocket connection manager with improved error handling,
 * performance monitoring, security features, and resilience.
 */

import { MessageParser } from "./message-parser";
import { ReconnectHandler, ReconnectOptions, ReconnectState } from "./reconnect-handler";
import { SessionManager } from "./session-manager";
import { useConnectionStore } from "@/lib/stores/connection-store";
import { useGameStore } from "@/lib/stores/game-store";
import { 
  WebSocketMessage, 
  GameStateUpdateMessage, 
  ErrorMessage, 
  BetAction, 
  ConnectionStatus, 
  ConnectionStatusInfo, 
  ConnectionStatusMessage, 
  isValidBetAction, 
  ERROR_CODES 
} from "@/types/game-types";
import { 
  createAppError, 
  handleError, 
  ErrorCategory, 
  ErrorSeverity,
  ErrorRecovery 
} from "@/lib/utils/enhanced-error-handling";
import { globalPerformanceMonitor, MetricCategory } from "@/lib/utils/performance-monitor-enhanced";
import { logError, logWarn, logInfo } from "@/lib/utils/logger";

// Configuration constants
const WS_CONFIG = {
  CONNECTION_TIMEOUT_MS: 10000,
  HEARTBEAT_INTERVAL_MS: 30000,
  HEARTBEAT_TIMEOUT_MS: 45000,
  DEFAULT_URL: process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8080',
  RECONNECT_MAX_ATTEMPTS: 10,
  RECONNECT_INITIAL_DELAY_MS: 1000,
  RECONNECT_MAX_DELAY_MS: 30000,
  RECONNECT_BACKOFF_FACTOR: 2,
  MAX_PENDING_HEARTBEATS: 10,
  MAX_MESSAGE_SIZE: 64 * 1024,
  MAX_RATE_LIMIT_REQUESTS: 100,
  RATE_LIMIT_WINDOW_MS: 60000,
  CLEANUP_INTERVAL_MS: 300000, // 5 minutes
  PERFORMANCE_THRESHOLDS: {
    SLOW_CONNECTION: 5000,
    SLOW_MESSAGE: 1000,
    HIGH_LATENCY: 1000,
    CONNECTION_ATTEMPTS_WARNING: 5,
  },
};

/**
 * Enhanced rate limiter with better performance and monitoring
 */
class EnhancedRateLimiter {
  private timestamps: number[] = [];
  private maxRequests: number;
  private windowMs: number;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(maxRequests: number, windowMs: number) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
    this.startCleanup();
  }

  canProceed(): boolean {
    const now = Date.now();
    const cutoff = now - this.windowMs;
    
    // Remove old timestamps efficiently
    this.timestamps = this.timestamps.filter(t => t > cutoff);
    
    if (this.timestamps.length >= this.maxRequests) {
      globalPerformanceMonitor.trackError('rate_limit_exceeded', 1);
      return false;
    }
    
    this.timestamps.push(now);
    return true;
  }

  reset(): void {
    this.timestamps = [];
  }

  getRemainingRequests(): number {
    const now = Date.now();
    const cutoff = now - this.windowMs;
    const recentRequests = this.timestamps.filter(t => t > cutoff);
    return Math.max(0, this.maxRequests - recentRequests.length);
  }

  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      const cutoff = now - this.windowMs;
      this.timestamps = this.timestamps.filter(t => t > cutoff);
    }, WS_CONFIG.CLEANUP_INTERVAL_MS);
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

/**
 * Enhanced connection manager with comprehensive error handling and monitoring
 */
export interface ConnectionOptions {
  url?: string;
  autoReconnect?: boolean;
  reconnectOptions?: ReconnectOptions;
  heartbeatInterval?: number;
  maxRetries?: number;
  timeout?: number;
}

const DEFAULT_OPTIONS: Required<ConnectionOptions> = {
  url: WS_CONFIG.DEFAULT_URL,
  autoReconnect: true,
  reconnectOptions: {
    maxAttempts: WS_CONFIG.RECONNECT_MAX_ATTEMPTS,
    initialDelay: WS_CONFIG.RECONNECT_INITIAL_DELAY_MS,
    maxDelay: WS_CONFIG.RECONNECT_MAX_DELAY_MS,
    backoffFactor: WS_CONFIG.RECONNECT_BACKOFF_FACTOR,
    jitter: true,
  },
  heartbeatInterval: WS_CONFIG.HEARTBEAT_INTERVAL_MS,
  maxRetries: 3,
  timeout: WS_CONFIG.CONNECTION_TIMEOUT_MS,
};

export type ConnectionState = 'idle' | 'connecting' | 'connected' | 'disconnecting' | 'error';

export class EnhancedConnectionManager {
  private socket: WebSocket | null = null;
  private options: Required<ConnectionOptions>;
  private reconnectHandler: ReconnectHandler | null = null;
  private heartbeatIntervalId: NodeJS.Timeout | null = null;
  private connectionTimeoutId: NodeJS.Timeout | null = null;
  private connectionState: ConnectionState = 'idle';
  private connectionLock: Promise<boolean> | null = null;
  private wasIntentionallyDisconnected = false;
  private connectionGeneration = 0;
  private pendingHeartbeatTimestamps: Map<number, number> = new Map();
  private lastMessageTime = 0;
  private pendingResolve: ((value: boolean) => void) | null = null;
  private abortController: AbortController | null = null;
  private heartbeatCounter = 0;
  private readonly rateLimiter: EnhancedRateLimiter;
  private connectionStartTime = 0;
  private messageCount = 0;
  private errorCount = 0;
  private lastErrorTime = 0;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private performanceInterval: NodeJS.Timeout | null = null;

  constructor(options: ConnectionOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };

    // Validate options
    this.validateOptions();

    // Initialize rate limiter
    this.rateLimiter = new EnhancedRateLimiter(
      WS_CONFIG.MAX_RATE_LIMIT_REQUESTS,
      WS_CONFIG.RATE_LIMIT_WINDOW_MS
    );

    // Initialize reconnect handler if auto-reconnect is enabled
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

    // Start periodic cleanup
    this.startPeriodicCleanup();

    // Start performance monitoring
    this.startPerformanceMonitoring();
  }

  /**
   * Validate connection options
   */
  private validateOptions(): void {
    if (!this.validateWebSocketUrl(this.options.url)) {
      throw createAppError(
        'InvalidWebSocketUrl',
        `Invalid WebSocket URL: ${this.options.url}`,
        ErrorCategory.NETWORK,
        { details: { url: this.options.url } }
      );
    }

    if (this.options.reconnectOptions.maxAttempts <= 0) {
      throw createAppError(
        'InvalidReconnectAttempts',
        'Reconnect attempts must be positive',
        ErrorCategory.VALIDATION,
        { details: { maxAttempts: this.options.reconnectOptions.maxAttempts } }
      );
    }

    if (this.options.heartbeatInterval <= 0) {
      throw createAppError(
        'InvalidHeartbeatInterval',
        'Heartbeat interval must be positive',
        ErrorCategory.VALIDATION,
        { details: { heartbeatInterval: this.options.heartbeatInterval } }
      );
    }
  }

  /**
   * Validate WebSocket URL
   */
  private validateWebSocketUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      if (!['ws:', 'wss:'].includes(parsed.protocol)) {
        return false;
      }

      if (process.env.NODE_ENV === 'production' && parsed.protocol !== 'wss:') {
        const error = createAppError(
          'InsecureWebSocket',
          'WebSocket must use wss:// protocol in production',
          ErrorCategory.NETWORK,
          { details: { url, protocol: parsed.protocol } }
        );
        logError('Security error:', error);
        return false;
      }

      const localhostHosts = ['localhost', '127.0.0.1', '::1', '[::1]'];
      if (parsed.protocol === 'ws:' && !localhostHosts.includes(parsed.hostname)) {
        const error = createAppError(
          'InsecureWebSocket',
          'Non-secure WebSocket (ws://) only allowed on localhost',
          ErrorCategory.NETWORK,
          { details: { url, hostname: parsed.hostname } }
        );
        logError('Security error:', error);
        return false;
      }

      return true;
    } catch (error) {
      const appError = handleError(error, {
        category: ErrorCategory.NETWORK,
        component: 'ConnectionManager',
        action: 'validateWebSocketUrl',
      });
      logError('Failed to parse WebSocket URL:', appError);
      return false;
    }
  }

  /**
   * Generate unique heartbeat ID
   */
  private generateHeartbeatId(): number {
    this.enforceHeartbeatBounds();
    this.heartbeatCounter = (this.heartbeatCounter + 1) & 0xFFFF;
    return (Date.now() & 0xFFFF0000) | this.heartbeatCounter;
  }

  /**
   * Enforce heartbeat bounds to prevent memory leaks
   */
  private enforceHeartbeatBounds(): void {
    const now = Date.now();
    const entriesToDelete: number[] = [];
    
    for (const [id, timestamp] of this.pendingHeartbeatTimestamps) {
      if (now - timestamp > WS_CONFIG.HEARTBEAT_TIMEOUT_MS) {
        entriesToDelete.push(id);
      }
    }
    
    for (const id of entriesToDelete) {
      this.pendingHeartbeatTimestamps.delete(id);
    }
    
    // Limit pending heartbeats to prevent memory issues
    while (this.pendingHeartbeatTimestamps.size > WS_CONFIG.MAX_PENDING_HEARTBEATS) {
      const oldestKey = this.pendingHeartbeatTimestamps.keys().next().value;
      if (oldestKey !== undefined) {
        this.pendingHeartbeatTimestamps.delete(oldestKey);
      } else {
        break;
      }
    }
  }

  /**
   * Connect to WebSocket server with enhanced error handling
   */
  async connect(): Promise<boolean> {
    // If already connecting, piggyback on the in-flight connection attempt
    if (this.connectionLock && this.connectionState === 'connecting') {
      return this.connectionLock;
    }

    // Bump generation to invalidate any in-flight handlers from prior attempts
    this.connectionGeneration++;
    const currentGeneration = this.connectionGeneration;

    // Tear down any lingering state from a previous connection
    if (this.connectionLock) {
      this.resetConnectionState();
    }

    if (this.socket) {
      this.cleanupSocket();
    }

    if (this.abortController) {
      this.abortController.abort();
    }
    this.abortController = new AbortController();
    const signal = this.abortController.signal;

    this.connectionState = 'connecting';
    this.connectionStartTime = performance.now();

    // Track connection attempt
    globalPerformanceMonitor.trackCustomMetric(
      'connection_attempt',
      1,
      'count',
      { generation: currentGeneration }
    );

    this.connectionLock = new Promise((resolve) => {
      this.pendingResolve = resolve;

      if (signal.aborted) {
        this.connectionState = 'idle';
        this.connectionLock = null;
        this.pendingResolve = null;
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
          
          const connectionTime = performance.now() - this.connectionStartTime;
          globalPerformanceMonitor.trackCustomMetric(
            'connection_time',
            connectionTime,
            'ms',
            { 
              success: result,
              generation: currentGeneration,
              previousState: this.connectionState 
            }
          );

          if (connectionTime > WS_CONFIG.PERFORMANCE_THRESHOLDS.SLOW_CONNECTION) {
            logWarn(`Slow connection detected: ${connectionTime.toFixed(2)}ms`);
          }

          resolve(result);
        };

        const handleTimeout = (): void => {
          if (currentGeneration !== this.connectionGeneration) return;
          if (this.connectionState === 'idle') return;

          this.handleConnectionTimeout();
          cleanupAndResolve(false);
        };

        this.connectionTimeoutId = setTimeout(handleTimeout, this.options.timeout);

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
        const appError = handleError(error, {
          category: ErrorCategory.NETWORK,
          component: 'ConnectionManager',
          action: 'connect',
          details: { url: this.options.url }
        });
        
        logError("Error creating WebSocket:", appError);
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

  /**
   * Handle WebSocket open event
   */
  private handleOpen(): void {
    const connectionTime = performance.now() - this.connectionStartTime;
    
    this.wasIntentionallyDisconnected = false;
    useConnectionStore.getState().setConnected(true);

    // Log successful connection with performance metrics
    logInfo(`WebSocket connected in ${connectionTime.toFixed(2)}ms`, {
      url: this.options.url,
      connectionTime,
      generation: this.connectionGeneration
    });

    this.startHeartbeat();

    const session = SessionManager.getSession();
    if (session) {
      this.sendMessage(MessageParser.createSessionInit(session.token));
    } else {
      this.sendMessage(MessageParser.createSessionInit());
    }

    this.reconnectHandler?.reset();
    this.errorCount = 0; // Reset error count on successful connection
  }

  /**
   * Handle WebSocket message event
   */
  private handleMessage(event: MessageEvent): void {
    const startTime = performance.now();
    this.messageCount++;
    this.lastMessageTime = performance.now();

    // Update heartbeat for connection health
    useConnectionStore.getState().updateHeartbeat();

    try {
      const message = MessageParser.parseMessage(event.data);
      if (!message) {
        const error = createAppError(
          'InvalidMessage',
          'Received invalid message from server',
          ErrorCategory.VALIDATION,
          { details: { data: event.data } }
        );
        useGameStore.getState().setError("Received invalid message from server");
        return;
      }

      if (message.type === "heartbeat") {
        this.handleHeartbeatMessage(message);
      } else {
        this.handleStructuredMessage(message);
      }

      // Track message processing performance
      const processingTime = performance.now() - startTime;
      if (processingTime > WS_CONFIG.PERFORMANCE_THRESHOLDS.SLOW_MESSAGE) {
        logWarn(`Slow message processing: ${processingTime.toFixed(2)}ms for ${message.type}`);
      }

    } catch (error) {
      const appError = handleError(error, {
        category: ErrorCategory.NETWORK,
        component: 'ConnectionManager',
        action: 'handleMessage',
        details: { messageData: event.data }
      });
      
      logError("Error handling WebSocket message:", appError);
      useGameStore.getState().setError("Error processing message from server");
    }
  }

  /**
   * Handle heartbeat message
   */
  private handleHeartbeatMessage(message: any): void {
    const clientTimestamp = this.pendingHeartbeatTimestamps.get(message.data.timestamp);
    if (clientTimestamp !== undefined) {
      const latency = Date.now() - clientTimestamp;
      useConnectionStore.getState().setLatency(latency);
      
      // Track latency performance
      if (latency > WS_CONFIG.PERFORMANCE_THRESHOLDS.HIGH_LATENCY) {
        logWarn(`High latency detected: ${latency}ms`);
      }
      
      this.pendingHeartbeatTimestamps.delete(message.data.timestamp);
    }
    SessionManager.updateSessionExpiry();
  }

  /**
   * Handle structured message types
   */
  private handleStructuredMessage(message: any): void {
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

  /**
   * Handle game state update
   */
  private handleGameStateUpdate(message: GameStateUpdateMessage): void {
    if (!message?.data) {
      const error = createAppError(
        'InvalidGameState',
        'Invalid game state update received',
        ErrorCategory.GAME_STATE,
        { details: { message } }
      );
      logError('handleGameStateUpdate: Invalid message structure', error);
      return;
    }
    
    try {
      useGameStore.getState().setGameState(message.data);
      SessionManager.updateSessionExpiry();
    } catch (error) {
      const appError = handleError(error, {
        category: ErrorCategory.GAME_STATE,
        component: 'ConnectionManager',
        action: 'handleGameStateUpdate',
      });
      
      logError('Error handling game state update:', appError);
      useGameStore.getState().setError("Failed to update game state");
    }
  }

  /**
   * Handle error message
   */
  private handleErrorMessage(message: ErrorMessage): void {
    if (!message?.data?.message) {
      const error = createAppError(
        'InvalidError',
        'Invalid error message received',
        ErrorCategory.NETWORK,
        { details: { message } }
      );
      logError('handleErrorMessage: Invalid error message structure', error);
      return;
    }
    
    const errorData = message.data;
    logError("Server error:", errorData);
    useGameStore.getState().setError(errorData.message);

    switch (errorData.code) {
      case ERROR_CODES.INVALID_TOKEN:
      case ERROR_CODES.UNAUTHORIZED:
        this.handleAuthError();
        break;
      case ERROR_CODES.GAME_NOT_ACTIVE:
        break;
      default:
        logError("Unhandled error code:", errorData.code);
    }
  }

  /**
   * Handle authentication errors
   */
  private handleAuthError(): void {
    try {
      SessionManager.clearSession();
      useConnectionStore.getState().clearSession();
      useGameStore.getState().setError("Session expired. Please reconnect.");
      
      // Force reconnection
      this.wasIntentionallyDisconnected = true;
      this.disconnect();
      
      // Attempt to reconnect after a short delay
      setTimeout(() => {
        this.connect();
      }, 1000);
    } catch (error) {
      const appError = handleError(error, {
        category: ErrorCategory.AUTHENTICATION,
        component: 'ConnectionManager',
        action: 'handleAuthError',
      });
      
      logError('Error handling authentication error:', appError);
    }
  }

  /**
   * Handle connection status message
   */
  private handleConnectionStatus(message: ConnectionStatusMessage): void {
    useConnectionStore.getState().setStatus(message.data.status);
    
    if (!message.data.player_id) return;

    // Determine token with priority: server-provided > client-generated > new
    let token = message.data.token ?? null;

    if (!token) {
      const currentToken = useConnectionStore.getState().sessionToken;
      token = currentToken;
    }

    if (!token) {
      const existingSession = SessionManager.getSession();
      token = existingSession?.token ?? null;
    }

    if (!token) {
      try {
        token = SessionManager.generateToken();
      } catch (error) {
        const appError = handleError(error, {
          category: ErrorCategory.SESSION,
          component: 'ConnectionManager',
          action: 'handleConnectionStatus',
        });
        
        logError("Failed to generate session token:", appError);
        useGameStore.getState().setError("Failed to establish session. Please refresh the page.");
        return;
      }
    }

    useConnectionStore.getState().setSession(token, message.data.player_id);
  }

  /**
   * Handle WebSocket error event
   */
  private handleError(event: Event | ErrorEvent): void {
    this.errorCount++;
    this.lastErrorTime = Date.now();

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

    // Log error with severity based on error count
    const severity = this.errorCount > 5 ? ErrorSeverity.HIGH : ErrorSeverity.MEDIUM;
    const error = createAppError(
      'WebSocketError',
      `WebSocket error: ${errorDetails}`,
      ErrorCategory.NETWORK,
      { 
        details: { errorDetails, errorCount: this.errorCount },
        severity 
      }
    );

    logError('WebSocket error:', error);
    
    if (severity === ErrorSeverity.HIGH) {
      useGameStore.getState().setError("Connection error");
    }

    this.handleConnectionFailure(`WebSocket error: ${errorDetails}`, true);
  }

  /**
   * Handle WebSocket close event
   */
  private handleClose(event: CloseEvent): void {
    if (this.connectionState === 'idle') {
      return;
    }
    
    const shouldReconnect = !this.wasIntentionallyDisconnected && 
      this.options.autoReconnect && 
      ReconnectHandler.shouldReconnect(event);
    
    this.handleConnectionFailure("WebSocket closed", shouldReconnect);
  }

  /**
   * Handle connection timeout
   */
  private handleConnectionTimeout(): void {
    if (this.connectionState === 'idle') {
      return;
    }
    
    const error = createAppError(
      'ConnectionTimeout',
      'WebSocket connection timeout',
      ErrorCategory.NETWORK,
      { details: { timeout: this.options.timeout } }
    );
    
    logError('Connection timeout:', error);
    this.handleConnectionFailure("WebSocket connection timeout", true);
  }

  /**
   * Handle connection failure with recovery
   */
  private handleConnectionFailure(error: string, shouldReconnect: boolean = false): void {
    const currentGeneration = this.connectionGeneration;
    
    if (this.connectionState === 'idle') {
      return;
    }
    
    logError(error);
    
    const wasConnecting = this.connectionState === 'connecting';
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
    
    if (currentGeneration === this.connectionGeneration) {
      useConnectionStore.getState().setConnected(false);
      
      if (shouldReconnect && this.options.autoReconnect && this.reconnectHandler && !wasConnecting) {
        this.reconnectHandler.start();
      }
    }
  }

  /**
   * Send WebSocket message with enhanced error handling
   */
  sendMessage(message: WebSocketMessage): boolean {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      const error = createAppError(
        'NotConnected',
        'Cannot send message: WebSocket not connected',
        ErrorCategory.NETWORK,
        { details: { message } }
      );
      logError('Cannot send message: WebSocket not connected', error);
      return false;
    }

    // Rate limiting
    if (!this.rateLimiter.canProceed()) {
      const error = createAppError(
        'RateLimitExceeded',
        'Rate limit exceeded - too many messages',
        ErrorCategory.RATE_LIMIT,
        { details: { messageCount: this.messageCount } }
      );
      logError('Rate limit exceeded - too many messages', error);
      return false;
    }

    try {
      const messageStr = MessageParser.stringifyMessage(message);
      
      if (messageStr.length > WS_CONFIG.MAX_MESSAGE_SIZE) {
        const error = createAppError(
          'MessageTooLarge',
          `Message too large: ${messageStr.length} bytes (max: ${WS_CONFIG.MAX_MESSAGE_SIZE})`,
          ErrorCategory.VALIDATION,
          { details: { messageLength: messageStr.length, maxLength: WS_CONFIG.MAX_MESSAGE_SIZE } }
        );
        logError('Message too large', error);
        return false;
      }
      
      const startTime = performance.now();
      this.socket.send(messageStr);
      const sendTime = performance.now() - startTime;
      
      // Track message send performance
      globalPerformanceMonitor.trackCustomMetric(
        'message_send_time',
        sendTime,
        'ms',
        { messageType: message.type }
      );
      
      return true;
    } catch (error) {
      const appError = handleError(error, {
        category: ErrorCategory.NETWORK,
        component: 'ConnectionManager',
        action: 'sendMessage',
        details: { messageType: message.type }
      });
      
      logError('Error sending message:', appError);
      return false;
    }
  }

  /**
   * Send bet action with enhanced validation
   */
  sendBetAction(action: BetAction, amount?: number): boolean {
    const token = useConnectionStore.getState().sessionToken;
    if (!token) {
      const error = createAppError(
        'NoToken',
        'Cannot send bet action: no session token',
        ErrorCategory.AUTHENTICATION,
        { details: { action, amount } }
      );
      logError('Cannot send bet action: no session token', error);
      return false;
    }

    if (!isValidBetAction(action)) {
      const error = createAppError(
        'InvalidAction',
        'Cannot send bet action: invalid action',
        ErrorCategory.VALIDATION,
        { details: { action, amount } }
      );
      logError('Cannot send bet action: invalid action', error);
      return false;
    }

    if (amount !== undefined) {
      if (typeof amount !== 'number' || !Number.isFinite(amount)) {
        const error = createAppError(
          'InvalidAmount',
          'Cannot send bet action: invalid amount type',
          ErrorCategory.VALIDATION,
          { details: { action, amount, type: typeof amount } }
        );
        logError('Cannot send bet action: invalid amount type', error);
        return false;
      }
      if (!Number.isInteger(amount)) {
        const error = createAppError(
          'InvalidAmount',
          'Cannot send bet action: amount must be an integer',
          ErrorCategory.VALIDATION,
          { details: { action, amount, type: typeof amount } }
        );
        logError('Cannot send bet action: amount must be an integer', error);
        return false;
      }
      if (amount < 0) {
        const error = createAppError(
          'InvalidAmount',
          'Cannot send bet action: negative amount',
          ErrorCategory.VALIDATION,
          { details: { action, amount } }
        );
        logError('Cannot send bet action: negative amount', error);
        return false;
      }

      // Validate raise amount against game state bounds
      const gameState = useGameStore.getState().gameState;
      if (gameState) {
        if (amount > gameState.max_bet) {
          const error = createAppError(
            'InvalidAmount',
            'Cannot send bet action: amount exceeds max_bet',
            ErrorCategory.VALIDATION,
            { details: { action, amount, maxBet: gameState.max_bet } }
          );
          logError('Cannot send bet action: amount exceeds max_bet', error);
          return false;
        }
        if (amount < gameState.min_bet) {
          const error = createAppError(
            'InvalidAmount',
            'Cannot send bet action: amount below min_bet',
            ErrorCategory.VALIDATION,
            { details: { action, amount, minBet: gameState.min_bet } }
          );
          logError('Cannot send bet action: amount below min_bet', error);
          return false;
        }
      }
    }

    return this.sendMessage({
      type: "bet_action",
      data: { action, ...(amount !== undefined && { amount }) },
      token,
    });
  }

  /**
   * Get connection status with enhanced metrics
   */
  getStatus(): ConnectionStatusInfo {
    const connectionStore = useConnectionStore.getState();
    const now = Date.now();
    
    return {
      isConnected: connectionStore.isConnected,
      status: connectionStore.status,
      latency: connectionStore.latency,
      sessionToken: connectionStore.sessionToken,
      playerId: connectionStore.playerId,
    };
  }

  /**
   * Get connection state with additional metrics
   */
  getState(): ConnectionState & {
    messageCount: number;
    errorCount: number;
    connectionTime?: number;
    lastErrorTime?: number;
    remainingRateLimit: number;
  } {
    const state = {
      connectionState: this.connectionState,
      messageCount: this.messageCount,
      errorCount: this.errorCount,
      remainingRateLimit: this.rateLimiter.getRemainingRequests(),
    };

    if (this.connectionStartTime > 0 && this.connectionState === 'connected') {
      state.connectionTime = performance.now() - this.connectionStartTime;
    }

    if (this.lastErrorTime > 0) {
      state.lastErrorTime = this.lastErrorTime;
    }

    return state as any;
  }

  /**
   * Disconnect from WebSocket server
   */
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

  /**
   * Cleanup resources
   */
  private performCleanup(): void {
    this.cleanupHeartbeat();
    this.cleanupConnectionTimeout();
    this.cleanupSocket();
    this.pendingHeartbeatTimestamps.clear();
    this.lastMessageTime = 0;
    this.messageCount = 0;
    this.errorCount = 0;
    this.lastErrorTime = 0;
    this.rateLimiter.reset();
  }

  /**
   * Reset connection state
   */
  private resetConnectionState(): void {
    this.connectionState = 'idle';
    this.connectionLock = null;

    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }

    if (this.pendingResolve) {
      this.pendingResolve(false);
      this.pendingResolve = null;
    }

    this.wasIntentionallyDisconnected = false;
    this.performCleanup();
  }

  /**
   * Cleanup connection timeout
   */
  private cleanupConnectionTimeout(): void {
    if (this.connectionTimeoutId) {
      clearTimeout(this.connectionTimeoutId);
      this.connectionTimeoutId = null;
    }
  }

  /**
   * Cleanup socket
   */
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

  /**
   * Cleanup heartbeat
   */
  private cleanupHeartbeat(): void {
    if (this.heartbeatIntervalId) {
      clearInterval(this.heartbeatIntervalId);
      this.heartbeatIntervalId = null;
    }
  }

  /**
   * Start heartbeat
   */
  private startHeartbeat(): void {
    this.cleanupHeartbeat();
    this.lastMessageTime = performance.now();

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

      // Check for connection staleness
      if (Date.now() - this.lastMessageTime > WS_CONFIG.HEARTBEAT_TIMEOUT_MS) {
        logError("Connection stale - no message received recently");
        this.cleanupHeartbeat();
        this.handleConnectionTimeout();
      }
    };

    sendHeartbeat();
    this.heartbeatIntervalId = setInterval(sendHeartbeat, this.options.heartbeatInterval);
  }

  /**
   * Start periodic cleanup
   */
  private startPeriodicCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      this.enforceHeartbeatBounds();
      
      // Clean up old pending heartbeats
      const now = Date.now();
      const staleHeartbeats: number[] = [];
      for (const [id, timestamp] of this.pendingHeartbeatTimestamps) {
        if (now - timestamp > WS_CONFIG.HEARTBEAT_TIMEOUT_MS) {
          staleHeartbeats.push(id);
        }
      }
      
      for (const id of staleHeartbeats) {
        this.pendingHeartbeatTimestamps.delete(id);
      }
      
      // Log cleanup statistics
      if (staleHeartbeats.length > 0) {
        logInfo(`Cleaned up ${staleHeartbearts.length} stale heartbeats`);
      }
    }, WS_CONFIG.CLEANUP_INTERVAL_MS);
  }

  /**
   * Start performance monitoring
   */
  private startPerformanceMonitoring(): void {
    this.performanceInterval = setInterval(() => {
      const state = this.getState();
      
      // Log performance metrics
      logInfo('Connection performance metrics:', {
        messageCount: state.messageCount,
        errorCount: state.errorCount,
        remainingRateLimit: state.remainingRateLimit,
        connectionTime: state.connectionTime ? `${state.connectionTime.toFixed(2)}ms` : 'N/A',
        connectionState: state.connectionState,
      });
      
      // Check for performance issues
      if (state.errorCount > 10) {
        logWarn(`High error count: ${state.errorCount} errors`);
      }
      
      if (state.connectionTime && state.connectionTime > 5000) {
        logWarn(`Long connection time: ${state.connectionTime.toFixed(2)}ms`);
      }
      
      if (state.remainingRateLimit < 10) {
        logWarn(`Low rate limit remaining: ${state.remainingRateLimit} requests`);
      }
    }, 60000); // Every minute
  }

  /**
   * Cleanup all resources
   */
  destroy(): void {
    this.disconnect();
    
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    
    if (this.performanceInterval) {
      clearInterval(this.performanceInterval);
      this.performanceInterval = null;
    }
    
    if (this.rateLimiter) {
      this.rateLimiter.destroy();
    }
    
    if (this.reconnectHandler) {
      this.reconnectHandler.destroy();
    }
    
    logInfo('Connection manager destroyed');
  }
}