import { logError } from "@/lib/utils/logger";

// Auto-reconnection handler for WebSocket connections
// Implements exponential backoff with jitter

export interface ReconnectOptions {
  maxAttempts?: number;          // Maximum reconnection attempts (0 = infinite)
  initialDelay?: number;         // Initial delay in milliseconds
  maxDelay?: number;             // Maximum delay in milliseconds
  backoffFactor?: number;        // Exponential backoff factor
  jitter?: boolean;              // Add random jitter to prevent thundering herd
}

const DEFAULT_OPTIONS: Required<ReconnectOptions> = {
  maxAttempts: 10,               // 10 attempts max
  initialDelay: 2000,            // Start with 2 seconds
  maxDelay: 30000,               // Max 30 seconds between attempts
  backoffFactor: 1.5,            // Multiply delay by 1.5 each attempt
  jitter: true,                  // Add jitter
};

export type ReconnectState = "connected" | "disconnected" | "stopped" | "failed" | `attempt_${number}` | `waiting_${string}`;

export class ReconnectHandler {
  private attempts = 0;
  private currentDelay: number;
  private timeoutId: ReturnType<typeof setTimeout> | null = null;
  private isActive = false;
  private connectFn: () => Promise<boolean>;

  private onStateChange?: (state: ReconnectState) => void;
  private options: Required<ReconnectOptions>;
  
  constructor(
    connectFn: () => Promise<boolean>,

    onStateChange?: (state: ReconnectState) => void,
    options: ReconnectOptions = {}
  ) {
    this.connectFn = connectFn;
    this.onStateChange = onStateChange;
    const opts = { ...DEFAULT_OPTIONS, ...options };
    this.options = opts;
    this.currentDelay = opts.initialDelay;
  }

  start(): void {
    if (this.isActive) return;
    
    this.isActive = true;
    this.attempts = 0;
    this.currentDelay = this.options.initialDelay;
    this.onStateChange?.("disconnected");
    
    this.attemptReconnect();
  }

  stop(): void {
    this.isActive = false;
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
    this.onStateChange?.("stopped");
  }

  reset(): void {
    this.attempts = 0;
    this.currentDelay = this.options.initialDelay;
    this.isActive = false;
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
    this.onStateChange?.("connected");
  }

  async reconnectNow(): Promise<boolean> {
    this.stop();
    return this.attemptReconnect();
  }

  getStatus() {
    return {
      attempts: this.attempts,
      currentDelay: this.currentDelay,
      isActive: this.isActive,
      maxAttempts: this.options.maxAttempts,
    };
  }
  
  // Private method to attempt reconnection
  private async attemptReconnect(): Promise<boolean> {
    if (!this.isActive) return false;

    const { maxAttempts } = this.options;

    if (maxAttempts > 0 && this.attempts >= maxAttempts) {
      this.onStateChange?.("failed");
      this.isActive = false;
      return false;
    }
    
    this.attempts++;
    this.onStateChange?.(`attempt_${this.attempts}`);
    
    try {
      const success = await this.connectFn();
      
      if (success) {
        this.reset();
        return true;
      } else {
        this.scheduleNextAttempt();
        return false;
      }
    } catch (error) {
      logError("Reconnection attempt failed:", error);
      this.scheduleNextAttempt();
      return false;
    }
  }
  
  // Schedule next reconnection attempt with exponential backoff
  private scheduleNextAttempt(): void {
    if (!this.isActive) return;

    const { backoffFactor, maxDelay, jitter } = this.options;

    let delay = this.currentDelay;

    delay *= backoffFactor;

    delay = Math.min(delay, maxDelay);

    // Apply jitter (±20%)
    if (jitter) {
      const jitterValue = 0.8 + Math.random() * 0.4;
      delay *= jitterValue;
    }

    this.currentDelay = delay;

    this.timeoutId = setTimeout(() => {
      this.attemptReconnect();
    }, delay);

    this.onStateChange?.(`waiting_${Math.round(delay / 1000)}s`);
  }
  
  // Static helper to determine if reconnection should be attempted
  static shouldReconnect(error: CloseEvent | Error | unknown): boolean {
    // Reconnect on network errors, but not on application errors
    if (error instanceof CloseEvent) {
      // Don't reconnect on normal closure (1000) or going away (1001)
      const dontReconnectCodes = [1000, 1001];
      return !dontReconnectCodes.includes(error.code);
    }
    
    // Reconnect on network errors
    if (error instanceof Error) {
      const networkErrors = [
        "NetworkError",
        "TypeError", // Often "Failed to fetch"
        "WebSocket is not open",
      ];
      return networkErrors.some((msg) => error.message.includes(msg));
    }
    
    // Default to reconnecting
    return true;
  }
  
  // Calculate reconnection delay (for UI display)
  static calculateDelay(attempt: number, options: ReconnectOptions = {}): number {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    let delay = opts.initialDelay;
    
    for (let i = 1; i < attempt; i++) {
      delay *= opts.backoffFactor;
      delay = Math.min(delay, opts.maxDelay);
    }
    
    return delay;
  }
}