---
stepsCompleted: [1, 2, 3]
inputDocuments: ['docs/prd.md', 'docs/architecture.md', 'docs/ux-design-specification.md', 'docs/ux-design-validation-report.md']
---

# turnbasedgame - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for turnbasedgame, decomposing the requirements from the PRD, UX Design if it exists, and Architecture requirements into implementable stories.

## Requirements Inventory

### Functional Requirements

FR1: Player can connect to the poker server using a browser
FR2: Player can join a heads-up NLHE table as one of 2 players
FR3: System can maintain a single table game session for exactly 2 players
FR4: System can persist game state for the duration of a session
FR5: System can preserve game state when a player disconnects
FR6: System can resume game from preserved state when player reconnects
FR7: System can implement standard NLHE rules (pre-flop, flop, turn, river)
FR8: System can use standard poker hand ranking (Royal Flush to High Card)
FR9: System can enforce no-limit betting rules
FR10: System can calculate pot amounts including side pots for all-in situations
FR11: System can determine hand winners including split pots
FR12: System can generate random card distributions and shuffling
FR13: System can manage blind posting (small blind/big blind structure)
FR14: System can handle 100bb starting stacks for each player
FR15: Player can perform betting actions (check, bet, raise, fold, call)
FR16: Player can view their hole cards and community cards
FR17: Player can see their chip stack and pot amounts
FR18: System can enforce action timeouts with default fold on expiration
FR19: Player can manually rebuy after busting out
FR20: System can automatically sit out a player who busts
FR21: System can validate bet amounts against player stack limits
FR22: System can handle player disconnections during active gameplay
FR23: System can compensate for network latency in action synchronization
FR24: System can maintain <200ms response time for game actions
FR25: System can provide automatic reconnection for transient connection issues
FR26: System can log game events for debugging unpredictable behavior
FR27: Player can see a visual poker table with cards and chips
FR28: Player can see real-time updates of game state changes
FR29: Player can see connection status and reconnection indicators
FR30: Player can see action buttons for available betting options
FR31: Player can see countdown timer for action deadlines
FR32: Player can see opponent's actions and chip amounts
FR33: System can use real-time communication between server and clients
FR34: System can serialize game state for disconnection recovery
FR35: System can handle concurrent connections for 2 players
FR36: System can synchronize game actions between server and both clients
FR37: System can validate game rules independently of client input

### NonFunctional Requirements

NFR1: Game actions (bet, fold, check, raise, call) must complete within 200ms from user input to server response
NFR2: Card dealing and hand initiation must complete within 500ms
NFR3: UI updates reflecting opponent actions must appear within 300ms of server decision
NFR4: Connection establishment must complete within 2 seconds
NFR5: Game state must be synchronized between server and both clients within 100ms tolerance
NFR6: Action timers must be synchronized within 50ms across all connected clients
NFR7: Pot calculation and chip updates must be reflected simultaneously to both players
NFR8: Poker table interface must render within 3 seconds on modern browsers
NFR9: Card animations must maintain 60fps for smooth gameplay experience
NFR10: UI must remain responsive (<100ms input lag) during active gameplay
NFR11: Server must maintain 99.5% uptime during scheduled game sessions (2-4 hour windows)
NFR12: Critical game functions must be available 100% of the time during active gameplay
NFR13: Server must recover from process crashes within 30 seconds without data loss
NFR14: Automatic reconnection must succeed within 5 seconds for transient network issues (<10 second disconnections)
NFR15: Reconnection success rate must exceed 95% for connection issues under 30 seconds
NFR16: Game state must be preserved for up to 30 minutes during player disconnection
NFR17: Partial connectivity must not corrupt game state or create unfair advantages
NFR18: Game state must be 100% consistent between server and clients at all times
NFR19: All poker rules must be implemented with 100% accuracy (no rule discrepancies)
NFR20: Random number generation must be cryptographically secure and verifiably random
NFR21: Game history must be preserved accurately for the duration of each session
NFR22: Server response times must have <20% variance during normal operation
NFR23: Memory usage must remain stable (<5% growth) during 4-hour gaming sessions
NFR24: Connection handling must be deterministic (same inputs produce same state outcomes)
NFR25: Error conditions must be handled gracefully with clear user feedback
NFR26: No game state corruption under network partitioning scenarios
NFR27: Chip stacks must be preserved exactly across reconnections
NFR28: Hand history must be complete and accurate for dispute resolution
NFR29: All critical operations must be logged for debugging unpredictable behavior

### Additional Requirements

- Starter template: Next.js frontend + C++ server with libhv (Epic 1 Story 1 initialization)
- Single binary deployment serving both static files and WebSocket API
- Session token authentication (UUIDv4) with localStorage persistence
- JSON message protocol with snake_case naming convention
- Card representation format: `<rank><suit>` (e.g., "Ah", "Kd")
- Full game state broadcast pattern (not partial updates)
- Server-authoritative game logic with client-side optimistic updates
- Structured JSON logging with rotation
- Health check endpoint `/health`
- WebSocket heartbeat and connection state tracking
- Rate limiting per connection
- WCAG AA compliance (4.5:1 contrast ratio minimum)
- Color-blind friendly suit differentiation (shapes + colors)
- Minimum 44×44px touch targets
- Responsive design: desktop primary, tablet secondary, mobile limited
- "Thinking space" timer design (reduces pressure)
- Persistent connection status indicator
- Minimalist analytical design direction
- Tailwind CSS + Headless UI components
- Zustand 5.0.9 for state management
- 60fps animations for card dealing/chip movements
- Real-time pot odds display integrated into betting
- Progressive disclosure of advanced features
- Hand history replay with step-through visualization
- Statistics visualization for skill validation
- Dark mode palette to reduce eye strain

### FR Coverage Map

FR1: Epic 1 - Connect to poker server using browser
FR2: Epic 1 - Join heads-up NLHE table as one of 2 players  
FR3: Epic 1 - Maintain single table game session for exactly 2 players
FR4: Epic 1 - Persist game state for duration of session
FR5: Epic 1 - Preserve game state when player disconnects
FR6: Epic 1 - Resume game from preserved state when player reconnects
FR7: Epic 2 - Implement standard NLHE rules (pre-flop, flop, turn, river)
FR8: Epic 2 - Use standard poker hand ranking (Royal Flush to High Card)
FR9: Epic 2 - Enforce no-limit betting rules
FR10: Epic 2 - Calculate pot amounts including side pots for all-in situations
FR11: Epic 2 - Determine hand winners including split pots
FR12: Epic 2 - Generate random card distributions and shuffling
FR13: Epic 2 - Manage blind posting (small blind/big blind structure)
FR14: Epic 2 - Handle 100bb starting stacks for each player
FR15: Epic 2 - Perform betting actions (check, bet, raise, fold, call)
FR16: Epic 2 - View hole cards and community cards
FR17: Epic 2 - See chip stack and pot amounts
FR18: Epic 2 - Enforce action timeouts with default fold on expiration
FR19: Epic 2 - Manually rebuy after busting out
FR20: Epic 2 - Automatically sit out a player who busts
FR21: Epic 2 - Validate bet amounts against player stack limits
FR22: Epic 2 - Handle player disconnections during active gameplay
FR23: Epic 2 - Compensate for network latency in action synchronization
FR24: Epic 2 - Maintain <200ms response time for game actions
FR25: Epic 2 - Provide automatic reconnection for transient connection issues
FR26: Epic 2 - Log game events for debugging unpredictable behavior
FR27: Epic 1 - See visual poker table with cards and chips
FR28: Epic 1 - See real-time updates of game state changes
FR29: Epic 3 - See connection status and reconnection indicators
FR30: Epic 3 - See action buttons for available betting options
FR31: Epic 3 - See countdown timer for action deadlines
FR32: Epic 3 - See opponent's actions and chip amounts
FR33: Epic 1 - Use real-time communication between server and clients
FR34: Epic 2 - Serialize game state for disconnection recovery
FR35: Epic 1 - Handle concurrent connections for 2 players
FR36: Epic 2 - Synchronize game actions between server and both clients
FR37: Epic 2 - Validate game rules independently of client input

## Epic List

### Epic 1: Connect and Start a Poker Game
Two friends can connect to the server, join a heads-up table, and see a basic poker interface ready for play.
**FRs covered:** FR1-FR6, FR27-FR28, FR33, FR35
**Implementation Notes:** Starter template (Next.js + C++ libhv), WebSocket setup, basic table component, session tokens for reconnection

### Epic 2: Play Robust Poker Hands  
Players can complete full poker hands with standard NLHE rules, betting actions, and pot calculation - and the game handles real-world issues gracefully (disconnections, latency, reconnections without losing state).
**FRs covered:** FR7-FR26, FR34, FR36-FR37
**Implementation Notes:** Poker game engine, card handling, betting logic, hand evaluation, state serialization, automatic reconnection, structured logging

### Epic 3: Polished Poker Interface
Players enjoy a professional, accessible poker experience with smooth animations, responsive design, and full UX polish.
**FRs covered:** FR29-FR32 + all UX requirements
**Implementation Notes:** Tailwind CSS components, connection status display, "thinking space" timer design, WCAG AA compliance, responsive layouts, animations

<!-- Repeat for each epic in epics_list (N = 1, 2, 3...) -->

## Epic 1: Connect and Start a Poker Game

Two friends can connect to the server, join a heads-up table, and see a basic poker interface ready for play.

### Story 1.1: Initialize Project Structure

As a development team,
I want to initialize the project with Next.js frontend and C++ server following architecture specifications,
So that we have a working foundation to build the poker platform with proper tooling and dependencies.

**Acceptance Criteria:**

**Given** a clean project directory  
**When** I run the Next.js initialization command  
**Then** a Next.js project is created in `/client` directory with TypeScript, Tailwind CSS, App Router, and Turbopack  
**And** Headless UI components are installed  
**And** the project uses `src/` directory structure with import alias `@/*`

**Given** the project directory  
**When** I set up the C++ server structure  
**Then** a CMake project is created in `/server` directory with C++17 standard  
**And** libhv dependency is configured in CMakeLists.txt  
**And** basic server source files are created with HTTP + WebSocket combined server skeleton

**Given** the initialized project  
**When** I build both frontend and backend  
**Then** Next.js builds successfully to `client/out/` directory  
**And** C++ server compiles without errors using CMake  
**And** the project structure matches architecture decisions (monorepo with `/client` and `/server`)

**Given** the architecture specifications  
**When** I review the project setup  
**Then** Tailwind CSS configuration includes custom design tokens for poker interface  
**And** libhv server is configured to serve static files from `../client/out`  
**And** WebSocket endpoint is ready for poker game API implementation

### Story 1.2: Establish WebSocket Connection

As a poker player,
I want to establish a WebSocket connection to the poker server and see real-time connection status,
So that I can participate in live poker gameplay with instant communication.

**Acceptance Criteria:**

**Given** the initialized project from Story 1.1  
**When** I open the application in a browser  
**Then** the frontend establishes a WebSocket connection to the server on `ws://localhost:8080/ws`  
**And** connection status is displayed visually (connected/disconnected/connecting)

**Given** a successful WebSocket connection  
**When** the server receives a connection request  
**Then** the server generates a unique session token (UUIDv4)  
**And** stores the connection in an active sessions map  
**And** sends the session token back to the client for future reconnection

**Given** an established connection  
**When** either client or server sends a WebSocket message  
**Then** the message is properly formatted as JSON with `type` and `data` fields using `snake_case` naming  
**And** basic message types are supported (`ping`, `pong`, `error`)

**Given** a network interruption  
**When** the WebSocket connection is lost  
**Then** the client automatically attempts reconnection with exponential backoff  
**And** displays clear "Reconnecting..." status  
**And** preserves the session token for reconnection attempts

**Given** the reconnection mechanism  
**When** connection is restored within 30 seconds  
**Then** the server validates the session token  
**And** restores the connection to the active sessions map  
**And** sends a "reconnected" confirmation message

### Story 1.3: Join Heads-Up Poker Table

As a poker player,
I want to join or create a heads-up poker table and see player positions,
So that I can start a game session with exactly one other player.

**Acceptance Criteria:**

**Given** a connected player from Story 1.2  
**When** I request to join a heads-up table  
**Then** the server creates a new game session if no available session exists  
**And** assigns player positions (button/small blind vs big blind)  
**And** sends game session details including session ID and player positions

**Given** a game session with one player waiting  
**When** a second player joins the same session  
**Then** the session transitions to "ready" state with both player positions filled  
**And** both players receive game session details  
**And** the server enforces maximum 2 players per session

**Given** a ready game session  
**When** both players are connected and confirmed  
**Then** the server initializes game state with 100bb starting stacks for each player  
**And** assigns small blind (1bb) and big blind (2bb) amounts  
**And** sets initial dealer/button position

**Given** player positions are assigned  
**When** I view the poker table  
**Then** I can see my position clearly marked (button/small blind vs big blind)  
**And** I can see opponent's position  
**And** chip stacks are displayed for both players

**Given** a player disconnects from an active session  
**When** they reconnect within 30 minutes using their session token  
**Then** they rejoin their previous position in the same game session  
**And** game state is restored from preserved state  
**And** opponent is notified of reconnection

### Story 1.4: View Basic Poker Table

As a poker player,
I want to see a visual poker table with cards, chips, and real-time game state updates,
So that I can understand the current game situation and make informed decisions.

**Acceptance Criteria:**

**Given** I have joined a game session from Story 1.3  
**When** I view the poker table interface  
**Then** I see a centered poker table with two player positions (opposite sides)  
**And** each position displays player name/identifier and chip stack amount  
**And** the dealer button is clearly shown on the appropriate player position

**Given** the poker table is displayed  
**When** game state changes occur  
**Then** I see real-time updates reflected on the table without page refresh  
**And** chip amounts update instantly when bets are placed  
**And** pot amount is displayed centrally on the table

**Given** cards need to be displayed  
**When** hole cards are dealt to me  
**Then** I see my two hole cards face down (or face up in development mode)  
**And** cards use standard poker card design with rank and suit symbols  
**And** card representation follows `<rank><suit>` format (e.g., "Ah", "Kd")

**Given** community cards are dealt  
**When** the flop, turn, or river is revealed  
**Then** I see community cards displayed face up in the center of the table  
**And** cards are arranged horizontally with clear spacing  
**And** each card shows rank and suit with appropriate colors (red for hearts/diamonds, black for spades/clubs)

**Given** the table interface is loaded  
**When** I inspect the visual design  
**Then** the table uses Tailwind CSS with custom poker design tokens  
**And** the layout is responsive and works on desktop screen sizes  
**And** color contrast meets minimum readability standards

### Story 1.5: Manage Session State

As a poker player,
I want my game session state to be properly managed, serialized, and restored across disconnections,
So that I can continue playing without losing progress or experiencing unfair advantages.

**Acceptance Criteria:**

**Given** an active game session  
**When** game state changes occur (bets, card deals, pot calculations)  
**Then** the server maintains a complete serializable game state object  
**And** the state includes all necessary information: player positions, chip stacks, pot amounts, community cards, hole cards, betting round, and action history

**Given** the game state needs to be preserved  
**When** a player disconnects during gameplay  
**Then** the server serializes the current game state to a JSON representation  
**And** stores it with the session token for up to 30 minutes  
**And** marks the session as "paused" waiting for reconnection

**Given** a paused game session  
**When** the disconnected player reconnects using their session token  
**Then** the server deserializes the stored game state  
**And** restores all game parameters exactly as they were before disconnection  
**And** resumes gameplay from the exact moment of disconnection

**Given** game state serialization is implemented  
**When** I inspect the serialized state format  
**Then** it uses `snake_case` naming convention for all JSON fields  
**And** card representations follow `<rank><suit>` format (e.g., "Ah", "Kd")  
**And** numeric values are stored as integers (chips, pot amounts, timeouts)

**Given** the need for data integrity  
**When** game state is serialized and deserialized  
**Then** chip stacks are preserved exactly (no rounding or truncation errors)  
**And** card distributions remain unchanged  
**And** pot calculations maintain exact amounts  
**And** player positions and betting order are preserved

**Given** the session management system  
**When** a game session exceeds 4 hours duration  
**Then** the server can gracefully conclude the session  
**And** preserve final game state for historical reference  
**And** allow players to start a new session if desired

## Epic 2: Play Robust Poker Hands

Players can complete full poker hands with standard NLHE rules, betting actions, and pot calculation - and the game handles real-world issues gracefully (disconnections, latency, reconnections without losing state).

### Story 2.1: Implement Poker Game Engine

As a poker player,
I want the game to follow standard No-Limit Texas Hold'em rules with proper hand progression,
So that I can play authentic poker with correct betting rounds and hand structure.

**Acceptance Criteria:**

**Given** a ready game session from Epic 1  
**When** a new hand begins  
**Then** the game progresses through correct NLHE phases: pre-flop, flop, turn, river  
**And** each phase has appropriate betting round structure  
**And** blinds are posted automatically (small blind = 1bb, big blind = 2bb)

**Given** the game is in a specific phase  
**When** I check the game state  
**Then** the current phase is clearly indicated (pre-flop, flop, turn, river, showdown)  
**And** the betting round status is tracked (first betting round, second betting round, etc.)  
**And** the acting player position is correctly determined based on dealer button

**Given** standard NLHE rules  
**When** the game engine processes actions  
**Then** it enforces proper betting structure: no-limit betting (any amount up to stack size)  
**And** it tracks minimum raise amounts (must be at least the previous bet/raise amount)  
**And** it handles all-in situations correctly (side pot creation when needed)

**Given** a completed betting round  
**When** all players have acted (called, folded, or are all-in)  
**Then** the game automatically progresses to the next phase  
**And** community cards are revealed at appropriate times (flop: 3 cards, turn: 1 card, river: 1 card)  
**And** betting resumes with correct player order

**Given** the river betting round completes  
**When** two or more players remain in the hand  
**Then** the game proceeds to showdown  
**And** players reveal their hole cards  
**And** the winner is determined based on best 5-card hand using community cards

### Story 2.2: Handle Card Distribution & Evaluation

As a poker player,
I want cards to be dealt randomly and hand rankings to be evaluated correctly,
So that the game is fair and winners are determined accurately according to standard poker rules.

**Acceptance Criteria:**

**Given** a new hand is starting  
**When** cards need to be dealt  
**Then** a standard 52-card deck is created and shuffled using cryptographically secure random number generation  
**And** each player receives 2 hole cards dealt from the deck in correct order  
**And** community cards are prepared for future phases (flop: 3 cards, turn: 1 card, river: 1 card)

**Given** card dealing requirements  
**When** cards are represented in the system  
**Then** each card uses `<rank><suit>` format (e.g., "Ah", "Kd", "7c", "2s")  
**And** suits are represented as: h=hearts, d=diamonds, c=clubs, s=spades  
**And** ranks are represented as: A, K, Q, J, 10, 9, 8, 7, 6, 5, 4, 3, 2

**Given** a hand reaches showdown  
**When** hand evaluation is required  
**Then** the system uses standard poker hand ranking from highest to lowest: Royal Flush, Straight Flush, Four of a Kind, Full House, Flush, Straight, Three of a Kind, Two Pair, One Pair, High Card  
**And** the evaluation considers the best 5-card hand from each player's 2 hole cards and 5 community cards

**Given** multiple players have hands to evaluate  
**When** hand strengths are compared  
**Then** the system correctly determines the winner based on hand ranking  
**And** in case of tied hand ranks (e.g., both have a flush), it compares kicker cards appropriately  
**And** split pots are identified when players have exactly equal hand strength

**Given** the need for fairness and verifiability  
**When** I inspect the random number generation  
**Then** it uses cryptographically secure methods (as specified in NFR20)  
**And** the shuffling algorithm produces uniformly random permutations  
**And** deck state can be logged for debugging purposes if needed

### Story 2.3: Process Betting Actions

As a poker player,
I want to place bets, raises, calls, checks, and folds with proper validation and pot calculation,
So that I can make strategic decisions and the game accurately tracks chip movements and pot amounts.

**Acceptance Criteria:**

**Given** it's my turn to act during a betting round  
**When** I review available betting options  
**Then** I see appropriate actions based on game state: check (if no bet to call), call (if bet exists), bet/raise (up to my stack size), fold  
**And** the minimum bet/raise amount is clearly indicated (big blind amount for opening bet, previous bet+raise amount for raising)

**Given** I choose to place a bet or raise  
**When** I specify an amount  
**Then** the system validates the amount is within my chip stack limits  
**And** enforces minimum raise rules (must be at least the previous bet/raise amount)  
**And** prevents invalid amounts (negative, zero, non-integer, exceeding stack)

**Given** betting actions occur during a hand  
**When** chips are placed in the pot  
**Then** the system accurately tracks the total pot amount  
**And** calculates side pots correctly when players go all-in with different stack sizes  
**And** subtracts bet amounts from player chip stacks immediately

**Given** multiple betting rounds in a hand  
**When** the game progresses through phases  
**Then** the pot accumulates correctly across all betting rounds  
**And** chip stacks are updated in real-time  
**And** bet amounts reset appropriately for each new betting round

**Given** an all-in situation with uneven stacks  
**When** side pots need to be created  
**Then** the system correctly allocates chips to main pot and side pots based on stack sizes  
**And** determines which players are eligible for each pot  
**And** distributes winnings appropriately at showdown

**Given** the need for betting validation  
**When** a player attempts an invalid action  
**Then** the system rejects the action with a clear error message  
**And** preserves game state without corruption  
**And** allows the player to take a valid action instead

### Story 2.4: Manage Game Flow & Timeouts

As a poker player,
I want the game to progress smoothly with automatic timeouts for inactive players and clear turn management,
So that gameplay maintains momentum and doesn't stall due to player inactivity or confusion.

**Acceptance Criteria:**

**Given** it's a player's turn to act  
**When** the player doesn't take action within the time limit  
**Then** the system automatically applies the default action (fold for betting rounds, check if checking is allowed)  
**And** the game progresses to the next player or next phase as appropriate  
**And** the timeout is logged for debugging purposes

**Given** action timers are implemented  
**When** I view the game interface during my turn  
**Then** I see a visible countdown timer showing time remaining to act  
**And** the timer is synchronized within 50ms across both clients (per NFR6)  
**And** visual indicators show when time is running low (e.g., color changes, warnings)

**Given** the need for turn management  
**When** betting actions occur  
**Then** the system correctly determines the next player to act based on position and game state  
**And** enforces proper action order (clockwise from dealer button, skipping folded players)  
**And** prevents acting out of turn

**Given** a player folds during a hand  
**When** the hand continues  
**Then** the folded player is skipped for all subsequent actions in that hand  
**And** their cards are marked as folded (not revealed unless required for side pot calculations)  
**And** they are not eligible to win any portion of the pot

**Given** a player busts out (chip stack reaches zero)  
**When** the hand concludes  
**Then** the system automatically sits out the busted player (per FR20)  
**And** provides option for manual rebuy if desired (per FR19)  
**And** adjusts game flow to continue with remaining player(s)

**Given** the need for smooth game progression  
**When** all players have acted in a betting round  
**Then** the game automatically advances to the next phase without manual intervention  
**And** community cards are revealed at appropriate times (flop, turn, river)  
**And** new betting round begins with correct player order

### Story 2.5: Handle Disconnections During Gameplay

As a poker player,
I want the game to handle player disconnections gracefully during active gameplay with proper state preservation and fair resolution,
So that temporary network issues don't ruin the game experience or create unfair advantages.

**Acceptance Criteria:**

**Given** a player disconnects during an active hand  
**When** the disconnection is detected (via WebSocket close or heartbeat timeout)  
**Then** the server preserves the exact game state at the moment of disconnection  
**And** starts a reconnection timer (default 30 seconds, configurable up to 5 minutes)  
**And** notifies the remaining player about the disconnection and timer

**Given** a disconnected player during their turn to act  
**When** the action timer expires  
**Then** the system applies the default timeout action (fold for betting situations)  
**And** continues the hand with the remaining player(s)  
**And** preserves the disconnected player's ability to reconnect and observe

**Given** network latency during gameplay  
**When** actions are transmitted between client and server  
**Then** the system compensates for latency using client-side prediction where appropriate  
**And** maintains server authority for all game rule validation  
**And** provides visual feedback when network conditions affect gameplay (e.g., "Syncing...")

**Given** a player reconnects during an active hand  
**When** they re-establish WebSocket connection with valid session token  
**Then** the server restores them to their exact position in the game  
**And** sends complete current game state  
**And** resumes normal gameplay with all actions synchronized

**Given** a player fails to reconnect within the allowed time window  
**When** the reconnection timer expires  
**Then** the system treats them as voluntarily folded from all current hands  
**And** distributes any owed chips appropriately (folded hands lose, side pots calculated correctly)  
**And** allows the remaining player to continue or start new hand as appropriate

**Given** partial connectivity issues (high latency, packet loss)  
**When** the game experiences network problems  
**Then** the system maintains game state consistency (no corrupted state)  
**And** prevents unfair advantages from network conditions  
**And** provides clear status indicators about connection quality

### Story 2.6: Implement Structured Logging

As a developer,
I want comprehensive structured logging for all game events and system operations,
So that I can debug unpredictable behavior, monitor performance, and maintain system reliability.

**Acceptance Criteria:**

**Given** game events occur (connections, disconnections, betting actions, errors)  
**When** events are logged  
**Then** they use structured JSON format with timestamp, level, category, and message fields  
**And** log levels are configurable (DEBUG, INFO, WARN, ERROR)  
**And** logs are written to stdout for development and rotated files for production

**Given** the need for debugging unpredictable behavior (per FR26)  
**When** critical operations occur (game state changes, rule validations, network events)  
**Then** they are logged with sufficient detail to reproduce issues  
**And** include relevant context (player IDs, game session IDs, action details)  
**And** error conditions include stack traces when available

**Given** performance requirements (NFR1-NFR10)  
**When** game actions are processed (betting, card dealing, state updates)  
**Then** response times are logged to monitor compliance with <200ms targets  
**And** synchronization delays are tracked to ensure <100ms tolerance (NFR5)  
**And** frontend render times are monitored for <3s load time (NFR8)

**Given** the need for production monitoring  
**When** the server is running  
**Then** it provides a health check endpoint `/health` returning server status  
**And** basic performance metrics are available (active connections, memory usage, uptime)  
**And** critical failures trigger ERROR level logs with alerting potential

**Given** log management needs for extended gameplay sessions  
**When** logs are generated during 4+ hour sessions  
**Then** log rotation prevents disk exhaustion  
**And** memory usage remains stable (<5% growth per NFR23)  
**And** log verbosity can be adjusted without server restart

**Given** the architecture's structured logging requirement  
**When** I review the logging implementation  
**Then** JSON logs include consistent field names (timestamp, level, category, message, data)  
**And** sensitive information (session tokens, card distributions in progress) is appropriately masked  
**And** logs support both human-readable and machine-parsable formats

## Epic 3: Polished Poker Interface

Players enjoy a professional, accessible poker experience with smooth animations, responsive design, and full UX polish.

### Story 3.1: Enhance Connection Status Display

As a poker player,
I want to always see clear connection status and reconnection progress indicators,
So that I understand my network connectivity state and can anticipate any gameplay interruptions.

**Acceptance Criteria:**

**Given** I am connected to the poker server  
**When** I view the game interface  
**Then** I see a persistent connection status indicator (e.g., top bar, corner indicator)  
**And** the indicator shows "Connected" with appropriate visual styling (green color, checkmark)

**Given** my connection is lost  
**When** the WebSocket disconnects  
**Then** the status indicator immediately changes to "Disconnected" (red color, warning icon)  
**And** shows "Reconnecting..." with progress indicator  
**And** displays estimated time until next reconnection attempt

**Given** I am reconnecting after a disconnection  
**When** reconnection attempts are in progress  
**Then** I see visual feedback of each attempt (spinner, progress bar)  
**And** the interface remains functional for observation (viewing game state, seeing opponent actions)  
**And** I can manually trigger reconnection if desired

**Given** network latency is affecting gameplay  
**When** latency exceeds acceptable thresholds (>200ms response time)  
**Then** I see a "High Latency" warning with appropriate visual treatment  
**And** receive suggestions for improving connection if available  
**And** the game continues with appropriate latency compensation

**Given** the connection status display  
**When** I inspect the visual design  
**Then** it follows WCAG AA accessibility standards (4.5:1 contrast ratio, clear icons)  
**And** uses Tailwind CSS utilities for consistent styling  
**And** is positioned persistently without obstructing gameplay

### Story 3.2: Implement Betting Control Interface

As a poker player,
I want to easily place bets with clear visual feedback and appropriate action buttons,
So that I can make strategic decisions quickly and confidently during gameplay.

**Acceptance Criteria:**

**Given** it's my turn to act during a betting round  
**When** I view the betting interface  
**Then** I see clearly labeled action buttons for available options (Check, Bet, Call, Raise, Fold)  
**And** only valid actions for the current game state are enabled  
**And** button labels show exact amounts where applicable (e.g., "Call 150", "Raise to 300")

**Given** I need to specify a bet or raise amount  
**When** I select the Bet or Raise option  
**Then** I see a bet amount input control (slider or numeric input)  
**And** the control shows minimum and maximum allowed amounts  
**And** provides quick-select buttons for common bet sizes (e.g., 1/2 pot, 3/4 pot, pot-sized)

**Given** I am entering a bet amount  
**When** I adjust the bet amount  
**Then** I see real-time visual feedback of the selected amount  
**And** the total resulting pot size is displayed  
**And** any invalid amounts are prevented with clear error messages

**Given** I submit a betting action  
**When** the action is processed  
**Then** I receive immediate visual confirmation (button press animation, color change)  
**And** the betting controls are disabled during server processing  
**And** I see "Action submitted..." status until server confirmation

**Given** the betting control interface  
**When** I inspect the design and accessibility  
**Then** all buttons meet minimum 44×44px touch target size  
**And** use sufficient color contrast (4.5:1 ratio per WCAG AA)  
**And** include clear visual states (default, hover, active, disabled)  
**And** work with keyboard navigation (Tab order, Enter/Space activation)

### Story 3.3: Design "Thinking Space" Timer

As a poker player,
I want a timer that helps me think strategically without creating pressure,
So that I can make better decisions and enjoy a more thoughtful gameplay experience.

**Acceptance Criteria:**

**Given** it's my turn to act during a betting round  
**When** I view the timer display  
**Then** I see a circular progress indicator showing time remaining  
**And** the timer uses a "thinking space" design that feels less pressured than traditional countdowns  
**And** time is displayed in both numeric (seconds) and visual (progress arc) formats

**Given** the timer is counting down  
**When** time remaining reaches certain thresholds  
**Then** visual changes occur gradually rather than abruptly (e.g., color shifts from green to yellow to red)  
**And** gentle reminders appear at appropriate intervals (e.g., "30 seconds remaining", "10 seconds remaining")  
**And** the final 10 seconds include a subtle pulsing animation rather than frantic flashing

**Given** I need more time to think  
**When** available time extensions are configured  
**Then** I can request additional time (e.g., +30 seconds) if the system allows it  
**And** time extensions are limited to prevent abuse (e.g., maximum 2 extensions per hand)  
**And** opponent is notified when I use a time extension

**Given** the timer design specifications  
**When** I inspect the visual implementation  
**Then** it uses SVG for smooth animations and scalability  
**And** follows the UX specification's "thinking space" principles (reduces pressure, supports strategic thinking)  
**And** maintains 60fps smoothness for all animations (per NFR9)

**Given** the need for timer synchronization  
**When** both players view the timer during a hand  
**Then** timer displays are synchronized within 50ms across clients (per NFR6)  
**And** timer pauses/resumes are synchronized immediately  
**And** any timer discrepancies are resolved automatically in favor of server authority

**Given** accessibility requirements  
**When** I use the timer interface  
**Then** time information is available in multiple formats (visual, numeric, optional audio cues)  
**And** color changes maintain sufficient contrast for color-blind users  
**And** the interface works with screen readers (proper ARIA labels, announcements for time warnings)

### Story 3.4: Improve Opponent Visibility

As a poker player,
I want to clearly see my opponent's actions, chip stacks, and betting history,
So that I can make informed strategic decisions based on complete game information.

**Acceptance Criteria:**

**Given** my opponent takes a betting action  
**When** the action is processed by the server  
**Then** I see a clear visual indication of their action (e.g., "Opponent raised to 300")  
**And** the action is displayed near their player position on the table  
**And** chip animations show the movement of chips to the pot

**Given** chip stacks need to be tracked  
**When** bets are placed or pots are won  
**Then** I see real-time updates to opponent's chip stack display  
**And** stack amounts are clearly visible with appropriate formatting (e.g., 1,500 instead of 1500)  
**And** significant stack changes are highlighted (e.g., color flash or subtle animation)

**Given** the need to understand opponent's betting patterns  
**When** I want to review recent actions  
**Then** I can see a concise action history for the current hand  
**And** the history shows player, action type, amount, and betting round  
**And** I can toggle between simple summary and detailed history views

**Given** opponent actions occur during different betting rounds  
**When** I'm trying to follow the hand progression  
**Then** I see clear visual separation between pre-flop, flop, turn, and river actions  
**And** the current betting round is highlighted in the action history  
**And** folded players are visually distinguished from active players

**Given** the opponent visibility interface  
**When** I inspect the visual design  
**Then** opponent information is positioned for optimal visibility without cluttering the table  
**And** uses consistent visual language with my own player information  
**And** follows the minimalist analytical design direction from UX specifications

**Given** accessibility considerations  
**When** opponent actions are displayed  
**Then** action announcements are available for screen readers  
**And** color-coded information has text alternatives  
**And** timing of visual updates considers potential cognitive load (not too rapid, not too slow)

### Story 3.5: Implement Accessibility & Responsive Design

As a poker player,
I want the game to be accessible to all players and work well on different devices,
So that everyone can enjoy the game regardless of their abilities or device preferences.

**Acceptance Criteria:**

**Given** the need for visual accessibility  
**When** I inspect text and interface elements  
**Then** all text meets WCAG AA contrast ratio requirements (minimum 4.5:1 for normal text)  
**And** interactive elements have sufficient size (minimum 44×44px touch targets)  
**And** color is not used as the only means of conveying information (suits have both color and shape differentiation)

**Given** players with color vision deficiencies  
**When** I view card suits and game state indicators  
**Then** hearts and diamonds are distinguishable by shape as well as color  
**And** spades and clubs have distinct shapes beyond just color difference  
**And** important game state information has text labels in addition to color coding

**Given** different screen sizes and devices  
**When** I access the game on desktop, tablet, or mobile  
**Then** the interface uses responsive design principles (desktop primary, tablet secondary, mobile limited)  
**And** layout adapts appropriately using Tailwind CSS responsive utilities  
**And** touch targets remain sufficiently large on mobile devices

**Given** keyboard-only users  
**When** navigating the game interface  
**Then** all interactive elements are reachable via logical Tab order  
**And** actions can be performed using Enter/Space keys  
**And** visual focus indicators are clearly visible (2:1 minimum contrast ratio for focus rings)

**Given** screen reader users  
**When** interacting with the game  
**Then** all interface elements have appropriate ARIA labels and roles  
**And** dynamic content updates are announced appropriately  
**And** game state changes are communicated in a way that doesn't overwhelm with announcements

**Given** the need for performance across devices  
**When** the game loads on different hardware  
**Then** it renders within 3 seconds on modern browsers (per NFR8)  
**And** maintains 60fps animations on supported devices (per NFR9)  
**And** remains responsive (<100ms input lag) during active gameplay (per NFR10)

### Story 3.6: Add Visual Polish & Animations

As a poker player,
I want the game to feel professional and engaging with smooth animations and visual polish,
So that I enjoy a premium gameplay experience that feels deliberate and well-crafted.

**Acceptance Criteria:**

**Given** cards are dealt during gameplay  
**When** hole cards or community cards are revealed  
**Then** smooth animations show cards being dealt (e.g., sliding into position, subtle flip animations)  
**And** animations maintain 60fps smoothness (per NFR9)  
**And** animation timing feels natural rather than mechanical (approximately 300ms per card)

**Given** chips are moved during betting  
**When** bets are placed or pots are won  
**Then** chip animations show physical movement from player stack to pot (or pot to winner)  
**And** chip counts update in sync with animations  
**And** different bet sizes have appropriately scaled animations (more chips for larger bets)

**Given** game state transitions occur  
**When** the game moves between phases (pre-flop → flop → turn → river → showdown)  
**Then** smooth transitions guide attention to relevant areas of the table  
**And** phase changes are clearly announced with subtle visual effects  
**And** the "thinking space" timer resets with appropriate animation

**Given** the need for visual polish  
**When** I view the overall game interface  
**Then** it uses the dark mode palette specified in UX design (reduces eye strain for extended sessions)  
**And** follows minimalist analytical design direction (clean, uncluttered, focused on gameplay)  
**And** includes subtle visual enhancements (gradients, shadows, borders) that enhance clarity without decoration

**Given** animations are implemented throughout the interface  
**When** I interact with various game elements  
**Then** all animations use consistent timing (300ms default) and easing functions  
**And** respect user motion preferences (reduced motion settings)  
**And** enhance rather than distract from gameplay decisions

**Given** the polished interface is complete  
**When** I play a full hand from start to finish  
**Then** the experience feels cohesive and professional  
**And** visual feedback reinforces game state understanding  
**And** the interface supports rather than interferes with strategic decision-making