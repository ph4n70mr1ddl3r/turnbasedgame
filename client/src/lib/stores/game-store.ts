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

  setGameState: (_gameState: GameState) => void;
  updatePlayer: (_playerId: string, _updates: Partial<PlayerState>) => void;
  setAvailableActions: (_actions: BetAction[]) => void;
  setError: (_error: string | null) => void;
  clearError: () => void;
  reset: () => void;

  getMyPlayer: () => PlayerState | null;
  getOpponentPlayer: () => PlayerState | null;
  getPlayer: (_playerId: string) => PlayerState | null;
}

export const useGameStore = create<GameStore>((set, get) => ({
  gameState: null,
  isMyTurn: false,
  availableActions: [],
  lastError: null,
  
  setGameState: (_gameState: GameState) => {
    const playerId = getPlayerId();
    const isMyTurn = _gameState.current_player === playerId;
    set({ gameState: _gameState, isMyTurn });
  },
  
  updatePlayer: (_playerId: string, _updates: Partial<PlayerState>) =>
    set((state) => {
      if (!state.gameState) return state;
      
      const updatedPlayers = state.gameState.players.map((player) =>
        player.player_id === _playerId ? { ...player, ..._updates } : player
      );
      
      return {
        gameState: { ...state.gameState, players: updatedPlayers },
      };
    }),
  
  setAvailableActions: (_actions: BetAction[]) => set({ availableActions: _actions }),
  
  setError: (_error: string | null) => set({ lastError: _error }),
  
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
  
  getPlayer: (_playerId: string) => {
    const state = get();
    if (!state.gameState) return null;
    
    return state.gameState.players.find((p) => p.player_id === _playerId) || null;
  },
}));

export const gameStateSelector = (state: GameStore) => state.gameState;
export const isMyTurnSelector = (state: GameStore) => state.isMyTurn;
export const availableActionsSelector = (state: GameStore) => state.availableActions;
export const lastErrorSelector = (state: GameStore) => state.lastError;