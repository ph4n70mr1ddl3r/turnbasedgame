import { create } from "zustand";
import { GameState, PlayerState } from "@/types/game-types";
import { PLAYER_ID_KEY } from "@/lib/constants/storage";

interface GameStore {
  // Current game state
  gameState: GameState | null;
  
  // UI state
  isMyTurn: boolean;
  availableActions: string[];
  lastError: string | null;
  
  // Actions
  setGameState: (_gameState: GameState) => void; // eslint-disable-line no-unused-vars
  updatePlayer: (_playerId: string, _updates: Partial<PlayerState>) => void; // eslint-disable-line no-unused-vars
  setAvailableActions: (_actions: string[]) => void; // eslint-disable-line no-unused-vars
  setError: (_error: string | null) => void; // eslint-disable-line no-unused-vars
  clearError: () => void;
  reset: () => void;
  
  // Derived selectors (computed)
  getMyPlayer: () => PlayerState | null;
  getOpponentPlayer: () => PlayerState | null;
  getPlayer: (_playerId: string) => PlayerState | null; // eslint-disable-line no-unused-vars
}

export const useGameStore = create<GameStore>((set, get) => ({
  // Initial state
  gameState: null,
  isMyTurn: false,
  availableActions: [],
  lastError: null,
  
  // Actions
  setGameState: (_gameState: GameState) => {
    const playerId = localStorage.getItem(PLAYER_ID_KEY);
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
  
  setAvailableActions: (_actions: string[]) => set({ availableActions: _actions }),
  
  setError: (_error: string | null) => set({ lastError: _error }),
  
  clearError: () => set({ lastError: null }),
  
  reset: () =>
    set({
      gameState: null,
      isMyTurn: false,
      availableActions: [],
      lastError: null,
    }),
  
  // Derived selectors
  getMyPlayer: () => {
    const state = get();
    const playerId = localStorage.getItem(PLAYER_ID_KEY);
    if (!state.gameState || !playerId) return null;

    return state.gameState.players.find((p) => p.player_id === playerId) || null;
  },

  getOpponentPlayer: () => {
    const state = get();
    const playerId = localStorage.getItem(PLAYER_ID_KEY);
    if (!state.gameState || !playerId) return null;

    return state.gameState.players.find((p) => p.player_id !== playerId) || null;
  },
  
  getPlayer: (_playerId: string) => {
    const state = get();
    if (!state.gameState) return null;
    
    return state.gameState.players.find((p) => p.player_id === _playerId) || null;
  },
}));

// Selectors
export const gameStateSelector = (state: GameStore) => state.gameState;
export const isMyTurnSelector = (state: GameStore) => state.isMyTurn;
export const availableActionsSelector = (state: GameStore) => state.availableActions;
export const lastErrorSelector = (state: GameStore) => state.lastError;
export const myPlayerSelector = (state: GameStore) => state.getMyPlayer();
export const opponentPlayerSelector = (state: GameStore) => state.getOpponentPlayer();