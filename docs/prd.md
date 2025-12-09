---
stepsCompleted: [1, 2, 3, 4, 7, 8, 9, 10]
inputDocuments: []
documentCounts:
  briefs: 0
  research: 0
  brainstorming: 0
  projectDocs: 0
workflowType: 'prd'
lastStep: 11
project_name: 'turnbasedgame'
user_name: 'Riddler'
date: 'Tue Dec 09 2025'
---

# Product Requirements Document - turnbasedgame

**Author:** Riddler
**Date:** Tue Dec 09 2025

## Executive Summary

Build a minimalist, high-performance heads-up No Limit Texas Hold'em poker platform with a C++ server and browser-based clients. The system will host a single table for 2 players, implement standard NLHE rules, and provide robust timeout/disconnection handling for reliable gameplay.

### What Makes This Special

This project challenges the assumption that poker platforms must be complex, multi-feature casinos by focusing on doing one thing exceptionally well: providing a technically excellent heads-up NLHE experience. The combination of C++ server performance with browser accessibility creates a unique value proposition for players seeking reliable, no-frills poker matches.

## Project Classification

**Technical Type:** game  
**Domain:** gaming (heads-up poker platform)  
**Complexity:** Medium (real-time game logic, networking, browser integration)  
**Project Context:** Greenfield - new project

*Note: While this is classified as a game project, we're proceeding with standard PRD workflow focused on the technical implementation of a poker server rather than full game design documentation.*

## Success Criteria

### User Success
- Two friends can play heads-up NLHE reliably without technical frustration
- Game handles internet connection issues gracefully with automatic reconnection
- Players can complete matches without game-breaking bugs or rule disputes
- Interface feels familiar like mainstream online poker platforms

### Business Success
*N/A - Personal project for friends*

### Technical Success
- C++ server maintains stable connection for duration of game sessions
- Robust timeout and disconnection handling with state preservation
- Correct implementation of No Limit Texas Hold'em rules
- Browser clients maintain responsive connection to server
- Automatic sit-out on bust with rebuy functionality
- 100bb starting stacks preserved per game session

### Measurable Outcomes
- Server uptime: 99.5% during scheduled game sessions
- Reconnection success rate: >95% for transient connection issues
- Game rule correctness: 100% adherence to standard NLHE rules
- Client-server latency: <200ms for game actions

## Product Scope

### MVP - Minimum Viable Product
- Single table heads-up NLHE cash game
- Play money only (no real money transactions)
- 100bb starting stacks
- No rake or fees
- Automatic sit-out on bust with manual rebuy option
- Basic frontend showing cards, chips, and game state
- Robust timeout and disconnection handling

### Growth Features (Post-MVP)
- "Decent frontend" matching typical online poker UI standards
- Chat functionality between players
- Game history and hand replay
- Customizable blind levels
- Player statistics display

### Vision (Future)
- Tournament mode with multi-table support
- Custom rule variations
- Spectator mode
- Mobile-responsive frontend
- Player profiles and history tracking

## User Journeys

**Journey 1: Peter - The Challenger Seeking Validation**
Peter is sitting in his home office after another friendly debate with John about who's the better heads-up NLHE player. They've argued about this for months, pointing to past live games where the results were always inconclusive due to distractions or different conditions. Peter feels a growing need to settle this once and for all - not just for bragging rights, but to validate years of studying poker strategy that he believes gives him an edge.

When you announce you've built a dedicated poker server, Peter sees his chance. He opens the browser link you send, skeptical but hopeful. The familiar poker table interface loads quickly, and he's relieved to see standard NLHE controls. He connects smoothly, deposits his 100bb play money stack, and waits for John. When John disconnects briefly during setup, Peter holds his breath - but the game pauses gracefully and resumes exactly where they left off when John reconnects.

The critical hand arrives in their third session. Peter makes what he believes is a perfect bluff on the river, putting John all-in. As he waits for John's decision, he notices the timer counting down - not with anxiety about server timeouts, but with confidence that the system will handle whatever happens. John calls, and Peter's bluff fails... but the game continues smoothly to the next hand without technical drama. The loss stings, but Peter realizes something important: for the first time, they're playing on a completely level technical field where the only variables are their poker skills.

After ten sessions over two weeks, Peter has definitive data. He's up 12,500 play chips overall. More importantly, he has clear evidence of where his game shines and where it needs work. The server's reliability meant every decision mattered, every result was meaningful. He doesn't just have bragging rights - he has validation that his study paid off, and specific areas to improve for their next challenge.

**Journey 2: John - The Defender Protecting His Reputation**
John hears about Peter's constant claims of being the better player and feels his competitive pride bristle. He remembers all the times he outplayed Peter in live games, only for Peter to blame "bad beats" or "distractions." John wants to shut this down definitively - not to humiliate Peter, but to establish the truth so they can move on to enjoying poker without this constant debate hanging over their games.

John receives your server link with mixed feelings. He worries about technical issues favoring one player or ruining the experience. As he logs in, he's pleasantly surprised by the familiar poker interface - it feels like the mainstream sites he's used to, removing the learning curve. When his internet flickers during an important hand, he expects the worst... but finds himself reconnected with the hand exactly as it was. The server preserved the game state perfectly.

During their seventh session, John faces a critical decision on the turn. He's trying to decide if Peter is bluffing or has him beat. As he thinks, he appreciates that the server gives him full time to decide without pressure - no fear of disconnection penalties. He makes what he believes is the right fold, only to see Peter show a bluff. Instead of frustration about the lost pot, he feels satisfaction: the server gave him the space to make his best decision, and now he has valuable information about Peter's playing patterns.

Despite being down overall, John discovers something valuable. The server's reliability and consistent rules mean he can analyze his play objectively. He identifies specific leaks in his game that were masked in live play. He messages Peter: "Okay, you're better at heads-up... for now. But I know exactly what to fix. Rematch in a month?" The server didn't just settle a debate - it gave him a clear improvement roadmap.

### Journey Requirements Summary
- **Seamless connection experience** - players connect without technical friction
- **State preservation on disconnect** - critical for fair play and player confidence
- **Familiar poker interface** - reduces learning curve and feels professional
- **Reliable timeout handling** - gives players thinking time without anxiety
- **Consistent game rules** - ensures results are meaningful and debatable
- **Session persistence** - allows for meaningful data collection over multiple games
- **Rebuy functionality** - enables continuous play after busting
- **Stable server performance** - maintains <200ms latency for responsive gameplay

## Game Specific Requirements

### Game-Type Overview
This is a heads-up No Limit Texas Hold'em cash game server implementing standard online poker rules with C++ backend and browser-based frontend. Focus is on technical reliability and accurate rule implementation rather than game design innovation.

### Technical Architecture Considerations

**Game Rules Implementation:**
- Standard NLHE with blinds (small blind/big blind structure)
- Four betting rounds: pre-flop, flop, turn, river
- No-limit betting (any amount up to player's stack)
- Standard hand ranking system (Royal Flush to High Card)
- Side pot calculation for all-in situations
- Automatic sit-out on bust with rebuy option
- 100bb starting stacks (play money)

**Game Session Management:**
- Single table for 2 players only
- Cash game format (no tournament structure)
- Play money only - no real money transactions
- No rake or fees
- Session persistence for duration of game
- State preservation on player disconnect/reconnect

### Game Brief (Technical Implementation Focus)

**Core Game Loop:**
1. Player connection and seat assignment
2. Blind posting and card dealing
3. Betting round progression
4. Pot calculation and distribution
5. Hand completion and new hand initiation

**Critical Technical Requirements:**
- Accurate random card generation and shuffling
- Real-time bet validation and pot calculation
- Simultaneous action resolution (both players act)
- Disconnection recovery with preserved game state
- Timeout handling with appropriate action defaults

**Rule Edge Cases to Handle:**
- Both players all-in situations
- Split pots (identical hand strength)
- Straddle and other optional betting structures (not required for MVP)
- Disconnections during critical betting decisions
- Network latency compensation

### GDD Elements (Poker Rule Specifics)

**Betting Structure:**
- No-limit: Players can bet any amount up to their stack
- Minimum raise: At least the size of previous bet/raise
- All-in: Player bets entire remaining stack
- Check: Bet zero when no previous bet exists
- Fold: Surrender hand and forfeit any bets

**Game Flow:**
1. **Pre-flop:** After blinds posted, dealing two hole cards each
2. **Flop:** Dealing three community cards, first betting round
3. **Turn:** Dealing fourth community card, second betting round  
4. **River:** Dealing fifth community card, final betting round
5. **Showdown:** If multiple players remain, reveal hands and determine winner

**Automated Actions:**
- Timeout fold: Player folds if action timer expires
- Disconnection handling: Game pauses, allows reconnection with preserved state
- Automatic rebuy: Player can rebuy after busting (manual confirmation)

### Implementation Considerations

**Server Architecture:**
- C++ server for game logic and rule enforcement
- WebSocket or similar real-time communication
- Game state serialization for disconnection recovery
- Concurrent connection handling for 2 players

**Client Requirements:**
- Browser-based frontend with poker table UI
- Real-time action synchronization
- Visual feedback for bets, cards, and game state
- Connection status monitoring and reconnection logic

**Testing Requirements:**
- Unit tests for all poker rule implementations
- Integration tests for server-client communication
- Load testing for 2-player concurrent sessions
- Disconnection/recovery scenario testing

## Project Scoping & Phased Development

### MVP Strategy & Philosophy

**MVP Approach:** Problem-Solving MVP - Solve the core problem with minimal features (friends can play poker online reliably with predictable server behavior and robust network handling)

**Resource Requirements:** Solo developer focus on core technical reliability

### MVP Feature Set (Phase 1)

**Core User Journeys Supported:**
- Peter seeking validation through reliable gameplay
- John protecting reputation with fair, consistent rules

**Must-Have Capabilities:**
1. C++ server with predictable behavior and network issue handling
2. Basic browser frontend showing cards, chips, and game state
3. Standard NLHE rules implementation (4 betting rounds, hand ranking, pot calculation)
4. Automatic sit-out on bust with manual rebuy option
5. State preservation on player disconnect/reconnect
6. Reliable timeout handling with appropriate defaults
7. 100bb starting stacks (play money)
8. Single table for 2 players only

### Post-MVP Features

**Phase 2 (Growth):**
- Enhanced frontend matching typical online poker UI standards
- Chat functionality between players
- Game history and hand replay
- Customizable blind levels
- Player statistics display

**Phase 3 (Expansion):**
- Tournament mode with multi-table support
- Custom rule variations
- Spectator mode
- Mobile-responsive frontend
- Player profiles and history tracking

### Risk Mitigation Strategy

**Technical Risks:** Focus on core disconnection recovery and state synchronization first; implement comprehensive logging for debugging unpredictable behavior

**Market Risks:** N/A - Personal project for friends with clear, limited scope

**Resource Risks:** Prioritize server reliability over UI polish; implement minimal viable frontend that shows game state clearly

## Functional Requirements

### Game Session Management
- FR1: Player can connect to the poker server using a browser
- FR2: Player can join a heads-up NLHE table as one of 2 players
- FR3: System can maintain a single table game session for exactly 2 players
- FR4: System can persist game state for the duration of a session
- FR5: System can preserve game state when a player disconnects
- FR6: System can resume game from preserved state when player reconnects

### Poker Game Logic
- FR7: System can implement standard NLHE rules (pre-flop, flop, turn, river)
- FR8: System can use standard poker hand ranking (Royal Flush to High Card)
- FR9: System can enforce no-limit betting rules
- FR10: System can calculate pot amounts including side pots for all-in situations
- FR11: System can determine hand winners including split pots
- FR12: System can generate random card distributions and shuffling
- FR13: System can manage blind posting (small blind/big blind structure)
- FR14: System can handle 100bb starting stacks for each player

### Player Management
- FR15: Player can perform betting actions (check, bet, raise, fold, call)
- FR16: Player can view their hole cards and community cards
- FR17: Player can see their chip stack and pot amounts
- FR18: System can enforce action timeouts with default fold on expiration
- FR19: Player can manually rebuy after busting out
- FR20: System can automatically sit out a player who busts
- FR21: System can validate bet amounts against player stack limits

### Network & Reliability
- FR22: System can handle player disconnections during active gameplay
- FR23: System can compensate for network latency in action synchronization
- FR24: System can maintain <200ms response time for game actions
- FR25: System can provide automatic reconnection for transient connection issues
- FR26: System can log game events for debugging unpredictable behavior

### Frontend Interface
- FR27: Player can see a visual poker table with cards and chips
- FR28: Player can see real-time updates of game state changes
- FR29: Player can see connection status and reconnection indicators
- FR30: Player can see action buttons for available betting options
- FR31: Player can see countdown timer for action deadlines
- FR32: Player can see opponent's actions and chip amounts

### System Architecture
- FR33: System can use real-time communication between server and clients
- FR34: System can serialize game state for disconnection recovery
- FR35: System can handle concurrent connections for 2 players
- FR36: System can synchronize game actions between server and both clients
- FR37: System can validate game rules independently of client input

## Non-Functional Requirements

### Performance

**Response Time Requirements:**
- Game actions (bet, fold, check, raise, call) must complete within 200ms from user input to server response
- Card dealing and hand initiation must complete within 500ms
- UI updates reflecting opponent actions must appear within 300ms of server decision
- Connection establishment must complete within 2 seconds

**Real-time Synchronization:**
- Game state must be synchronized between server and both clients within 100ms tolerance
- Action timers must be synchronized within 50ms across all connected clients
- Pot calculation and chip updates must be reflected simultaneously to both players

**Frontend Performance:**
- Poker table interface must render within 3 seconds on modern browsers
- Card animations must maintain 60fps for smooth gameplay experience
- UI must remain responsive (<100ms input lag) during active gameplay

### Reliability

**Server Uptime & Availability:**
- Server must maintain 99.5% uptime during scheduled game sessions (2-4 hour windows)
- Critical game functions must be available 100% of the time during active gameplay
- Server must recover from process crashes within 30 seconds without data loss

**Network Resilience:**
- Automatic reconnection must succeed within 5 seconds for transient network issues (<10 second disconnections)
- Reconnection success rate must exceed 95% for connection issues under 30 seconds
- Game state must be preserved for up to 30 minutes during player disconnection
- Partial connectivity must not corrupt game state or create unfair advantages

**State Management & Consistency:**
- Game state must be 100% consistent between server and clients at all times
- All poker rules must be implemented with 100% accuracy (no rule discrepancies)
- Random number generation must be cryptographically secure and verifiably random
- Game history must be preserved accurately for the duration of each session

**Predictable Behavior:**
- Server response times must have <20% variance during normal operation
- Memory usage must remain stable (<5% growth) during 4-hour gaming sessions
- Connection handling must be deterministic (same inputs produce same state outcomes)
- Error conditions must be handled gracefully with clear user feedback

**Data Integrity:**
- No game state corruption under network partitioning scenarios
- Chip stacks must be preserved exactly across reconnections
- Hand history must be complete and accurate for dispute resolution
- All critical operations must be logged for debugging unpredictable behavior