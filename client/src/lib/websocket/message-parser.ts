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

export class MessageParser {
  // Parse raw WebSocket message
  static parseMessage(data: string): WebSocketMessage | null {
    try {
      const parsed = JSON.parse(data);
      
      // Basic validation
      if (!parsed || typeof parsed !== "object") {
        console.error("Invalid message: not an object", parsed);
        return null;
      }
      
      if (typeof parsed.type !== "string") {
        console.error("Invalid message: missing type field", parsed);
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
          console.warn(`Unexpected message type from server: ${parsed.type}`);
          return parsed;
        default:
          console.error(`Unknown message type: ${parsed.type}`, parsed);
          return null;
      }
    } catch (error) {
      console.error("Error parsing WebSocket message:", error, data);
      return null;
    }
  }
  
  // Validate game state update message
  private static validateGameStateUpdate(
    msg: any
  ): GameStateUpdateMessage | null {
    if (!msg.data || typeof msg.data !== "object") {
      console.error("Invalid game_state_update: missing data", msg);
      return null;
    }
    
    const { data } = msg;
    
    // Basic validation
    if (!Array.isArray(data.players) || data.players.length !== 2) {
      console.error("Invalid game_state_update: players array invalid", data);
      return null;
    }
    
    if (!Array.isArray(data.community_cards)) {
      console.error("Invalid game_state_update: community_cards not array", data);
      return null;
    }
    
    if (typeof data.pot !== "number" || data.pot < 0) {
      console.error("Invalid game_state_update: invalid pot", data);
      return null;
    }
    
    // Validate player data
    for (const player of data.players) {
      if (!isValidPlayerId(player.player_id)) {
        console.error("Invalid game_state_update: invalid player_id", player);
        return null;
      }
      
      if (typeof player.chip_stack !== "number" || player.chip_stack < 0) {
        console.error("Invalid game_state_update: invalid chip_stack", player);
        return null;
      }
      
      if (!Array.isArray(player.hole_cards)) {
        console.error("Invalid game_state_update: hole_cards not array", player);
        return null;
      }
      
      // Validate cards if present
      for (const card of player.hole_cards) {
        if (card && !isValidCard(card)) {
          console.error("Invalid game_state_update: invalid card", card);
          return null;
        }
      }
    }
    
    // Validate community cards
    for (const card of data.community_cards) {
      if (!isValidCard(card)) {
        console.error("Invalid game_state_update: invalid community card", card);
        return null;
      }
    }
    
    return msg as GameStateUpdateMessage;
  }
  
  // Validate error message
  private static validateErrorMessage(msg: any): ErrorMessage | null {
    if (!msg.data || typeof msg.data !== "object") {
      console.error("Invalid error message: missing data", msg);
      return null;
    }
    
    const { data } = msg;
    
    if (typeof data.code !== "string") {
      console.error("Invalid error message: missing code", data);
      return null;
    }
    
    if (typeof data.message !== "string") {
      console.error("Invalid error message: missing message", data);
      return null;
    }
    
    return msg as ErrorMessage;
  }
  
  // Validate connection status message
  private static validateConnectionStatus(
    msg: any
  ): ConnectionStatusMessage | null {
    if (!msg.data || typeof msg.data !== "object") {
      console.error("Invalid connection_status: missing data", msg);
      return null;
    }
    
    const { data } = msg;
    
    if (!["connected", "disconnected", "reconnecting"].includes(data.status)) {
      console.error("Invalid connection_status: invalid status", data);
      return null;
    }
    
    if (data.player_id && !isValidPlayerId(data.player_id)) {
      console.error("Invalid connection_status: invalid player_id", data);
      return null;
    }
    
    return msg as ConnectionStatusMessage;
  }
  
  // Validate heartbeat message
  private static validateHeartbeat(msg: any): HeartbeatMessage | null {
    if (!msg.data || typeof msg.data !== "object") {
      console.error("Invalid heartbeat: missing data", msg);
      return null;
    }
    
    const { data } = msg;
    
    if (typeof data.timestamp !== "number") {
      console.error("Invalid heartbeat: invalid timestamp", data);
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