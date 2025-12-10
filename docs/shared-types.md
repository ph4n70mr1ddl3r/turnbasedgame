# Shared Type Definitions

*This document defines the shared data structures and message formats for the turnbasedgame poker platform. These definitions MUST be kept synchronized between the C++ server and TypeScript client implementations.*

## Naming Conventions

- **JSON fields**: `snake_case` (required for consistency)
- **Card strings**: `<rank><suit>` format (e.g., `"Ah"`, `"Kd"`, `"7c"`)
- **Player IDs**: `"p1"`, `"p2"` for the two players
- **Session tokens**: UUIDv4 format
- **Error codes**: `snake_case` descriptive codes

## Base WebSocket Message Structure

All WebSocket messages follow the same base structure:

```typescript
interface BaseWebSocketMessage {
  type: string;
  data: any;
  token?: string;  // Optional, used for client→server authentication
}
```

**Field descriptions:**
- `type`: Message type identifier (see Message Types section)
- `data`: Message payload specific to the message type
- `token`: Session token (optional, required for authenticated actions)

## Card Representation

**Format**: `<rank><suit>` where:
- `rank`: One of `2`, `3`, `4`, `5`, `6`, `7`, `8`, `9`, `T`, `J`, `Q`, `K`, `A`
- `suit`: One of `c` (clubs), `d` (diamonds), `h` (hearts), `s` (spades)

**Examples**: `"Ah"` (Ace of hearts), `"Kd"` (King of diamonds), `"7c"` (7 of clubs)

**Regular expression**: `^[2-9TJQKA][cdhs]$`

**TypeScript type**:
```typescript
type Card = string;  // Must match regex /^[2-9TJQKA][cdhs]$/
```

**C++ validation**: Use regex or manual validation in `card_utils.cpp`

## Player Position

**Valid positions**:
- `"button"`: Player with the dealer button
- `"small_blind"`: Player posting small blind
- `"big_blind"`: Player posting big blind
- `"none"`: No special position

**TypeScript type**:
```typescript
type PlayerPosition = "button" | "small_blind" | "big_blind" | "none";
```

## Betting Round

**Valid rounds**:
- `"preflop"`: Before community cards are dealt
- `"flop"`: After first 3 community cards
- `"turn"`: After 4th community card
- `"river"`: After 5th community card
- `"showdown"`: After final betting, cards revealed

**TypeScript type**:
```typescript
type BettingRound = "preflop" | "flop" | "turn" | "river" | "showdown";
```

## Player State

**Complete player state structure**:

```typescript
interface PlayerState {
  player_id: string;           // "p1" or "p2"
  chip_stack: number;          // Current chip count
  hole_cards: [Card, Card];    // Player's private cards (empty array if not revealed)
  position: PlayerPosition;    // Current position (button, blinds, etc.)
  current_bet: number;         // Amount bet in current betting round
  is_active: boolean;          // Whether player is still in the hand
  is_folded: boolean;          // Whether player has folded
  is_all_in: boolean;          // Whether player is all-in
  last_action?: string;        // Last action taken (e.g., "check", "raise", "fold")
  time_remaining: number;      // Milliseconds remaining for current action
}
```

**Notes**:
- `hole_cards` array is empty (`[]`) for opponents' cards (not revealed)
- `hole_cards` contains 2 cards for the player's own hand when revealed
- `current_bet` resets to 0 at the start of each betting round
- `time_remaining` is provided by server, client displays countdown

## Game State

**Complete game state structure**:

```typescript
interface GameState {
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
  game_status: "waiting" | "active" | "finished";  // Overall game status
}
```

**Notes**:
- `community_cards` length: 0 (preflop), 3 (flop), 4 (turn), 5 (river/showdown)
- `current_player` is `null` during card dealing or when no action required
- `min_bet` and `max_bet` are recalculated each betting round
- `game_status`: "waiting" (waiting for players), "active" (hand in progress), "finished" (hand completed)

## Message Types

### 1. `game_state_update` (Server → Client)

Full or partial game state update. Server sends this message whenever game state changes.

**Message structure**:
```typescript
interface GameStateUpdateMessage {
  type: "game_state_update";
  data: GameState;  // Complete game state
}
```

**When sent**:
- Initial connection
- After any player action
- Timer tick (every 10 seconds)
- Player connection/disconnection
- Game phase changes

### 2. `bet_action` (Client → Server)

Player betting action request.

**Message structure**:
```typescript
interface BetActionMessage {
  type: "bet_action";
  data: {
    action: "check" | "call" | "raise" | "fold";
    amount?: number;  // Required for "raise", ignored for other actions
  };
  token: string;  // Session token required
}
```

**Valid actions**:
- `check`: Check (no bet) if no current bet
- `call`: Call the current bet
- `raise`: Raise by specified amount
- `fold`: Fold hand

**Validation**:
- Server validates action is legal given current game state
- `amount` must be >= `min_bet` and <= `max_bet` for raises
- Server responds with `game_state_update` on success or `error` on failure

### 3. `connection_status` (Server → Client)

Connection status notification.

**Message structure**:
```typescript
interface ConnectionStatusMessage {
  type: "connection_status";
  data: {
    status: "connected" | "disconnected" | "reconnecting";
    player_id?: string;  // Which player's connection changed
    message?: string;    // Human-readable status message
  };
}
```

**When sent**:
- When a player connects
- When a player disconnects  
- When a player reconnects
- Connection quality changes (optional)

### 4. `error` (Server → Client)

Error response for invalid actions or system errors.

**Message structure**:
```typescript
interface ErrorMessage {
  type: "error";
  data: {
    code: string;      // Error code (see Error Codes section)
    message: string;   // Human-readable error message
    details?: any;     // Additional error details
  };
}
```

**Common error codes**:
- `invalid_token`: Session token invalid or expired
- `invalid_action`: Betting action not allowed in current state
- `invalid_bet_amount`: Bet amount outside valid range
- `not_your_turn`: Action attempted when not current player
- `game_not_active`: Action attempted when game not in active state
- `connection_error`: WebSocket connection issue
- `server_error`: Internal server error

### 5. `heartbeat` (Bidirectional)

Keep-alive ping/pong message.

**Message structure**:
```typescript
interface HeartbeatMessage {
  type: "heartbeat";
  data: {
    timestamp: number;  // Unix timestamp in milliseconds
  };
}
```

**Usage**:
- Client sends heartbeat every 30 seconds
- Server responds with heartbeat echo
- Used to detect broken connections

### 6. `session_init` (Client → Server)

Initial session establishment.

**Message structure**:
```typescript
interface SessionInitMessage {
  type: "session_init";
  data: {
    player_name?: string;  // Optional player display name
    reconnect_token?: string;  // Existing token for reconnection
  };
}
```

**Response**: Server responds with `game_state_update` and sets session token in WebSocket handshake or separate message.

### 7. `chat_message` (Bidirectional, Optional)

In-game chat message.

**Message structure**:
```typescript
interface ChatMessage {
  type: "chat_message";
  data: {
    player_id: string;
    message: string;
    timestamp: number;
  };
  token?: string;  // Required for client→server
}
```

## Error Codes Reference

| Code | Description | Recommended Client Action |
|------|-------------|---------------------------|
| `invalid_token` | Session token invalid, expired, or missing | Show login screen, create new session |
| `invalid_action` | Betting action not allowed in current game state | Display error, disable invalid buttons |
| `invalid_bet_amount` | Bet amount too low or too high | Show validation error, suggest valid range |
| `not_your_turn` | Player attempted action when not their turn | Display "Wait your turn" message |
| `game_not_active` | Action attempted when game not in progress | Disable action buttons |
| `insufficient_chips` | Player doesn't have enough chips for bet | Show chip count, suggest lower amount |
| `connection_error` | WebSocket connection issue | Show reconnection UI, attempt auto-reconnect |
| `server_error` | Internal server error | Log error, show generic error message |
| `rate_limit_exceeded` | Too many actions too quickly | Slow down actions, show warning |
| `invalid_message_format` | Message doesn't match expected format | Log error, discard message |

## TypeScript Full Interface Export

```typescript
// Export all types for client use
export type {
  Card,
  PlayerPosition,
  BettingRound,
  PlayerState,
  GameState,
  BaseWebSocketMessage,
  GameStateUpdateMessage,
  BetActionMessage,
  ConnectionStatusMessage,
  ErrorMessage,
  HeartbeatMessage,
  SessionInitMessage,
  ChatMessage,
};

// Union type for all message types
export type WebSocketMessage =
  | GameStateUpdateMessage
  | BetActionMessage
  | ConnectionStatusMessage
  | ErrorMessage
  | HeartbeatMessage
  | SessionInitMessage
  | ChatMessage;

// Helper type guards
export function isGameStateUpdate(msg: any): msg is GameStateUpdateMessage {
  return msg.type === 'game_state_update';
}

export function isBetAction(msg: any): msg is BetActionMessage {
  return msg.type === 'bet_action';
}

export function isErrorMessage(msg: any): msg is ErrorMessage {
  return msg.type === 'error';
}

// Validation functions
export function isValidCard(card: string): boolean {
  return /^[2-9TJQKA][cdhs]$/.test(card);
}

export function isValidPlayerId(id: string): boolean {
  return id === 'p1' || id === 'p2';
}
```

## C++ Equivalent Structures

C++ structures in `server/include/types/` should mirror these TypeScript interfaces exactly:

```cpp
// game_types.hpp
struct PlayerState {
  std::string player_id;
  int chip_stack;
  std::array<std::string, 2> hole_cards;  // Empty strings for unrevealed cards
  std::string position;  // "button", "small_blind", "big_blind", "none"
  int current_bet;
  bool is_active;
  bool is_folded;
  bool is_all_in;
  std::optional<std::string> last_action;
  int time_remaining;
  
  // Serialization to JSON
  nlohmann::json to_json() const;
};

struct GameState {
  std::vector<PlayerState> players;
  std::vector<std::string> community_cards;
  int pot;
  std::optional<std::string> current_player;
  int time_remaining;
  std::string round;  // "preflop", "flop", "turn", "river", "showdown"
  int min_bet;
  int max_bet;
  std::optional<std::string> last_winner;
  std::optional<std::string> winning_hand;
  std::string game_status;  // "waiting", "active", "finished"
  
  // Serialization to JSON
  nlohmann::json to_json() const;
};

// websocket_types.hpp
struct WebSocketMessage {
  std::string type;
  nlohmann::json data;
  std::optional<std::string> token;
  
  static WebSocketMessage from_json(const nlohmann::json& j);
  nlohmann::json to_json() const;
};
```

## JSON Schema Validation

For runtime validation, use these JSON schemas:

```json
{
  "$schema": "http://json-schema.org/draft-2020-12/schema",
  "definitions": {
    "Card": {
      "type": "string",
      "pattern": "^[2-9TJQKA][cdhs]$"
    },
    "PlayerState": {
      "type": "object",
      "properties": {
        "player_id": { "type": "string", "enum": ["p1", "p2"] },
        "chip_stack": { "type": "integer", "minimum": 0 },
        "hole_cards": {
          "type": "array",
          "items": { "$ref": "#/definitions/Card" },
          "minItems": 0,
          "maxItems": 2
        },
        "position": {
          "type": "string",
          "enum": ["button", "small_blind", "big_blind", "none"]
        },
        "current_bet": { "type": "integer", "minimum": 0 },
        "is_active": { "type": "boolean" },
        "is_folded": { "type": "boolean" },
        "is_all_in": { "type": "boolean" },
        "last_action": { "type": "string" },
        "time_remaining": { "type": "integer", "minimum": 0 }
      },
      "required": [
        "player_id", "chip_stack", "hole_cards", "position",
        "current_bet", "is_active", "is_folded", "is_all_in", "time_remaining"
      ]
    }
  }
}
```

## Synchronization Rules

1. **Field Names**: MUST use `snake_case` in both C++ and TypeScript
2. **Card Format**: MUST use exact same string representation (`"Ah"`, `"Kd"`, etc.)
3. **Numeric Types**: All chip amounts as integers, time in milliseconds
4. **Optional Fields**: Use `std::optional` in C++, `?` in TypeScript, omit from JSON when null
5. **Enum Values**: Use exact same string literals (case-sensitive)
6. **Array Bounds**: Same minimum/maximum lengths (e.g., hole_cards: 0-2 cards)

## Versioning

When making changes to these types:
1. Update this document
2. Update both C++ and TypeScript implementations simultaneously
3. Add migration path if breaking changes
4. Update integration tests
5. Document changes in CHANGELOG

**Current Version**: 1.0.0 (Initial MVP release)
**Last Updated**: Wed Dec 10 2025
