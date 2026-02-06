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
  setStatus: (status: ConnectionStatus) => void;
  setConnected: (connected: boolean) => void;
  updateHeartbeat: () => void;
  setLatency: (latency: number) => void;
  setSession: (token: string, playerId: string) => void;
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
  setStatus: (_status: ConnectionStatus) => set({ status: _status }),
  
  setConnected: (_isConnected: boolean) =>
    set({ isConnected: _isConnected, status: _isConnected ? "connected" : "disconnected" }),
  
  updateHeartbeat: () => set({ lastHeartbeat: Date.now() }),
  
  setLatency: (_latency: number) => set({ latency: _latency }),
  
  setSession: (_token: string, _playerId: string) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem("poker_session_token", _token);
      localStorage.setItem("poker_player_id", _playerId);
    }
    set({ sessionToken: _token, playerId: _playerId });
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