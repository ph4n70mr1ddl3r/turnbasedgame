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
import { BetAction } from "@/types/game-types";
import { logError } from "@/lib/utils/logger";
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
    status: "connected" | "disconnected" | "reconnecting";
    latency: number | null;
    sessionToken: string | null;
    playerId: string | null;
  };
  isConnected: boolean;
  connectionStatus: "connected" | "disconnected" | "reconnecting";
  latency: number | null;
  sessionToken: string | null;
  playerId: string | null;
  gameState: ReturnType<typeof gameStateSelector>;
  isMyTurn: boolean;
  availableActions: BetAction[];
  lastError: string | null;
  getMyPlayer: () => ReturnType<typeof useGameStore.getState>["getMyPlayer"] extends () => infer R ? R : never;
  getOpponentPlayer: () => ReturnType<typeof useGameStore.getState>["getOpponentPlayer"] extends () => infer R ? R : never;
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
  const autoConnect = options.autoConnect;
  const url = options.url;

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

  const createManager = useCallback((wsUrl: string): ConnectionManager => {
    if (managerRef.current) {
      managerRef.current.disconnect();
    }
    const manager = new ConnectionManager({
      url: wsUrl,
      autoReconnect: true,
    });
    managerRef.current = manager;
    return manager;
  }, []);

  const performConnection = useCallback(async (
    manager: ConnectionManager,
    signal?: AbortSignal
  ): Promise<boolean> => {
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
      logError("Connection failed:", error);
      useGameStore.getState().setError("Connection failed");
      return false;
    } finally {
      connectingRef.current = false;
    }
  }, []);

  const connect = useCallback(async (): Promise<boolean> => {
    if (connectingRef.current) {
      logError("Connection already in progress");
      return false;
    }

    const wsUrl = url || process.env.NEXT_PUBLIC_WS_URL || getDefaultWebSocketUrl();
    const manager = managerRef.current || createManager(wsUrl);
    return performConnection(manager);
  }, [url, createManager, performConnection]);

  const disconnect = useCallback(() => {
    if (managerRef.current) {
      managerRef.current.disconnect();
    }
  }, []);

  const sendBetAction = useCallback((action: BetAction, amount?: number) => {
    if (!managerRef.current) {
      logError("sendBetAction called before connection initialized");
      return false;
    }

    if (!isConnected) {
      logError("sendBetAction called while disconnected");
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
    const abortController = new AbortController();

    initializeConnectionStore();
    initializeGameStore();

    if (autoConnect !== false) {
      const wsUrl = url || process.env.NEXT_PUBLIC_WS_URL || getDefaultWebSocketUrl();
      const manager = createManager(wsUrl);
      performConnection(manager, abortController.signal);
    }

    return () => {
      abortController.abort();
      connectingRef.current = false;
      if (managerRef.current) {
        managerRef.current.disconnect();
        managerRef.current = null;
      }
    };
  }, [autoConnect, url, createManager, performConnection]);

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