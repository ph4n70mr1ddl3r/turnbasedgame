import { create } from "zustand";
import { GameState, PlayerState, BetAction } from "@/types/game-types";
import { PLAYER_ID_KEY } from "@/lib/constants/storage";

let cachedPlayerId: string | null = null;

function getPlayerId(): string | null {
  if (cachedPlayerId !== null) {
    return cachedPlayerId;
  }
  if (typeof window !== "undefined") {
    cachedPlayerId = localStorage.getItem(PLAYER_ID_KEY);
  }
  return cachedPlayerId;
}

export function setCachedPlayerId(id: string | null): void {
  cachedPlayerId = id;
}

interface GameStore {
  gameState: GameState | null;
  isMyTurn: boolean;
  availableActions: BetAction[];
  lastError: string | null;

  setGameState: (gameState: GameState) => void;
  updatePlayer: (playerId: string, updates: Partial<PlayerState>) => void;
  setAvailableActions: (actions: BetAction[]) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
  reset: () => void;

  getMyPlayer: () => PlayerState | null;
  getOpponentPlayer: () => PlayerState | null;
  getPlayer: (playerId: string) => PlayerState | null;
}

export const useGameStore = create<GameStore>((set, get) => ({
  gameState: null,
  isMyTurn: false,
  availableActions: [],
  lastError: null,
  
  setGameState: (gameState: GameState) => {
    const playerId = getPlayerId();
    const isMyTurn = gameState.current_player === playerId;
    set({ gameState, isMyTurn });
  },
  
  updatePlayer: (playerId: string, updates: Partial<PlayerState>) =>
    set((state) => {
      if (!state.gameState) return state;
      
      const updatedPlayers = state.gameState.players.map((player) =>
        player.player_id === playerId ? { ...player, ...updates } : player
      );
      
      return {
        gameState: { ...state.gameState, players: updatedPlayers },
      };
    }),
  
  setAvailableActions: (actions: BetAction[]) => set({ availableActions: actions }),
  
  setError: (error: string | null) => set({ lastError: error }),
  
  clearError: () => set({ lastError: null }),
  
  reset: () => {
    cachedPlayerId = null;
    return set({
      gameState: null,
      isMyTurn: false,
      availableActions: [],
      lastError: null,
    });
  },
  
  getMyPlayer: (): PlayerState | null => {
    const state = get();
    const playerId = getPlayerId();
    if (!state.gameState || !playerId) return null;

    return state.gameState.players.find((p) => p.player_id === playerId) || null;
  },

  getOpponentPlayer: (): PlayerState | null => {
    const state = get();
    const playerId = getPlayerId();
    if (!state.gameState || !playerId) return null;

    return state.gameState.players.find((p) => p.player_id !== playerId) || null;
  },
  
  getPlayer: (playerId: string): PlayerState | null => {
    const state = get();
    if (!state.gameState) return null;
    
    return state.gameState.players.find((p) => p.player_id === playerId) || null;
  },
}));

export const gameStateSelector = (state: GameStore) => state.gameState;
export const isMyTurnSelector = (state: GameStore) => state.isMyTurn;
export const availableActionsSelector = (state: GameStore) => state.availableActions;
export const lastErrorSelector = (state: GameStore) => state.lastError;