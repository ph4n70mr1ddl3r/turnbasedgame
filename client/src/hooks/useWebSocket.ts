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

export interface UseWebSocketOptions {
  autoConnect?: boolean;
  url?: string;
}

export interface UseWebSocketReturn {
  connect: () => Promise<boolean>;
  disconnect: () => void;
  sendBetAction: (action: BetAction, amount?: number) => boolean;
  getStatus: () => {
    isConnected: boolean;
    status: 'connected' | 'disconnected' | 'reconnecting';
    latency: number | null;
    sessionToken: string | null;
    playerId: string | null;
  };
  isConnected: boolean;
  connectionStatus: 'connected' | 'disconnected' | 'reconnecting';
  latency: number | null;
  sessionToken: string | null;
  playerId: string | null;
  gameState: ReturnType<typeof gameStateSelector>;
  isMyTurn: boolean;
  availableActions: BetAction[];
  lastError: string | null;
  getMyPlayer: () => PlayerState | null;
  getOpponentPlayer: () => PlayerState | null;
  clearError: () => void;
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
    const manager = managerRef.current;
    if (manager) {
      managerRef.current = null;
      urlRef.current = null;
      connectingRef.current = false;
      manager.disconnect();
    }
  }, []);

  const getOrCreateManager = useCallback((wsUrl: string): ConnectionManager => {
    if (managerRef.current && urlRef.current === wsUrl) {
      return managerRef.current;
    }
    cleanupManager();
    const manager = new ConnectionManager({
      url: wsUrl,
      autoReconnect: true,
    });
    managerRef.current = manager;
    urlRef.current = wsUrl;
    return manager;
  }, [cleanupManager]);

  const performConnection = useCallback(async (
    manager: ConnectionManager,
    signal?: AbortSignal
  ): Promise<boolean> => {
    if (connectingRef.current) {
      logWarn("Connection already in progress, skipping");
      return false;
    }
    
    connectingRef.current = true;
    try {
      const connected = await manager.connect();
      if (signal?.aborted) {
        manager.disconnect();
        return false;
      }
      if (!connected) {
        useGameStore.getState().setError("Failed to connect to game server");
      }
      return connected;
    } catch (error) {
      if (signal?.aborted) {
        return false;
      }
      const errorMessage = error instanceof Error ? error.message : "Connection failed";
      logError("Connection failed:", error);
      useGameStore.getState().setError(errorMessage);
      return false;
    } finally {
      connectingRef.current = false;
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
    const manager = getOrCreateManager(wsUrl);
    return performConnection(manager);
  }, [getOrCreateManager, performConnection]);

  const disconnect = useCallback(() => {
    cleanupManager();
  }, [cleanupManager]);

  const sendBetAction = useCallback((action: BetAction, amount?: number) => {
    if (!managerRef.current) {
      logError("sendBetAction called before connection initialized");
      return false;
    }

    if (!isConnected) {
      logError("sendBetAction called while disconnected");
      return false;
    }

    if (typeof action !== 'string') {
      logError("sendBetAction: invalid action type");
      return false;
    }

    return managerRef.current.sendBetAction(action, amount);
  }, [isConnected]);

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

  useEffect(() => {
    const abortController = new AbortController();

    try {
      initializeConnectionStore();
      initializeGameStore();
    } catch (error) {
      logError("Failed to initialize stores:", error);
      useGameStore.getState().setError("Failed to initialize application. Please refresh the page.");
      return;
    }

    if (autoConnectRef.current !== false) {
      try {
        const wsUrl = optionsUrlRef.current || process.env.NEXT_PUBLIC_WS_URL || getDefaultWebSocketUrl();
        if (wsUrl) {
          const manager = getOrCreateManager(wsUrl);
          performConnection(manager, abortController.signal);
        } else {
          useGameStore.getState().setError("No WebSocket URL configured");
        }
      } catch (error) {
        logError("Failed to setup connection:", error);
        useGameStore.getState().setError("Failed to setup connection. Please refresh the page.");
      }
    }

    return () => {
      abortController.abort();
      cleanupManager();
    };
  }, [getOrCreateManager, performConnection, cleanupManager]);

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