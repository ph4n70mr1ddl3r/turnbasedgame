import { describe, test, expect, beforeEach, jest, afterEach } from '@jest/globals';
import {
  useGameStore,
  gameStateSelector,
  isMyTurnSelector,
  availableActionsSelector,
  lastErrorSelector,
  cachedPlayerIdSelector,
  resetGameStoreInitialization,
} from '@/lib/stores/game-store';
import { GameState, PlayerState } from '@/types/game-types';

const createValidPlayer = (overrides: Partial<PlayerState> = {}): PlayerState => ({
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

const createValidGameState = (overrides: Partial<GameState> = {}): GameState => ({
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

describe('game-store', () => {
  beforeEach(() => {
    resetGameStoreInitialization();
    useGameStore.getState().reset();
    jest.clearAllMocks();
  });

  afterEach(() => {
    useGameStore.getState().reset();
  });

  describe('initial state', () => {
    test('should have correct initial state', () => {
      const state = useGameStore.getState();

      expect(state.gameState).toBeNull();
      expect(state.isMyTurn).toBe(false);
      expect(state.availableActions).toEqual([]);
      expect(state.lastError).toBeNull();
      expect(state.cachedPlayerId).toBeNull();
    });
  });

  describe('setGameState', () => {
    test('should set valid game state', () => {
      const gameState = createValidGameState();
      useGameStore.getState().setGameState(gameState);

      const state = useGameStore.getState();
      expect(state.gameState).toEqual(gameState);
    });

    test('should reject invalid game state - missing players', () => {
      const invalidState = { ...createValidGameState(), players: [] };

      useGameStore.getState().setGameState(invalidState as unknown as GameState);

      expect(useGameStore.getState().gameState).toBeNull();
    });

    test('should reject invalid game state - negative pot', () => {
      const invalidState = { ...createValidGameState(), pot: -100 };

      useGameStore.getState().setGameState(invalidState);

      expect(useGameStore.getState().gameState).toBeNull();
    });

    test('should reject invalid game state - invalid round', () => {
      const invalidState = { ...createValidGameState(), round: 'invalid' };

      useGameStore.getState().setGameState(invalidState as unknown as GameState);

      expect(useGameStore.getState().gameState).toBeNull();
    });

    test('should reject invalid game state - min_bet > max_bet', () => {
      const invalidState = { ...createValidGameState(), min_bet: 100, max_bet: 50 };

      useGameStore.getState().setGameState(invalidState);

      expect(useGameStore.getState().gameState).toBeNull();
    });

    test('should set isMyTurn to true when current_player matches cachedPlayerId', () => {
      useGameStore.getState().setCachedPlayerId('p1');
      const gameState = createValidGameState({ current_player: 'p1' });

      useGameStore.getState().setGameState(gameState);

      expect(useGameStore.getState().isMyTurn).toBe(true);
    });

    test('should set isMyTurn to false when current_player does not match', () => {
      useGameStore.getState().setCachedPlayerId('p1');
      const gameState = createValidGameState({ current_player: 'p2' });

      useGameStore.getState().setGameState(gameState);

      expect(useGameStore.getState().isMyTurn).toBe(false);
    });
  });

  describe('updatePlayer', () => {
    test('should update player chip_stack', () => {
      const gameState = createValidGameState();
      useGameStore.getState().setGameState(gameState);

      useGameStore.getState().updatePlayer('p1', { chip_stack: 500 });

      const updatedPlayer = useGameStore.getState().getPlayer('p1');
      expect(updatedPlayer?.chip_stack).toBe(500);
    });

    test('should reject invalid chip_stack value', () => {
      const gameState = createValidGameState();
      useGameStore.getState().setGameState(gameState);
      const originalStack = gameState.players[0].chip_stack;

      useGameStore.getState().updatePlayer('p1', { chip_stack: -100 });

      const player = useGameStore.getState().getPlayer('p1');
      expect(player?.chip_stack).toBe(originalStack);
    });

    test('should reject invalid chip_stack - NaN', () => {
      const gameState = createValidGameState();
      useGameStore.getState().setGameState(gameState);
      const originalStack = gameState.players[0].chip_stack;

      useGameStore.getState().updatePlayer('p1', { chip_stack: NaN });

      const player = useGameStore.getState().getPlayer('p1');
      expect(player?.chip_stack).toBe(originalStack);
    });

    test('should not update non-existent player', () => {
      const gameState = createValidGameState();
      useGameStore.getState().setGameState(gameState);

      useGameStore.getState().updatePlayer('p3', { chip_stack: 500 });

      expect(useGameStore.getState().getPlayer('p3')).toBeNull();
    });

    test('should update is_folded', () => {
      const gameState = createValidGameState();
      useGameStore.getState().setGameState(gameState);

      useGameStore.getState().updatePlayer('p1', { is_folded: true });

      const player = useGameStore.getState().getPlayer('p1');
      expect(player?.is_folded).toBe(true);
    });
  });

  describe('setCachedPlayerId', () => {
    test('should set cached player id', () => {
      useGameStore.getState().setCachedPlayerId('p1');

      expect(useGameStore.getState().cachedPlayerId).toBe('p1');
    });

    test('should clear cached player id when set to null', () => {
      useGameStore.getState().setCachedPlayerId('p1');
      useGameStore.getState().setCachedPlayerId(null);

      expect(useGameStore.getState().cachedPlayerId).toBeNull();
    });

    test('should update availableActions when cachedPlayerId changes', () => {
      const gameState = createValidGameState({ current_player: 'p1' });
      useGameStore.getState().setGameState(gameState);

      useGameStore.getState().setCachedPlayerId('p1');

      expect(useGameStore.getState().availableActions).toContain('check');
      expect(useGameStore.getState().availableActions).toContain('fold');
    });
  });

  describe('error handling', () => {
    test('should set error', () => {
      useGameStore.getState().setError('Test error');

      expect(useGameStore.getState().lastError).toBe('Test error');
    });

    test('should clear error', () => {
      useGameStore.getState().setError('Test error');
      useGameStore.getState().clearError();

      expect(useGameStore.getState().lastError).toBeNull();
    });
  });

  describe('player getters', () => {
    beforeEach(() => {
      const gameState = createValidGameState();
      useGameStore.getState().setGameState(gameState);
      useGameStore.getState().setCachedPlayerId('p1');
    });

    test('getMyPlayer should return current player', () => {
      const player = useGameStore.getState().getMyPlayer();

      expect(player?.player_id).toBe('p1');
    });

    test('getMyPlayer should return null when no cachedPlayerId', () => {
      useGameStore.getState().setCachedPlayerId(null);

      const player = useGameStore.getState().getMyPlayer();

      expect(player).toBeNull();
    });

    test('getOpponentPlayer should return other player', () => {
      const player = useGameStore.getState().getOpponentPlayer();

      expect(player?.player_id).toBe('p2');
    });

    test('getPlayer should return specific player', () => {
      const player = useGameStore.getState().getPlayer('p2');

      expect(player?.player_id).toBe('p2');
    });

    test('getPlayer should return null for non-existent player', () => {
      const player = useGameStore.getState().getPlayer('p3');

      expect(player).toBeNull();
    });
  });

  describe('reset', () => {
    test('should reset all state', () => {
      const gameState = createValidGameState();
      useGameStore.getState().setGameState(gameState);
      useGameStore.getState().setCachedPlayerId('p1');
      useGameStore.getState().setError('Test error');

      useGameStore.getState().reset();

      const state = useGameStore.getState();
      expect(state.gameState).toBeNull();
      expect(state.isMyTurn).toBe(false);
      expect(state.availableActions).toEqual([]);
      expect(state.lastError).toBeNull();
      expect(state.cachedPlayerId).toBeNull();
    });
  });

  describe('selectors', () => {
    test('gameStateSelector should return gameState', () => {
      const gameState = createValidGameState();
      useGameStore.getState().setGameState(gameState);

      const result = gameStateSelector(useGameStore.getState());

      expect(result).toEqual(gameState);
    });

    test('isMyTurnSelector should return isMyTurn', () => {
      useGameStore.getState().setCachedPlayerId('p1');
      const gameState = createValidGameState({ current_player: 'p1' });
      useGameStore.getState().setGameState(gameState);

      const result = isMyTurnSelector(useGameStore.getState());

      expect(result).toBe(true);
    });

    test('availableActionsSelector should return availableActions', () => {
      useGameStore.getState().setAvailableActions(['check', 'fold']);

      const result = availableActionsSelector(useGameStore.getState());

      expect(result).toEqual(['check', 'fold']);
    });

    test('lastErrorSelector should return lastError', () => {
      useGameStore.getState().setError('Test error');

      const result = lastErrorSelector(useGameStore.getState());

      expect(result).toBe('Test error');
    });

    test('cachedPlayerIdSelector should return cachedPlayerId', () => {
      useGameStore.getState().setCachedPlayerId('p1');

      const result = cachedPlayerIdSelector(useGameStore.getState());

      expect(result).toBe('p1');
    });
  });

  describe('availableActions derivation', () => {
    test('should derive check when no bet to call', () => {
      useGameStore.getState().setCachedPlayerId('p1');
      const gameState = createValidGameState({
        current_player: 'p1',
        players: [
          createValidPlayer({ player_id: 'p1', current_bet: 10 }),
          createValidPlayer({ player_id: 'p2', current_bet: 10 }),
        ],
      });

      useGameStore.getState().setGameState(gameState);

      const actions = useGameStore.getState().availableActions;
      expect(actions).toContain('check');
      expect(actions).not.toContain('call');
    });

    test('should derive call when there is a bet to call', () => {
      useGameStore.getState().setCachedPlayerId('p1');
      const gameState = createValidGameState({
        current_player: 'p1',
        players: [
          createValidPlayer({ player_id: 'p1', current_bet: 0, chip_stack: 1000 }),
          createValidPlayer({ player_id: 'p2', current_bet: 50 }),
        ],
      });

      useGameStore.getState().setGameState(gameState);

      const actions = useGameStore.getState().availableActions;
      expect(actions).toContain('call');
      expect(actions).not.toContain('check');
    });

    test('should derive raise when player has chips', () => {
      useGameStore.getState().setCachedPlayerId('p1');
      const gameState = createValidGameState({
        current_player: 'p1',
        players: [
          createValidPlayer({ player_id: 'p1', current_bet: 0, chip_stack: 1000 }),
          createValidPlayer({ player_id: 'p2', current_bet: 50 }),
        ],
      });

      useGameStore.getState().setGameState(gameState);

      expect(useGameStore.getState().availableActions).toContain('raise');
    });

    test('should not derive raise when player is all-in', () => {
      useGameStore.getState().setCachedPlayerId('p1');
      const gameState = createValidGameState({
        current_player: 'p1',
        players: [
          createValidPlayer({ player_id: 'p1', is_all_in: true }),
          createValidPlayer({ player_id: 'p2' }),
        ],
      });

      useGameStore.getState().setGameState(gameState);

      expect(useGameStore.getState().availableActions).toEqual([]);
    });

    test('should not derive raise when player is folded', () => {
      useGameStore.getState().setCachedPlayerId('p1');
      const gameState = createValidGameState({
        current_player: 'p1',
        players: [
          createValidPlayer({ player_id: 'p1', is_folded: true }),
          createValidPlayer({ player_id: 'p2' }),
        ],
      });

      useGameStore.getState().setGameState(gameState);

      expect(useGameStore.getState().availableActions).toEqual([]);
    });

    test('should always derive fold when available', () => {
      useGameStore.getState().setCachedPlayerId('p1');
      const gameState = createValidGameState({ current_player: 'p1' });

      useGameStore.getState().setGameState(gameState);

      expect(useGameStore.getState().availableActions).toContain('fold');
    });

    test('should return empty array when game not active', () => {
      useGameStore.getState().setCachedPlayerId('p1');
      const gameState = createValidGameState({
        current_player: 'p1',
        game_status: 'waiting',
      });

      useGameStore.getState().setGameState(gameState);

      expect(useGameStore.getState().availableActions).toEqual([]);
    });
  });

  describe('validation edge cases', () => {
    test('should reject player with invalid player_id', () => {
      const invalidState = {
        ...createValidGameState(),
        players: [
          { ...createValidPlayer({ player_id: 'p1' }) },
          { ...createValidPlayer({ player_id: 'p3' }) },
        ],
      };

      useGameStore.getState().setGameState(invalidState);

      expect(useGameStore.getState().gameState).toBeNull();
    });

    test('should reject player with non-finite chip_stack', () => {
      const invalidState = {
        ...createValidGameState(),
        players: [
          createValidPlayer({ player_id: 'p1', chip_stack: Infinity }),
          createValidPlayer({ player_id: 'p2' }),
        ],
      };

      useGameStore.getState().setGameState(invalidState);

      expect(useGameStore.getState().gameState).toBeNull();
    });

    test('should accept player with empty hole_cards', () => {
      const gameState = createValidGameState({
        players: [
          createValidPlayer({ player_id: 'p1', hole_cards: [] }),
          createValidPlayer({ player_id: 'p2' }),
        ],
      });

      useGameStore.getState().setGameState(gameState);

      expect(useGameStore.getState().gameState).not.toBeNull();
    });

    test('should accept game with null current_player', () => {
      const gameState = createValidGameState({ current_player: null });

      useGameStore.getState().setGameState(gameState);

      expect(useGameStore.getState().gameState).not.toBeNull();
    });
  });
});
