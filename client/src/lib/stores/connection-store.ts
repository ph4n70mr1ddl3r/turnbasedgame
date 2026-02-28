import { create } from "zustand";
import { ConnectionStatus } from "@/types/game-types";
import { SessionManager } from "@/lib/websocket/session-manager";
import { setCachedPlayerId } from "@/lib/stores/game-store";

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
}

function getInitialSession(): { token: string | null; playerId: string | null } {
  if (typeof window === "undefined") {
    return { token: null, playerId: null };
  }
  const session = SessionManager.getSession();
  return {
    token: session?.token ?? null,
    playerId: session?.playerId ?? null,
  };
}

const initialSession = getInitialSession();

export const useConnectionStore = create<ConnectionStore>((set) => ({
  status: "disconnected",
  isConnected: false,
  lastHeartbeat: null,
  latency: null,
  sessionToken: initialSession.token,
  playerId: initialSession.playerId,

  setStatus: (status: ConnectionStatus) => set({ status }),

  setConnected: (isConnected: boolean) =>
    set({ isConnected, status: isConnected ? "connected" : "disconnected" }),

  updateHeartbeat: () => set({ lastHeartbeat: Date.now() }),

  setLatency: (latency: number) => set({ latency }),

  setSession: (token: string, playerId: string) => {
    SessionManager.createSession(token, playerId);
    setCachedPlayerId(playerId);
    set({ sessionToken: token, playerId });
  },

  clearSession: () => {
    SessionManager.clearSession();
    setCachedPlayerId(null);
    set({ sessionToken: null, playerId: null });
  },

  reset: () => {
    SessionManager.clearSession();
    setCachedPlayerId(null);
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

export const connectionStatusSelector = (state: ConnectionStore) => state.status;
export const isConnectedSelector = (state: ConnectionStore) => state.isConnected;
export const sessionTokenSelector = (state: ConnectionStore) => state.sessionToken;
export const playerIdSelector = (state: ConnectionStore) => state.playerId;
export const latencySelector = (state: ConnectionStore) => state.latency;