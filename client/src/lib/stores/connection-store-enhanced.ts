/**
 * Enhanced connection store with improved error handling, performance monitoring,
 * and integration with enhanced connection manager.
 */

import { create } from "zustand";
import { ConnectionManager, ConnectionOptions, ConnectionStatusInfo } from "@/lib/websocket/connection-manager-enhanced";
import { 
  createAppError, 
  handleError, 
  ErrorCategory, 
  ErrorSeverity 
} from "@/lib/utils/enhanced-error-handling";
import { globalPerformanceMonitor, MetricCategory } from "@/lib/utils/performance-monitor-enhanced";
import { logError, logWarn, logInfo } from "@/lib/utils/logger";

// Constants
const DEFAULT_TIMEOUT_MS = 10000;
const MAX_RETRIES = 3;
const DEFAULT_WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8080';

// Connection store state interface
interface EnhancedConnectionStore {
  // Connection status
  isConnected: boolean;
  status: string;
  latency: number;
  
  // Session information
  sessionToken: string | null;
  playerId: string | null;
  
  // Connection metrics
  connectionAttempts: number;
  connectionFailures: number;
  lastConnectionTime: number | null;
  averageLatency: number;
  
  // Error handling
  lastError: string | null;
  errorCount: number;
  
  // Performance monitoring
  latencyHistory: number[];
  connectionHistory: {
    timestamp: number;
    status: string;
    latency?: number;
    error?: string;
  }[];
  maxHistorySize: number;
  
  // Loading and processing states
  isConnecting: boolean;
  isReconnecting: boolean;
  isLoading: boolean;
  
  // Actions
  connect: (options?: ConnectionOptions) => Promise<boolean>;
  disconnect: () => void;
  setStatus: (status: string) => void;
  setConnected: (connected: boolean) => void;
  setSession: (token: string, playerId: string) => void;
  clearSession: () => void;
  setError: (error: string | null) => void;
  updateHeartbeat: () => void;
  setLatency: (latency: number) => void;
  
  // Enhanced actions
  reconnect: () => Promise<boolean>;
  getStatus: () => ConnectionStatusInfo;
  getLatencyStats: () => {
    current: number;
    average: number;
    min: number;
    max: number;
    historySize: number;
  };
  getConnectionStats: () => {
    isConnected: boolean;
    status: string;
    connectionAttempts: number;
    connectionFailures: number;
    lastConnectionTime: number | null;
    averageLatency: number;
    errorCount: number;
  };
  clearHistory: () => void;
  setMaxHistorySize: (size: number) => void;
  
  // Loading states
  setLoading: (loading: boolean) => void;
  setConnecting: (connecting: boolean) => void;
  setReconnecting: (reconnecting: boolean) => void;
}

// Initialize connection manager instance
let connectionManager: ConnectionManager | null = null;

// Helper functions
function createConnectionManager(options?: ConnectionOptions): ConnectionManager {
  try {
    return new ConnectionManager(options);
  } catch (error) {
    const appError = handleError(error, {
      category: ErrorCategory.NETWORK,
      component: 'ConnectionStore',
      action: 'createConnectionManager',
    });
    
    logError('Failed to create connection manager:', appError);
    throw createAppError(
      'ConnectionManagerError',
      'Failed to initialize connection manager',
      ErrorCategory.NETWORK,
      { cause: appError }
    );
  }
}

// Create enhanced connection store
export const useEnhancedConnectionStore = create<EnhancedConnectionStore>((set, get) => ({
  // Initial state
  isConnected: false,
  status: 'disconnected',
  latency: 0,
  sessionToken: null,
  playerId: null,
  connectionAttempts: 0,
  connectionFailures: 0,
  lastConnectionTime: null,
  averageLatency: 0,
  lastError: null,
  errorCount: 0,
  latencyHistory: [],
  connectionHistory: [],
  maxHistorySize: 100,
  isConnecting: false,
  isReconnecting: false,
  isLoading: false,

  // Connect to WebSocket server
  connect: async (options?: ConnectionOptions): Promise<boolean> => {
    const startTime = performance.now();
    const state = get();
    
    try {
      set({
        isConnecting: true,
        isLoading: true,
        lastError: null,
      });
      
      // Create connection manager if not exists
      if (!connectionManager) {
        connectionManager = createConnectionManager(options);
      }
      
      // Increment connection attempts
      set({ connectionAttempts: state.connectionAttempts + 1 });
      
      // Add to connection history
      const historyEntry = {
        timestamp: Date.now(),
        status: 'connecting',
      };
      
      set((prevState) => ({
        connectionHistory: [...prevState.connectionHistory.slice(-prevState.maxHistorySize + 1), historyEntry],
      }));
      
      // Connect with error handling
      const success = await ErrorRecovery.retryWithBackoff(
        () => connectionManager!.connect(),
        MAX_RETRIES,
        1000,
        { 
          category: ErrorCategory.NETWORK, 
          component: 'ConnectionStore', 
          action: 'connect' 
        }
      );
      
      if (success) {
        const connectionTime = performance.now() - startTime;
        
        // Update connection stats
        set({
          isConnected: true,
          isConnecting: false,
          isLoading: false,
          lastConnectionTime: Date.now(),
          lastError: null,
          errorCount: 0,
        });
        
        // Add to history
        const successEntry = {
          timestamp: Date.now(),
          status: 'connected',
          latency: connectionManager!.getStatus().latency,
        };
        
        set((prevState) => ({
          connectionHistory: [...prevState.connectionHistory.slice(-prevState.maxHistorySize + 1), successEntry],
        }));
        
        // Track performance
        globalPerformanceMonitor.trackCustomMetric(
          'connection_success',
          1,
          'count',
          { connectionTime: connectionTime.toFixed(2) + 'ms' }
        );
        
        logInfo(`Connected to WebSocket in ${connectionTime.toFixed(2)}ms`);
        
        return true;
      } else {
        set({
          isConnected: false,
          isConnecting: false,
          isLoading: false,
          lastError: 'Connection failed after multiple attempts',
          connectionFailures: state.connectionFailures + 1,
          errorCount: state.errorCount + 1,
        });
        
        // Add to history
        const failureEntry = {
          timestamp: Date.now(),
          status: 'failed',
          error: 'Connection failed after multiple attempts',
        };
        
        set((prevState) => ({
          connectionHistory: [...prevState.connectionHistory.slice(-prevState.maxHistorySize + 1), failureEntry],
        }));
        
        return false;
      }
      
    } catch (error) {
      const appError = handleError(error, {
        category: ErrorCategory.NETWORK,
        component: 'ConnectionStore',
        action: 'connect',
      });
      
      const connectionTime = performance.now() - startTime;
      
      set({
        isConnected: false,
        isConnecting: false,
        isLoading: false,
        lastError: appError.message,
        connectionFailures: state.connectionFailures + 1,
        errorCount: state.errorCount + 1,
      });
      
      // Add to history
      const failureEntry = {
        timestamp: Date.now(),
        status: 'failed',
        error: appError.message,
      };
      
      set((prevState) => ({
        connectionHistory: [...prevState.connectionHistory.slice(-prevState.maxHistorySize + 1), failureEntry],
      }));
      
      // Track error
      globalPerformanceMonitor.trackError('connection_failed', 1, {
        connectionTime: connectionTime.toFixed(2) + 'ms',
        errorType: appError.name,
      });
      
      logError('Connection failed:', appError);
      
      return false;
    }
  },

  // Disconnect from WebSocket server
  disconnect: (): void => {
    try {
      if (connectionManager) {
        connectionManager.disconnect();
        connectionManager = null;
      }
      
      set({
        isConnected: false,
        status: 'disconnected',
        latency: 0,
        sessionToken: null,
        playerId: null,
        isConnecting: false,
        isReconnecting: false,
        isLoading: false,
      });
      
      logInfo('Disconnected from WebSocket server');
      
      // Track performance
      globalPerformanceMonitor.trackCustomMetric(
        'disconnect',
        1,
        'count',
      );
      
    } catch (error) {
      const appError = handleError(error, {
        category: ErrorCategory.NETWORK,
        component: 'ConnectionStore',
        action: 'disconnect',
      });
      
      logError('Error disconnecting:', appError);
      set({ lastError: appError.message });
    }
  },

  // Set connection status
  setStatus: (status: string): void => {
    const state = get();
    const previousStatus = state.status;
    
    set({ status });
    
    // Track status changes
    if (status !== previousStatus) {
      globalPerformanceMonitor.trackCustomMetric(
        'status_change',
        1,
        'count',
        { 
          from: previousStatus, 
          to: status 
        }
      );
    }
  },

  // Set connection state
  setConnected: (connected: boolean): void => {
    set({ isConnected: connected });
  },

  // Set session information
  setSession: (token: string, playerId: string): void => {
    const state = get();
    
    set({
      sessionToken: token,
      playerId: playerId,
    });
    
    // Track session changes
    globalPerformanceMonitor.trackCustomMetric(
      'session_created',
      1,
      'count',
      { 
        hasSession: !!token,
        hasPlayerId: !!playerId 
      }
    );
  },

  // Clear session information
  clearSession: (): void => {
    set({
      sessionToken: null,
      playerId: null,
    });
  },

  // Set error
  setError: (error: string | null): void => {
    set({ 
      lastError: error,
      errorCount: error ? get().errorCount + 1 : get().errorCount,
    });
    
    if (error) {
      globalPerformanceMonitor.trackError('connection_error', 1);
    }
  },

  // Update heartbeat
  updateHeartbeat: (): void => {
    const state = get();
    
    // Update latency history
    const newLatencyHistory = [...state.latencyHistory, state.latency];
    if (newLatencyHistory.length > state.maxHistorySize) {
      newLatencyHistory.shift();
    }
    
    // Calculate average latency
    const averageLatency = newLatencyHistory.length > 0
      ? newLatencyHistory.reduce((sum, lat) => sum + lat, 0) / newLatencyHistory.length
      : 0;
    
    set({
      latencyHistory: newLatencyHistory,
      averageLatency,
    });
  },

  // Set latency
  setLatency: (latency: number): void => {
    set({ latency });
  },

  // Reconnect with enhanced error handling
  reconnect: async (): Promise<boolean> => {
    const state = get();
    
    try {
      set({ isReconnecting: true, isLoading: true, lastError: null });
      
      // Add to connection history
      const historyEntry = {
        timestamp: Date.now(),
        status: 'reconnecting',
      };
      
      set((prevState) => ({
        connectionHistory: [...prevState.connectionHistory.slice(-prevState.maxHistorySize + 1), historyEntry],
      }));
      
      if (connectionManager) {
        connectionManager.destroy();
      }
      
      connectionManager = createConnectionManager({
        url: DEFAULT_WS_URL,
        autoReconnect: true,
        reconnectOptions: {
          maxAttempts: 5,
          initialDelay: 1000,
          maxDelay: 30000,
          backoffFactor: 2,
        },
        heartbeatInterval: 30000,
        maxRetries: 3,
        timeout: DEFAULT_TIMEOUT_MS,
      });
      
      const success = await connectionManager.connect();
      
      if (success) {
        set({
          isReconnecting: false,
          isLoading: false,
          lastConnectionTime: Date.now(),
          lastError: null,
          errorCount: 0,
        });
        
        // Add to history
        const successEntry = {
          timestamp: Date.now(),
          status: 'reconnected',
          latency: connectionManager.getStatus().latency,
        };
        
        set((prevState) => ({
          connectionHistory: [...prevState.connectionHistory.slice(-prevState.maxHistorySize + 1), successEntry],
        }));
        
        logInfo('Successfully reconnected to WebSocket server');
        
        return true;
      } else {
        set({
          isReconnecting: false,
          isLoading: false,
          lastError: 'Reconnection failed',
          errorCount: state.errorCount + 1,
        });
        
        return false;
      }
      
    } catch (error) {
      const appError = handleError(error, {
        category: ErrorCategory.NETWORK,
        component: 'ConnectionStore',
        action: 'reconnect',
      });
      
      set({
        isReconnecting: false,
        isLoading: false,
        lastError: appError.message,
        errorCount: state.errorCount + 1,
      });
      
      // Add to history
      const failureEntry = {
        timestamp: Date.now(),
        status: 'reconnect_failed',
        error: appError.message,
      };
      
      set((prevState) => ({
        connectionHistory: [...prevState.connectionHistory.slice(-prevState.maxHistorySize + 1), failureEntry],
      }));
      
      logError('Reconnection failed:', appError);
      
      return false;
    }
  },

  // Get connection status
  getStatus: (): ConnectionStatusInfo => {
    if (!connectionManager) {
      return {
        isConnected: false,
        status: 'disconnected',
        latency: 0,
        sessionToken: null,
        playerId: null,
      };
    }
    
    return connectionManager.getStatus();
  },

  // Get latency statistics
  getLatencyStats: () => {
    const state = get();
    
    if (state.latencyHistory.length === 0) {
      return {
        current: 0,
        average: 0,
        min: 0,
        max: 0,
        historySize: 0,
      };
    }
    
    const min = Math.min(...state.latencyHistory);
    const max = Math.max(...state.latencyHistory);
    
    return {
      current: state.latency,
      average: state.averageLatency,
      min,
      max,
      historySize: state.latencyHistory.length,
    };
  },

  // Get connection statistics
  getConnectionStats: () => {
    const state = get();
    
    return {
      isConnected: state.isConnected,
      status: state.status,
      connectionAttempts: state.connectionAttempts,
      connectionFailures: state.connectionFailures,
      lastConnectionTime: state.lastConnectionTime,
      averageLatency: state.averageLatency,
      errorCount: state.errorCount,
    };
  },

  // Clear history
  clearHistory: (): void => {
    set({
      latencyHistory: [],
      connectionHistory: [],
      lastError: null,
      errorCount: 0,
    });
  },

  // Set maximum history size
  setMaxHistorySize: (size: number): void => {
    const maxSize = Math.max(1, size);
    set({ maxHistorySize: maxSize });
  },

  // Set loading state
  setLoading: (loading: boolean): void => {
    set({ isLoading: loading });
  },

  // Set connecting state
  setConnecting: (connecting: boolean): void => {
    set({ isConnecting: connecting });
  },

  // Set reconnecting state
  setReconnecting: (reconnecting: boolean): void => {
    set({ isReconnecting: reconnecting });
  },
}));

// Export selectors for easier access
export const isConnectedSelector = (state: EnhancedConnectionStore): boolean =>
  state.isConnected;

export const statusSelector = (state: EnhancedConnectionStore): string =>
  state.status;

export const sessionTokenSelector = (state: EnhancedConnectionStore): string | null =>
  state.sessionToken;

export const playerIdSelector = (state: EnhancedConnectionStore): string | null =>
  state.playerId;

export const latencySelector = (state: EnhancedConnectionStore): number =>
  state.latency;

export const connectionStatsSelector = (state: EnhancedConnectionStore) => ({
  isConnected: state.isConnected,
  status: state.status,
  connectionAttempts: state.connectionAttempts,
  connectionFailures: state.connectionFailures,
  lastConnectionTime: state.lastConnectionTime,
  averageLatency: state.averageLatency,
  errorCount: state.errorCount,
});

export const latencyStatsSelector = (state: EnhancedConnectionStore) => ({
  current: state.latency,
  average: state.averageLatency,
  min: state.latencyHistory.length > 0 ? Math.min(...state.latencyHistory) : 0,
  max: state.latencyHistory.length > 0 ? Math.max(...state.latencyHistory) : 0,
  historySize: state.latencyHistory.length,
});

// Initialize connection store
export function initializeConnectionStore(): () => void {
  if (typeof window === 'undefined') return () => {};
  
  try {
    const store = useEnhancedConnectionStore.getState();
    
    // Initialize with default connection manager
    connectionManager = createConnectionManager({
      url: DEFAULT_WS_URL,
      autoReconnect: true,
      reconnectOptions: {
        maxAttempts: 5,
        initialDelay: 1000,
        maxDelay: 30000,
        backoffFactor: 2,
      },
      heartbeatInterval: 30000,
      maxRetries: 3,
      timeout: DEFAULT_TIMEOUT_MS,
    });
    
    // Set up periodic status monitoring
    const interval = setInterval(() => {
      const state = useEnhancedConnectionStore.getState();
      
      // Update heartbeat
      state.updateHeartbeat();
      
      // Track performance metrics
      globalPerformanceMonitor.trackCustomMetric(
        'connection_status',
        1,
        'count',
        { 
          status: state.status,
          isConnected: state.isConnected,
          latency: state.latency,
        }
      );
      
      // Log performance warnings
      if (state.latency > 1000) {
        logWarn(`High latency detected: ${state.latency}ms`);
      }
      
      if (state.errorCount > 10) {
        logWarn(`High error count: ${state.errorCount} errors`);
      }
    }, 30000); // Every 30 seconds
    
    return () => {
      clearInterval(interval);
      if (connectionManager) {
        connectionManager.destroy();
        connectionManager = null;
      }
    };
  } catch (error) {
    const appError = handleError(error, {
      category: ErrorCategory.SESSION,
      component: 'ConnectionStore',
      action: 'initializeConnectionStore',
    });
    
    logError('Failed to initialize connection store:', appError);
    useEnhancedConnectionStore.getState().setError('Failed to initialize connection store');
    return () => {};
  }
}

// Reset connection store
export function resetConnectionStore(): void {
  if (typeof window === 'undefined') return;
  
  try {
    if (connectionManager) {
      connectionManager.destroy();
      connectionManager = null;
    }
    
    useEnhancedConnectionStore.getState().disconnect();
    useEnhancedConnectionStore.getState().clearHistory();
    
    logInfo('Connection store reset');
  } catch (error) {
    const appError = handleError(error, {
      category: ErrorCategory.SESSION,
      component: 'ConnectionStore',
      action: 'resetConnectionStore',
    });
    
    logError('Error resetting connection store:', appError);
  }
}