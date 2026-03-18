import { create } from "zustand";
import { GameState, PlayerState, BetAction } from "@/types/game-types";
import { logError } from "@/lib/utils/logger";
import { registerPlayerIdCallback } from "@/lib/stores/connection-store";

const MAX_CHIP_VALUE = 1_000_000_000;

function isValidChipValue(value: unknown): value is number {
  return typeof value === 'number' && 
         Number.isFinite(value) && 
         value >= 0 && 
         value <= MAX_CHIP_VALUE;
}

function isValidGameState(state: unknown): state is GameState {
  if (typeof state !== 'object' || state === null) {
    logError('Invalid game state: not an object', state);
    return false;
  }
  
  const gameState = state as GameState;
  
  if (!Array.isArray(gameState.players) || gameState.players.length === 0) {
    logError('Invalid game state: missing or invalid players', gameState);
    return false;
  }
  
  if (typeof gameState.pot !== 'number') {
    logError('Invalid game state: invalid pot', gameState);
    return false;
  }
  
  if (typeof gameState.round !== 'string') {
    logError('Invalid game state: invalid round', gameState);
    return false;
  }
  
  if (typeof gameState.game_status !== 'string') {
    logError('Invalid game state: invalid game_status', gameState);
    return false;
  }
  
  if (typeof gameState.min_bet !== 'number' || gameState.min_bet < 0) {
    logError('Invalid game state: invalid min_bet', gameState);
    return false;
  }
  
  if (typeof gameState.max_bet !== 'number' || gameState.max_bet < 0) {
    logError('Invalid game state: invalid max_bet', gameState);
    return false;
  }
  
  if (gameState.min_bet > gameState.max_bet) {
    logError('Invalid game state: min_bet cannot be greater than max_bet');
    return false;
  }
  
  return true;
}

function deriveAvailableActions(
  gameState: GameState | null,
  cachedPlayerId: string | null
): BetAction[] {
  if (!gameState || !cachedPlayerId) return [];
  if (gameState.current_player !== cachedPlayerId) return [];
  if (gameState.game_status !== "active") return [];
  if (!Array.isArray(gameState.players) || gameState.players.length === 0) return [];

  const myPlayer = gameState.players.find((p) => p.player_id === cachedPlayerId);
  if (!myPlayer || myPlayer.is_folded || myPlayer.is_all_in) return [];

  const actions: BetAction[] = [];
  const bets = gameState.players.map((p) => p.current_bet);
  const highestBet = bets.length > 0 ? Math.max(0, ...bets) : 0;
  const myBet = myPlayer.current_bet;
  const toCall = highestBet - myBet;

  if (toCall === 0) {
    actions.push("check");
  } else {
    actions.push("call");
  }

  if (myPlayer.chip_stack > toCall) {
    actions.push("raise");
  }

  actions.push("fold");

  return actions;
}

interface GameStore {
  gameState: GameState | null;
  isMyTurn: boolean;
  availableActions: BetAction[];
  lastError: string | null;
  cachedPlayerId: string | null;

  setGameState: (gameState: GameState) => void;
  updatePlayer: (playerId: string, updates: Partial<PlayerState>) => void;
  setAvailableActions: (actions: BetAction[]) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
  reset: () => void;
  resetGameState: () => void;
  setCachedPlayerId: (id: string | null) => void;

  getMyPlayer: () => PlayerState | null;
  getOpponentPlayer: () => PlayerState | null;
  getPlayer: (playerId: string) => PlayerState | null;
}

export const useGameStore = create<GameStore>((set, get) => ({
  gameState: null,
  isMyTurn: false,
  availableActions: [],
  lastError: null,
  cachedPlayerId: null,

  setCachedPlayerId: (id: string | null): void => {
    const { gameState } = get();
    const availableActions = deriveAvailableActions(gameState, id);
    set({ cachedPlayerId: id, availableActions });
  },

  setGameState: (gameState: GameState): void => {
    if (!isValidGameState(gameState)) {
      logError('setGameState: Invalid game state received', gameState);
      return;
    }
    
    const { cachedPlayerId } = get();
    const isMyTurn = cachedPlayerId !== null && gameState.current_player === cachedPlayerId;
    const availableActions = deriveAvailableActions(gameState, cachedPlayerId);
    set({ gameState, isMyTurn, availableActions });
  },

  updatePlayer: (playerId: string, updates: Partial<PlayerState>): void => {
    set((state) => {
      if (!state.gameState) return state;

      const playerExists = state.gameState.players.some(
        (player) => player.player_id === playerId
      );
      if (!playerExists) {
        logError('updatePlayer: player not found:', playerId);
        return state;
      }

      if (updates.chip_stack !== undefined && !isValidChipValue(updates.chip_stack)) {
        logError('Invalid chip_stack value:', updates.chip_stack);
        return state;
      }

      if (updates.current_bet !== undefined && !isValidChipValue(updates.current_bet)) {
        logError('Invalid current_bet value:', updates.current_bet);
        return state;
      }

      if (updates.time_remaining !== undefined && (typeof updates.time_remaining !== 'number' || !Number.isFinite(updates.time_remaining) || updates.time_remaining < 0)) {
        logError('Invalid time_remaining value:', updates.time_remaining);
        return state;
      }

      const updatedPlayers = state.gameState.players.map((player) =>
        player.player_id === playerId ? { ...player, ...updates } : player
      );

      const newGameState = { ...state.gameState, players: updatedPlayers };
      const isMyTurn = newGameState.current_player === state.cachedPlayerId;
      const availableActions = deriveAvailableActions(newGameState, state.cachedPlayerId);

      return {
        gameState: newGameState,
        isMyTurn,
        availableActions,
      };
    });
  },

  setAvailableActions: (actions: BetAction[]): void => {
    set({ availableActions: actions });
  },

  setError: (error: string | null): void => {
    set({ lastError: error });
  },

  clearError: (): void => {
    set({ lastError: null });
  },

  reset: (): void => {
    set({
      gameState: null,
      isMyTurn: false,
      availableActions: [],
      lastError: null,
      cachedPlayerId: null,
    });
  },

  resetGameState: (): void => {
    set({
      gameState: null,
      isMyTurn: false,
      availableActions: [],
      lastError: null,
    });
  },

  getMyPlayer: (): PlayerState | null => {
    const state = get();
    if (!state.gameState || !state.cachedPlayerId) return null;

    return (
      state.gameState.players.find((p) => p.player_id === state.cachedPlayerId) ||
      null
    );
  },

  getOpponentPlayer: (): PlayerState | null => {
    const state = get();
    if (!state.gameState || !state.cachedPlayerId) return null;

    return (
      state.gameState.players.find((p) => p.player_id !== state.cachedPlayerId) ||
      null
    );
  },

  getPlayer: (playerId: string): PlayerState | null => {
    const state = get();
    if (!state.gameState) return null;

    return state.gameState.players.find((p) => p.player_id === playerId) || null;
  },
}));

export const gameStateSelector = (state: GameStore): GameState | null =>
  state.gameState;
export const isMyTurnSelector = (state: GameStore): boolean => state.isMyTurn;
export const availableActionsSelector = (state: GameStore): BetAction[] =>
  state.availableActions;
export const lastErrorSelector = (state: GameStore): string | null => state.lastError;
export const cachedPlayerIdSelector = (state: GameStore): string | null =>
  state.cachedPlayerId;

interface GameStoreInitState {
  isInitialized: boolean;
  unregisterCallback: (() => void) | null;
}

const gameStoreInitState: GameStoreInitState = {
  isInitialized: false,
  unregisterCallback: null,
};

export function initializeGameStore(): () => void {
  if (typeof window === 'undefined') return () => {};
  
  if (gameStoreInitState.isInitialized && gameStoreInitState.unregisterCallback) {
    return gameStoreInitState.unregisterCallback;
  }
  
  gameStoreInitState.isInitialized = true;
  
  gameStoreInitState.unregisterCallback = registerPlayerIdCallback((playerId) => {
    useGameStore.getState().setCachedPlayerId(playerId);
  });
  
  return gameStoreInitState.unregisterCallback;
}

export function resetGameStoreInitialization(): void {
  if (gameStoreInitState.unregisterCallback) {
    gameStoreInitState.unregisterCallback();
    gameStoreInitState.unregisterCallback = null;
  }
  gameStoreInitState.isInitialized = false;
}