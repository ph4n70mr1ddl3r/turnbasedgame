import { describe, test, expect, beforeEach } from '@jest/globals';
import { MessageParser } from '@/lib/websocket/message-parser';
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

describe('MessageParser', () => {
  describe('parseMessage', () => {
    test('should return null for empty string', () => {
      expect(MessageParser.parseMessage('')).toBeNull();
    });

    test('should return null for non-string input', () => {
      expect(MessageParser.parseMessage(null as unknown as string)).toBeNull();
      expect(MessageParser.parseMessage(undefined as unknown as string)).toBeNull();
    });

    test('should return null for very short strings', () => {
      expect(MessageParser.parseMessage('{}')).toBeNull();
    });

    test('should return null for invalid JSON', () => {
      expect(MessageParser.parseMessage('not json')).toBeNull();
    });

    test('should return null for non-object JSON', () => {
      expect(MessageParser.parseMessage('"string"')).toBeNull();
      expect(MessageParser.parseMessage('123')).toBeNull();
      expect(MessageParser.parseMessage('[]')).toBeNull();
    });

    test('should return null for message without type field', () => {
      expect(MessageParser.parseMessage('{"data": {}}')).toBeNull();
    });

    test('should return null for unknown message type', () => {
      expect(MessageParser.parseMessage('{"type": "unknown", "data": {}}')).toBeNull();
    });
  });

  describe('parseMessage - game_state_update', () => {
    test('should parse valid game_state_update message', () => {
      const gameState = createValidGameState();
      const message = JSON.stringify({
        type: 'game_state_update',
        data: gameState,
      });

      const result = MessageParser.parseMessage(message);

      expect(result).not.toBeNull();
      expect(result?.type).toBe('game_state_update');
      expect(result?.data).toEqual(gameState);
    });

    test('should return null for game_state_update without data', () => {
      const message = JSON.stringify({
        type: 'game_state_update',
      });

      expect(MessageParser.parseMessage(message)).toBeNull();
    });

    test('should return null for game_state_update with empty players', () => {
      const message = JSON.stringify({
        type: 'game_state_update',
        data: { ...createValidGameState(), players: [] },
      });

      expect(MessageParser.parseMessage(message)).toBeNull();
    });

    test('should return null for game_state_update with invalid round', () => {
      const message = JSON.stringify({
        type: 'game_state_update',
        data: { ...createValidGameState(), round: 'invalid' },
      });

      expect(MessageParser.parseMessage(message)).toBeNull();
    });

    test('should return null for game_state_update with negative pot', () => {
      const message = JSON.stringify({
        type: 'game_state_update',
        data: { ...createValidGameState(), pot: -100 },
      });

      expect(MessageParser.parseMessage(message)).toBeNull();
    });

    test('should return null for game_state_update with invalid player_id', () => {
      const message = JSON.stringify({
        type: 'game_state_update',
        data: {
          ...createValidGameState(),
          players: [
            createValidPlayer({ player_id: 'p1' }),
            createValidPlayer({ player_id: 'p3' }),
          ],
        },
      });

      expect(MessageParser.parseMessage(message)).toBeNull();
    });

    test('should handle null current_player', () => {
      const message = JSON.stringify({
        type: 'game_state_update',
        data: { ...createValidGameState(), current_player: null },
      });

      const result = MessageParser.parseMessage(message);

      expect(result?.data.current_player).toBeNull();
    });

    test('should handle optional fields (last_winner, winning_hand)', () => {
      const message = JSON.stringify({
        type: 'game_state_update',
        data: {
          ...createValidGameState(),
          last_winner: 'p1',
          winning_hand: 'Royal Flush',
        },
      });

      const result = MessageParser.parseMessage(message);

      expect(result?.data.last_winner).toBe('p1');
      expect(result?.data.winning_hand).toBe('Royal Flush');
    });

    test('should validate player position', () => {
      const message = JSON.stringify({
        type: 'game_state_update',
        data: {
          ...createValidGameState(),
          players: [
            createValidPlayer({ player_id: 'p1', position: 'invalid' as unknown as 'button' }),
            createValidPlayer({ player_id: 'p2' }),
          ],
        },
      });

      expect(MessageParser.parseMessage(message)).toBeNull();
    });

    test('should validate card format', () => {
      const message = JSON.stringify({
        type: 'game_state_update',
        data: {
          ...createValidGameState(),
          community_cards: ['invalid'],
        },
      });

      expect(MessageParser.parseMessage(message)).toBeNull();
    });

    test('should accept valid cards', () => {
      const message = JSON.stringify({
        type: 'game_state_update',
        data: {
          ...createValidGameState(),
          community_cards: ['Ah', 'Kd', '7c', 'Ts', '2h'],
        },
      });

      const result = MessageParser.parseMessage(message);

      expect(result?.data.community_cards).toEqual(['Ah', 'Kd', '7c', 'Ts', '2h']);
    });

    test('should handle empty hole_cards', () => {
      const message = JSON.stringify({
        type: 'game_state_update',
        data: {
          ...createValidGameState(),
          players: [
            createValidPlayer({ player_id: 'p1', hole_cards: [] }),
            createValidPlayer({ player_id: 'p2' }),
          ],
        },
      });

      const result = MessageParser.parseMessage(message);

      expect(result).not.toBeNull();
      expect(result?.data.players[0].hole_cards).toEqual([]);
    });

    test('should filter out null/empty hole_cards', () => {
      const message = JSON.stringify({
        type: 'game_state_update',
        data: {
          ...createValidGameState(),
          players: [
            createValidPlayer({ player_id: 'p1', hole_cards: [null, '', 'Ah'] as unknown as string[] }),
            createValidPlayer({ player_id: 'p2' }),
          ],
        },
      });

      const result = MessageParser.parseMessage(message);

      expect(result?.data.players[0].hole_cards).toEqual(['Ah']);
    });
  });

  describe('parseMessage - error', () => {
    test('should parse valid error message', () => {
      const message = JSON.stringify({
        type: 'error',
        data: {
          code: 'invalid_token',
          message: 'Invalid session token',
        },
      });

      const result = MessageParser.parseMessage(message);

      expect(result).not.toBeNull();
      expect(result?.type).toBe('error');
      expect(result?.data.code).toBe('invalid_token');
      expect(result?.data.message).toBe('Invalid session token');
    });

    test('should return null for error message without data', () => {
      const message = JSON.stringify({
        type: 'error',
      });

      expect(MessageParser.parseMessage(message)).toBeNull();
    });

    test('should return null for error message without code', () => {
      const message = JSON.stringify({
        type: 'error',
        data: {
          message: 'Error without code',
        },
      });

      expect(MessageParser.parseMessage(message)).toBeNull();
    });

    test('should return null for error message without message', () => {
      const message = JSON.stringify({
        type: 'error',
        data: {
          code: 'some_code',
        },
      });

      expect(MessageParser.parseMessage(message)).toBeNull();
    });

    test('should include details if provided', () => {
      const message = JSON.stringify({
        type: 'error',
        data: {
          code: 'validation_error',
          message: 'Invalid input',
          details: { field: 'amount', value: -100 },
        },
      });

      const result = MessageParser.parseMessage(message);

      expect(result?.data.details).toEqual({ field: 'amount', value: -100 });
    });
  });

  describe('parseMessage - connection_status', () => {
    test('should parse valid connection_status message', () => {
      const message = JSON.stringify({
        type: 'connection_status',
        data: {
          status: 'connected',
          player_id: 'p1',
        },
      });

      const result = MessageParser.parseMessage(message);

      expect(result).not.toBeNull();
      expect(result?.type).toBe('connection_status');
      expect(result?.data.status).toBe('connected');
      expect(result?.data.player_id).toBe('p1');
    });

    test('should return null for invalid status', () => {
      const message = JSON.stringify({
        type: 'connection_status',
        data: {
          status: 'invalid',
        },
      });

      expect(MessageParser.parseMessage(message)).toBeNull();
    });

    test('should accept all valid statuses', () => {
      const statuses = ['connected', 'disconnected', 'reconnecting'];

      statuses.forEach((status) => {
        const message = JSON.stringify({
          type: 'connection_status',
          data: { status },
        });

        const result = MessageParser.parseMessage(message);
        expect(result?.data.status).toBe(status);
      });
    });

    test('should return null for invalid player_id in connection_status', () => {
      const message = JSON.stringify({
        type: 'connection_status',
        data: {
          status: 'connected',
          player_id: 'p3',
        },
      });

      expect(MessageParser.parseMessage(message)).toBeNull();
    });

    test('should handle optional message field', () => {
      const message = JSON.stringify({
        type: 'connection_status',
        data: {
          status: 'connected',
          message: 'Welcome!',
        },
      });

      const result = MessageParser.parseMessage(message);

      expect(result?.data.message).toBe('Welcome!');
    });
  });

  describe('parseMessage - heartbeat', () => {
    test('should parse valid heartbeat message', () => {
      const message = JSON.stringify({
        type: 'heartbeat',
        data: {
          timestamp: 1234567890,
        },
      });

      const result = MessageParser.parseMessage(message);

      expect(result).not.toBeNull();
      expect(result?.type).toBe('heartbeat');
      expect(result?.data.timestamp).toBe(1234567890);
    });

    test('should return null for heartbeat without timestamp', () => {
      const message = JSON.stringify({
        type: 'heartbeat',
        data: {},
      });

      expect(MessageParser.parseMessage(message)).toBeNull();
    });

    test('should return null for heartbeat with non-numeric timestamp', () => {
      const message = JSON.stringify({
        type: 'heartbeat',
        data: {
          timestamp: 'not-a-number',
        },
      });

      expect(MessageParser.parseMessage(message)).toBeNull();
    });

    test('should return null for heartbeat with negative timestamp', () => {
      const message = JSON.stringify({
        type: 'heartbeat',
        data: {
          timestamp: -1,
        },
      });

      expect(MessageParser.parseMessage(message)).toBeNull();
    });

    test('should return null for heartbeat with non-finite timestamp', () => {
      const message = JSON.stringify({
        type: 'heartbeat',
        data: {
          timestamp: Infinity,
        },
      });

      expect(MessageParser.parseMessage(message)).toBeNull();
    });
  });

  describe('parseMessage - unexpected types', () => {
    test('should return null for bet_action from server', () => {
      const message = JSON.stringify({
        type: 'bet_action',
        data: { action: 'check' },
      });

      expect(MessageParser.parseMessage(message)).toBeNull();
    });

    test('should return null for session_init from server', () => {
      const message = JSON.stringify({
        type: 'session_init',
        data: {},
      });

      expect(MessageParser.parseMessage(message)).toBeNull();
    });

    test('should return null for chat_message from server', () => {
      const message = JSON.stringify({
        type: 'chat_message',
        data: { message: 'hello' },
      });

      expect(MessageParser.parseMessage(message)).toBeNull();
    });
  });

  describe('stringifyMessage', () => {
    test('should stringify message correctly', () => {
      const message = {
        type: 'heartbeat' as const,
        data: { timestamp: 1234567890 },
      };

      const result = MessageParser.stringifyMessage(message);

      expect(JSON.parse(result)).toEqual(message);
    });

    test('should stringify game_state_update message', () => {
      const gameState = createValidGameState();
      const message = {
        type: 'game_state_update' as const,
        data: gameState,
      };

      const result = MessageParser.stringifyMessage(message);
      const parsed = JSON.parse(result);

      expect(parsed.type).toBe('game_state_update');
      expect(parsed.data.players).toHaveLength(2);
    });
  });

  describe('createHeartbeat', () => {
    test('should create heartbeat message with current timestamp', () => {
      const before = Date.now();
      const message = MessageParser.createHeartbeat();
      const after = Date.now();

      expect(message.type).toBe('heartbeat');
      expect(message.data.timestamp).toBeGreaterThanOrEqual(before);
      expect(message.data.timestamp).toBeLessThanOrEqual(after);
    });
  });

  describe('createSessionInit', () => {
    test('should create session init without reconnect token', () => {
      const message = MessageParser.createSessionInit();

      expect(message.type).toBe('session_init');
      expect(message.data.reconnect_token).toBeUndefined();
    });

    test('should create session init with reconnect token', () => {
      const message = MessageParser.createSessionInit('token-123');

      expect(message.type).toBe('session_init');
      expect(message.data.reconnect_token).toBe('token-123');
    });
  });

  describe('edge cases', () => {
    test('should handle game_state_update with too many players', () => {
      const players = [
        createValidPlayer({ player_id: 'p1' }),
        createValidPlayer({ player_id: 'p2' }),
        createValidPlayer({ player_id: 'p1', chip_stack: 500 }),
      ];
      const message = JSON.stringify({
        type: 'game_state_update',
        data: { ...createValidGameState(), players },
      });

      expect(MessageParser.parseMessage(message)).toBeNull();
    });

    test('should handle game_state_update with too many community cards', () => {
      const message = JSON.stringify({
        type: 'game_state_update',
        data: {
          ...createValidGameState(),
          community_cards: ['Ah', 'Kd', 'Qc', 'Js', 'Th', '9h'],
        },
      });

      expect(MessageParser.parseMessage(message)).toBeNull();
    });

    test('should handle game_state_update with non-finite chip_stack', () => {
      const message = JSON.stringify({
        type: 'game_state_update',
        data: {
          ...createValidGameState(),
          players: [
            createValidPlayer({ player_id: 'p1', chip_stack: Infinity }),
            createValidPlayer({ player_id: 'p2' }),
          ],
        },
      });

      expect(MessageParser.parseMessage(message)).toBeNull();
    });

    test('should handle game_state_update with missing required boolean fields', () => {
      const { is_active, ...playerWithoutActive } = createValidPlayer({ player_id: 'p1' });
      const message = JSON.stringify({
        type: 'game_state_update',
        data: {
          ...createValidGameState(),
          players: [playerWithoutActive, createValidPlayer({ player_id: 'p2' })],
        },
      });

      expect(MessageParser.parseMessage(message)).toBeNull();
    });
  });
});
