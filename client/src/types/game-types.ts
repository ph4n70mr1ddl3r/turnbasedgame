// Game type definitions - must match docs/shared-types.md and C++ structures
// All JSON fields use snake_case

export const MAX_PLAYERS = 2;
export const MAX_COMMUNITY_CARDS = 5;

// Card representation: <rank><suit> e.g., "Ah", "Kd", "7c"
export type Card = string; // Must match regex /^[2-9TJQKA][cdhs]$/

export type PlayerPosition = "button" | "small_blind" | "big_blind" | "none";
export type BettingRound = "preflop" | "flop" | "turn" | "river" | "showdown";
export type GameStatus = "waiting" | "active" | "finished";
export type BetAction = "check" | "call" | "raise" | "fold";
export type ConnectionStatus = "connected" | "disconnected" | "reconnecting";

export interface ConnectionStatusInfo {
  isConnected: boolean;
  status: ConnectionStatus;
  latency: number | null;
  sessionToken: string | null;
  playerId: string | null;
}

// Player state
export interface PlayerState {
  player_id: string;           // "p1" or "p2"
  chip_stack: number;          // Current chip count
  hole_cards: Card[];          // Player's private cards (empty array if not revealed)
  position: PlayerPosition;    // Current position (button, blinds, etc.)
  current_bet: number;         // Amount bet in current betting round
  is_active: boolean;          // Whether player is still in the hand
  is_folded: boolean;          // Whether player has folded
  is_all_in: boolean;          // Whether player is all-in
  last_action?: string;        // Last action taken (e.g., "check", "raise", "fold")
  time_remaining: number;      // Milliseconds remaining for current action
}

// Game state
export interface GameState {
  players: PlayerState[];           // Array of 2 player states
  community_cards: Card[];          // Community cards (0-5 cards)
  pot: number;                      // Total pot amount
  current_player: string | null;    // Player ID whose turn it is, or null if not betting round
  time_remaining: number;           // Milliseconds remaining for current action
  round: BettingRound;              // Current betting round
  min_bet: number;                  // Minimum raise amount
  max_bet: number;                  // Maximum bet (player's stack)
  last_winner?: string;             // Player ID of last hand winner (if game ended)
  winning_hand?: string;            // Description of winning hand (e.g., "Straight")
  game_status: GameStatus;          // Overall game status
}

// WebSocket message base
export interface BaseWebSocketMessage {
  type: string;
  data: unknown;
  token?: string;
}

// Specific message types
export interface GameStateUpdateMessage {
  type: "game_state_update";
  data: GameState;
}

export interface BetActionMessage {
  type: "bet_action";
  data: {
    action: BetAction;
    amount?: number;  // Required for "raise"
  };
  token: string;
}

export interface ConnectionStatusMessage {
  type: "connection_status";
  data: {
    status: ConnectionStatus;
    player_id?: string;
    message?: string;
  };
}

export interface ErrorMessage {
  type: "error";
  data: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

export interface HeartbeatMessage {
  type: "heartbeat";
  data: {
    timestamp: number;
  };
}

export interface SessionInitMessage {
  type: "session_init";
  data: {
    player_name?: string;
    reconnect_token?: string;
  };
}

export interface ChatMessage {
  type: "chat_message";
  data: {
    player_id: string;
    message: string;
    timestamp: number;
  };
  token?: string;
}

// Union type for all message types
export type WebSocketMessage =
  | GameStateUpdateMessage
  | BetActionMessage
  | ConnectionStatusMessage
  | ErrorMessage
  | HeartbeatMessage
  | SessionInitMessage
  | ChatMessage;

// Type guards
export function isGameStateUpdate(msg: unknown): msg is GameStateUpdateMessage {
  const message = msg as Record<string, unknown>;
  return message.type === "game_state_update";
}

export function isBetAction(msg: unknown): msg is BetActionMessage {
  const message = msg as Record<string, unknown>;
  return message.type === "bet_action";
}

export function isConnectionStatus(msg: unknown): msg is ConnectionStatusMessage {
  const message = msg as Record<string, unknown>;
  return message.type === "connection_status";
}

export function isErrorMessage(msg: unknown): msg is ErrorMessage {
  const message = msg as Record<string, unknown>;
  return message.type === "error";
}

export function isHeartbeat(msg: unknown): msg is HeartbeatMessage {
  const message = msg as Record<string, unknown>;
  return message.type === "heartbeat";
}

// Validation functions
export function isValidCard(card: string): boolean {
  return /^[2-9TJQKA][cdhs]$/.test(card);
}

export function isValidPlayerId(id: string): boolean {
  return id === "p1" || id === "p2";
}

export function isValidBetAction(action: string): action is BetAction {
  return ["check", "call", "raise", "fold"].includes(action);
}

// Helper to create messages
export function createBetActionMessage(
  token: string,
  action: BetAction,
  amount?: number
): BetActionMessage {
  return {
    type: "bet_action",
    data: { action, ...(amount !== undefined && { amount }) },
    token,
  };
}

export function createSessionInitMessage(
  reconnectToken?: string,
  playerName?: string
): SessionInitMessage {
  return {
    type: "session_init",
    data: {
      ...(reconnectToken && { reconnect_token: reconnectToken }),
      ...(playerName && { player_name: playerName }),
    },
  };
}