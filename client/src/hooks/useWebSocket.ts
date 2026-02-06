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
  
  // Initialize connection manager
  const initManager = useCallback(() => {
    if (managerRef.current) {
      managerRef.current.disconnect();
    }
    
    managerRef.current = new ConnectionManager({
      url: options.url,
      autoReconnect: true,
    });
    
    return managerRef.current;
  }, [options.url]);
  
  // Connect to server
  const connect = useCallback(async () => {
    const manager = managerRef.current || initManager();
    return manager.connect();
  }, [initManager]);
  
  // Disconnect from server
  const disconnect = useCallback(() => {
    if (managerRef.current) {
      managerRef.current.disconnect();
    }
  }, []);
  
  // Send bet action
  const sendBetAction = useCallback((action: BetAction, amount?: number) => {
    if (!managerRef.current) {
      logError("Connection manager not initialized");
      return false;
    }

    return managerRef.current.sendBetAction(action, amount);
  }, []);
  
  // Get connection status
  const getStatus = useCallback(() => {
    if (!managerRef.current) {
      return {
        isConnected: false,
        status: "disconnected",
        latency: null,
        sessionToken: null,
        playerId: null,
      };
    }
    
    return managerRef.current.getStatus();
  }, []);
  
  // Auto-connect on mount if enabled
  useEffect(() => {
    if (options.autoConnect !== false) {
      const manager = initManager();
      manager.connect();
    }
    
    // Cleanup on unmount
    return () => {
      if (managerRef.current) {
        managerRef.current.disconnect();
        managerRef.current = null;
      }
    };
  }, [initManager, options.autoConnect]);

  return {
    // Connection methods
    connect,
    disconnect,
    sendBetAction,
    getStatus,
    
    // State
    isConnected: connectionStore.isConnected,
    connectionStatus: connectionStore.status,
    latency: connectionStore.latency,
    sessionToken: connectionStore.sessionToken,
    playerId: connectionStore.playerId,
    
    // Game state
    gameState: gameStore.gameState,
    isMyTurn: gameStore.isMyTurn,
    availableActions: gameStore.availableActions,
    lastError: gameStore.lastError,
    
    // Helper methods
    getMyPlayer: gameStore.getMyPlayer,
    getOpponentPlayer: gameStore.getOpponentPlayer,
    clearError: gameStore.clearError,
  };
}

// Hook for accessing the connection manager instance directly
export function useConnectionManager() {
  const managerRef = useRef<ConnectionManager | null>(null);
  
  useEffect(() => {
    const instance = ConnectionManager.getInstance();
    managerRef.current = instance;
    
    return () => {
      // Don't destroy instance on unmount - let it persist
    };
  }, []);
  
  return {
    getInstance: () => managerRef.current || ConnectionManager.getInstance(),
    disconnect: () => managerRef.current?.disconnect(),
    connect: () => managerRef.current?.connect(),
  };
}