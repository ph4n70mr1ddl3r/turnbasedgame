/**
 * Custom hook for managing WebSocket connections and game state
 * 
 * This hook provides a complete interface for connecting to the game server,
 * handling WebSocket messages, managing game state, and sending player actions.
 * It includes automatic reconnection, error handling, and session management.
 * 
 * @example
 * ```tsx
 * const { 
 *   connect, 
 *   disconnect, 
 *   isConnected, 
 *   gameState, 
 *   sendBetAction 
 * } = useWebSocket({ autoConnect: true });
 * ```
 */
import { useEffect, useRef, useCallback } from "react";
import { ConnectionManager } from "@/lib/websocket/connection-manager";
import {
  useConnectionStore,
  connectionSelector,
  initializeConnectionStore,
} from "@/lib/stores/connection-store";
import {
  useGameStore,
  gameStateSelector,
  isMyTurnSelector,
  availableActionsSelector,
  lastErrorSelector,
  initializeGameStore,
} from "@/lib/stores/game-store";
import { BetAction, PlayerState } from "@/types/game-types";
import { logError, logWarn } from "@/lib/utils/logger";
import { getDefaultWebSocketUrl } from "@/lib/constants/game";

/**
 * Configuration options for the WebSocket hook
 */
export interface UseWebSocketOptions {
  /** Whether to automatically connect on component mount */
  autoConnect?: boolean;
  /** Custom WebSocket URL to connect to */
  url?: string;
}

/**
 * Return value from the useWebSocket hook containing all connection and game state
 */
export interface UseWebSocketReturn {
  /** Connection methods */
  connect: () => Promise<boolean>;        /** Manually connect to the server */
  disconnect: () => void;                 /** Disconnect from the server */
  
  /** Action methods */
  sendBetAction: (action: BetAction, amount?: number) => boolean; /** Send betting action */
  
  /** Status methods */
  getStatus: () => {                      /** Get comprehensive connection status */
    isConnected: boolean;
    status: 'connected' | 'disconnected' | 'reconnecting';
    latency: number | null;
    sessionToken: string | null;
    playerId: string | null;
  };
  
  /** Connection state */
  isConnected: boolean;                   /** Whether currently connected */
  connectionStatus: 'connected' | 'disconnected' | 'reconnecting'; /** Connection status */
  latency: number | null;                /** Connection latency in ms */
  sessionToken: string | null;            /** Server session token */
  playerId: string | null;                /** Player ID assigned by server */
  
  /** Game state */
  gameState: ReturnType<typeof gameStateSelector>;      /** Current game state */
  isMyTurn: boolean;                     /** Whether it's the current player's turn */
  availableActions: BetAction[];          /** Available betting actions */
  lastError: string | null;               /** Last error message */
  
  /** Utility methods */
  getMyPlayer: () => PlayerState | null;          /** Get current player state */
  getOpponentPlayer: () => PlayerState | null;      /** Get opponent player state */
  clearError: () => void;                 /** Clear last error message */
}

const DISCONNECTED_STATUS = {
  isConnected: false,
  status: "disconnected" as const,
  latency: null,
  sessionToken: null,
  playerId: null,
};

export function useWebSocket(options: UseWebSocketOptions = {}): UseWebSocketReturn {
  const managerRef = useRef<ConnectionManager | null>(null);
  const connectingRef = useRef(false);
  const urlRef = useRef<string | null>(null);
  const cleanupRequestedRef = useRef(false);
  const hasInitializedRef = useRef(false);
  // Stable references that don't change across renders
  const autoConnectRef = useRef(options.autoConnect);
  const optionsUrlRef = useRef(options.url);

  const {
    isConnected,
    status: connectionStatus,
    latency,
    sessionToken,
    playerId,
  } = useConnectionStore(connectionSelector);

  const gameState = useGameStore(gameStateSelector);
  const isMyTurn = useGameStore(isMyTurnSelector);
  const availableActions = useGameStore(availableActionsSelector);
  const lastError = useGameStore(lastErrorSelector);

  const getMyPlayer = useCallback(
    () => useGameStore.getState().getMyPlayer(),
    [],
  );
  const getOpponentPlayer = useCallback(
    () => useGameStore.getState().getOpponentPlayer(),
    [],
  );
  const clearError = useCallback(
    () => useGameStore.getState().clearError(),
    [],
  );

  const cleanupManager = useCallback((): void => {
    if (cleanupRequestedRef.current) return;
    
    cleanupRequestedRef.current = true;
    const manager = managerRef.current;
    if (manager) {
      try {
        managerRef.current = null;
        urlRef.current = null;
        connectingRef.current = false;
        manager.disconnect();
      } catch (error) {
        logError('Error during cleanup:', error);
      }
    }
  }, []);

  const connect = useCallback(async (): Promise<boolean> => {
    if (connectingRef.current) {
      logWarn("Connection already in progress");
      return false;
    }

    const wsUrl = optionsUrlRef.current || process.env.NEXT_PUBLIC_WS_URL || getDefaultWebSocketUrl();
    if (!wsUrl) {
      logError("No WebSocket URL configured");
      useGameStore.getState().setError("No WebSocket URL configured");
      return false;
    }

    // Reuse existing manager if URL hasn't changed and it's still usable
    if (managerRef.current && urlRef.current === wsUrl) {
      logWarn("Reusing existing connection manager for same URL");
    } else {
      cleanupManager();
      const manager = new ConnectionManager({
        url: wsUrl,
        autoReconnect: true,
      });
      managerRef.current = manager;
      urlRef.current = wsUrl;
    }

    connectingRef.current = true;
    try {
      const manager = managerRef.current;
      if (!manager) {
        connectingRef.current = false;
        return false;
      }
      const connected = await manager.connect();
      if (!connected) {
        useGameStore.getState().setError("Failed to connect to game server");
        return false;
      }
      return connected;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Connection failed";
      logError("Connection failed:", error);
      useGameStore.getState().setError(errorMessage);
      return false;
    } finally {
      connectingRef.current = false;
    }
  }, [cleanupManager]);

  const disconnect = useCallback(() => {
    cleanupManager();
  }, [cleanupManager]);

  const sendBetAction = useCallback((action: BetAction, amount?: number) => {
    if (!managerRef.current) {
      logError("sendBetAction called before connection initialized");
      useGameStore.getState().setError("Connection not initialized. Please refresh the page.");
      return false;
    }

    // Read directly from store to avoid stale closure over isConnected
    const connectionState = useConnectionStore.getState();
    if (!connectionState.isConnected) {
      logError("sendBetAction called while disconnected");
      useGameStore.getState().setError("Not connected to server. Please check your connection.");
      return false;
    }

    if (typeof action !== 'string') {
      logError("sendBetAction: invalid action type", { action });
      useGameStore.getState().setError("Invalid action type. Please try again.");
      return false;
    }

    try {
      return managerRef.current.sendBetAction(action, amount);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to send bet action";
      logError("Bet action failed:", error);
      useGameStore.getState().setError(errorMessage);
      return false;
    }
  }, []);

  const getStatus = useCallback(() => {
    if (!managerRef.current) {
      return DISCONNECTED_STATUS;
    }

    return managerRef.current.getStatus();
  }, []);

  useEffect(() => {
    autoConnectRef.current = options.autoConnect;
    optionsUrlRef.current = options.url;
  }, [options.autoConnect, options.url]);

  // Initialize stores and optionally auto-connect - runs once on mount
  useEffect(() => {
    if (hasInitializedRef.current) return;
    hasInitializedRef.current = true;

    let isMounted = true;
    
    try {
      initializeConnectionStore();
      initializeGameStore();
    } catch (error) {
      logError("Failed to initialize stores:", error);
      if (isMounted) {
        useGameStore.getState().setError("Failed to initialize application. Please refresh the page.");
      }
      return;
    }

    // Auto-connect uses the same connect() callback to avoid duplicate ConnectionManager creation
    if (autoConnectRef.current !== false) {
      connect();
    }

    return () => {
      isMounted = false;
      cleanupManager();
    };
  }, [connect, cleanupManager]);

  return {
    connect,
    disconnect,
    sendBetAction,
    getStatus,

    isConnected,
    connectionStatus,
    latency,
    sessionToken,
    playerId,

    gameState,
    isMyTurn,
    availableActions,
    lastError,

    getMyPlayer,
    getOpponentPlayer,
    clearError,
  };
}