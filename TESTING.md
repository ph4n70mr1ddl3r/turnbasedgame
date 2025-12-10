# Test Automation Framework Setup

## Overview
Comprehensive test automation framework established for the turn-based poker game project. Implements risk-based testing methodology with ATDD (Acceptance Test-Driven Development) workflow.

## Test Strategy

### Risk-Based Testing Approach
- **3 epics analyzed** with 21 identified risks (13 high-priority ≥6 score)
- **166 total tests** designed across Epics 1-3
- **Test distribution:** Heavy unit testing for poker logic, minimal E2E duplication
- **Quality gates:** P0=100% pass, P1≥95%, high-risk mitigations required

### ATDD Workflow for Story 1.2
- **17 failing tests created** (RED phase established)
- **Implementation checklist** with 5 priority tasks (14 hours total)
- **Reference:** `docs/atdd-checklist-epic1-story1.2.md`

## Test Frameworks

### 1. Playwright (E2E Testing)
- **Purpose:** End-to-end testing of WebSocket connections and UI flows
- **Configuration:** `playwright.config.ts`
- **Features:**
  - Multi-browser support (Chromium, Firefox, WebKit)
  - Video recording on failure
  - Automatic screenshot capture
  - Trace viewer for debugging
- **Test location:** `tests/e2e/`

### 2. Jest + React Testing Library (Component Testing)
- **Purpose:** React component testing with mocked dependencies
- **Configuration:** `jest.config.js`
- **Features:**
  - 80% coverage thresholds (branches, functions, lines, statements)
  - TypeScript support with ts-jest
  - DOM testing with jsdom environment
  - Mock WebSocket connections for isolation
- **Test location:** `tests/component/`

### 3. Google Test (C++ Server Testing)
- **Purpose:** Unit testing for C++ server logic
- **Configuration:** `server/CMakeLists.txt`
- **Features:**
  - FetchContent auto-download of Google Test
  - CMake integration with ctest
  - Isolated from libhv dependencies for test compilation
- **Test location:** `server/tests/`

## Test Data Management

### Factories (`tests/support/factories/`)
- **WebSocket factory:** Generates random, realistic test data using Faker
- **UUID generation:** Valid UUIDv4 format validation
- **Session data:** Mock session tokens and connection states

### Fixtures (`tests/support/fixtures/`)
- **Auto-cleanup:** Automatic teardown after each test
- **WebSocket mock:** Mock WebSocket server for isolated testing
- **State management:** Clean state between test runs

## Available Test Commands

### Root Package.json Scripts
```bash
# Default test (component tests)
npm test

# Run all test suites
npm run test:all

# CI/CD optimized test run
npm run test:ci

# Individual test suites
npm run test:server      # C++ Google Test
npm run test:component   # Jest component tests
npm run test:e2e         # Playwright E2E tests

# Development modes
npm run test:component:watch  # Watch mode for component tests
npm run test:e2e:ui           # Playwright UI mode
npm run test:e2e:headed       # Headed browser mode

# Installation
npm run test:install     # Install Playwright browsers
```

### Client Package.json Scripts
```bash
# Run from client directory
cd client
npm run test:e2e         # Playwright tests
npm run test:component   # Jest component tests
```

## Current Test Status (RED Phase)

### Server Tests (Google Test)
- ✅ `GeneratesValidUUIDv4` - PASSING (validates UUIDv4 format)
- ❌ `HandlesConnectionRequests` - FAILING (implementation required)
- ❌ `ManagesActiveSessions` - FAILING (implementation required)
- ❌ `RespondsToPingWithPong` - FAILING (implementation required)
- ❌ `ValidatesSessionTokens` - FAILING (implementation required)

### Component Tests (Jest)
- ❌ All Story 1.2 tests - FAILING (components not implemented yet)
  - Connection status display tests (7 tests)
  - WebSocket mock dependency resolution required

### E2E Tests (Playwright)
- ❌ WebSocket connection tests (4 tests)
  - Requires server implementation and browser installation

## Setup Instructions

### 1. Initial Setup
```bash
# Install all dependencies
npm run install:all

# Install test browsers (requires sudo for system dependencies)
npm run test:install
```

### 2. Running Tests
```bash
# Run all tests (stops on first failure)
npm run test:all

# Run tests for CI (continues on failure, generates reports)
npm run test:ci

# Run specific test suite
npm run test:server
npm run test:component
npm run test:e2e
```

### 3. Development Workflow
```bash
# TDD workflow for component development
npm run test:component:watch

# Debug E2E tests
npm run test:e2e:ui
npm run test:e2e:headed
```

## Test Architecture Decisions

### 1. Risk-Based Test Design
- Epics prioritized by risk score (probability × impact)
- Epic 1 → Epic 2 → Epic 3 implementation sequence
- High-risk areas receive more comprehensive testing

### 2. Framework Selection Rationale
- **Playwright:** Superior to Cypress for WebSocket testing, better debugging tools
- **Jest + RTL:** Industry standard for React, better TypeScript integration
- **Google Test:** Native C++ testing, integrates with CMake build system

### 3. Mock Strategy
- **WebSocket mocks:** Isolate frontend tests from server dependencies
- **Data factories:** Generate realistic, random test data
- **Auto-cleanup fixtures:** Prevent test pollution

### 4. Coverage Requirements
- **80% minimum coverage** for all metrics
- **P0 tests:** 100% pass required for deployment
- **P1 tests:** ≥95% pass required for release candidates

## Next Steps for DEV Team

### 1. Implement Story 1.2 (Highest Priority)
- Follow ATDD checklist: `docs/atdd-checklist-epic1-story1.2.md`
- Start with failing tests in RED phase
- Implement components and server logic
- Verify tests pass (GREEN phase)

### 2. Expand Test Coverage
- Generate tests for remaining stories using risk analysis
- Implement poker logic tests (high-risk area)
- Add integration tests for WebSocket communication

### 3. CI/CD Integration
- Configure GitHub Actions with test matrix
- Add coverage reporting to PRs
- Set up automated deployment gates

## Troubleshooting

### Common Issues

#### C++ Test Compilation
```bash
# If libhv is not installed, tests will compile without it
# Main server executable requires libhv and nlohmann/json
cd server
cmake -B build -DBUILD_TESTS=ON
cmake --build build
cd build && ctest --output-on-failure
```

#### Jest Module Resolution
- Component tests use `@/` alias mapped to `client/src/`
- Ensure components exist at expected paths
- Update `jest.config.js` moduleNameMapper for custom aliases

#### Playwright Browser Installation
```bash
# Install without system dependencies
cd client
npx playwright install chromium

# Or install all browsers (may require sudo)
npx playwright install --with-deps
```

## References
- `docs/test-design-epic-{1,2,3}.md` - Risk analysis and test designs
- `docs/atdd-checklist-epic1-story1.2.md` - Story 1.2 implementation checklist
- `docs/epics.md` - Epic definitions and requirements
- `docs/prd.md` - Product requirements document