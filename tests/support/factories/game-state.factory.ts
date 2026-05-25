import { GameState, PlayerState } from '@/types/game-types';

export interface PlayerStateOverrides {
  player_id?: string;
  chip_stack?: number;
  hole_cards?: string[];
  position?: string;
  current_bet?: number;
  is_active?: boolean;
  is_folded?: boolean;
  is_all_in?: boolean;
  time_remaining?: number;
  last_action?: string;
}

export interface GameStateOverrides {
  players?: PlayerState[];
  community_cards?: string[];
  pot?: number;
  current_player?: string | null;
  time_remaining?: number;
  round?: string;
  min_bet?: number;
  max_bet?: number;
  last_winner?: string | null;
  winning_hand?: string | null;
  game_status?: string;
}

export function createValidPlayer(overrides: PlayerStateOverrides = {}): PlayerState {
  return {
    player_id: overrides.player_id ?? 'p1',
    chip_stack: overrides.chip_stack ?? 1500,
    hole_cards: overrides.hole_cards ?? [],
    position: overrides.position ?? 'none',
    current_bet: overrides.current_bet ?? 0,
    is_active: overrides.is_active ?? true,
    is_folded: overrides.is_folded ?? false,
    is_all_in: overrides.is_all_in ?? false,
    time_remaining: overrides.time_remaining ?? 0,
    last_action: overrides.last_action ?? undefined,
  };
}

export function createValidGameState(overrides: GameStateOverrides = {}): GameState {
  const defaultPlayers: PlayerState[] = [
    createValidPlayer({ player_id: 'p1' }),
    createValidPlayer({ player_id: 'p2' }),
  ];

  const defaultGameState: GameState = {
    players: defaultPlayers,
    community_cards: [],
    pot: 0,
    current_player: 'p1',
    time_remaining: 30000,
    round: 'preflop',
    min_bet: 50,
    max_bet: 1500,
    last_winner: undefined,
    winning_hand: undefined,
    game_status: 'active',
  };

  const mergedState: GameState = {
    ...defaultGameState,
    ...overrides,
    players: overrides.players ?? defaultPlayers,
    community_cards: overrides.community_cards ?? [],
    last_winner: overrides.last_winner !== undefined ? overrides.last_winner : undefined,
    winning_hand: overrides.winning_hand !== undefined ? overrides.winning_hand : undefined,
  };

  return mergedState;
}

// Factory for specific game scenarios
export const GameScenarios = {
  waitingForPlayers: (overrides: GameStateOverrides = {}) =>
    createValidGameState({ ...overrides, game_status: 'waiting' }),

  playerFolded: (playerId: 'p1' | 'p2', overrides: GameStateOverrides = {}) =>
    createValidGameState({
      ...overrides,
      players: [
        createValidPlayer({ player_id: playerId, is_folded: true }),
        createValidPlayer({ player_id: playerId === 'p1' ? 'p2' : 'p1' }),
      ],
    }),

  playerAllIn: (playerId: 'p1' | 'p2', overrides: GameStateOverrides = {}) =>
    createValidGameState({
      ...overrides,
      players: [
        createValidPlayer({ player_id: playerId, is_all_in: true }),
        createValidPlayer({ player_id: playerId === 'p1' ? 'p2' : 'p1' }),
      ],
    }),

  currentBettingRound: (round: 'preflop' | 'flop' | 'turn' | 'river', overrides: GameStateOverrides = {}) =>
    createValidGameState({ ...overrides, round }),

  gameFinished: (winner: 'p1' | 'p2' | null, handType: string = 'High Card', overrides: GameStateOverrides = {}) =>
    createValidGameState({
      ...overrides,
      game_status: 'finished',
      last_winner: winner,
      winning_hand: handType,
    }),

  smallBlindTurn: (playerId: 'p1' | 'p2', overrides: GameStateOverrides = {}) =>
    createValidGameState({
      ...overrides,
      current_player: playerId,
      players: [
        createValidPlayer({ player_id: 'p1', current_bet: 25, chip_stack: 1475 }),
        createValidPlayer({ player_id: 'p2', current_bet: 50, chip_stack: 1450 }),
      ],
      pot: 75,
      min_bet: 50,
      current_highest_bet: 50,
    }),

  callRequired: (playerId: 'p1' | 'p2', callAmount: number, overrides: GameStateOverrides = {}) =>
    createValidGameState({
      ...overrides,
      current_player: playerId,
      players: [
        createValidPlayer({ player_id: 'p1', current_bet: callAmount - 50, chip_stack: 1500 - (callAmount - 50) }),
        createValidPlayer({ player_id: 'p2', current_bet: callAmount, chip_stack: 1500 - callAmount }),
      ],
      pot: callAmount * 2,
      min_bet: callAmount,
      current_highest_bet: callAmount,
    }),

  showdownPhase: (overrides: GameStateOverrides = {}) =>
    createValidGameState({
      ...overrides,
      round: 'showdown',
      game_status: 'finished',
    }),

  noCardsRevealed: (overrides: GameStateOverrides = {}) =>
    createValidGameState({
      ...overrides,
      players: [
        createValidPlayer({ player_id: 'p1', hole_cards: [] }),
        createValidPlayer({ player_id: 'p2', hole_cards: [] }),
      ],
    }),

  timePressure: (timeRemaining: number, playerId: 'p1' | 'p2' = 'p1', overrides: GameStateOverrides = {}) =>
    createValidGameState({
      ...overrides,
      time_remaining: timeRemaining,
      current_player: playerId,
      players: [
        createValidPlayer({ player_id: 'p1', time_remaining: timeRemaining }),
        createValidPlayer({ player_id: 'p2', time_remaining: 0 }),
      ],
    }),
};