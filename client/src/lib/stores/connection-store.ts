import { create } from "zustand";
import { ConnectionStatus } from "@/types/game-types";
import { SessionManager } from "@/lib/websocket/session-manager";
import { useGameStore } from "@/lib/stores/game-store";

interface ConnectionStore {
  status: ConnectionStatus;
  isConnected: boolean;
  lastHeartbeat: number | null;
  latency: number | null;
  sessionToken: string | null;
  playerId: string | null;

  setStatus: (_status: ConnectionStatus) => void;
  setConnected: (_connected: boolean) => void;
  updateHeartbeat: () => void;
  setLatency: (_latency: number) => void;
  setSession: (_token: string, _playerId: string) => void;
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
    set({ isConnected, status: isConnected ? "connected" : "disconnected" });
  },

  updateHeartbeat: (): void => {
    set({ lastHeartbeat: Date.now() });
  },

  setLatency: (latency: number): void => {
    set({ latency });
  },

  setSession: (token: string, playerId: string): void => {
    SessionManager.createSession(token, playerId);
    useGameStore.getState().setCachedPlayerId(playerId);
    set({ sessionToken: token, playerId });
  },

  clearSession: (): void => {
    SessionManager.clearSession();
    useGameStore.getState().setCachedPlayerId(null);
    set({ sessionToken: null, playerId: null });
  },

  reset: (): void => {
    SessionManager.clearSession();
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

if (typeof window !== "undefined") {
  useConnectionStore.getState().initializeFromSession();
}