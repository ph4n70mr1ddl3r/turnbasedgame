export const WS_CONNECTION_TIMEOUT_MS = 10000;
export const WS_HEARTBEAT_INTERVAL_MS = 30000;
export const WS_HEARTBEAT_TIMEOUT_MS = 60000;
export const WS_MAX_PENDING_HEARTBEATS = 10;

export function getDefaultWebSocketUrl(): string {
  if (typeof window === "undefined") {
    return "ws://localhost:8080";
  }
  return window.location.protocol === "https:"
    ? "wss://localhost:8080"
    : "ws://localhost:8080";
}

export const WS_DEFAULT_URL = "ws://localhost:8080";

export const SESSION_DURATION_MS = 30 * 60 * 1000;

export const RECONNECT_MAX_ATTEMPTS = 10;
export const RECONNECT_INITIAL_DELAY_MS = 2000;
export const RECONNECT_MAX_DELAY_MS = 30000;
export const RECONNECT_BACKOFF_FACTOR = 1.5;

export const DEFAULT_TURN_TIME_MS = 30000;
export const DEFAULT_STARTING_CHIPS = 1500;
export const DEFAULT_MIN_BET = 50;

export const CHIP_VISUAL_DIVISOR = 100;
export const MAX_CHIP_STACK_DISPLAY = 5;
export const MAX_QUICK_RAISE_OPTIONS = 4;
