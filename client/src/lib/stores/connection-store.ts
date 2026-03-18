import { create } from "zustand";
import { ConnectionStatus } from "@/types/game-types";
import { SessionManager } from "@/lib/websocket/session-manager";
import { logError } from "@/lib/utils/logger";

type PlayerIdCallback = (playerId: string | null) => void;

const MAX_CALLBACKS = 100;

interface CallbackEntry {
  callback: PlayerIdCallback;
  id: number;
}

interface CallbackRegistryState {
  entries: CallbackEntry[];
  nextId: number;
}

function createCallbackRegistry(): {
  clear: () => void;
  register: (callback: PlayerIdCallback) => () => void;
  notify: (playerId: string | null) => void;
} {
  const state: CallbackRegistryState = {
    entries: [],
    nextId: 0,
  };

  return {
    clear(): void {
      state.entries = [];
      state.nextId = 0;
    },

    register(callback: PlayerIdCallback): () => void {
      if (state.entries.length >= MAX_CALLBACKS) {
        const removed = state.entries.shift();
        if (removed) {
          try {
            removed.callback(null);
          } catch {
            // Ignore cleanup errors
          }
        }
        console.error('[CONNECTION] Callback registry overflow - oldest callback removed. Check for memory leaks.');
      }
      const id = state.nextId++;
      state.entries.push({ callback, id });
      return () => {
        const index = state.entries.findIndex((e) => e.id === id);
        if (index !== -1) {
          state.entries.splice(index, 1);
        }
      };
    },

    notify(playerId: string | null): void {
      state.entries.forEach(({ callback }) => {
        try {
          callback(playerId);
        } catch (error) {
          logError("Error in playerId callback:", error);
        }
      });
    },
  };
}

interface ConnectionWindowState {
  __callbackRegistry?: ReturnType<typeof createCallbackRegistry>;
}

function getCallbackRegistry(): ReturnType<typeof createCallbackRegistry> {
  if (typeof window === 'undefined') {
    return {
      clear: () => {},
      register: () => () => {},
      notify: () => {},
    };
  }

  const win = window as unknown as ConnectionWindowState;
  if (!win.__callbackRegistry) {
    win.__callbackRegistry = createCallbackRegistry();
  }
  return win.__callbackRegistry;
}

export function clearAllPlayerIdCallbacks(): void {
  getCallbackRegistry().clear();
}

export function registerPlayerIdCallback(callback: PlayerIdCallback): () => void {
  return getCallbackRegistry().register(callback);
}

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
      getCallbackRegistry().notify(session.playerId);
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
    } catch (error) {
      logError("Failed to persist session:", error);
    }
    getCallbackRegistry().notify(playerId);
    set({ sessionToken: token, playerId });
  },

  clearSession: (): void => {
    try {
      SessionManager.clearSession();
    } catch (error) {
      logError("Failed to clear session:", error);
    }
    getCallbackRegistry().notify(null);
    set({ sessionToken: null, playerId: null });
  },

  reset: (): void => {
    try {
      SessionManager.clearSession();
    } catch (error) {
      logError("Failed to clear session during reset:", error);
    }
    getCallbackRegistry().notify(null);
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
export const latencySelector = (state: ConnectionStore): number | null =>
  state.latency;

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