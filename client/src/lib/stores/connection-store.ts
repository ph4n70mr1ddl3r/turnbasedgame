import { create } from "zustand";
import { ConnectionStatus } from "@/types/game-types";

interface ConnectionStore {
  // Connection state
  status: ConnectionStatus;
  isConnected: boolean;
  lastHeartbeat: number | null;
  latency: number | null;
  
  // Session
  sessionToken: string | null;
  playerId: string | null;
  
  // Actions
  setStatus: (_status: ConnectionStatus) => void; // eslint-disable-line no-unused-vars
  setConnected: (_connected: boolean) => void; // eslint-disable-line no-unused-vars
  updateHeartbeat: () => void;
  setLatency: (_latency: number) => void; // eslint-disable-line no-unused-vars
  setSession: (_token: string, _playerId: string) => void; // eslint-disable-line no-unused-vars
  clearSession: () => void;
  reset: () => void;
}

export const useConnectionStore = create<ConnectionStore>((set) => ({
  // Initial state
  status: "disconnected",
  isConnected: false,
  lastHeartbeat: null,
  latency: null,
  sessionToken: typeof window !== 'undefined' ? localStorage.getItem("poker_session_token") || null : null,
  playerId: typeof window !== 'undefined' ? localStorage.getItem("poker_player_id") || null : null,
  
  // Actions
  setStatus: (status: ConnectionStatus) => set({ status }),
  
  setConnected: (isConnected: boolean) =>
    set({ isConnected, status: isConnected ? "connected" : "disconnected" }),
  
  updateHeartbeat: () => set({ lastHeartbeat: Date.now() }),
  
  setLatency: (latency: number) => set({ latency }),
  
  setSession: (token: string, playerId: string) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem("poker_session_token", token);
      localStorage.setItem("poker_player_id", playerId);
    }
    set({ sessionToken: token, playerId });
  },
  
  clearSession: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem("poker_session_token");
      localStorage.removeItem("poker_player_id");
    }
    set({ sessionToken: null, playerId: null });
  },
  
  reset: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem("poker_session_token");
      localStorage.removeItem("poker_player_id");
    }
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

// Selectors
export const connectionStatusSelector = (state: ConnectionStore) => state.status;
export const isConnectedSelector = (state: ConnectionStore) => state.isConnected;
export const sessionTokenSelector = (state: ConnectionStore) => state.sessionToken;
export const playerIdSelector = (state: ConnectionStore) => state.playerId;
export const latencySelector = (state: ConnectionStore) => state.latency;