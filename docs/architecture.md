 ---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7]
inputDocuments: ['docs/prd.md', 'docs/ux-design-specification.md', 'docs/ux-design-validation-report.md']
workflowType: 'architecture'
lastStep: 7
project_name: 'turnbasedgame'
user_name: 'Riddler'
date: 'Wed Dec 10 2025'
---

# Architecture Decision Document

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

## Project Context Analysis

### Requirements Overview

**Functional Requirements:**

37 functional requirements organized into 6 categories that define architectural boundaries:

1. **Game Session Management (FR1-FR6)**: Connection handling, table management, session persistence, and state preservation on disconnect/reconnect. Architecturally, this requires a stateful server with robust connection management and serializable game state.

2. **Poker Game Logic (FR7-FR14)**: Standard NLHE rules implementation including 4 betting rounds, hand ranking, no-limit betting, pot calculation, random card generation, and blind management. This requires a deterministic game engine with rule validation independent of client input.

3. **Player Management (FR15-FR21)**: Betting actions, card visibility, chip stack management, timeout handling, rebuy functionality. This defines the player-server interaction model and state synchronization requirements.

4. **Network & Reliability (FR22-FR26)**: Disconnection handling, latency compensation, real-time response requirements, logging for debugging. This drives architectural decisions around connection resilience and fault tolerance.

5. **Frontend Interface (FR27-FR32)**: Visual poker table, real-time updates, connection status display, action controls, timer display. This defines client-side requirements for real-time state visualization and user interaction.

6. **System Architecture (FR33-FR37)**: Real-time communication, state serialization, concurrent connections, action synchronization, server-side rule validation. This establishes the fundamental architecture pattern: server-authoritative game state with real-time client synchronization.

**Non-Functional Requirements:**

Performance requirements that will drive architectural decisions:

- **Response Time**: Game actions must complete within 200ms from user input to server response
- **Synchronization**: Game state must be synchronized between server and both clients within 100ms tolerance
- **Uptime**: Server must maintain 99.5% uptime during scheduled game sessions (2-4 hour windows)
- **Reconnection**: Automatic reconnection must succeed within 5 seconds for transient network issues
- **State Consistency**: Game state must be 100% consistent between server and clients at all times
- **Predictable Behavior**: Server response times must have <20% variance during normal operation
- **Accessibility**: WCAG AA compliance with all text meeting 4.5:1 contrast ratios

**Scale & Complexity:**

- **Primary domain**: Full-stack real-time game platform (C++ server + browser clients)
- **Complexity level**: Medium - real-time constraints with 2-player concurrency create technical challenges, but limited scope reduces overall complexity
- **Estimated architectural components**: 7-10 core components (game engine, connection manager, state manager, WebSocket server, client-side game state, UI components, statistics engine)

### Technical Constraints & Dependencies

**Mandatory Constraints:**
- C++ server backend (specified in PRD)
- Browser-based frontend clients (no native apps)
- Real-time WebSocket or similar communication
- Play money only - no real money transaction requirements
- Single table for exactly 2 players only

**Technology Dependencies from UX Specification:**
- Tailwind CSS + Headless UI components for frontend
- Design system with custom poker components (cards, chips, betting controls)
- WCAG AA accessibility compliance
- Support for desktop browsers with tablet fallback

**Performance Dependencies:**
- <200ms action latency requirement dictates low-latency communication
- State preservation on disconnect requires serializable game state
- 60fps animations for card dealing and chip movements

### Cross-Cutting Concerns Identified

1. **Real-time State Synchronization**: Game state must be identical across server and both clients at all times, requiring careful design of update propagation and conflict resolution.

2. **Network Resilience Architecture**: Disconnection handling isn't just error recovery - it's a core feature. Architecture must treat network issues as expected events, not exceptions.

3. **Deterministic Game Logic**: Poker rules must be implemented identically on server regardless of client input or timing, requiring server-authoritative design.

4. **Accessibility Integration**: WCAG AA compliance affects visual design, color choices, keyboard navigation, and screen reader support across all components.

5. **Performance vs Reliability Trade-offs**: <200ms response time requirement conflicts with robust error handling; architecture must balance speed with correctness.

6. **State Serialization for Recovery**: Game state must be serializable for disconnection recovery while maintaining poker rule integrity (cards cannot be revealed prematurely).

7. **Client-Side Prediction**: Network latency compensation may require predictive UI updates while maintaining server authority for game rules.

## Starter Template Evaluation

### Primary Technology Domain

**Full-stack game platform** with C++17 backend game server and Next.js frontend, deployed as a single monolithic process on Linux VPS.

### Starter Options Considered

**Option 1: Standard Next.js Starter**
- **Technology**: Next.js 16.0.8 with TypeScript, Tailwind CSS, App Router, Turbopack
- **Coverage**: Provides modern React frontend foundation matching UX specification requirements
- **Gap**: Only covers frontend; requires separate backend server implementation

**Option 2: C++ Web Server with libhv**
- **Technology**: libhv 1.3.4 (released Oct 2025) - C/C++ network library supporting HTTP/WebSocket/MQTT
- **Coverage**: Provides both HTTP static file serving and WebSocket real-time communication
- **Advantage**: Single process can serve Next.js static files AND handle game WebSocket connections
- **Performance**: Benchmarks show libhv outperforming nginx in some scenarios (215 MB/s throughput)

**Option 3: Custom Combined Approach** ✅ **SELECTED**
- **Frontend**: Next.js with Tailwind CSS + Headless UI components (per UX spec)
- **Backend**: Custom C++ server using libhv for HTTP/WebSocket unified service
- **Deployment**: Single binary on Linux VPS serving both static frontend and game WebSocket API

### Selected Starter: Custom Combined Approach

**Rationale for Selection:**

1. **Technical Alignment**: PRD specifies C++ server; UX spec requires Tailwind CSS + Headless UI
2. **Deployment Simplicity**: Single process on Linux VPS (no containers, no separate frontend/backend processes)
3. **Performance Requirements**: <200ms latency requires tight integration between game logic and network layer
4. **Network Resilience**: libhv provides built-in reconnection handling and heartbeat mechanisms
5. **Static File Serving**: libhv can efficiently serve Next.js built static files alongside WebSocket game API

**Initialization Commands:**

```bash
# 1. Initialize Next.js frontend with TypeScript and Tailwind CSS
npx create-next-app@latest client --typescript --tailwind --app --no-eslint --src-dir --import-alias "@/*"

# 2. Install Headless UI components (per UX specification)
cd client
npm install @headlessui/react
npm install -D @types/node

# 3. Initialize C++ server with CMake and libhv dependency
cd ..
mkdir -p server
cd server

# Create basic CMakeLists.txt
cat > CMakeLists.txt << 'EOF'
cmake_minimum_required(VERSION 3.15)
project(poker_server VERSION 1.0.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Find libhv (assumes installed system-wide)
find_package(libhv REQUIRED)

add_executable(poker_server src/main.cpp)
target_link_libraries(poker_server libhv::libhv)

# Install target
install(TARGETS poker_server DESTINATION bin)
EOF

# Create basic source structure
mkdir -p src
cat > src/main.cpp << 'EOF'
#include <iostream>
#include "hv/HttpServer.h"
#include "hv/WebSocketServer.h"

using namespace hv;

int main() {
    // Combined HTTP + WebSocket server
    HttpService http;
    WebSocketService ws;
    
    // HTTP: Serve static files from ../client/out
    http.static("/", "../client/out");
    
    // WebSocket: Poker game API
    ws.onopen = [](const WebSocketChannelPtr& channel, const HttpRequestPtr& req) {
        std::cout << "WebSocket connection opened: " << req->path << std::endl;
    };
    
    ws.onmessage = [](const WebSocketChannelPtr& channel, const std::string& msg) {
        // Poker game logic here
        channel->send(msg); // Echo for now
    };
    
    // Create combined server
    WebSocketServer server(&ws);
    server.registerHttpService(&http);
    server.setPort(8080);
    server.setThreadNum(4);
    
    std::cout << "Poker server starting on port 8080..." << std::endl;
    server.run();
    
    return 0;
}
EOF
```

**Architectural Decisions Provided by This Approach:**

**Language & Runtime:**
- **Frontend**: TypeScript 5.x with React 19 (via Next.js 16.0.8)
- **Backend**: C++17 with libhv 1.3.4 network library
- **Build System**: Next.js Turbopack (dev) / Webpack (prod) for frontend, CMake for C++ server

**Styling Solution:**
- Tailwind CSS v3.4+ with custom poker design tokens (per UX spec)
- Headless UI components for unstyled interactive behaviors
- Custom poker components (cards, chips, betting controls) built with Tailwind utilities

**Build Tooling:**
- **Frontend**: Next.js built-in optimization (image, font, script optimization)
- **Backend**: CMake with system-wide libhv dependency
- **Production**: Next.js `next build` outputs to `out/` directory served by C++ server

**Testing Framework:**
- **Frontend**: Jest + React Testing Library (included with Next.js)
- **Backend**: Google Test or Catch2 for C++ unit tests (to be configured)
- **Integration**: Manual WebSocket testing required for game logic

**Code Organization:**
- **Monorepo structure**: `/client` (Next.js frontend), `/server` (C++ game server)
- **Frontend**: Next.js App Router with `src/` directory (`src/app`, `src/components`, `src/lib`)
- **Backend**: CMake project with `src/` for game logic, `include/` for headers
- **Shared Types**: TypeScript interfaces for game state shared via documentation

**Development Experience:**
- **Frontend Dev**: `npm run dev` on `localhost:3000` with hot reload
- **Backend Dev**: Build with CMake, run server on `localhost:8080`
- **Integrated Dev**: Frontend proxies to backend API during development
- **Production**: Single C++ server serves both static files and WebSocket on port 8080

**Deployment Strategy:**
1. Build Next.js frontend: `cd client && npm run build`
2. Build C++ server: `cd server && cmake -B build && cmake --build build`
3. Copy executable to Linux VPS
4. Run: `./poker_server` (serves on port 8080)

**Note:** Project initialization using these commands should be the first implementation story. The C++ server will need additional poker game logic implementation, but this foundation provides both HTTP static file serving and WebSocket communication in a single process.

## Core Architectural Decisions

### Decision Priority Analysis

**Critical Decisions (Block Implementation):**

1. **Game State Persistence**: Pure in-memory with JSON serialization for disconnection recovery
   - Rationale: Matches "no database for now" preference, simple MVP implementation
   - Impact: Game state lost on server restart, requires robust serialization design

2. **Authentication & Security**: Session tokens for player identification and secure reconnection
   - Rationale: Required for FR5, FR6, FR25 (reconnection handling), enables secure session management
   - Impact: Token generation/validation needed, localStorage storage for automatic reconnection

3. **API Communication**: Raw JSON events over WebSocket with `type` and `data` fields
   - Rationale: Human-readable for debugging, simple for limited message types, libhv handles JSON
   - Impact: Manual validation required, can evolve to schema validation later

**Important Decisions (Shape Architecture):**

1. **Frontend State Management**: Zustand 5.0.9 (latest, released Nov 30 2025)
   - Rationale: Minimal boilerplate matches "Minimalist Analytical" design, good performance for real-time updates
   - Impact: WebSocket integration pattern, optimistic UI updates for betting actions

2. **Server Logging**: Structured JSON logging to stdout/files
   - Rationale: Required for debugging (FR26), machine-readable, works with Linux VPS deployment
   - Impact: Log rotation strategy, performance metric collection

**Deferred Decisions (Post-MVP):**

1. **Database Integration**: No database for MVP, can add PostgreSQL/Redis later
   - Rationale: Focus on core gameplay, in-memory sufficient for scheduled sessions
   - Can add: Game history, statistics, persistent player profiles

2. **Advanced Monitoring**: Basic logging for MVP, can add Prometheus/Grafana later
   - Rationale: Meet debugging requirements without over-engineering
   - Can add: Real-time metrics, alerting, performance dashboards

3. **Binary Protocol**: JSON for MVP, can evaluate Protocol Buffers for performance
   - Rationale: Debugging ease during development
   - Can add: Binary serialization if message volume requires optimization

### Data Architecture

**Game State Representation:**
- **Storage**: Pure in-memory C++ objects with JSON serialization for disconnection recovery
- **Serialization**: JSON format using nlohmann/json (included with libhv 1.3.4)
- **Random Generation**: Mersenne Twister (std::mt19937) for deterministic card shuffling
- **State Recovery**: Full game state serialized on disconnect, restored on reconnection within 30 minutes

**Session Management:**
- **Tokens**: UUIDv4 session tokens stored in browser localStorage
- **Expiration**: Match game session duration (2-4 hours)
- **Validation**: Token lookup in server's active sessions map

### Authentication & Security

**Player Identification:**
- **Method**: Session tokens generated on initial WebSocket connection
- **Storage**: Browser localStorage for automatic reconnection
- **Transmission**: WebSocket handshake header or initial connection message

**Connection Security:**
- **Reconnection**: Token validation on reconnection attempts
- **Hijacking Prevention**: One active connection per token
- **No External Auth**: Self-contained token system, no username/password complexity

**WebSocket Security:**
- **libhv Features**: Built-in heartbeat, ping/pong, connection state tracking
- **Message Validation**: Server-side validation of all game actions
- **Rate Limiting**: Basic per-connection action rate limiting

### API & Communication Patterns

**WebSocket Message Protocol:**
```typescript
// Client → Server
{
  "type": "bet_action",
  "data": {
    "action": "raise",
    "amount": 500
  },
  "token": "session-token-uuid"
}

// Server → Client  
{
  "type": "game_state_update",
  "data": {
    "players": [...],
    "communityCards": [...],
    "pot": 1500,
    "currentPlayer": "player1",
    "timeRemaining": 30000
  }
}

// Error Response
{
  "type": "error",
  "data": {
    "code": "invalid_bet",
    "message": "Bet amount exceeds chip stack"
  }
}
```

**Message Types (MVP):**
- `game_state_update` - Full or partial game state
- `bet_action` - Player betting actions (check, call, raise, fold)
- `connection_status` - Connection/disconnection events
- `error` - Error responses with codes
- `heartbeat` - Keep-alive ping/pong

**Error Handling:**
- Structured error codes and messages
- Client-side error display per UX specification
- Server-side logging of all errors for debugging

### Frontend Architecture

**State Management Stack:**
- **Library**: Zustand 5.0.9 (3.1kB min+gzip)
- **Pattern**: Single store with slices for game state, connection, UI
- **Integration**: WebSocket middleware for real-time updates

**Component Architecture:**
- **Base**: Next.js 16.0.8 App Router with `src/` directory
- **Styling**: Tailwind CSS 3.4+ with custom poker design tokens
- **UI Components**: Headless UI for unstyled behaviors + custom poker components
- **Structure**: Atomic design (atoms, molecules, organisms, templates)

**Real-time Updates:**
- WebSocket connection managed in Zustand middleware
- Optimistic updates for player actions with rollback on server rejection
- Debounced state updates to prevent rapid re-renders

### Infrastructure & Deployment

**Server Architecture:**
- **Process**: Single binary (C++ with libhv) serving both static files and WebSocket
- **Static Files**: Next.js `out/` directory served by libhv HTTP service
- **Concurrency**: 4 worker threads (configurable) for WebSocket handling

**Logging & Monitoring:**
- **Format**: Structured JSON logs with timestamp, level, category, message
- **Output**: stdout for development, rotated files for production
- **Metrics**: Basic performance counters (connections, actions, response times)
- **Health Check**: HTTP endpoint `/health` returning server status

**Deployment Process:**
1. Build Next.js frontend: `cd client && npm run build`
2. Build C++ server: `cd server && cmake -B build && cmake --build build --config Release`
3. Deploy to Linux VPS: Copy `server/build/poker_server` and `client/out/`
4. Run: `./poker_server` (listens on port 8080)
5. Optional: systemd service for automatic restart

**Development Workflow:**
- **Frontend**: `npm run dev` on localhost:3000 with hot reload
- **Backend**: Build with CMake, run on localhost:8080
- **Integration**: Frontend proxies to backend during development

### Decision Impact Analysis

**Implementation Sequence:**
1. Project initialization (Next.js + C++ server skeleton)
2. Basic WebSocket connection with session tokens
3. Poker game state representation in C++
4. Basic betting actions and game flow
5. Frontend game table and UI components
6. Disconnection/reconnection handling
7. Polish, animations, accessibility

**Cross-Component Dependencies:**
- Frontend Zustand store depends on WebSocket message format
- C++ game state serialization must match TypeScript interfaces
- Session token system spans both client storage and server validation
- Error handling must be consistent across C++ server and React UI

**Performance Considerations:**
- <200ms response time requires efficient C++ game logic
- JSON serialization/deserialization adds overhead but acceptable for MVP
- WebSocket message size optimization (send only changed state)
- Client-side prediction for smooth UI during network latency

## Implementation Patterns & Consistency Rules

### Pattern Categories Defined

**Critical Conflict Points Identified:** 14 areas where AI agents could make different choices

### Naming Patterns

**JSON Field Naming Conventions:**
- **Rule**: All JSON fields use `snake_case`
- **Rationale**: Consistent with C++/libhv conventions, avoids bidirectional mapping complexity
- **Examples**:
  ```json
  // CORRECT
  {
    "player_id": "p1",
    "chip_stack": 1500,
    "hole_cards": ["Ah", "Kd"],
    "current_player": "p2",
    "time_remaining": 30000
  }
  
  // INCORRECT
  {
    "playerId": "p1",     // Wrong - camelCase
    "chip-stack": 1500,   // Wrong - kebab-case  
    "HoleCards": ["Ah", "Kd"]  // Wrong - PascalCase
  }
  ```

**WebSocket Event Type Naming:**
- **Rule**: Event types use `snake_case` to match JSON field naming
- **Examples**: `game_state_update`, `bet_action`, `connection_status`, `error`

**Code Naming Conventions:**

**C++ Files & Directories:**
- **Rule**: Snake case for files and directories
- **Examples**:
  - Files: `poker_game.cpp`, `game_state.hpp`, `websocket_handler.cpp`
  - Directories: `src/game_logic/`, `include/network/`, `tests/unit/`

**TypeScript/React Files & Directories:**
- **Rule**: Kebab-case for files, PascalCase for React components
- **Examples**:
  - Files: `poker-table.tsx`, `game-state-store.ts`, `websocket-middleware.ts`
  - Components: `PokerTable.tsx`, `PlayerChipStack.tsx`, `BettingControls.tsx`
  - Directories: `src/components/poker-table/`, `src/hooks/`, `src/lib/websocket/`

### Structure Patterns

**WebSocket Message Handling:**
- **Rule**: Primary message parsing and validation happens on C++ server side
- **Rationale**: Server-authoritative design requires validation before game state changes
- **C++ Structure**:
  ```
  server/src/
  ├── message_handlers/
  │   ├── game_state_handler.cpp
  │   ├── betting_handler.cpp  
  │   └── connection_handler.cpp
  ├── game_logic/
  └── network/
  ```
- **TypeScript Structure**:
  ```
  client/src/
  ├── lib/websocket/
  │   ├── message-parser.ts
  │   └── connection-manager.ts
  ├── stores/game-state.ts
  └── components/
  ```

**Card Representation Format:**
- **Rule**: String shorthand using rank + suit code
- **Format**: `<rank><suit>` where rank in `[2-9,T,J,Q,K,A]`, suit in `[c,d,h,s]`
- **Examples**: `"Ah"` (Ace of hearts), `"Kd"` (King of diamonds), `"7c"` (7 of clubs)
- **Rationale**: Compact JSON representation, easy parsing, matches poker notation standards

### Format Patterns

**WebSocket Message Format:**
```json
{
  "type": "game_state_update",
  "data": {
    "players": [
      {
        "player_id": "p1",
        "chip_stack": 1500,
        "hole_cards": ["Ah", "Kd"],
        "position": "button",
        "current_bet": 100
      }
    ],
    "community_cards": ["2h", "7d", "Qs"],
    "pot": 300,
    "current_player": "p1",
    "time_remaining": 30000,
    "round": "flop"
  }
}
```

**Error Response Format:**
```json
{
  "type": "error",
  "data": {
    "code": "invalid_bet_amount",
    "message": "Bet amount exceeds maximum allowed",
    "details": {
      "max_bet": 500,
      "attempted_bet": 600
    }
  }
}
```

### Communication Patterns

**State Update Strategy:**
- **Rule**: Full game state sent on every update
- **Rationale**: Simpler implementation, ensures consistency, avoids delta sync complexity
- **Optimization**: Only send when state actually changes, not on heartbeat
- **Client Handling**: Zustand store replaces entire game state on update

**Message Frequency:**
- **Game actions**: Immediate full state update
- **Timer ticks**: State update every 10 seconds (not every second)
- **Connection events**: Full state on connect/reconnect
- **Heartbeat**: Empty ping/pong messages only

### Process Patterns

**Disconnection & Reconnection:**
- **Rule**: Auto-reconnect with full state restore
- **Client Behavior**:
  1. Detect WebSocket disconnect
  2. Show "reconnecting..." UI (per UX spec)
  3. Attempt reconnect every 2s with exponential backoff (max 10s)
  4. On reconnect, server sends full current game state
  5. Restore UI state from server state
- **Server Behavior**:
  1. Maintain game state for 30 minutes after disconnect (per FR6)
  2. Validate session token on reconnection
  3. Send full game state to reconnected player
  4. Notify other player of reconnection

**Error Recovery:**
- **Client-side errors**: Display user-friendly message, log to console
- **Server-side errors**: Return structured error, log with context
- **Network errors**: Auto-retry non-destructive actions once
- **Game logic errors**: Roll back to last valid state, notify both players

### Enforcement Guidelines

**All AI Agents MUST:**

1. **Use snake_case for all JSON fields** in both C++ serialization and TypeScript interfaces
2. **Validate card strings** match `/[2-9TJQKA][cdhs]/` pattern before processing
3. **Send full game state** on every state-changing event (not partial/delta updates)
4. **Implement auto-reconnect** with session token persistence in localStorage
5. **Structure WebSocket messages** with `type` and `data` fields exactly as specified
6. **Log all errors** in structured JSON format with timestamp and context

**Pattern Enforcement:**

- **C++ code reviews**: Verify nlohmann/json serialization uses snake_case field names
- **TypeScript code reviews**: Verify interfaces match C++ JSON structure exactly
- **Integration testing**: Validate WebSocket message round-trip serialization
- **Documentation**: Update `docs/shared-types.md` with any interface changes
- **Violation process**: Document deviations in PR description, require architecture review

### Pattern Examples

**Good Examples:**

```cpp
// CORRECT C++ serialization
json game_state = {
  {"player_id", player.getId()},
  {"chip_stack", player.getChipStack()},
  {"hole_cards", {"Ah", "Kd"}},  // String shorthand
  {"is_active", player.isActive()}
};
```

```typescript
// CORRECT TypeScript interface
interface PlayerState {
  player_id: string;
  chip_stack: number;
  hole_cards: [string, string];  // e.g., ["Ah", "Kd"]
  is_active: boolean;
}

// CORRECT WebSocket message handling
socket.onmessage = (event) => {
  const message = JSON.parse(event.data);
  if (message.type === 'game_state_update') {
    // Replace entire game state
    useGameStore.setState(message.data);
  }
};
```

**Anti-Patterns to Avoid:**

```cpp
// WRONG - Mixing naming conventions
json game_state = {
  {"playerId", player.getId()},      // camelCase
  {"chip_stack", player.getChipStack()},  // snake_case
  {"HoleCards", {"A♥", "K♦"}}        // PascalCase, Unicode symbols
};
```

```typescript
// WRONG - Partial state updates
socket.onmessage = (event) => {
  const delta = JSON.parse(event.data);
  // Merging partial state can cause inconsistencies
  useGameStore.setState((prev) => ({ ...prev, ...delta }));
};
```

 **Cross-Language Consistency Checklist:**
- [ ] Card strings identical format (Ah, Kd, 7c)
- [ ] JSON field names identical (snake_case)
- [ ] Error code strings identical
- [ ] Session token format identical (UUIDv4)
- [ ] WebSocket message types identical
- [ ] State restoration logic matches

## Complete Project Structure & Boundaries

### Project Directory Tree

**Root Structure:**
```
turnbasedgame/
├── client/                    # Next.js frontend application
│   ├── src/                  # Source code directory
│   │   ├── app/              # Next.js App Router pages
│   │   │   ├── layout.tsx    # Root layout with WebSocket provider
│   │   │   ├── page.tsx      # Main game table page
│   │   │   ├── connection-status/  # Connection status display
│   │   │   └── error/        # Error boundary and display
│   │   ├── components/       # React components (PascalCase)
│   │   │   ├── poker-table/  # Poker table components
│   │   │   │   ├── PokerTable.tsx        # Main table canvas
│   │   │   │   ├── PlayerSeat.tsx        # Individual player seat
│   │   │   │   ├── CommunityCards.tsx    # Community cards display
│   │   │   │   ├── PotDisplay.tsx        # Pot amount display
│   │   │   │   └── BettingControls.tsx   # Betting action buttons
│   │   │   ├── cards/        # Card display components
│   │   │   │   ├── Card.tsx              # Single card component
│   │   │   │   ├── HoleCards.tsx         # Player hole cards
│   │   │   │   └── DeckBack.tsx          # Deck back design
│   │   │   ├── chips/        # Chip components
│   │   │   │   ├── Chip.tsx              # Single chip component
│   │   │   │   ├── ChipStack.tsx         # Stack of chips
│   │   │   │   └── PotChips.tsx          # Pot chip visualization
│   │   │   ├── ui/           # Generic UI components
│   │   │   │   ├── Button.tsx            # Action buttons
│   │   │   │   ├── Timer.tsx             # Countdown timer
│   │   │   │   ├── ConnectionStatus.tsx  # Connection indicator
│   │   │   │   └── ErrorDisplay.tsx      # Error message display
│   │   │   └── layout/       # Layout components
│   │   │       ├── Header.tsx            # Game header
│   │   │       └── Footer.tsx            # Game footer/status
│   │   ├── hooks/            # Custom React hooks
│   │   │   ├── useWebSocket.ts          # WebSocket connection hook
│   │   │   ├── useGameState.ts          # Game state subscription
│   │   │   ├── usePlayerActions.ts      # Player action handlers
│   │   │   └── useTimer.ts              # Game timer management
│   │   ├── lib/              # Utility libraries
│   │   │   ├── websocket/    # WebSocket management
│   │   │   │   ├── connection-manager.ts   # WebSocket connection handling
│   │   │   │   ├── message-parser.ts       # Message parsing/validation
│   │   │   │   ├── session-manager.ts      # Session token management
│   │   │   │   └── reconnect-handler.ts    # Auto-reconnection logic
│   │   │   ├── poker/        # Poker-specific utilities
│   │   │   │   ├── card-utils.ts          # Card parsing/display helpers
│   │   │   │   ├── hand-evaluator.ts      # Hand ranking (client-side validation)
│   │   │   │   └── betting-utils.ts       # Bet amount validation
│   │   │   ├── validation/   # Input validation
│   │   │   │   ├── schema-validation.ts   # JSON schema validation
│   │   │   │   └── error-handling.ts      # Error handling utilities
│   │   │   └── stores/       # Zustand stores
│   │   │       ├── game-store.ts          # Main game state store
│   │   │       ├── connection-store.ts    # Connection status store
│   │   │       └── ui-store.ts            # UI state store
│   │   ├── types/            # TypeScript type definitions
│   │   │   ├── game-types.ts             # Game state interfaces
│   │   │   ├── websocket-types.ts        # WebSocket message types
│   │   │   ├── poker-types.ts            # Poker-specific types
│   │   │   └── index.ts                  # Type exports
│   │   └── styles/           # Global styles
│   │       ├── globals.css               # Global Tailwind directives
│   │       ├── poker-tokens.css          # CSS custom properties
│   │       └── animations.css            # Animation keyframes
│   ├── public/               # Static assets
│   │   ├── images/           # Image assets
│   │   │   ├── cards/        # Card SVGs
│   │   │   ├── chips/        # Chip SVGs
│   │   │   └── backgrounds/  # Table backgrounds
│   │   └── sounds/           # Sound effects (optional)
│   ├── tests/                # Frontend tests
│   │   ├── unit/             # Unit tests
│   │   ├── integration/      # Integration tests
│   │   └── e2e/              # E2E tests (Playwright)
│   ├── next.config.js        # Next.js configuration
│   ├── tailwind.config.js    # Tailwind CSS configuration
│   ├── tsconfig.json         # TypeScript configuration
│   └── package.json          # Dependencies and scripts
├── server/                   # C++ game server
│   ├── src/                  # Source code (snake_case files)
│   │   ├── main.cpp          # Application entry point
│   │   ├── game_logic/       # Core poker game logic
│   │   │   ├── poker_game.cpp           # Main game class
│   │   │   ├── poker_game.hpp           # Game class header
│   │   │   ├── deck.cpp                 # Deck management
│   │   │   ├── deck.hpp                 # Deck header
│   │   │   ├── player.cpp               # Player state management
│   │   │   ├── player.hpp               # Player header
│   │   │   ├── hand_evaluator.cpp       # Hand ranking logic
│   │   │   ├── hand_evaluator.hpp       # Hand evaluator header
│   │   │   ├── betting_round.cpp        # Betting round logic
│   │   │   ├── betting_round.hpp        # Betting round header
│   │   │   ├── pot_manager.cpp          # Pot calculation
│   │   │   ├── pot_manager.hpp          # Pot manager header
│   │   │   └── game_state.cpp           # Game state serialization
│   │   ├── network/          # Network communication
│   │   │   ├── websocket_server.cpp     # WebSocket server setup
│   │   │   ├── websocket_server.hpp     # WebSocket server header
│   │   │   ├── message_handler.cpp      # Message routing
│   │   │   ├── message_handler.hpp      # Message handler header
│   │   │   ├── session_manager.cpp      # Session token management
│   │   │   ├── session_manager.hpp      # Session manager header
│   │   │   ├── connection_manager.cpp   # Connection lifecycle
│   │   │   ├── connection_manager.hpp   # Connection manager header
│   │   │   └── http_server.cpp          # Static file serving
│   │   ├── message_handlers/ # Specific message handlers
│   │   │   ├── game_state_handler.cpp   # Game state updates
│   │   │   ├── game_state_handler.hpp   # Game state handler header
│   │   │   ├── betting_handler.cpp      # Betting action handling
│   │   │   ├── betting_handler.hpp      # Betting handler header
│   │   │   ├── connection_handler.cpp   # Connection events
│   │   │   ├── connection_handler.hpp   # Connection handler header
│   │   │   └── error_handler.cpp        # Error response generation
│   │   ├── utils/            # Utility functions
│   │   │   ├── json_utils.cpp           # JSON serialization helpers
│   │   │   ├── json_utils.hpp           # JSON utilities header
│   │   │   ├── logging.cpp              # Structured JSON logging
│   │   │   ├── logging.hpp              # Logging header
│   │   │   ├── random.cpp               # Random number generation
│   │   │   ├── random.hpp               # Random header
│   │   │   └── timer.cpp                # Game timer management
│   │   └── types/            # Type definitions (headers only)
│   │       ├── game_types.hpp           # Game state structures
│   │       ├── websocket_types.hpp      # WebSocket message structures
│   │       ├── poker_types.hpp          # Poker-specific types
│   │       └── error_codes.hpp          # Error code definitions
│   ├── include/              # Public headers (if needed)
│   ├── tests/                # C++ unit tests
│   │   ├── unit/             # Unit tests (Google Test)
│   │   ├── integration/      # Integration tests
│   │   └── fixtures/         # Test fixtures
│   ├── cmake/                # CMake modules
│   ├── CMakeLists.txt        # Main CMake configuration
│   ├── build.sh              # Build script
│   └── run.sh                # Run script
├── docs/                     # Documentation
│   ├── architecture.md       # This document
│   ├── prd.md               # Product Requirements Document
│   ├── ux-design-specification.md  # UX design specification
│   ├── ux-design-validation-report.md  # UX validation report
│   ├── shared-types.md      # Shared type definitions (JSON schemas)
│   └── api-protocol.md      # WebSocket API documentation
├── scripts/                  # Build/deployment scripts
│   ├── build-all.sh         # Build both client and server
│   ├── deploy.sh            # Deployment script
│   └── dev.sh               # Development environment setup
├── .github/                  # GitHub workflows (optional)
│   └── workflows/
│       ├── build.yml        # CI build workflow
│       └── test.yml         # CI test workflow
├── .gitignore               # Git ignore rules
├── README.md                # Project overview
 └── AGENTS.md               # Agent instructions and guidelines
```

### Requirements to File Mapping

**Game Session Management (FR1-FR6):**
- **FR1 (Connection establishment)**: `server/src/network/websocket_server.cpp`, `server/src/network/connection_manager.cpp`, `client/src/lib/websocket/connection-manager.ts`
- **FR2 (Table creation)**: `server/src/game_logic/poker_game.cpp` (table initialization), `client/src/app/page.tsx` (table UI)
- **FR3 (Session persistence)**: `server/src/game_logic/game_state.cpp` (serialization), `server/src/network/session_manager.cpp` (token storage)
- **FR4 (Rejoin capability)**: `server/src/network/session_manager.cpp` (token validation), `client/src/lib/websocket/reconnect-handler.ts` (auto-reconnect)
- **FR5 (Session timeout)**: `server/src/utils/timer.cpp` (session timer), `server/src/game_logic/poker_game.cpp` (timeout handling)
- **FR6 (State preservation)**: `server/src/game_logic/game_state.cpp` (state serialization), `client/src/lib/stores/game-store.ts` (client state restoration)

**Poker Game Logic (FR7-FR14):**
- **FR7 (Standard NLHE rules)**: `server/src/game_logic/poker_game.cpp` (game flow), `server/src/game_logic/betting_round.cpp` (betting rounds)
- **FR8 (4 betting rounds)**: `server/src/game_logic/betting_round.cpp` (preflop, flop, turn, river logic)
- **FR9 (Hand ranking)**: `server/src/game_logic/hand_evaluator.cpp` (hand strength calculation), `client/src/lib/poker/hand-evaluator.ts` (client-side validation)
- **FR10 (No-limit betting)**: `server/src/game_logic/betting_round.cpp` (bet validation), `server/src/game_logic/pot_manager.cpp` (pot tracking)
- **FR11 (Pot calculation)**: `server/src/game_logic/pot_manager.cpp` (main/side pots), `client/src/components/poker-table/PotDisplay.tsx` (UI display)
- **FR12 (Random card generation)**: `server/src/game_logic/deck.cpp` (shuffling), `server/src/utils/random.cpp` (RNG)
- **FR13 (Blind management)**: `server/src/game_logic/poker_game.cpp` (blind posting), `server/src/game_logic/betting_round.cpp` (blind rounds)
- **FR14 (Card dealing)**: `server/src/game_logic/deck.cpp` (deal cards), `server/src/game_logic/poker_game.cpp` (deal to players/community)

**Player Management (FR15-FR21):**
- **FR15 (Betting actions)**: `server/src/message_handlers/betting_handler.cpp` (action validation), `client/src/components/poker-table/BettingControls.tsx` (UI controls)
- **FR16 (Card visibility)**: `server/src/game_logic/player.cpp` (hole card storage), `client/src/components/cards/HoleCards.tsx` (card display logic)
- **FR17 (Chip stack management)**: `server/src/game_logic/player.cpp` (stack updates), `client/src/components/chips/ChipStack.tsx` (stack visualization)
- **FR18 (Timeout handling)**: `server/src/utils/timer.cpp` (player timer), `server/src/game_logic/poker_game.cpp` (auto-fold on timeout)
- **FR19 (Rebuy functionality)**: `server/src/game_logic/player.cpp` (stack reset), `client/src/components/poker-table/PlayerSeat.tsx` (rebuy UI)
- **FR20 (Player status)**: `server/src/game_logic/player.cpp` (active/folded tracking), `client/src/components/poker-table/PlayerSeat.tsx` (status display)
- **FR21 (Action validation)**: `server/src/message_handlers/betting_handler.cpp` (rule validation), `client/src/lib/validation/schema-validation.ts` (client-side validation)

**Network & Reliability (FR22-FR26):**
- **FR22 (Disconnection handling)**: `server/src/network/connection_manager.cpp` (connection tracking), `client/src/lib/websocket/reconnect-handler.ts` (reconnection logic)
- **FR23 (Latency compensation)**: `client/src/lib/websocket/connection-manager.ts` (message queuing), `client/src/hooks/usePlayerActions.ts` (optimistic updates)
- **FR24 (Real-time response)**: `server/src/network/message_handler.cpp` (message routing), `server/src/utils/timer.cpp` (response timing)
- **FR25 (Reconnection)**: `server/src/network/session_manager.cpp` (session restoration), `client/src/lib/websocket/reconnect-handler.ts` (auto-reconnect)
- **FR26 (Debug logging)**: `server/src/utils/logging.cpp` (structured JSON logs), `client/src/lib/validation/error-handling.ts` (client error logging)

**Frontend Interface (FR27-FR32):**
- **FR27 (Visual poker table)**: `client/src/components/poker-table/PokerTable.tsx` (main table), `client/src/styles/globals.css` (table styling)
- **FR28 (Real-time updates)**: `client/src/lib/stores/game-store.ts` (Zustand store), `client/src/hooks/useGameState.ts` (state subscription)
- **FR29 (Connection status)**: `client/src/components/ui/ConnectionStatus.tsx` (status indicator), `client/src/lib/stores/connection-store.ts` (connection state)
- **FR30 (Action controls)**: `client/src/components/poker-table/BettingControls.tsx` (betting buttons), `client/src/hooks/usePlayerActions.ts` (action handlers)
- **FR31 (Timer display)**: `client/src/components/ui/Timer.tsx` (countdown timer), `client/src/hooks/useTimer.ts` (timer logic)
- **FR32 (Chip animations)**: `client/src/styles/animations.css` (animation keyframes), `client/src/components/chips/Chip.tsx` (animated chip component)

**System Architecture (FR33-FR37):**
- **FR33 (Real-time communication)**: `server/src/network/websocket_server.cpp` (WebSocket server), `client/src/lib/websocket/connection-manager.ts` (WebSocket client)
- **FR34 (State serialization)**: `server/src/game_logic/game_state.cpp` (JSON serialization), `client/src/types/game-types.ts` (TypeScript interfaces)
- **FR35 (Concurrent connections)**: `server/src/network/connection_manager.cpp` (connection pool), `server/src/network/websocket_server.cpp` (thread management)
- **FR36 (Action synchronization)**: `server/src/message_handlers/game_state_handler.cpp` (state broadcast), `client/src/lib/websocket/message-parser.ts` (message parsing)
 - **FR37 (Server-side validation)**: `server/src/message_handlers/betting_handler.cpp` (action validation), `server/src/game_logic/betting_round.cpp` (rule enforcement)

### Integration Boundaries & Communication Patterns

**Boundary 1: WebSocket Protocol Layer**
- **Interface**: JSON messages with `type` and `data` fields (snake_case)
- **Client-side**: `client/src/lib/websocket/connection-manager.ts` (send/receive), `client/src/lib/websocket/message-parser.ts` (parsing)
- **Server-side**: `server/src/network/message_handler.cpp` (routing), `server/src/message_handlers/` (specific handlers)
- **Data Flow**: 
  1. Client sends action message → WebSocket → Server message handler
  2. Server validates → Updates game state → Broadcasts state update
  3. All clients receive full game state → Update Zustand store → Re-render UI
- **Error Handling**: Structured error messages with `type: "error"`, client displays error via `ErrorDisplay.tsx`

**Boundary 2: Game State Synchronization**
- **Interface**: Complete game state JSON structure (shared via `docs/shared-types.md`)
- **Server representation**: C++ objects in `server/src/game_logic/` with serialization in `game_state.cpp`
- **Client representation**: TypeScript interfaces in `client/src/types/game-types.ts`, Zustand store in `game-store.ts`
- **Consistency Enforcement**:
  - Serialization/deserialization must produce identical JSON
  - TypeScript interfaces must match C++ struct field names exactly
  - Card string format (`Ah`, `Kd`) must be identical
  - All numeric values (chips, timers) must use same units (milliseconds for time, integer chips)

**Boundary 3: Session Management**
- **Interface**: Session tokens (UUIDv4) passed in WebSocket handshake or initial message
- **Client storage**: `localStorage` via `client/src/lib/websocket/session-manager.ts`
- **Server storage**: In-memory map in `server/src/network/session_manager.cpp`
- **Reconnection flow**:
  1. Client stores token on initial connection
  2. On disconnect, client attempts reconnect with token
  3. Server validates token, restores game state, continues session
  4. If token invalid/expired, server sends error, client creates new session

**Boundary 4: Static File Serving**
- **Interface**: HTTP requests for frontend assets (HTML, JS, CSS, images)
- **Server**: `server/src/network/http_server.cpp` serves files from `client/out/`
- **Build integration**: Next.js `next build` outputs to `client/out/`, copied to server location
- **Development**: Next.js dev server on `localhost:3000`, C++ server on `localhost:8080`, proxy configuration

**Boundary 5: Development/Production Parity**
- **Development**: 
  - Frontend: `npm run dev` (hot reload)
  - Backend: CMake debug build, run locally
  - Communication: WebSocket connection to `localhost:8080`
- **Production**:
  - Frontend: `npm run build` → static files in `client/out/`
  - Backend: CMake release build → single binary `poker_server`
  - Deployment: Binary + `client/out/` directory on Linux VPS
  - Communication: Same WebSocket protocol, served from same port

**Communication Patterns:**

**Pattern 1: Full State Broadcast**
- **Trigger**: Any game state change (player action, timer tick, connection event)
- **Implementation**: Server calls `broadcastGameState()` → serializes entire state → sends to all connected clients
- **Optimization**: Only broadcast when state actually changes, not on heartbeat
- **Client handling**: Zustand store replaces entire state (`setState()`), React re-renders affected components

**Pattern 2: Optimistic Updates for Player Actions**
- **Trigger**: Player initiates action (bet, check, fold)
- **Implementation**:
  1. Client immediately updates local UI (optimistic)
  2. Client sends WebSocket message
  3. Server validates, updates game state, broadcasts
  4. Client receives authoritative state, reconciles if different
  5. If server rejects, client rolls back optimistic update
- **Files**: `client/src/hooks/usePlayerActions.ts`, `client/src/lib/stores/game-store.ts`

**Pattern 3: Heartbeat & Connection Health**
- **Implementation**: libhv built-in ping/pong, client monitors last message time
- **Detection**: 10 seconds without message → "connection unstable" UI
- **Recovery**: 30 seconds without message → attempt reconnect
- **Files**: `server/src/network/websocket_server.cpp`, `client/src/lib/websocket/connection-manager.ts`

**Pattern 4: Error Handling & User Feedback**
- **Server errors**: Structured error response with code, message, details
- **Client display**: `ErrorDisplay.tsx` shows user-friendly message, logs technical details
- **Recovery actions**: Based on error code (retry, reconnect, show help)
- **Files**: `server/src/message_handlers/error_handler.cpp`, `client/src/components/ui/ErrorDisplay.tsx`

**Pattern 5: Timer Synchronization**
- **Server authority**: Game timers managed in `server/src/utils/timer.cpp`
- **Client display**: Timer component shows countdown with network latency compensation
- **Sync method**: Server includes `time_remaining` in game state updates
- **Files**: `server/src/utils/timer.cpp`, `client/src/components/ui/Timer.tsx`, `client/src/hooks/useTimer.ts`

 **Cross-Boundary Validation Rules:**
1. **JSON Schema Validation**: Both sides must validate incoming messages against documented schema
2. **Card Format Validation**: All card strings must match `/[2-9TJQKA][cdhs]/` regex
3. **Chip Amount Validation**: Chip amounts must be positive integers, within stack limits
4. **Session Token Validation**: Tokens must be valid UUIDv4 format, not expired
5. **State Integrity Validation**: After any state change, game must remain in valid poker state

### Step 6 Summary

**Complete Project Structure Defined:**
1. **Directory Tree**: Comprehensive structure for both C++ server and Next.js frontend with clear separation of concerns
2. **Requirements Mapping**: All 37 functional requirements mapped to specific implementation files
3. **Integration Boundaries**: 5 key boundaries with clear interfaces and communication patterns
4. **Communication Patterns**: 5 established patterns for state sync, optimistic updates, error handling, etc.

**Key Structural Decisions:**
- **Monorepo organization**: Clear separation of `client/` and `server/` directories
- **Consistent naming**: snake_case for C++, kebab-case for TypeScript files, PascalCase for React components
- **Shared type definitions**: Maintained in `docs/shared-types.md` for cross-language consistency
- **Build integration**: Next.js outputs static files served by C++ server binary

**Implementation Readiness:** This structure provides AI agents with clear implementation targets. Each requirement has specific file assignments, and integration patterns ensure consistent cross-component communication.

 **Next Step**: Validation of architectural coherence and completeness (Step 7).

## Architectural Validation & Completeness Check (Step 7)

### Coherence Validation

**Internal Consistency Check:**
- [x] **Technology Stack Consistency**: C++17 + libhv aligns with PRD C++ requirement; Next.js + Tailwind CSS aligns with UX specification
- [x] **Naming Convention Consistency**: snake_case JSON, snake_case C++ files, kebab-case TypeScript files, PascalCase React components - all consistently defined
- [x] **Communication Pattern Consistency**: WebSocket JSON messages with `type`/`data` structure used throughout
- [x] **State Management Consistency**: Server-authoritative design with full state broadcast pattern applied consistently
- [x] **Error Handling Consistency**: Structured error responses with codes used across all boundaries

**Cross-Component Dependency Analysis:**
- **Frontend-Backend Data Flow**: WebSocket messages → Message handlers → Game logic → State serialization → Broadcast → Zustand store → UI updates (clear chain)
- **Shared Type Synchronization**: `docs/shared-types.md` will ensure C++ and TypeScript interfaces remain synchronized
- **Build Dependency**: Frontend build output (`client/out/`) served by C++ server (clear build sequence)
- **Session Management**: Token generation (server) ↔ localStorage storage (client) ↔ reconnection validation (both)

**Pattern Application Consistency:**
- Full state broadcast applied to all state changes
- Optimistic updates limited to player actions (not game state changes)
- Auto-reconnect with token persistence applied consistently
- Structured logging applied to both server and client errors

### Completeness Validation

**Requirements Coverage Analysis:**
- **Functional Requirements (37/37)**: All FR1-FR37 mapped to specific implementation files
- **Non-Functional Requirements**: 
  - Performance (<200ms): Achieved via libhv efficiency, minimal JSON, efficient C++ game logic
  - Uptime (99.5%): Single binary on Linux VPS, no external dependencies, robust reconnection
  - Accessibility (WCAG AA): Tailwind CSS + Headless UI components, design tokens for contrast
  - State consistency: Server-authoritative with full state broadcast ensures 100% consistency

**Cross-Cutting Concerns Addressed:**
1. **Real-time State Synchronization**: Full state broadcast pattern with WebSocket
2. **Network Resilience**: Auto-reconnect with token persistence, heartbeat monitoring
3. **Deterministic Game Logic**: Server-side C++ implementation, client-side validation only
4. **Accessibility Integration**: WCAG AA compliance via Tailwind CSS custom tokens
5. **Performance vs Reliability**: Optimistic updates balance speed with server authority
6. **State Serialization**: JSON serialization for disconnection recovery
7. **Client-Side Prediction**: Optimistic UI updates for player actions

**Edge Cases Covered:**
- **Network disconnection**: Auto-reconnect with state restoration (FR4, FR6, FR22, FR25)
- **Invalid player actions**: Server validation with structured errors (FR21, FR37)
- **Player timeout**: Auto-fold with timer management (FR18)
- **Session expiration**: 30-minute state preservation (FR6)
- **Concurrent actions**: Single-threaded game logic with message queue prevents race conditions
- **Browser refresh**: Token persistence in localStorage enables reconnection

### Risk Assessment & Mitigation

**Technical Risks:**
1. **C++/TypeScript Type Drift**
   - **Risk**: JSON structures diverge between languages causing runtime errors
   - **Mitigation**: Shared type documentation (`docs/shared-types.md`), integration tests, code generation
   - **Priority**: High

2. **WebSocket Message Volume**
   - **Risk**: Full state broadcast on every change could create excessive network traffic
   - **Mitigation**: Only broadcast on actual state changes, not heartbeats; monitor performance
   - **Priority**: Medium (MVP scale: 2 players only)

3. **Memory Leaks in C++ Server**
   - **Risk**: Long-running server process could accumulate memory leaks
   - **Mitigation**: Use RAII patterns, smart pointers, valgrind testing, restart schedule
   - **Priority**: Medium

4. **Cross-Browser Compatibility**
   - **Risk**: CSS/JavaScript features not supported in all browsers
   - **Mitigation**: Target modern browsers (Chrome, Firefox, Safari), progressive enhancement
   - **Priority**: Low (controlled environment)

**Implementation Risks:**
1. **Build Complexity**
   - **Risk**: CMake + Next.js build process could be complex for contributors
   - **Mitigation**: Documented build scripts (`scripts/build-all.sh`), clear README
   - **Priority**: Medium

2. **Development Environment Setup**
   - **Risk**: Developers need C++ toolchain + Node.js setup
   - **Mitigation**: Docker development environment (optional), clear setup instructions
   - **Priority**: Low (controlled AI agent environment)

3. **Testing Coverage**
   - **Risk**: Real-time WebSocket testing is complex
   - **Mitigation**: Unit tests for game logic, integration tests with mock WebSocket
   - **Priority**: High

### Gap Analysis

**Identified Gaps & Resolution:**

1. **Missing Shared Type Documentation**
   - **Gap**: No `docs/shared-types.md` file yet
   - **Resolution**: Create as first implementation task with JSON schemas for all messages

2. **No Health Check Endpoint**
   - **Gap**: Infrastructure monitoring requires `/health` endpoint
   - **Resolution**: Add to `server/src/network/http_server.cpp`

3. **Missing Build Scripts**
   - **Gap**: `scripts/build-all.sh`, `scripts/deploy.sh` not yet created
   - **Resolution**: Create as part of project initialization

4. **No Performance Testing Strategy**
   - **Gap**: No defined approach to validate <200ms response time
   - **Resolution**: Add performance tests with simulated load, monitor in development

**Accepted Gaps (Post-MVP):**
- Database persistence (in-memory sufficient for MVP)
- Advanced monitoring (basic logging sufficient)
- Binary protocol optimization (JSON acceptable for MVP)
- Multi-table support (2-player single table only)

### Validation Summary

**Architecture Coherence: ✅ PASS**
- Consistent patterns applied throughout
- Clear separation of concerns with defined boundaries
- Technology choices align with requirements
- Naming and structural conventions are consistent

**Requirements Completeness: ✅ PASS**
- All 37 functional requirements mapped to implementation
- Non-functional requirements addressed with specific patterns
- Cross-cutting concerns properly handled
- Edge cases identified and mitigated

**Implementation Viability: ✅ PASS**
- Clear file structure for AI agent implementation
- Defined communication patterns reduce integration risk
- Technology stack is appropriate and achievable
- Build and deployment process is straightforward

**Recommendation: ARCHITECTURE APPROVED**

The architecture is coherent, complete, and ready for implementation. All requirements are addressed with appropriate patterns and technologies. The project structure provides clear implementation targets for AI agents with consistent conventions across the codebase.

**Next Actions:**
1. Create `docs/shared-types.md` with JSON schemas
2. Initialize project structure with `client/` and `server/` directories
3. Implement core WebSocket connectivity
4. Build basic poker game logic
5. Develop frontend components per UX specification