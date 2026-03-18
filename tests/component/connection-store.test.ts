import { describe, test, expect, beforeEach, jest, afterEach } from '@jest/globals';
import {
  useConnectionStore,
  connectionStatusSelector,
  latencySelector,
  connectionSelector,
  clearAllPlayerIdCallbacks,
  registerPlayerIdCallback,
} from '@/lib/stores/connection-store';
import { ConnectionStatus } from '@/types/game-types';

describe('connection-store', () => {
  beforeEach(() => {
    useConnectionStore.getState().reset();
    clearAllPlayerIdCallbacks();
    jest.clearAllMocks();
  });

  afterEach(() => {
    useConnectionStore.getState().reset();
    clearAllPlayerIdCallbacks();
  });

  describe('initial state', () => {
    test('should have correct initial state', () => {
      const state = useConnectionStore.getState();

      expect(state.status).toBe('disconnected');
      expect(state.isConnected).toBe(false);
      expect(state.lastHeartbeat).toBeNull();
      expect(state.latency).toBeNull();
      expect(state.sessionToken).toBeNull();
      expect(state.playerId).toBeNull();
    });
  });

  describe('setStatus', () => {
    test('should set status to connected', () => {
      useConnectionStore.getState().setStatus('connected');

      expect(useConnectionStore.getState().status).toBe('connected');
    });

    test('should set status to disconnected', () => {
      useConnectionStore.getState().setStatus('connected');
      useConnectionStore.getState().setStatus('disconnected');

      expect(useConnectionStore.getState().status).toBe('disconnected');
    });

    test('should set status to reconnecting', () => {
      useConnectionStore.getState().setStatus('reconnecting');

      expect(useConnectionStore.getState().status).toBe('reconnecting');
    });
  });

  describe('setConnected', () => {
    test('should set isConnected to true and status to connected', () => {
      useConnectionStore.getState().setConnected(true);

      expect(useConnectionStore.getState().isConnected).toBe(true);
      expect(useConnectionStore.getState().status).toBe('connected');
    });

    test('should set isConnected to false and status to disconnected', () => {
      useConnectionStore.getState().setConnected(true);
      useConnectionStore.getState().setConnected(false);

      expect(useConnectionStore.getState().isConnected).toBe(false);
      expect(useConnectionStore.getState().status).toBe('disconnected');
    });

    test('should preserve reconnecting status when disconnecting', () => {
      useConnectionStore.getState().setStatus('reconnecting');
      useConnectionStore.getState().setConnected(false);

      expect(useConnectionStore.getState().status).toBe('reconnecting');
    });
  });

  describe('updateHeartbeat', () => {
    test('should update lastHeartbeat timestamp', () => {
      const before = Date.now();
      useConnectionStore.getState().updateHeartbeat();
      const after = Date.now();

      const heartbeat = useConnectionStore.getState().lastHeartbeat;
      expect(heartbeat).not.toBeNull();
      expect(heartbeat!).toBeGreaterThanOrEqual(before);
      expect(heartbeat!).toBeLessThanOrEqual(after);
    });
  });

  describe('setLatency', () => {
    test('should set latency value', () => {
      useConnectionStore.getState().setLatency(50);

      expect(useConnectionStore.getState().latency).toBe(50);
    });

    test('should update latency value', () => {
      useConnectionStore.getState().setLatency(50);
      useConnectionStore.getState().setLatency(100);

      expect(useConnectionStore.getState().latency).toBe(100);
    });
  });

  describe('setSession', () => {
    test('should set session token and player id', () => {
      useConnectionStore.getState().setSession('token-123', 'p1');

      expect(useConnectionStore.getState().sessionToken).toBe('token-123');
      expect(useConnectionStore.getState().playerId).toBe('p1');
    });

    test('should notify callback when session is set', () => {
      const callback = jest.fn<(playerId: string | null) => void>();
      registerPlayerIdCallback(callback);

      useConnectionStore.getState().setSession('token-123', 'p1');

      expect(callback).toHaveBeenCalledWith('p1');
    });
  });

  describe('clearSession', () => {
    test('should clear session token and player id', () => {
      useConnectionStore.getState().setSession('token-123', 'p1');
      useConnectionStore.getState().clearSession();

      expect(useConnectionStore.getState().sessionToken).toBeNull();
      expect(useConnectionStore.getState().playerId).toBeNull();
    });

    test('should notify callback with null when session is cleared', () => {
      const callback = jest.fn<(playerId: string | null) => void>();
      registerPlayerIdCallback(callback);
      useConnectionStore.getState().setSession('token-123', 'p1');

      useConnectionStore.getState().clearSession();

      expect(callback).toHaveBeenCalledWith(null);
    });
  });

  describe('reset', () => {
    test('should reset all state to initial values', () => {
      useConnectionStore.getState().setStatus('connected');
      useConnectionStore.getState().setConnected(true);
      useConnectionStore.getState().updateHeartbeat();
      useConnectionStore.getState().setLatency(100);
      useConnectionStore.getState().setSession('token', 'p1');

      useConnectionStore.getState().reset();

      const state = useConnectionStore.getState();
      expect(state.status).toBe('disconnected');
      expect(state.isConnected).toBe(false);
      expect(state.lastHeartbeat).toBeNull();
      expect(state.latency).toBeNull();
      expect(state.sessionToken).toBeNull();
      expect(state.playerId).toBeNull();
    });

    test('should notify callback with null on reset', () => {
      const callback = jest.fn<(playerId: string | null) => void>();
      registerPlayerIdCallback(callback);
      useConnectionStore.getState().setSession('token', 'p1');
      callback.mockClear();

      useConnectionStore.getState().reset();

      expect(callback).toHaveBeenCalledWith(null);
    });
  });

  describe('selectors', () => {
    test('connectionStatusSelector should return status', () => {
      useConnectionStore.getState().setStatus('connected');

      const result = connectionStatusSelector(useConnectionStore.getState());

      expect(result).toBe('connected');
    });

    test('latencySelector should return latency', () => {
      useConnectionStore.getState().setLatency(75);

      const result = latencySelector(useConnectionStore.getState());

      expect(result).toBe(75);
    });

    test('connectionSelector should return all connection state', () => {
      useConnectionStore.getState().setConnected(true);
      useConnectionStore.getState().setLatency(50);
      useConnectionStore.getState().setSession('token-abc', 'p2');

      const result = connectionSelector(useConnectionStore.getState());

      expect(result).toEqual({
        isConnected: true,
        status: 'connected',
        latency: 50,
        sessionToken: 'token-abc',
        playerId: 'p2',
      });
    });
  });

  describe('playerIdCallback', () => {
    test('should register and receive notifications', () => {
      const callback = jest.fn<(playerId: string | null) => void>();
      registerPlayerIdCallback(callback);

      useConnectionStore.getState().setSession('token', 'p1');

      expect(callback).toHaveBeenCalledWith('p1');
    });

    test('should unregister callback when cleanup function is called', () => {
      const callback = jest.fn<(playerId: string | null) => void>();
      const cleanup = registerPlayerIdCallback(callback);

      cleanup();
      useConnectionStore.getState().setSession('token', 'p1');

      expect(callback).not.toHaveBeenCalled();
    });

    test('should support multiple callbacks', () => {
      const callback1 = jest.fn<(playerId: string | null) => void>();
      const callback2 = jest.fn<(playerId: string | null) => void>();

      registerPlayerIdCallback(callback1);
      registerPlayerIdCallback(callback2);

      useConnectionStore.getState().setSession('token', 'p1');

      expect(callback1).toHaveBeenCalledWith('p1');
      expect(callback2).toHaveBeenCalledWith('p1');
    });

    test('clearAllPlayerIdCallbacks should remove all callbacks', () => {
      const callback = jest.fn<(playerId: string | null) => void>();
      registerPlayerIdCallback(callback);

      clearAllPlayerIdCallbacks();
      useConnectionStore.getState().setSession('token', 'p1');

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('state transitions', () => {
    test('should handle full connection lifecycle', () => {
      useConnectionStore.getState().setStatus('reconnecting');
      expect(useConnectionStore.getState().status).toBe('reconnecting');

      useConnectionStore.getState().setConnected(true);
      expect(useConnectionStore.getState().isConnected).toBe(true);
      expect(useConnectionStore.getState().status).toBe('connected');

      useConnectionStore.getState().setSession('token', 'p1');
      expect(useConnectionStore.getState().playerId).toBe('p1');

      useConnectionStore.getState().setLatency(30);
      expect(useConnectionStore.getState().latency).toBe(30);

      useConnectionStore.getState().reset();
      expect(useConnectionStore.getState().isConnected).toBe(false);
      expect(useConnectionStore.getState().playerId).toBeNull();
    });
  });
});
