import { create } from "zustand";
import { ConnectionStatus } from "@/types/game-types";
import { SessionManager } from "@/lib/websocket/session-manager";
import { useGameStore } from "@/lib/stores/game-store";
import { logError } from "@/lib/utils/logger";

interface ConnectionStore {
  status: ConnectionStatus;
  isConnected: boolean;
  lastHeartbeat: number | null;
  latency: number | null;
  sessionToken: string | null;
  playerId: string | null;

  setStatus: (status: ConnectionStatus) => void;
  setConnected: (connected: boolean) => void;
  updateHeartbeat: () => void;
  setLatency: (latency: number) => void;
  setSession: (token: string, playerId: string) => void;
  clearSession: () => void;
  reset: () => void;
  initializeFromSession: () => void;
}

export const useConnectionStore = create<ConnectionStore>((set) => ({
  status: "disconnected",
  isConnected: false,
  lastHeartbeat: null,
  latency: null,
  sessionToken: null,
  playerId: null,

  initializeFromSession: (): void => {
    if (typeof window === "undefined") return;
    const session = SessionManager.getSession();
    if (session) {
      useGameStore.getState().setCachedPlayerId(session.playerId);
      set({ sessionToken: session.token, playerId: session.playerId });
    }
  },

  setStatus: (status: ConnectionStatus): void => {
    set({ status });
  },

  setConnected: (isConnected: boolean): void => {
    set((state) => ({
      isConnected,
      status: isConnected ? "connected" : (state.status === "reconnecting" ? "reconnecting" : "disconnected"),
    }));
  },

  updateHeartbeat: (): void => {
    set({ lastHeartbeat: Date.now() });
  },

  setLatency: (latency: number): void => {
    set({ latency });
  },

  setSession: (token: string, playerId: string): void => {
    try {
      SessionManager.createSession(token, playerId);
      useGameStore.getState().setCachedPlayerId(playerId);
      set({ sessionToken: token, playerId });
    } catch (error) {
      logError("Failed to persist session:", error);
      set({ sessionToken: token, playerId });
    }
  },

  clearSession: (): void => {
    try {
      SessionManager.clearSession();
    } catch (error) {
      logError("Failed to clear session:", error);
    }
    useGameStore.getState().setCachedPlayerId(null);
    set({ sessionToken: null, playerId: null });
  },

  reset: (): void => {
    try {
      SessionManager.clearSession();
    } catch (error) {
      logError("Failed to clear session during reset:", error);
    }
    useGameStore.getState().setCachedPlayerId(null);
    set({
      status: "disconnected",
      isConnected: false,
      lastHeartbeat: null,
      latency: null,
      sessionToken: null,
      playerId: null,
    });
  },
}));

export const connectionStatusSelector = (
  state: ConnectionStore,
): ConnectionStatus => state.status;
export const isConnectedSelector = (state: ConnectionStore): boolean =>
  state.isConnected;
export const sessionTokenSelector = (state: ConnectionStore): string | null =>
  state.sessionToken;
export const playerIdSelector = (state: ConnectionStore): string | null =>
  state.playerId;
export const latencySelector = (state: ConnectionStore): number | null =>
  state.latency;
export const lastHeartbeatSelector = (state: ConnectionStore): number | null =>
  state.lastHeartbeat;

export interface ConnectionSelectorState {
  isConnected: boolean;
  status: ConnectionStatus;
  latency: number | null;
  sessionToken: string | null;
  playerId: string | null;
}

export const connectionSelector = (state: ConnectionStore): ConnectionSelectorState => ({
  isConnected: state.isConnected,
  status: state.status,
  latency: state.latency,
  sessionToken: state.sessionToken,
  playerId: state.playerId,
});

export function initializeConnectionStore(): void {
  if (typeof window !== "undefined") {
    useConnectionStore.getState().initializeFromSession();
  }
}