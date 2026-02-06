import {
  WebSocketMessage,
  GameStateUpdateMessage,
  ErrorMessage,
  ConnectionStatusMessage,
  HeartbeatMessage,
  SessionInitMessage,
  isValidCard,
  isValidPlayerId,
} from "@/types/game-types";
import { logError, logWarn } from "@/lib/utils/logger";

const isDev = () => process.env.NODE_ENV === "development";

export class MessageParser {
  // Parse raw WebSocket message
  static parseMessage(data: string): WebSocketMessage | null {
    try {
      const parsed = JSON.parse(data);
      
      // Basic validation
      if (!parsed || typeof parsed !== "object") {
        logError("Invalid message: not an object", parsed);
        return null;
      }

      if (typeof parsed.type !== "string") {
        logError("Invalid message: missing type field", parsed);
        return null;
      }
      
      // Type-specific validation
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
          // Client shouldn't receive these from server
          logWarn(`Unexpected message type from server: ${parsed.type}`);
          return parsed;
        default:
          logError(`Unknown message type: ${parsed.type}`, parsed);
          return null;
      }
    } catch (error) {
      logError("Error parsing WebSocket message:", error);
      return null;
    }
  }
  
  // Validate game state update message
  private static validateGameStateUpdate(
    msg: unknown
  ): GameStateUpdateMessage | null {
    if (!msg || typeof msg !== "object") {
      if (isDev()) console.error("Invalid game_state_update: missing data", msg);
      return null;
    }

    const message = msg as Record<string, unknown>;
    
    if (!message.data || typeof message.data !== "object") {
      if (isDev()) console.error("Invalid game_state_update: missing data", msg);
      return null;
    }
    
    const data = message.data as Record<string, unknown>;
    
    // Basic validation
    if (!Array.isArray(data.players) || data.players.length !== 2) {
      if (isDev()) console.error("Invalid game_state_update: players array invalid", data);
      return null;
    }
    
    if (!Array.isArray(data.community_cards)) {
      if (isDev()) console.error("Invalid game_state_update: community_cards not array", data);
      return null;
    }
    
    if (typeof data.pot !== "number" || data.pot < 0) {
      if (isDev()) console.error("Invalid game_state_update: invalid pot", data);
      return null;
    }
    
    // Validate player data
    for (const player of data.players) {
      if (!player || typeof player !== "object") {
        if (isDev()) console.error("Invalid game_state_update: invalid player", player);
        return null;
      }
      
      const playerObj = player as Record<string, unknown>;
      
      if (!isValidPlayerId(playerObj.player_id as string)) {
        if (isDev()) console.error("Invalid game_state_update: invalid player_id", player);
        return null;
      }
      
      if (typeof playerObj.chip_stack !== "number" || playerObj.chip_stack < 0) {
        if (isDev()) console.error("Invalid game_state_update: invalid chip_stack", player);
        return null;
      }
      
      if (!Array.isArray(playerObj.hole_cards)) {
        if (isDev()) console.error("Invalid game_state_update: hole_cards not array", player);
        return null;
      }
      
      // Validate cards if present
      for (const card of playerObj.hole_cards) {
        if (card && !isValidCard(card)) {
          if (isDev()) console.error("Invalid game_state_update: invalid card", card);
          return null;
        }
      }
    }
    
    // Validate community cards
    for (const card of data.community_cards) {
      if (!isValidCard(card)) {
        if (isDev()) console.error("Invalid game_state_update: invalid community card", card);
        return null;
      }
    }
    
    return msg as GameStateUpdateMessage;
  }
  
  // Validate error message
  private static validateErrorMessage(msg: unknown): ErrorMessage | null {
    if (!msg || typeof msg !== "object") {
      if (isDev()) console.error("Invalid error message: missing data", msg);
      return null;
    }

    const message = msg as Record<string, unknown>;
    
    if (!message.data || typeof message.data !== "object") {
      if (isDev()) console.error("Invalid error message: missing data", msg);
      return null;
    }
    
    const data = message.data as Record<string, unknown>;
    
    if (typeof data.code !== "string") {
      if (isDev()) console.error("Invalid error message: missing code", data);
      return null;
    }
    
    if (typeof data.message !== "string") {
      if (isDev()) console.error("Invalid error message: missing message", data);
      return null;
    }
    
    return msg as ErrorMessage;
  }
  
  // Validate connection status message
  private static validateConnectionStatus(
    msg: unknown
  ): ConnectionStatusMessage | null {
    if (!msg || typeof msg !== "object") {
      if (isDev()) console.error("Invalid connection_status: missing data", msg);
      return null;
    }

    const message = msg as Record<string, unknown>;
    
    if (!message.data || typeof message.data !== "object") {
      if (isDev()) console.error("Invalid connection_status: missing data", msg);
      return null;
    }
    
    const data = message.data as Record<string, unknown>;
    
    if (!["connected", "disconnected", "reconnecting"].includes(data.status as string)) {
      if (isDev()) console.error("Invalid connection_status: invalid status", data);
      return null;
    }
    
    if (data.player_id && !isValidPlayerId(data.player_id as string)) {
      if (isDev()) console.error("Invalid connection_status: invalid player_id", data);
      return null;
    }
    
    return msg as ConnectionStatusMessage;
  }
  
  // Validate heartbeat message
  private static validateHeartbeat(msg: unknown): HeartbeatMessage | null {
    if (!msg || typeof msg !== "object") {
      if (isDev()) console.error("Invalid heartbeat: missing data", msg);
      return null;
    }

    const message = msg as Record<string, unknown>;
    
    if (!message.data || typeof message.data !== "object") {
      if (isDev()) console.error("Invalid heartbeat: missing data", msg);
      return null;
    }
    
    const data = message.data as Record<string, unknown>;
    
    if (typeof data.timestamp !== "number") {
      if (isDev()) console.error("Invalid heartbeat: invalid timestamp", data);
      return null;
    }
    
    return msg as HeartbeatMessage;
  }
  
  // Stringify message for sending
  static stringifyMessage(message: WebSocketMessage): string {
    return JSON.stringify(message);
  }
  
  // Create a heartbeat message
  static createHeartbeat(): HeartbeatMessage {
    return {
      type: "heartbeat",
      data: { timestamp: Date.now() },
    };
  }
  
  // Create a session init message
  static createSessionInit(reconnectToken?: string): SessionInitMessage {
    return {
      type: "session_init",
      data: {
        ...(reconnectToken && { reconnect_token: reconnectToken }),
      },
    };
  }
}