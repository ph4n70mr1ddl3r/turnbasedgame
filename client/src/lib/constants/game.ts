// Game Configuration Constants

// Connection Settings
export const WS_CONNECTION_TIMEOUT_MS = 10000; // 10 seconds
export const WS_HEARTBEAT_INTERVAL_MS = 30000; // 30 seconds
export const WS_HEARTBEAT_TIMEOUT_MS = 60000; // 60 seconds
export const WS_MAX_PENDING_HEARTBEATS = 10;
export const WS_MAX_MESSAGE_SIZE = 64 * 1024; // 64KB
export const WS_MIN_MESSAGE_SIZE = 2;

// Game Settings
export const MAX_PLAYERS = 2;
export const MAX_COMMUNITY_CARDS = 5;
export const PREFLOP_CARDS = 2;
export const FLOP_CARDS = 3;
export const TURN_CARDS = 1;
export const RIVER_CARDS = 1;
export const MAX_CHIP_VALUE = 1_000_000_000;
export const MAX_TIME_REMAINING_MS = 24 * 60 * 60 * 1000; // 24 hours

// Poker Game Constants
export const STARTING_CHIPS = 1500;
export const SMALL_BLIND = 25;
export const BIG_BLIND = 50;
export const MAX_BET_AMOUNT = 1000000;
export const SESSION_TIMEOUT_MINUTES = 30;
export const RATE_LIMITER_CLEANUP_INTERVAL_MINUTES = 5;
export const MAX_RATE_LIMITER_ENTRIES = 100;

// Timeouts (in milliseconds)
export const ACTION_TIMEOUT_MS = 30000; // 30 seconds per action
export const CONNECTION_RETRY_DELAY_MS = 1000; // 1 second initial retry delay
export const MAX_CONNECTION_RETRY_ATTEMPTS = 5;
export const RECONNECT_MAX_DELAY_MS = 30000; // 30 seconds max delay
export const RECONNECT_BACKOFF_FACTOR = 2;

// Game States
export const VALID_BETTING_ROUNDS = ['preflop', 'flop', 'turn', 'river', 'showdown'] as const;
export const VALID_GAME_STATUSES = ['waiting', 'active', 'finished'] as const;
export const VALID_CONNECTION_STATUSES = ['connected', 'disconnected', 'reconnecting'] as const;
export const VALID_PLAYER_POSITIONS = ['button', 'small_blind', 'big_blind', 'none'] as const;
export const VALID_PLAYER_IDS = ['p1', 'p2'] as const;
export const VALID_BET_ACTIONS = ['check', 'call', 'raise', 'fold'] as const;

// Card Settings
export const CARD_RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'] as const;
export const CARD_SUITS = ['c', 'd', 'h', 's'] as const;

// UI Settings
export const DEFAULT_ANIMATION_DURATION = 300; // milliseconds
export const MAX_TOOLTIP_LENGTH = 100;
export const AUTO_REFRESH_INTERVAL_MS = 60000; // 1 minute

// Error Codes
export const ERROR_CODES = {
  INVALID_TOKEN: 'invalid_token',
  GAME_NOT_ACTIVE: 'game_not_active',
  INVALID_ACTION: 'invalid_action',
  UNAUTHORIZED: 'unauthorized',
  RATE_LIMITED: 'rate_limited',
  MESSAGE_TOO_LARGE: 'message_too_large',
  PARSE_ERROR: 'parse_error',
  SERVER_ERROR: 'server_error',
  GAME_FULL: 'game_full',
  CONNECTION_ERROR: 'connection_error',
  TIMEOUT_ERROR: 'timeout_error',
  NETWORK_ERROR: 'network_error',
  VALIDATION_ERROR: 'validation_error',
} as const;

// Error Messages
export const ERROR_MESSAGES = {
  [ERROR_CODES.INVALID_TOKEN]: 'Invalid session token. Please refresh the page.',
  [ERROR_CODES.GAME_NOT_ACTIVE]: 'Game is not currently active.',
  [ERROR_CODES.INVALID_ACTION]: 'Invalid action. Please try again.',
  [ERROR_CODES.UNAUTHORIZED]: 'Unauthorized access. Please log in again.',
  [ERROR_CODES.RATE_LIMITED]: 'Too many requests. Please slow down.',
  [ERROR_CODES.MESSAGE_TOO_LARGE]: 'Message size exceeds limit.',
  [ERROR_CODES.PARSE_ERROR]: 'Invalid message format.',
  [ERROR_CODES.SERVER_ERROR]: 'Server error. Please try again later.',
  [ERROR_CODES.GAME_FULL]: 'Game is full. Please try again later.',
  [ERROR_CODES.CONNECTION_ERROR]: 'Connection error. Please check your internet.',
  [ERROR_CODES.TIMEOUT_ERROR]: 'Request timed out. Please try again.',
  [ERROR_CODES.NETWORK_ERROR]: 'Network error. Please check your connection.',
  [ERROR_CODES.VALIDATION_ERROR]: 'Invalid data. Please check your input.',
} as const;

// API Endpoints
export const API_ENDPOINTS = {
  WS_URL: process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8080',
  HTTP_URL: process.env.NEXT_PUBLIC_HTTP_URL || 'http://localhost:3000',
} as const;

// Environment-specific settings
export const ENV_CONFIG = {
  development: {
    logLevel: 'debug',
    enableDevTools: true,
    showPerformanceWarnings: true,
    autoRefreshEnabled: true,
  },
  production: {
    logLevel: 'error',
    enableDevTools: false,
    showPerformanceWarnings: false,
    autoRefreshEnabled: false,
  },
  test: {
    logLevel: 'silent',
    enableDevTools: false,
    showPerformanceWarnings: false,
    autoRefreshEnabled: false,
  },
} as const;

// Performance thresholds
export const PERFORMANCE_THRESHOLDS = {
  SLOW_RENDER_MS: 100,
  SLOW_NETWORK_MS: 2000,
  MEMORY_WARNING_MB: 50,
  CPU_WARNING_PERCENT: 80,
} as const;

// Game Rules
export const GAME_RULES = {
  MIN_BET_INCREMENT: BIG_BLIND,
  ALL_IN_THRESHOLD: 0.9, // 90% of stack to be considered all-in
  TIME_BANK_SECONDS: 10,
  DISCONNECTION_TIMEOUT_MS: 30000,
} as const;

// WebSocket Message Types
export const MESSAGE_TYPES = {
  GAME_STATE_UPDATE: 'game_state_update',
  BET_ACTION: 'bet_action',
  CONNECTION_STATUS: 'connection_status',
  ERROR: 'error',
  HEARTBEAT: 'heartbeat',
  SESSION_INIT: 'session_init',
  CHAT_MESSAGE: 'chat_message',
} as const;

// Player Actions
export const PLAYER_ACTIONS = {
  CHECK: 'check',
  CALL: 'call',
  RAISE: 'raise',
  FOLD: 'fold',
  DISCONNECT: 'disconnect',
} as const;

// Game Phases
export const GAME_PHASES = {
  WAITING: 'waiting',
  PREFLOP: 'preflop',
  FLOP: 'flop',
  TURN: 'turn',
  RIVER: 'river',
  SHOWDOWN: 'showdown',
  FINISHED: 'finished',
} as const;

// Hand Rankings
export const HAND_RANKINGS = [
  'High Card',
  'Pair',
  'Two Pair',
  'Three of a Kind',
  'Straight',
  'Flush',
  'Full House',
  'Four of a Kind',
  'Straight Flush',
  'Royal Flush',
] as const;