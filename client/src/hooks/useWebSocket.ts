import { useEffect, useRef, useCallback } from "react";
import { ConnectionManager } from "@/lib/websocket/connection-manager";
import {
  useConnectionStore,
  connectionStatusSelector,
  isConnectedSelector,
  latencySelector,
  sessionTokenSelector,
  playerIdSelector,
} from "@/lib/stores/connection-store";
import {
  useGameStore,
  gameStateSelector,
  isMyTurnSelector,
  availableActionsSelector,
  lastErrorSelector,
} from "@/lib/stores/game-store";
import { BetAction } from "@/types/game-types";
import { logError } from "@/lib/utils/logger";

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

export function useWebSocket(options: UseWebSocketOptions = {}): UseWebSocketReturn {
  const managerRef = useRef<ConnectionManager | null>(null);

  const isConnected = useConnectionStore(isConnectedSelector);
  const connectionStatus = useConnectionStore(connectionStatusSelector);
  const latency = useConnectionStore(latencySelector);
  const sessionToken = useConnectionStore(sessionTokenSelector);
  const playerId = useConnectionStore(playerIdSelector);

  const gameState = useGameStore(gameStateSelector);
  const isMyTurn = useGameStore(isMyTurnSelector);
  const availableActions = useGameStore(availableActionsSelector);
  const lastError = useGameStore(lastErrorSelector);
  const getMyPlayer = useGameStore((s) => s.getMyPlayer);
  const getOpponentPlayer = useGameStore((s) => s.getOpponentPlayer);
  const clearError = useGameStore((s) => s.clearError);

  const connect = useCallback(async () => {
    if (managerRef.current) {
      return managerRef.current.connect();
    }
    return false;
  }, []);

  const disconnect = useCallback(() => {
    if (managerRef.current) {
      managerRef.current.disconnect();
    }
  }, []);

  const sendBetAction = useCallback((action: BetAction, amount?: number) => {
    if (!managerRef.current) {
      logError("Connection manager not initialized");
      return false;
    }

    return managerRef.current.sendBetAction(action, amount);
  }, []);

  const getStatus = useCallback(() => {
    if (!managerRef.current) {
      return {
        isConnected: false,
        status: "disconnected" as const,
        latency: null,
        sessionToken: null,
        playerId: null,
      };
    }

    return managerRef.current.getStatus();
  }, []);

  useEffect(() => {
    if (options.autoConnect !== false && !managerRef.current) {
      managerRef.current = new ConnectionManager({
        url: options.url,
        autoReconnect: true,
      });
      managerRef.current.connect();
    }

    return () => {
      if (managerRef.current) {
        managerRef.current.disconnect();
        managerRef.current = null;
      }
    };
  }, [options.autoConnect, options.url]);

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