import { useEffect, useRef, useCallback } from "react";
import { ConnectionManager } from "@/lib/websocket/connection-manager";
import { useConnectionStore } from "@/lib/stores/connection-store";
import { useGameStore } from "@/lib/stores/game-store";
import { BetAction } from "@/types/game-types";
import { logError } from "@/lib/utils/logger";

export interface UseWebSocketOptions {
  autoConnect?: boolean;
  url?: string;
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const managerRef = useRef<ConnectionManager | null>(null);
  const connectionStore = useConnectionStore();
  const gameStore = useGameStore();

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

    isConnected: connectionStore.isConnected,
    connectionStatus: connectionStore.status,
    latency: connectionStore.latency,
    sessionToken: connectionStore.sessionToken,
    playerId: connectionStore.playerId,

    gameState: gameStore.gameState,
    isMyTurn: gameStore.isMyTurn,
    availableActions: gameStore.availableActions,
    lastError: gameStore.lastError,

    getMyPlayer: gameStore.getMyPlayer,
    getOpponentPlayer: gameStore.getOpponentPlayer,
    clearError: gameStore.clearError,
  };
}

export function useConnectionManager() {
  const managerRef = useRef<ConnectionManager | null>(null);

  useEffect(() => {
    return () => {
      if (managerRef.current) {
        managerRef.current.disconnect();
        managerRef.current = null;
      }
    };
  }, []);

  const getManager = useCallback((options?: { url?: string }) => {
    if (!managerRef.current) {
      managerRef.current = new ConnectionManager({
        url: options?.url,
        autoReconnect: true,
      });
    }
    return managerRef.current;
  }, []);

  return {
    getManager,
    disconnect: () => managerRef.current?.disconnect(),
    connect: (options?: { url?: string }) => getManager(options).connect(),
  };
}