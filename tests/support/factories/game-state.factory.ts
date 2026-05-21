import { GameState, PlayerState } from '@/types/game-types';

export const createValidPlayer = (overrides: Partial<PlayerState> = {}): PlayerState => ({
  player_id: 'p1',
  chip_stack: 1000,
  hole_cards: ['Ah', 'Kd'],
  position: 'button',
  current_bet: 0,
  is_active: true,
  is_folded: false,
  is_all_in: false,
  time_remaining: 30000,
  ...overrides,
});

export const createValidGameState = (overrides: Partial<GameState> = {}): GameState => ({
  players: [createValidPlayer({ player_id: 'p1' }), createValidPlayer({ player_id: 'p2' })],
  community_cards: [],
  pot: 0,
  current_player: 'p1',
  time_remaining: 30000,
  round: 'preflop',
  min_bet: 10,
  max_bet: 1000,
  game_status: 'active',
  ...overrides,
});
