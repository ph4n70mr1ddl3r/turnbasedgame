import { create } from "zustand";
import { GameState, PlayerState, BetAction, isValidBettingRound, isValidPlayerId, MAX_PLAYERS } from "@/types/game-types";
import { registerPlayerIdCallback } from "@/lib/stores/connection-store";

const MAX_CHIP_VALUE = 1_000_000_000;
const MAX_TIME_REMAINING_MS = 24 * 60 * 60 * 1000;

function isValidChipValue(value: unknown): value is number {
  return typeof value === 'number' && 
         Number.isFinite(value) && 
         value >= 0 && 
         value <= MAX_CHIP_VALUE;
}

function isValidTimeRemaining(value: unknown): value is number {
  return typeof value === 'number' && 
         Number.isFinite(value) && 
         value >= 0 && 
         value <= MAX_TIME_REMAINING_MS;
}

function isValidGameState(state: unknown): state is GameState {
  if (!state || typeof state !== 'object') return false;
  
  const s = state as Record<string, unknown>;
  
  if (!Array.isArray(s.players) || s.players.length === 0 || s.players.length > MAX_PLAYERS) {
    return false;
  }
  
  if (typeof s.pot !== 'number' || !Number.isFinite(s.pot) || s.pot < 0) {
    return false;
  }
  
  if (typeof s.round !== 'string' || !isValidBettingRound(s.round)) {
    return false;
  }
  
  if (typeof s.min_bet !== 'number' || typeof s.max_bet !== 'number') {
    return false;
  }
  
  if (s.min_bet > s.max_bet) {
    return false;
  }
  
  for (const player of s.players) {
    if (!player || typeof player !== 'object') return false;
    const p = player as Record<string, unknown>;
    
    if (typeof p.player_id !== 'string' || !isValidPlayerId(p.player_id)) {
      return false;
    }
    
    if (typeof p.chip_stack !== 'number' || !Number.isFinite(p.chip_stack) || p.chip_stack < 0) {
      return false;
    }
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
      if (!playerExists) return state;

      if (updates.chip_stack !== undefined && !isValidChipValue(updates.chip_stack)) {
        return state;
      }

      if (updates.current_bet !== undefined && !isValidChipValue(updates.current_bet)) {
        return state;
      }

      if (updates.time_remaining !== undefined && !isValidTimeRemaining(updates.time_remaining)) {
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

interface GameStoreWindowState {
  __gameStoreInitialized?: boolean;
  __gameStoreCleanup?: () => void;
}

export function initializeGameStore(): () => void {
  if (typeof window === 'undefined') return () => {};
  
  const win = window as unknown as GameStoreWindowState;
  
  if (win.__gameStoreInitialized && win.__gameStoreCleanup) {
    return win.__gameStoreCleanup;
  }
  
  win.__gameStoreInitialized = true;
  
  win.__gameStoreCleanup = registerPlayerIdCallback((playerId) => {
    useGameStore.getState().setCachedPlayerId(playerId);
  });
  
  return win.__gameStoreCleanup;
}

export function resetGameStoreInitialization(): void {
  if (typeof window === 'undefined') return;
  
  const win = window as unknown as GameStoreWindowState;
  
  if (win.__gameStoreCleanup) {
    win.__gameStoreCleanup();
    win.__gameStoreCleanup = undefined;
  }
  win.__gameStoreInitialized = false;
}
