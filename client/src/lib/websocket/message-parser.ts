import {
  WebSocketMessage,
  GameStateUpdateMessage,
  ErrorMessage,
  ConnectionStatusMessage,
  HeartbeatMessage,
  SessionInitMessage,
  PlayerState,
  BettingRound,
  GameStatus,
  Card,
  isValidCard,
  isValidPlayerId,
  isValidBettingRound,
  isValidGameStatus,
  isValidPlayerPosition,
  MAX_PLAYERS,
  MAX_COMMUNITY_CARDS,
  isObject,
  isString,
  isNumber,
  isArray,
} from "@/types/game-types";
import { logError } from "@/lib/utils/logger";
import { WS_MAX_MESSAGE_SIZE } from "@/lib/constants/game";

const MIN_MESSAGE_SIZE_BYTES = 2;

export class MessageParser {
  static parseMessage(data: string): WebSocketMessage | null {
    if (!data || typeof data !== 'string') {
      return null;
    }

    if (data.length < MIN_MESSAGE_SIZE_BYTES) {
      return null;
    }

    if (data.length > WS_MAX_MESSAGE_SIZE) {
      logError(`Message too large: ${data.length} bytes (max: ${WS_MAX_MESSAGE_SIZE})`);
      return null;
    }
    
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

    if (!isArray(data.players) || data.players.length === 0 || data.players.length > MAX_PLAYERS) {
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

    const validatedPlayers: PlayerState[] = [];

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
      if (!isNumber(chipStack) || chipStack < 0 || !Number.isFinite(chipStack)) {
        logError("Invalid game_state_update: invalid chip_stack", player);
        return null;
      }

      if (!isArray(player.hole_cards)) {
        logError("Invalid game_state_update: hole_cards not array", player);
        return null;
      }

      const validatedHoleCards: Card[] = [];
      for (const card of player.hole_cards) {
        if (card === null || card === undefined || card === "") {
          continue;
        }
        if (!isString(card) || !isValidCard(card)) {
          logError("Invalid game_state_update: invalid card", card);
          return null;
        }
        validatedHoleCards.push(card as Card);
      }

      const timeRemaining = player.time_remaining;
      if (timeRemaining !== undefined && (!isNumber(timeRemaining) || !Number.isFinite(timeRemaining))) {
        logError("Invalid game_state_update: invalid time_remaining", player);
        return null;
      }

      if (!isString(player.position) || !isValidPlayerPosition(player.position)) {
        logError("Invalid game_state_update: missing or invalid position", player);
        return null;
      }

      if (!isNumber(player.current_bet) || player.current_bet < 0 || !Number.isFinite(player.current_bet)) {
        logError("Invalid game_state_update: invalid current_bet", player);
        return null;
      }

      if (typeof player.is_active !== 'boolean') {
        logError("Invalid game_state_update: invalid is_active", player);
        return null;
      }

      if (typeof player.is_folded !== 'boolean') {
        logError("Invalid game_state_update: invalid is_folded", player);
        return null;
      }

      if (typeof player.is_all_in !== 'boolean') {
        logError("Invalid game_state_update: invalid is_all_in", player);
        return null;
      }

      if (player.last_action !== undefined && !isString(player.last_action)) {
        logError("Invalid game_state_update: invalid last_action", player);
        return null;
      }

      validatedPlayers.push({
        player_id: playerId,
        chip_stack: chipStack,
        hole_cards: validatedHoleCards,
        position: player.position,
        current_bet: player.current_bet,
        is_active: player.is_active,
        is_folded: player.is_folded,
        is_all_in: player.is_all_in,
        last_action: player.last_action,
        time_remaining: timeRemaining ?? 0,
      });
    }

    const validatedCommunityCards: Card[] = [];
    for (const card of data.community_cards) {
      if (!isString(card) || !isValidCard(card)) {
        logError("Invalid game_state_update: invalid community card", card);
        return null;
      }
      validatedCommunityCards.push(card as Card);
    }

    if (data.current_player != null && !isString(data.current_player)) {
      logError("Invalid game_state_update: invalid current_player", data);
      return null;
    }

    if (data.time_remaining !== undefined && (!isNumber(data.time_remaining) || !Number.isFinite(data.time_remaining))) {
      logError("Invalid game_state_update: invalid time_remaining", data);
      return null;
    }

    if (data.last_winner != null && !isString(data.last_winner)) {
      logError("Invalid game_state_update: invalid last_winner", data);
      return null;
    }

    if (data.winning_hand != null && !isString(data.winning_hand)) {
      logError("Invalid game_state_update: invalid winning_hand", data);
      return null;
    }

    return {
      type: "game_state_update",
      data: {
        players: validatedPlayers,
        community_cards: validatedCommunityCards,
        pot: data.pot as number,
        current_player: isString(data.current_player) ? data.current_player : null,
        time_remaining: isNumber(data.time_remaining) ? data.time_remaining : 0,
        round: data.round as BettingRound,
        min_bet: data.min_bet as number,
        max_bet: data.max_bet as number,
        last_winner: isString(data.last_winner) ? data.last_winner : undefined,
        winning_hand: isString(data.winning_hand) ? data.winning_hand : undefined,
        game_status: data.game_status as GameStatus,
      },
    };
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

    let details: Record<string, unknown> | undefined;
    if (isObject(data.details)) {
      try {
        details = JSON.parse(JSON.stringify(data.details));
      } catch {
        details = { ...data.details };
      }
    }

    return {
      type: "error",
      data: {
        code: data.code,
        message: data.message,
        details,
      },
    };
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

    return {
      type: "connection_status",
      data: {
        status: data.status as "connected" | "disconnected" | "reconnecting",
        player_id: data.player_id as string | undefined,
        message: isString(data.message) ? data.message : undefined,
      },
    };
  }

  private static validateHeartbeat(msg: Record<string, unknown>): HeartbeatMessage | null {
    if (!isObject(msg.data)) {
      logError("Invalid heartbeat: missing data", msg);
      return null;
    }

    const data = msg.data;

    if (!isNumber(data.timestamp) || !Number.isFinite(data.timestamp)) {
      logError("Invalid heartbeat: invalid timestamp", data);
      return null;
    }

    if (data.timestamp < 0) {
      logError("Invalid heartbeat: negative timestamp", data);
      return null;
    }

    return {
      type: "heartbeat",
      data: {
        timestamp: data.timestamp,
      },
    };
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
