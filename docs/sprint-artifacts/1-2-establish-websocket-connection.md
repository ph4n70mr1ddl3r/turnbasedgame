# Story 1.2: establish-websocket-connection

Status: drafted

## Story

As a poker player,
I want to establish a WebSocket connection to the poker server and see real-time connection status,
So that I can participate in live poker gameplay with instant communication.

## Acceptance Criteria

1. **Connection Establishment**  
   **Given** the initialized project from Story 1.1  
   **When** I open the application in a browser  
   **Then** the frontend establishes a WebSocket connection to `ws://localhost:8080/ws`  
   **And** connection status is displayed visually (connected/disconnected/connecting)

2. **Session Token Generation**  
   **Given** a successful WebSocket connection  
   **When** the server receives a connection request  
   **Then** the server generates a unique session token (UUIDv4)  
   **And** stores the connection in an active sessions map  
   **And** sends the session token back to the client for future reconnection

3. **Message Format**  
   **Given** an established connection  
   **When** either client or server sends a WebSocket message  
   **Then** the message is properly formatted as JSON with `type` and `data` fields using `snake_case` naming  
   **And** basic message types are supported (`ping`, `pong`, `error`)

4. **Automatic Reconnection**  
   **Given** a network interruption  
   **When** the WebSocket connection is lost  
   **Then** the client automatically attempts reconnection with exponential backoff  
   **And** displays clear "Reconnecting..." status  
   **And** preserves the session token for reconnection attempts

5. **Reconnection Validation**  
   **Given** the reconnection mechanism  
   **When** connection is restored within 30 seconds  
   **Then** the server validates the session token  
   **And** restores the connection to the active sessions map  
   **And** sends a "reconnected" confirmation message

## Tasks / Subtasks

- [ ] **Frontend WebSocket Hook** (AC: 1,3,4)  
  - [ ] Create `useWebSocket` hook with connection management  
  - [ ] Implement exponential backoff reconnection logic  
  - [ ] Integrate session token persistence (`localStorage`)  
  - [ ] Add ping/pong heartbeat handling

- [ ] **Connection Status Component** (AC: 1,4)  
  - [ ] Build `ConnectionStatus` component with visual states (connected/disconnected/connecting)  
  - [ ] Ensure WCAG AA compliance (contrast, touch targets)  
  - [ ] Add reconnection progress indicator

- [ ] **Backend WebSocket Server** (AC: 2,3,5)  
  - [ ] Set up libhv WebSocket endpoint at `/ws`  
  - [ ] Implement session token generation (UUIDv4)  
  - [ ] Create connection‑session mapping  
  - [ ] Add reconnection validation logic

- [ ] **Message Protocol** (AC: 3)  
  - [ ] Define JSON message types (`ping`, `pong`, `error`, `reconnected`)  
  - [ ] Ensure `snake_case` naming convention  
  - [ ] Create message serialization/deserialization helpers

- [ ] **Testing** (All ACs)  
  - [ ] Write unit tests for WebSocket hook and connection status  
  - [ ] Write server‑side tests for session token validation  
  - [ ] Create E2E tests for connection/disconnection scenarios

## Dev Notes

### Technical Stack
- **Frontend:** Next.js 14 (TypeScript), Tailwind CSS, Headless UI components
- **Backend:** C++17 with libhv 1.3.x (HTTP + WebSocket combined server)
- **Protocol:** WebSocket with JSON messages, `snake_case` field naming

### Implementation Requirements
1. **WebSocket Endpoint:** Server must expose `/ws` endpoint on port 8080
2. **Session Token:** Generate UUIDv4 on server, store in `localStorage` on client
3. **Message Format:** All messages must follow `{ "type": "<message_type>", "data": { ... } }`
4. **Reconnection Logic:** Exponential backoff with jitter (initial 1s, max 30s)
5. **Connection Status UI:** Persistent indicator with WCAG AA contrast (4.5:1), 44×44px touch target

### File Structure
```
client/src/hooks/useWebSocket.ts          # Custom WebSocket hook with reconnection
client/src/components/ui/ConnectionStatus.tsx  # Connection status indicator
server/src/main.cpp                       # libhv WebSocket server setup
server/src/websocket/connection-manager.cpp # Session token and connection mapping
```

### Testing Standards
- **Frontend:** Jest + React Testing Library for connection status UI
- **Backend:** Catch2 for WebSocket endpoint and session management
- **Integration:** Playwright E2E for connection/disconnection scenarios

### Architecture Compliance
- Monorepo structure (`/client`, `/server`) already established in Story 1.1
- Combined HTTP+WebSocket server serves static files from `../client/out`
- Session tokens are UUIDv4, rate‑limited per connection
- Structured JSON logging for all connection events

### Library/Framework Requirements
- libhv 1.3.x (latest stable) – ensure CMakeLists.txt includes correct version
- UUID library for C++ (e.g., `uuid` package or `std::random_device` with formatting)
- Tailwind CSS for connection status styling (design tokens from poker interface)

### Previous Story Intelligence
- Story 1.1 initialized project with Next.js + C++ libhv structure
- No existing WebSocket implementation yet
- Git history is clean (no commits to conflict with)

### Latest Technical Information
- **libhv 1.3.x** supports combined HTTP/WebSocket server; no breaking changes from 1.2.x
- **WebSocket heartbeat** recommended at 30‑second intervals
- **Exponential backoff with jitter** reduces reconnection collisions
- **Session token storage:** `localStorage` persists across tabs; `sessionStorage` is tab‑specific

## References

- [Source: docs/epics.md#story-12-establish-websocket-connection](docs/epics.md#story-12-establish-websocket-connection) – Full acceptance criteria and story context  
- [Source: docs/architecture.md](docs/architecture.md) – Technical stack and architectural constraints  
- [Source: docs/prd.md](docs/prd.md) – Original requirements (covered in epics)  
- [Source: docs/ux-design-specification.md](docs/ux-design-specification.md) – UI/UX guidelines for connection status display  
- libhv documentation: https://github.com/ithewei/libhv  
- WebSocket API MDN: https://developer.mozilla.org/en-US/docs/Web/API/WebSocket  

## Dev Agent Record

### Context Reference

<!-- Path(s) to story context XML will be added here by context workflow -->

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List