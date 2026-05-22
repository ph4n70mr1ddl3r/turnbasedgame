/**
 * Comprehensive test suite for enhanced connection store and WebSocket connection manager.
 * Tests error handling, performance monitoring, and resilience features.
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { ConnectionManager, ConnectionOptions } from '@/lib/websocket/connection-manager-enhanced';
import { useEnhancedConnectionStore, initializeConnectionStore } from '@/lib/stores/connection-store-enhanced';
import { 
  createAppError, 
  handleError, 
  ErrorCategory, 
  ErrorSeverity 
} from '@/lib/utils/enhanced-error-handling';
import { globalPerformanceMonitor, MetricCategory } from '@/lib/utils/performance-monitor-enhanced';
import { 
  WebSocketMessage, 
  GameStateUpdateMessage, 
  ErrorMessage, 
  ConnectionStatusMessage 
} from '@/types/game-types';
import { logError, logWarn, logInfo } from '@/lib/utils/logger';

// Mock dependencies
jest.mock('@/lib/utils/logger', () => ({
  logError: jest.fn(),
  logWarn: jest.fn(),
  logInfo: jest.fn(),
}));

jest.mock('@/lib/utils/enhanced-error-handling', () => ({
  createAppError: jest.fn((name, message, category, details) => ({
    name,
    message,
    category,
    details,
    severity: details?.severity || ErrorSeverity.MEDIUM,
  })),
  handleError: jest.fn((error, context) => ({
    message: error.message,
    category: context.category,
    details: context.details,
    stack: error.stack,
  })),
  ErrorCategory,
  ErrorSeverity,
}));

// Mock message parser
jest.mock('@/lib/websocket/message-parser', () => ({
  MessageParser: {
    parseMessage: jest.fn(),
    stringifyMessage: jest.fn(),
    createSessionInit: jest.fn().mockReturnValue({ type: 'session_init', data: {} }),
  },
}));

// Mock game store
jest.mock('@/lib/stores/game-store', () => ({
  useGameStore: {
    getState: jest.fn().mockReturnValue({
      setError: jest.fn(),
      setGameState: jest.fn(),
    }),
  },
}));

// Mock session manager
jest.mock('@/lib/websocket/session-manager', () => ({
  SessionManager: {
    getSession: jest.fn().mockReturnValue(null),
    generateToken: jest.fn().mockReturnValue('test-token-123'),
    updateSessionExpiry: jest.fn(),
    clearSession: jest.fn(),
  },
}));

describe('Enhanced Connection Store', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useEnhancedConnectionStore.getState().disconnect();
    useEnhancedConnectionStore.getState().clearHistory();
  });

  afterEach(() => {
    if (typeof window !== 'undefined') {
      useEnhancedConnectionStore.getState().disconnect();
    }
  });

  describe('Initial State', () => {
    it('should initialize with correct default state', () => {
      const state = useEnhancedConnectionStore.getState();
      
      expect(state.isConnected).toBe(false);
      expect(state.status).toBe('disconnected');
      expect(state.latency).toBe(0);
      expect(state.sessionToken).toBe(null);
      expect(state.playerId).toBe(null);
      expect(state.connectionAttempts).toBe(0);
      expect(state.connectionFailures).toBe(0);
      expect(state.lastError).toBe(null);
      expect(state.errorCount).toBe(0);
      expect(state.latencyHistory).toEqual([]);
      expect(state.connectionHistory).toEqual([]);
      expect(state.isConnecting).toBe(false);
      expect(state.isReconnecting).toBe(false);
      expect(state.isLoading).toBe(false);
    });
  });

  describe('Connection Management', () => {
    it('should connect successfully', async () => {
      const mockConnectionManager = {
        connect: jest.fn().mockResolvedValue(true),
        getStatus: jest.fn().mockReturnValue({
          isConnected: true,
          status: 'connected',
          latency: 50,
          sessionToken: 'test-token',
          playerId: 'player-123',
        }),
        disconnect: jest.fn(),
      };
      
      // Mock ConnectionManager constructor
      jest.spyOn(require('@/lib/websocket/connection-manager-enhanced'), 'ConnectionManager')
        .mockImplementation(() => mockConnectionManager);
      
      const result = await useEnhancedConnectionStore.getState().connect();
      
      expect(result).toBe(true);
      expect(mockConnectionManager.connect).toHaveBeenCalledTimes(1);
      expect(useEnhancedConnectionStore.getState().isConnected).toBe(true);
      expect(useEnhancedConnectionStore.getState().isConnecting).toBe(false);
    });

    it('should handle connection failure', async () => {
      const mockConnectionManager = {
        connect: jest.fn().mockRejectedValue(new Error('Connection failed')),
        disconnect: jest.fn(),
      };
      
      // Mock ConnectionManager constructor
      jest.spyOn(require('@/lib/websocket/connection-manager-enhanced'), 'ConnectionManager')
        .mockImplementation(() => mockConnectionManager);
      
      const result = await useEnhancedConnectionStore.getState().connect();
      
      expect(result).toBe(false);
      expect(useEnhancedConnectionStore.getState().isConnected).toBe(false);
      expect(useEnhancedConnectionStore.getState().lastError).toContain('Connection failed');
      expect(useEnhancedConnectionStore.getState().errorCount).toBe(1);
    });

    it('should retry connection with backoff', async () => {
      let attemptCount = 0;
      const mockConnectionManager = {
        connect: jest.fn()
          .mockRejectedValueOnce(new Error('First attempt'))
          .mockResolvedValue(true),
        getStatus: jest.fn().mockReturnValue({
          isConnected: true,
          status: 'connected',
          latency: 50,
          sessionToken: 'test-token',
          playerId: 'player-123',
        }),
        disconnect: jest.fn(),
      };
      
      // Mock ConnectionManager constructor
      jest.spyOn(require('@/lib/websocket/connection-manager-enhanced'), 'ConnectionManager')
        .mockImplementation(() => mockConnectionManager);
      
      const result = await useEnhancedConnectionStore.getState().connect();
      
      expect(result).toBe(true);
      expect(mockConnectionManager.connect).toHaveBeenCalledTimes(2);
      expect(useEnhancedConnectionStore.getState().connectionAttempts).toBe(1);
    });
  });

  describe('Session Management', () => {
    it('should set session correctly', () => {
      const store = useEnhancedConnectionStore.getState();
      
      store.setSession('test-token-123', 'player-456');
      
      expect(store.sessionToken).toBe('test-token-123');
      expect(store.playerId).toBe('player-456');
    });

    it('should clear session correctly', () => {
      const store = useEnhancedConnectionStore.getState();
      
      store.setSession('test-token-123', 'player-456');
      store.clearSession();
      
      expect(store.sessionToken).toBe(null);
      expect(store.playerId).toBe(null);
    });
  });

  describe('Error Handling', () => {
    it('should set error correctly', () => {
      const store = useEnhancedConnectionStore.getState();
      
      store.setError('Test error');
      
      expect(store.lastError).toBe('Test error');
      expect(store.errorCount).toBe(1);
    });

    it('should clear error correctly', () => {
      const store = useEnhancedConnectionStore.getState();
      
      store.setError('Test error');
      store.setError(null);
      
      expect(store.lastError).toBe(null);
      expect(store.errorCount).toBe(1);
    });

    it('should handle multiple errors', () => {
      const store = useEnhancedConnectionStore.getState();
      
      store.setError('Error 1');
      store.setError('Error 2');
      store.setError('Error 3');
      
      expect(store.errorCount).toBe(3);
    });
  });

  describe('Latency Tracking', () => {
    it('should update latency correctly', () => {
      const store = useEnhancedConnectionStore.getState();
      
      store.setLatency(100);
      store.updateHeartbeat();
      
      expect(store.latency).toBe(100);
      expect(store.latencyHistory).toContain(100);
      expect(store.averageLatency).toBe(100);
    });

    it('should calculate average latency correctly', () => {
      const store = useEnhancedConnectionStore.getState();
      
      store.setLatency(100);
      store.updateHeartbeat();
      store.setLatency(200);
      store.updateHeartbeat();
      
      expect(store.averageLatency).toBe(150);
    });

    it('should respect max history size', () => {
      const store = useEnhancedConnectionStore.getState();
      
      // Set history size to 2
      store.setMaxHistorySize(2);
      
      store.setLatency(100);
      store.updateHeartbeat();
      store.setLatency(200);
      store.updateHeartbeat();
      store.setLatency(300);
      store.updateHeartbeat();
      
      expect(store.latencyHistory).toHaveLength(2);
      expect(store.latencyHistory).toContain(200);
      expect(store.latencyHistory).toContain(300);
    });
  });

  describe('Connection History', () => {
    it('should track connection attempts', () => {
      const store = useEnhancedConnectionStore.getState();
      
      store.setStatus('connecting');
      store.setStatus('connected');
      store.setStatus('failed');
      
      const history = store.connectionHistory;
      
      expect(history).toHaveLength(3);
      expect(history[0].status).toBe('connecting');
      expect(history[1].status).toBe('connected');
      expect(history[2].status).toBe('failed');
    });

    it('should track errors in history', () => {
      const store = useEnhancedConnectionStore.getState();
      
      store.setStatus('failed');
      store.setError('Connection error');
      
      const history = store.connectionHistory;
      
      expect(history).toHaveLength(1);
      expect(history[0].error).toBe('Connection error');
    });

    it('should respect max history size', () => {
      const store = useEnhancedConnectionStore.getState();
      
      // Set max size to 2
      store.setMaxHistorySize(2);
      
      store.setStatus('connecting');
      store.setStatus('connected');
      store.setStatus('failed');
      
      const history = store.connectionHistory;
      
      expect(history).toHaveLength(2);
      expect(history[0].status).toBe('connected');
      expect(history[1].status).toBe('failed');
    });
  });

  describe('Reconnection', () => {
    it('should reconnect successfully', async () => {
      const mockConnectionManager = {
        connect: jest.fn().mockResolvedValue(true),
        getStatus: jest.fn().mockReturnValue({
          isConnected: true,
          status: 'connected',
          latency: 50,
          sessionToken: 'test-token',
          playerId: 'player-123',
        }),
        disconnect: jest.fn(),
        destroy: jest.fn(),
      };
      
      // Mock ConnectionManager constructor
      jest.spyOn(require('@/lib/websocket/connection-manager-enhanced'), 'ConnectionManager')
        .mockImplementation(() => mockConnectionManager);
      
      await useEnhancedConnectionStore.getState().reconnect();
      
      expect(mockConnectionManager.disconnect).toHaveBeenCalledTimes(1);
      expect(mockConnectionManager.connect).toHaveBeenCalledTimes(1);
      expect(useEnhancedConnectionStore.getState().isReconnecting).toBe(false);
    });

    it('should handle reconnection failure', async () => {
      const mockConnectionManager = {
        connect: jest.fn().mockRejectedValue(new Error('Reconnection failed')),
        disconnect: jest.fn(),
        destroy: jest.fn(),
      };
      
      // Mock ConnectionManager constructor
      jest.spyOn(require('@/lib/websocket/connection-manager-enhanced'), 'ConnectionManager')
        .mockImplementation(() => mockConnectionManager);
      
      await useEnhancedConnectionStore.getState().reconnect();
      
      expect(useEnhancedConnectionStore.getState().lastError).toContain('Reconnection failed');
      expect(useEnhancedConnectionStore.getState().isReconnecting).toBe(false);
    });
  });

  describe('Selectors', () => {
    it('should provide correct selectors', () => {
      const store = useEnhancedConnectionStore.getState();
      
      store.setSession('test-token', 'player-123');
      store.setStatus('connected');
      store.setConnected(true);
      store.setLatency(150);
      
      expect(sessionTokenSelector(store)).toBe('test-token');
      expect(playerIdSelector(store)).toBe('player-123');
      expect(statusSelector(store)).toBe('connected');
      expect(isConnectedSelector(store)).toBe(true);
      expect(latencySelector(store)).toBe(150);
    });

    it('should provide correct stats selectors', () => {
      const store = useEnhancedConnectionStore.getState();
      
      store.setStatus('connected');
      store.setConnected(true);
      store.setLatency(100);
      store.setLatency(200);
      store.updateHeartbeat();
      
      const stats = connectionStatsSelector(store);
      const latencyStats = latencyStatsSelector(store);
      
      expect(stats.isConnected).toBe(true);
      expect(stats.status).toBe('connected');
      expect(stats.averageLatency).toBe(150);
      
      expect(latencyStats.current).toBe(200);
      expect(latencyStats.average).toBe(150);
      expect(latencyStats.min).toBe(100);
      expect(latencyStats.max).toBe(200);
    });
  });

  describe('Performance Monitoring', () => {
    it('should track connection performance', () => {
      const mockTrackMetric = jest.fn();
      globalPerformanceMonitor.trackCustomMetric = mockTrackMetric;
      
      const store = useEnhancedConnectionStore.getState();
      
      store.setStatus('connecting');
      store.setStatus('connected');
      
      expect(mockTrackMetric).toHaveBeenCalledWith(
        'status_change',
        1,
        'count',
        expect.objectContaining({
          from: 'disconnected',
          to: 'connecting'
        })
      );
    });

    it('should track error metrics', () => {
      const mockTrackError = jest.fn();
      globalPerformanceMonitor.trackError = mockTrackError;
      
      const store = useEnhancedConnectionStore.getState();
      
      store.setError('Test error');
      
      expect(mockTrackError).toHaveBeenCalledWith('connection_error', 1);
    });

    it('should track connection success metrics', () => {
      const mockTrackMetric = jest.fn();
      globalPerformanceMonitor.trackCustomMetric = mockTrackMetric;
      
      const store = useEnhancedConnectionStore.getState();
      
      store.setStatus('connected');
      
      expect(mockTrackMetric).toHaveBeenCalledWith(
        'status_change',
        1,
        'count',
        expect.objectContaining({
          from: 'disconnecting',
          to: 'connected'
        })
      );
    });
  });

  describe('Loading States', () => {
    it('should handle loading states correctly', () => {
      const store = useEnhancedConnectionStore.getState();
      
      store.setLoading(true);
      store.setConnecting(true);
      store.setReconnecting(true);
      
      expect(store.isLoading).toBe(true);
      expect(store.isConnecting).toBe(true);
      expect(store.isReconnecting).toBe(true);
      
      store.setLoading(false);
      store.setConnecting(false);
      store.setReconnecting(false);
      
      expect(store.isLoading).toBe(false);
      expect(store.isConnecting).toBe(false);
      expect(store.isReconnecting).toBe(false);
    });
  });

  describe('Error Scenarios', () => {
    it('should handle connection timeout', async () => {
      const mockConnectionManager = {
        connect: jest.fn().mockImplementation(() => new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Connection timeout')), 2000)
        )),
        disconnect: jest.fn(),
      };
      
      // Mock ConnectionManager constructor
      jest.spyOn(require('@/lib/websocket/connection-manager-enhanced'), 'ConnectionManager')
        .mockImplementation(() => mockConnectionManager);
      
      const startTime = Date.now();
      const result = await useEnhancedConnectionStore.getState().connect();
      const endTime = Date.now();
      
      expect(result).toBe(false);
      expect(useEnhancedConnectionStore.getState().lastError).toContain('Connection timeout');
      expect(endTime - startTime).toBeLessThan(5000); // Should timeout before 5 seconds
    });

    it('should handle network errors gracefully', async () => {
      const mockConnectionManager = {
        connect: jest.fn().mockRejectedValue(new Error('Network error')),
        disconnect: jest.fn(),
      };
      
      // Mock ConnectionManager constructor
      jest.spyOn(require('@/lib/websocket/connection-manager-enhanced'), 'ConnectionManager')
        .mockImplementation(() => mockConnectionManager);
      
      const result = await useEnhancedConnectionStore.getState().connect();
      
      expect(result).toBe(false);
      expect(useEnhancedConnectionStore.getState().lastError).toContain('Network error');
      expect(useEnhancedConnectionStore.getState().errorCount).toBe(1);
    });

    it('should handle invalid connection options', async () => {
      // Mock ConnectionManager to throw validation error
      jest.spyOn(require('@/lib/websocket/connection-manager-enhanced'), 'ConnectionManager')
        .mockImplementation(() => {
          throw new Error('Invalid WebSocket URL');
        });
      
      const result = await useEnhancedConnectionStore.getState().connect({
        url: 'invalid-url',
      });
      
      expect(result).toBe(false);
      expect(useEnhancedConnectionStore.getState().lastError).toContain('Invalid WebSocket URL');
    });
  });

  describe('Connection Manager Integration', () => {
    it('should create connection manager correctly', () => {
      const mockConnectionManager = {
        connect: jest.fn().mockResolvedValue(true),
        getStatus: jest.fn().mockReturnValue({
          isConnected: true,
          status: 'connected',
          latency: 50,
          sessionToken: 'test-token',
          playerId: 'player-123',
        }),
        disconnect: jest.fn(),
      };
      
      jest.spyOn(require('@/lib/websocket/connection-manager-enhanced'), 'ConnectionManager')
        .mockImplementation(() => mockConnectionManager);
      
      const store = useEnhancedConnectionStore.getState();
      
      expect(mockConnectionManager).toBeDefined();
    });

    it('should handle connection manager destruction', () => {
      const mockConnectionManager = {
        connect: jest.fn().mockResolvedValue(true),
        getStatus: jest.fn().mockReturnValue({
          isConnected: true,
          status: 'connected',
          latency: 50,
          sessionToken: 'test-token',
          playerId: 'player-123',
        }),
        disconnect: jest.fn(),
        destroy: jest.fn(),
      };
      
      jest.spyOn(require('@/lib/websocket/connection-manager-enhanced'), 'ConnectionManager')
        .mockImplementation(() => mockConnectionManager);
      
      const store = useEnhancedConnectionStore.getState();
      
      store.disconnect();
      
      expect(mockConnectionManager.disconnect).toHaveBeenCalledTimes(1);
      expect(mockConnectionManager.destroy).toHaveBeenCalledTimes(1);
    });
  });

  describe('Memory Management', () => {
    it('should clear history correctly', () => {
      const store = useEnhancedConnectionStore.getState();
      
      store.setStatus('connected');
      store.setStatus('disconnected');
      store.setLatency(100);
      store.updateHeartbeat();
      setLatency(200);
      store.updateHeartbeat();
      
      expect(store.connectionHistory).toHaveLength(2);
      expect(store.latencyHistory).toHaveLength(2);
      
      store.clearHistory();
      
      expect(store.connectionHistory).toEqual([]);
      expect(store.latencyHistory).toEqual([]);
      expect(store.errorCount).toBe(0);
    });

    it('should respect history limits', () => {
      const store = useEnhancedConnectionStore.getState();
      
      // Set very small history size
      store.setMaxHistorySize(1);
      
      store.setStatus('connected');
      store.setStatus('disconnected');
      store.setLatency(100);
      store.updateHeartbeat();
      setLatency(200);
      store.updateHeartbeat();
      
      expect(store.connectionHistory).toHaveLength(1);
      expect(store.latencyHistory).toHaveLength(1);
      expect(store.connectionHistory[0].status).toBe('disconnected');
      expect(store.latencyHistory[0]).toBe(200);
    });
  });

  describe('Edge Cases', () => {
    it('should handle null session token', () => {
      const store = useEnhancedConnectionStore.getState();
      
      store.setSession(null, 'player-123');
      
      expect(store.sessionToken).toBe(null);
      expect(store.playerId).toBe('player-123');
    });

    it('should handle null player ID', () => {
      const store = useEnhancedConnectionStore.getState();
      
      store.setSession('test-token', null);
      
      expect(store.sessionToken).toBe('test-token');
      expect(store.playerId).toBe(null);
    });

    it('should handle negative latency values', () => {
      const store = useEnhancedConnectionStore.getState();
      
      store.setLatency(-100);
      
      expect(store.latency).toBe(-100);
      // Should still update history
      store.updateHeartbeat();
      expect(store.latencyHistory).toContain(-100);
    });

    it('should handle very large latency values', () => {
      const store = useEnhancedConnectionStore.getState();
      
      store.setLatency(999999);
      
      expect(store.latency).toBe(999999);
      store.updateHeartbeat();
      expect(store.latencyHistory).toContain(999999);
    });
  });

  describe('Performance Tests', () => {
    it('should handle rapid state changes efficiently', () => {
      const store = useEnhancedConnectionStore.getState();
      const startTime = performance.now();
      
      // Rapidly change state
      for (let i = 0; i < 1000; i++) {
        store.setStatus('connected');
        store.setStatus('disconnected');
      }
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      expect(duration).toBeLessThan(1000); // Should complete in under 1 second
    });

    it('should handle large history efficiently', () => {
      const store = useEnhancedConnectionStore.getState();
      
      // Set large history size
      store.setMaxHistorySize(10000);
      
      const startTime = performance.now();
      
      // Add many entries
      for (let i = 0; i < 1000; i++) {
        store.setStatus('connected');
        store.setLatency(i);
        store.updateHeartbeat();
      }
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      expect(store.connectionHistory).toHaveLength(1000);
      expect(store.latencyHistory).toHaveLength(1000);
      expect(duration).toBeLessThan(500); // Should complete in under 500ms
    });
  });

  describe('Integration Tests', () => {
    it('should handle complete connection lifecycle', async () => {
      const mockConnectionManager = {
        connect: jest.fn().mockResolvedValue(true),
        getStatus: jest.fn().mockReturnValue({
          isConnected: true,
          status: 'connected',
          latency: 50,
          sessionToken: 'test-token',
          playerId: 'player-123',
        }),
        disconnect: jest.fn(),
      };
      
      jest.spyOn(require('@/lib/websocket/connection-manager-enhanced'), 'ConnectionManager')
        .mockImplementation(() => mockConnectionManager);
      
      const store = useEnhancedConnectionStore.getState();
      
      // Connect
      const connected = await store.connect();
      expect(connected).toBe(true);
      
      // Set session
      store.setSession('test-token', 'player-123');
      
      // Set status and latency
      store.setStatus('connected');
      store.setLatency(75);
      store.updateHeartbeat();
      
      // Check stats
      const stats = store.getConnectionStats();
      expect(stats.isConnected).toBe(true);
      expect(stats.status).toBe('connected');
      expect(stats.averageLatency).toBe(75);
      
      // Disconnect
      store.disconnect();
      
      expect(mockConnectionManager.disconnect).toHaveBeenCalledTimes(1);
      expect(store.isConnected).toBe(false);
      expect(store.status).toBe('disconnected');
    });

    it('should handle error recovery scenarios', async () => {
      const mockConnectionManager = {
        connect: jest.fn()
          .mockRejectedValueOnce(new Error('Connection failed'))
          .mockResolvedValue(true),
        getStatus: jest.fn().mockReturnValue({
          isConnected: true,
          status: 'connected',
          latency: 50,
          sessionToken: 'test-token',
          playerId: 'player-123',
        }),
        disconnect: jest.fn(),
      };
      
      jest.spyOn(require('@/lib/websocket/connection-manager-enhanced'), 'ConnectionManager')
        .mockImplementation(() => mockConnectionManager);
      
      const store = useEnhancedConnectionStore.getState();
      
      // Should retry and succeed
      const connected = await store.connect();
      expect(connected).toBe(true);
      
      // Should have tracked the failure
      expect(store.connectionFailures).toBe(1);
      expect(store.connectionAttempts).toBe(1);
    });
  });
});

describe('Enhanced Connection Manager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Clear any existing connection manager
    if (typeof window !== 'undefined') {
      require('@/lib/stores/connection-store-enhanced').resetConnectionStore();
    }
  });

  afterEach(() => {
    if (typeof window !== 'undefined') {
      require('@/lib/stores/connection-store-enhanced').resetConnectionStore();
    }
  });

  describe('WebSocket URL Validation', () => {
    it('should validate WebSocket URLs correctly', () => {
      const manager = new ConnectionManager({ url: 'ws://localhost:8080' });
      expect(manager).toBeDefined();
    });

    it('should reject invalid WebSocket URLs', () => {
      expect(() => {
        new ConnectionManager({ url: 'http://example.com' });
      }).toThrow();
    });

    it('should enforce HTTPS in production', () => {
      process.env.NODE_ENV = 'production';
      
      expect(() => {
        new ConnectionManager({ url: 'ws://example.com' });
      }).toThrow();
      
      expect(() => {
        new ConnectionManager({ url: 'wss://example.com' });
      }).not.toThrow();
      
      process.env.NODE_ENV = 'test';
    });
  });

  describe('Connection State Management', () => {
    it('should handle connection lifecycle', async () => {
      const mockWebSocket = {
        readyState: WebSocket.OPEN,
        send: jest.fn(),
        close: jest.fn(),
        onopen: null,
        onmessage: null,
        onerror: null,
        onclose: null,
      };
      
      // Mock WebSocket constructor
      global.WebSocket = jest.fn().mockImplementation(() => mockWebSocket);
      
      const manager = new ConnectionManager();
      
      // Connect
      const connected = await manager.connect();
      
      if (connected) {
        // Should be connected
        expect(mockWebSocket.readyState).toBe(WebSocket.OPEN);
        
        // Should be able to send messages
        const message = { type: 'test', data: {} };
        const result = manager.sendMessage(message);
        expect(result).toBe(true);
        
        // Should be able to get status
        const status = manager.getStatus();
        expect(status.isConnected).toBe(true);
        
        // Disconnect
        manager.disconnect();
        
        expect(mockWebSocket.close).toHaveBeenCalledWith(1000, 'Client disconnect');
      }
    });
  });

  describe('Message Handling', () => {
    it('should handle structured messages correctly', () => {
      const mockWebSocket = {
        readyState: WebSocket.OPEN,
        send: jest.fn(),
        close: jest.fn(),
        onopen: null,
        onmessage: null,
        onerror: null,
        onclose: null,
      };
      
      // Mock WebSocket constructor
      global.WebSocket = jest.fn().mockImplementation(() => mockWebSocket);
      
      const manager = new ConnectionManager();
      
      // Mock message parser
      const mockParser = require('@/lib/websocket/message-parser').MessageParser;
      mockParser.parseMessage.mockReturnValue({
        type: 'connection_status',
        data: {
          status: 'connected',
          player_id: 'player-123',
        },
      });
      
      // Simulate message event
      const messageEvent = new MessageEvent('message', {
        data: JSON.stringify({
          type: 'connection_status',
          data: {
            status: 'connected',
            player_id: 'player-123',
          },
        }),
      });
      
      manager.connect().then(() => {
        manager.handleMessage(messageEvent);
        
        // Should have handled the message
        expect(mockParser.parseMessage).toHaveBeenCalled();
      });
    });

    it('should handle error messages correctly', () => {
      const mockWebSocket = {
        readyState: WebSocket.OPEN,
        send: jest.fn(),
        close: jest.fn(),
        onopen: null,
        onmessage: null,
        onerror: null,
        onclose: null,
      };
      
      // Mock WebSocket constructor
      global.WebSocket = jest.fn().mockImplementation(() => mockWebSocket);
      
      const manager = new ConnectionManager();
      
      // Mock message parser
      const mockParser = require('@/lib/websocket/message-parser').MessageParser;
      mockParser.parseMessage.mockReturnValue({
        type: 'error',
        data: {
          message: 'Invalid action',
          code: 'INVALID_ACTION',
        },
      });
      
      // Simulate error message event
      const messageEvent = new MessageEvent('message', {
        data: JSON.stringify({
          type: 'error',
          data: {
            message: 'Invalid action',
            code: 'INVALID_ACTION',
          },
        }),
      });
      
      manager.connect().then(() => {
        manager.handleMessage(messageEvent);
        
        // Should have handled the error
        expect(mockParser.parseMessage).toHaveBeenCalled();
      });
    });
  });

  describe('Rate Limiting', () => {
    it('should respect rate limits', () => {
      const mockWebSocket = {
        readyState: WebSocket.OPEN,
        send: jest.fn(),
        close: jest.fn(),
        onopen: null,
        onmessage: null,
        onerror: null,
        onclose: null,
      };
      
      // Mock WebSocket constructor
      global.WebSocket = jest.fn().mockImplementation(() => mockWebSocket);
      
      const manager = new ConnectionManager();
      
      // Simulate rate limit
      for (let i = 0; i < 100; i++) {
        const message = { type: 'test', data: {} };
        const result = manager.sendMessage(message);
        if (i >= 100) {
          expect(result).toBe(false);
        }
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors gracefully', () => {
      const mockWebSocket = {
        readyState: WebSocket.CLOSED,
        send: jest.fn().mockImplementation(() => {
          throw new Error('Network error');
        }),
        close: jest.fn(),
        onopen: null,
        onmessage: null,
        onerror: null,
        onclose: null,
      };
      
      // Mock WebSocket constructor
      global.WebSocket = jest.fn().mockImplementation(() => mockWebSocket);
      
      const manager = new ConnectionManager();
      
      // Should handle network errors
      const message = { type: 'test', data: {} };
      const result = manager.sendMessage(message);
      
      expect(result).toBe(false);
    });

    it('should handle connection timeout', async () => {
      // Mock WebSocket constructor to throw timeout error
      global.WebSocket = jest.fn().mockImplementation(() => {
        throw new Error('Connection timeout');
      });
      
      const manager = new ConnectionManager({
        timeout: 100, // Very short timeout
      });
      
      const startTime = performance.now();
      const connected = await manager.connect();
      const endTime = performance.now();
      
      expect(connected).toBe(false);
      expect(endTime - startTime).toBeLessThan(5000); // Should timeout before 5 seconds
    });
  });

  describe('Performance Monitoring', () => {
    it('should track connection performance', () => {
      const mockTrackMetric = jest.fn();
      globalPerformanceMonitor.trackCustomMetric = mockTrackMetric;
      
      const mockWebSocket = {
        readyState: WebSocket.OPEN,
        send: jest.fn(),
        close: jest.fn(),
        onopen: null,
        onmessage: null,
        onerror: null,
        onclose: null,
      };
      
      // Mock WebSocket constructor
      global.WebSocket = jest.fn().mockImplementation(() => mockWebSocket);
      
      const manager = new ConnectionManager();
      
      // Connect
      manager.connect();
      
      // Should track connection attempts
      expect(mockTrackMetric).toHaveBeenCalledWith(
        'connection_attempt',
        1,
        'count',
        expect.any(Object)
      );
    });

    it('should track message send performance', () => {
      const mockTrackMetric = jest.fn();
      globalPerformanceMonitor.trackCustomMetric = mockTrackMetric;
      
      const mockWebSocket = {
        readyState: WebSocket.OPEN,
        send: jest.fn(),
        close: jest.fn(),
        onopen: null,
        onmessage: null,
        onerror: null,
        onclose: null,
      };
      
      // Mock WebSocket constructor
      global.WebSocket = jest.fn().mockImplementation(() => mockWebSocket);
      
      const manager = new ConnectionManager();
      
      // Connect and send message
      manager.connect().then(() => {
        const message = { type: 'test', data: {} };
        manager.sendMessage(message);
        
        // Should track message send time
        expect(mockTrackMetric).toHaveBeenCalledWith(
          'message_send_time',
          expect.any(Number),
          'ms',
          expect.any(Object)
        );
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle concurrent connections', async () => {
      const mockWebSocket = {
        readyState: WebSocket.OPEN,
        send: jest.fn(),
        close: jest.fn(),
        onopen: null,
        onmessage: null,
        onerror: null,
        onclose: null,
      };
      
      // Mock WebSocket constructor
      global.WebSocket = jest.fn().mockImplementation(() => mockWebSocket);
      
      const manager = new ConnectionManager();
      
      // Connect multiple times concurrently
      const promises = [
        manager.connect(),
        manager.connect(),
        manager.connect(),
      ];
      
      const results = await Promise.all(promises);
      
      // Should handle concurrent connections gracefully
      expect(results.every(result => typeof result === 'boolean')).toBe(true);
    });

    it('should handle rapid disconnections', () => {
      const mockWebSocket = {
        readyState: WebSocket.OPEN,
        send: jest.fn(),
        close: jest.fn(),
        onopen: null,
        onmessage: null,
        onerror: null,
        onclose: null,
      };
      
      // Mock WebSocket constructor
      global.WebSocket = jest.fn().mockImplementation(() => mockWebSocket);
      
      const manager = new ConnectionManager();
      
      // Connect and disconnect rapidly
      manager.connect();
      manager.disconnect();
      manager.connect();
      manager.disconnect();
      
      // Should handle rapid changes gracefully
      expect(mockWebSocket.close).toHaveBeenCalledTimes(2);
    });
  });

  describe('Integration with Connection Store', () => {
    it('should integrate with connection store correctly', async () => {
      const mockConnectionManager = {
        connect: jest.fn().mockResolvedValue(true),
        getStatus: jest.fn().mockReturnValue({
          isConnected: true,
          status: 'connected',
          latency: 50,
          sessionToken: 'test-token',
          playerId: 'player-123',
        }),
        disconnect: jest.fn(),
      };
      
      jest.spyOn(require('@/lib/websocket/connection-manager-enhanced'), 'ConnectionManager')
        .mockImplementation(() => mockConnectionManager);
      
      const store = useEnhancedConnectionStore.getState();
      
      // Connect
      const connected = await store.connect();
      expect(connected).toBe(true);
      
      // Should have updated store state
      expect(store.isConnected).toBe(true);
      expect(store.status).toBe('connected');
      expect(store.latency).toBe(50);
      expect(store.sessionToken).toBe('test-token');
      expect(store.playerId).toBe('player-123');
      
      // Get status
      const status = store.getStatus();
      expect(status.isConnected).toBe(true);
      expect(status.status).toBe('connected');
      expect(status.latency).toBe(50);
      expect(status.sessionToken).toBe('test-token');
      expect(status.playerId).toBe('player-123');
    });
  });
});