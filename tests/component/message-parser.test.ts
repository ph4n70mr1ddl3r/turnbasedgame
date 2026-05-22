import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { MessageParser } from '@/lib/websocket/message-parser';
import { 
  GameStateUpdateMessage, 
  ErrorMessage, 
  ConnectionStatusMessage,
  HeartbeatMessage,
  SessionInitMessage,
  GameState,
  PlayerState,
  BetAction,
  ConnectionStatus,
  BettingRound,
  GameStatus
} from '@/types/game-types';
import { createValidGameState } from '../support/factories/game-state.factory';

describe('MessageParser', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('parseMessage', () => {
    test('should parse valid game state update', () => {
      const gameState = createValidGameState();
      const message: GameStateUpdateMessage = {
        type: "game_state_update",
        data: gameState,
      };

      const messageStr = JSON.stringify(message);
      const result = MessageParser.parseMessage(messageStr);

      expect(result).toEqual(message);
    });

    test('should parse valid error message', () => {
      const errorMessage: ErrorMessage = {
        type: "error",
        data: {
          code: "invalid_token",
          message: "Invalid session token",
          details: { token: "abc123" }
        },
      };

      const messageStr = JSON.stringify(errorMessage);
      const result = MessageParser.parseMessage(messageStr);

      expect(result).toEqual(errorMessage);
    });

    test('should parse valid connection status message', () => {
      const connectionMessage: ConnectionStatusMessage = {
        type: "connection_status",
        data: {
          status: "connected",
          player_id: "p1",
          token: "session-token-123"
        },
      };

      const messageStr = JSON.stringify(connectionMessage);
      const result = MessageParser.parseMessage(messageStr);

      expect(result).toEqual(connectionMessage);
    });

    test('should parse valid heartbeat message', () => {
      const heartbeatMessage: HeartbeatMessage = {
        type: "heartbeat",
        data: {
          timestamp: 1234567890
        },
      };

      const messageStr = JSON.stringify(heartbeatMessage);
      const result = MessageParser.parseMessage(messageStr);

      expect(result).toEqual(heartbeatMessage);
    });

    test('should reject empty message', () => {
      const result = MessageParser.parseMessage("");

      expect(result).toBeNull();
    });

    test('should reject null message', () => {
      const result = MessageParser.parseMessage(null as unknown as string);

      expect(result).toBeNull();
    });

    test('should reject message that is too small', () => {
      const result = MessageParser.parseMessage("{}");

      expect(result).toBeNull();
    });

    test('should reject invalid JSON', () => {
      const result = MessageParser.parseMessage("invalid json");

      expect(result).toBeNull();
    });

    test('should reject message missing type field', () => {
      const messageStr = JSON.stringify({ data: {} });
      const result = MessageParser.parseMessage(messageStr);

      expect(result).toBeNull();
    });

    test('should reject message with non-string type', () => {
      const messageStr = JSON.stringify({ type: 123, data: {} });
      const result = MessageParser.parseMessage(messageStr);

      expect(result).toBeNull();
    });

    test('should reject unknown message type', () => {
      const messageStr = JSON.stringify({ type: "unknown_type", data: {} });
      const result = MessageParser.parseMessage(messageStr);

      expect(result).toBeNull();
    });

    test('should reject game state update with invalid players array', () => {
      const invalidState = createValidGameState();
      (invalidState as any).players = "not an array";
      
      const messageStr = JSON.stringify({
        type: "game_state_update",
        data: invalidState
      });
      
      const result = MessageParser.parseMessage(messageStr);
      
      expect(result).toBeNull();
    });

    test('should reject game state update with empty players array', () => {
      const invalidState = createValidGameState();
      (invalidState as any).players = [];
      
      const messageStr = JSON.stringify({
        type: "game_state_update",
        data: invalidState
      });
      
      const result = MessageParser.parseMessage(messageStr);
      
      expect(result).toBeNull();
    });

    test('should reject game state update with too many players', () => {
      const invalidState = createValidGameState();
      // Add a third player to exceed MAX_PLAYERS
      (invalidState as any).players.push({
        player_id: "p3",
        chip_stack: 1500,
        hole_cards: [],
        position: "none",
        current_bet: 0,
        is_active: true,
        is_folded: false,
        is_all_in: false,
        time_remaining: 0
      });
      
      const messageStr = JSON.stringify({
        type: "game_state_update",
        data: invalidState
      });
      
      const result = MessageParser.parseMessage(messageStr);
      
      expect(result).toBeNull();
    });

    test('should reject game state update with negative pot', () => {
      const invalidState = createValidGameState();
      (invalidState as any).pot = -100;
      
      const messageStr = JSON.stringify({
        type: "game_state_update",
        data: invalidState
      });
      
      const result = MessageParser.parseMessage(messageStr);
      
      expect(result).toBeNull();
    });

    test('should reject game state update with invalid round', () => {
      const invalidState = createValidGameState();
      (invalidState as any).round = "invalid_round" as BettingRound;
      
      const messageStr = JSON.stringify({
        type: "game_state_update",
        data: invalidState
      });
      
      const result = MessageParser.parseMessage(messageStr);
      
      expect(result).toBeNull();
    });

    test('should reject game state update with invalid game status', () => {
      const invalidState = createValidGameState();
      (invalidState as any).game_status = "invalid_status" as GameStatus;
      
      const messageStr = JSON.stringify({
        type: "game_state_update",
        data: invalidState
      });
      
      const result = MessageParser.parseMessage(messageStr);
      
      expect(result).toBeNull();
    });

    test('should reject error message missing code', () => {
      const messageStr = JSON.stringify({
        type: "error",
        data: {
          message: "Error message"
        }
      });
      
      const result = MessageParser.parseMessage(messageStr);
      
      expect(result).toBeNull();
    });

    test('should reject error message missing message', () => {
      const messageStr = JSON.stringify({
        type: "error",
        data: {
          code: "invalid_token"
        }
      });
      
      const result = MessageParser.parseMessage(messageStr);
      
      expect(result).toBeNull();
    });

    test('should reject connection status with invalid status', () => {
      const messageStr = JSON.stringify({
        type: "connection_status",
        data: {
          status: "invalid_status" as ConnectionStatus,
          player_id: "p1"
        }
      });
      
      const result = MessageParser.parseMessage(messageStr);
      
      expect(result).toBeNull();
    });

    test('should reject connection status with invalid player_id', () => {
      const messageStr = JSON.stringify({
        type: "connection_status",
        data: {
          status: "connected",
          player_id: "invalid_player_id"
        }
      });
      
      const result = MessageParser.parseMessage(messageStr);
      
      expect(result).toBeNull();
    });

    test('should reject heartbeat with negative timestamp', () => {
      const messageStr = JSON.stringify({
        type: "heartbeat",
        data: {
          timestamp: -100
        }
      });
      
      const result = MessageParser.parseMessage(messageStr);
      
      expect(result).toBeNull();
    });

    test('should reject heartbeat with non-number timestamp', () => {
      const messageStr = JSON.stringify({
        type: "heartbeat",
        data: {
          timestamp: "not_a_number"
        }
      });
      
      const result = MessageParser.parseMessage(messageStr);
      
      expect(result).toBeNull();
    });

    test('should handle malformed gracefully', () => {
      // Test various malformed JSON structures
      const malformedMessages = [
        "{",
        "}",
        "[",
        "]",
        "null",
        "123",
        '"string"',
        "{ type: 'game_state_update', data: {} }", // Missing quotes
        "{ \"type\": 'game_state_update', \"data\": {} }" // Mixed quotes
      ];

      malformedMessages.forEach(msg => {
        const result = MessageParser.parseMessage(msg);
        expect(result).toBeNull();
      });
    });

    test('should handle game state update with null current_player', () => {
      const gameState = createValidGameState({ current_player: null });
      
      const messageStr = JSON.stringify({
        type: "game_state_update",
        data: gameState
      });
      
      const result = MessageParser.parseMessage(messageStr);
      
      expect(result).not.toBeNull();
      expect(result?.type).toBe("game_state_update");
      expect(result?.data.current_player).toBeNull();
    });

    test('should handle game state update with optional winning_hand', () => {
      const gameState = createValidGameState({ winning_hand: "Royal Flush" });
      
      const messageStr = JSON.stringify({
        type: "game_state_update",
        data: gameState
      });
      
      const result = MessageParser.parseMessage(messageStr);
      
      expect(result).not.toBeNull();
      expect(result?.type).toBe("game_state_update");
      expect(result?.data.winning_hand).toBe("Royal Flush");
    });

    test('should handle error message with optional details', () => {
      const errorMessage: ErrorMessage = {
        type: "error",
        data: {
          code: "invalid_token",
          message: "Invalid session token"
        },
      };

      const messageStr = JSON.stringify(errorMessage);
      const result = MessageParser.parseMessage(messageStr);

      expect(result).toEqual(errorMessage);
    });

    test('should handle connection status with optional token', () => {
      const connectionMessage: ConnectionStatusMessage = {
        type: "connection_status",
        data: {
          status: "connected",
          player_id: "p1"
        },
      };

      const messageStr = JSON.stringify(connectionMessage);
      const result = MessageParser.parseMessage(messageStr);

      expect(result).toEqual(connectionMessage);
    });
  });

  describe('stringifyMessage', () => {
    test('should stringify valid game state update', () => {
      const gameState = createValidGameState();
      const message: GameStateUpdateMessage = {
        type: "game_state_update",
        data: gameState,
      };

      const result = MessageParser.stringifyMessage(message);
      const parsed = JSON.parse(result);

      expect(parsed.type).toBe("game_state_update");
      expect(parsed.data).toEqual(gameState);
    });

    test('should stringify error message', () => {
      const errorMessage: ErrorMessage = {
        type: "error",
        data: {
          code: "invalid_token",
          message: "Invalid session token",
          details: { token: "abc123" }
        },
      };

      const result = MessageParser.stringifyMessage(errorMessage);
      const parsed = JSON.parse(result);

      expect(parsed.type).toBe("error");
      expect(parsed.data.code).toBe("invalid_token");
      expect(parsed.data.message).toBe("Invalid session token");
    });

    test('should stringify connection status message', () => {
      const connectionMessage: ConnectionStatusMessage = {
        type: "connection_status",
        data: {
          status: "connected",
          player_id: "p1",
          token: "session-token-123"
        },
      };

      const result = MessageParser.stringifyMessage(connectionMessage);
      const parsed = JSON.parse(result);

      expect(parsed.type).toBe("connection_status");
      expect(parsed.data.status).toBe("connected");
      expect(parsed.data.player_id).toBe("p1");
    });

    test('should stringify heartbeat message', () => {
      const heartbeatMessage: HeartbeatMessage = {
        type: "heartbeat",
        data: {
          timestamp: 1234567890
        },
      };

      const result = MessageParser.stringifyMessage(heartbeatMessage);
      const parsed = JSON.parse(result);

      expect(parsed.type).toBe("heartbeat");
      expect(parsed.data.timestamp).toBe(1234567890);
    });

    test('should stringify session init message', () => {
      const sessionMessage: SessionInitMessage = {
        type: "session_init",
        data: {
          reconnect_token: "abc123"
        },
      };

      const result = MessageParser.stringifyMessage(sessionMessage);
      const parsed = JSON.parse(result);

      expect(parsed.type).toBe("session_init");
      expect(parsed.data.reconnect_token).toBe("abc123");
    });
  });

  describe('createSessionInit', () => {
    test('should create session init without reconnect token', () => {
      const message = MessageParser.createSessionInit();

      expect(message.type).toBe("session_init");
      expect(message.data).toEqual({});
    });

    test('should create session init with reconnect token', () => {
      const token = "reconnect-token-123";
      const message = MessageParser.createSessionInit(token);

      expect(message.type).toBe("session_init");
      expect(message.data.reconnect_token).toBe(token);
    });

    test('should create session init with both reconnect token and player name', () => {
      const message = MessageParser.createSessionInit("reconnect-token-123", "Player1");

      expect(message.type).toBe("session_init");
      expect(message.data.reconnect_token).toBe("reconnect-token-123");
      expect(message.data.player_name).toBe("Player1");
    });
  });
});