import { create } from "zustand";
import { GameState, PlayerState, BetAction } from "@/types/game-types";

function deriveAvailableActions(
  gameState: GameState | null,
  cachedPlayerId: string | null
): BetAction[] {
  if (!gameState || !cachedPlayerId) return [];
  if (gameState.current_player !== cachedPlayerId) return [];
  if (gameState.game_status !== "active") return [];

  const myPlayer = gameState.players.find((p) => p.player_id === cachedPlayerId);
  if (!myPlayer || myPlayer.is_folded || myPlayer.is_all_in) return [];

  const actions: BetAction[] = [];
  const highestBet = Math.max(...gameState.players.map((p) => p.current_bet));
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
    const { cachedPlayerId } = get();
    const isMyTurn = gameState.current_player === cachedPlayerId;
    const availableActions = deriveAvailableActions(gameState, cachedPlayerId);
    set({ gameState, isMyTurn, availableActions });
  },

  updatePlayer: (playerId: string, updates: Partial<PlayerState>): void => {
    set((state) => {
      if (!state.gameState) return state;

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