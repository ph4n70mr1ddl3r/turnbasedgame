import {
  WebSocketMessage,
  GameStateUpdateMessage,
  ErrorMessage,
  ConnectionStatusMessage,
  HeartbeatMessage,
  SessionInitMessage,
  isValidCard,
  isValidPlayerId,
  isValidBettingRound,
  isValidGameStatus,
  MAX_PLAYERS,
  MAX_COMMUNITY_CARDS,
  isObject,
  isString,
  isNumber,
  isArray,
} from "@/types/game-types";
import { logError } from "@/lib/utils/logger";

export class MessageParser {
  static parseMessage(data: string): WebSocketMessage | null {
    try {
      const parsed = JSON.parse(data);

      if (!isObject(parsed)) {
        logError("Invalid message: not an object", parsed);
        return null;
      }

      if (!isString(parsed.type)) {
        logError("Invalid message: missing type field", parsed);
        return null;
      }

      switch (parsed.type) {
        case "game_state_update":
          return this.validateGameStateUpdate(parsed);
        case "error":
          return this.validateErrorMessage(parsed);
        case "connection_status":
          return this.validateConnectionStatus(parsed);
        case "heartbeat":
          return this.validateHeartbeat(parsed);
        case "bet_action":
        case "session_init":
        case "chat_message":
          logError(`Unexpected message type from server: ${parsed.type}`);
          return null;
        default:
          logError(`Unknown message type: ${parsed.type}`, parsed);
          return null;
      }
    } catch (error) {
      logError("Error parsing WebSocket message:", error);
      return null;
    }
  }

  private static validateGameStateUpdate(
    msg: Record<string, unknown>
  ): GameStateUpdateMessage | null {
    if (!isObject(msg.data)) {
      logError("Invalid game_state_update: missing data", msg);
      return null;
    }

    const data = msg.data;

    if (!isArray(data.players) || data.players.length !== MAX_PLAYERS) {
      logError("Invalid game_state_update: players array invalid", data);
      return null;
    }

    if (!isArray(data.community_cards) || data.community_cards.length > MAX_COMMUNITY_CARDS) {
      logError("Invalid game_state_update: community_cards not array or too many cards", data);
      return null;
    }

    if (!isNumber(data.pot) || data.pot < 0) {
      logError("Invalid game_state_update: invalid pot", data);
      return null;
    }

    if (!isString(data.round) || !isValidBettingRound(data.round)) {
      logError("Invalid game_state_update: invalid round", data);
      return null;
    }

    if (!isString(data.game_status) || !isValidGameStatus(data.game_status)) {
      logError("Invalid game_state_update: invalid game_status", data);
      return null;
    }

    if (!isNumber(data.min_bet) || data.min_bet < 0) {
      logError("Invalid game_state_update: invalid min_bet", data);
      return null;
    }

    if (!isNumber(data.max_bet) || data.max_bet < 0) {
      logError("Invalid game_state_update: invalid max_bet", data);
      return null;
    }

    for (const player of data.players) {
      if (!isObject(player)) {
        logError("Invalid game_state_update: invalid player", player);
        return null;
      }

      const playerId = player.player_id;
      if (!isString(playerId) || !isValidPlayerId(playerId)) {
        logError("Invalid game_state_update: invalid player_id", player);
        return null;
      }

      const chipStack = player.chip_stack;
      if (!isNumber(chipStack) || chipStack < 0) {
        logError("Invalid game_state_update: invalid chip_stack", player);
        return null;
      }

      if (!isArray(player.hole_cards)) {
        logError("Invalid game_state_update: hole_cards not array", player);
        return null;
      }

      for (const card of player.hole_cards) {
        if (card === null || card === undefined || card === "") {
          continue;
        }
        if (!isString(card) || !isValidCard(card)) {
          logError("Invalid game_state_update: invalid card", card);
          return null;
        }
      }
    }

    for (const card of data.community_cards) {
      if (!isValidCard(card as string)) {
        logError("Invalid game_state_update: invalid community card", card);
        return null;
      }
    }

    return msg as unknown as GameStateUpdateMessage;
  }

  private static validateErrorMessage(msg: Record<string, unknown>): ErrorMessage | null {
    if (!isObject(msg.data)) {
      logError("Invalid error message: missing data", msg);
      return null;
    }

    const data = msg.data;

    if (!isString(data.code)) {
      logError("Invalid error message: missing code", data);
      return null;
    }

    if (!isString(data.message)) {
      logError("Invalid error message: missing message", data);
      return null;
    }

    return msg as unknown as ErrorMessage;
  }

  private static validateConnectionStatus(
    msg: Record<string, unknown>
  ): ConnectionStatusMessage | null {
    if (!isObject(msg.data)) {
      logError("Invalid connection_status: missing data", msg);
      return null;
    }

    const data = msg.data;

    if (!isString(data.status) || !["connected", "disconnected", "reconnecting"].includes(data.status)) {
      logError("Invalid connection_status: invalid status", data);
      return null;
    }

    if (data.player_id !== undefined) {
      if (!isString(data.player_id) || !isValidPlayerId(data.player_id)) {
        logError("Invalid connection_status: invalid player_id", data);
        return null;
      }
    }

    return msg as unknown as ConnectionStatusMessage;
  }

  private static validateHeartbeat(msg: Record<string, unknown>): HeartbeatMessage | null {
    if (!isObject(msg.data)) {
      logError("Invalid heartbeat: missing data", msg);
      return null;
    }

    const data = msg.data;

    if (!isNumber(data.timestamp)) {
      logError("Invalid heartbeat: invalid timestamp", data);
      return null;
    }

    return msg as unknown as HeartbeatMessage;
  }

  static stringifyMessage(message: WebSocketMessage): string {
    return JSON.stringify(message);
  }

  static createHeartbeat(): HeartbeatMessage {
    return {
      type: "heartbeat",
      data: { timestamp: Date.now() },
    };
  }

  static createSessionInit(reconnectToken?: string): SessionInitMessage {
    return {
      type: "session_init",
      data: {
        ...(reconnectToken && { reconnect_token: reconnectToken }),
      },
    };
  }
}
