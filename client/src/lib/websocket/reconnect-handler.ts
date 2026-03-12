import { logError } from "@/lib/utils/logger";
import {
  RECONNECT_MAX_ATTEMPTS,
  RECONNECT_INITIAL_DELAY_MS,
  RECONNECT_MAX_DELAY_MS,
  RECONNECT_BACKOFF_FACTOR,
} from "@/lib/constants/game";

export interface ReconnectOptions {
  maxAttempts?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffFactor?: number;
  jitter?: boolean;
}

const DEFAULT_OPTIONS: Required<ReconnectOptions> = {
  maxAttempts: RECONNECT_MAX_ATTEMPTS,
  initialDelay: RECONNECT_INITIAL_DELAY_MS,
  maxDelay: RECONNECT_MAX_DELAY_MS,
  backoffFactor: RECONNECT_BACKOFF_FACTOR,
  jitter: true,
};

export type ReconnectState = "connected" | "disconnected" | "stopped" | "failed" | `attempt_${number}` | `waiting_${number}s`;

export class ReconnectHandler {
  private attempts = 0;
  private currentDelay: number;
  private timeoutId: ReturnType<typeof setTimeout> | null = null;
  private isActive = false;
  private isAttempting = false;
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

    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }

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
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
    if (this.isAttempting) {
      return false;
    }
    this.isActive = true;
    this.attempts = 0;
    this.currentDelay = this.options.initialDelay;
    return this.attemptReconnect();
  }

  isReconnecting(): boolean {
    return this.isActive;
  }

  getStatus(): {
    attempts: number;
    currentDelay: number;
    isActive: boolean;
    maxAttempts: number;
  } {
    return {
      attempts: this.attempts,
      currentDelay: this.currentDelay,
      isActive: this.isActive,
      maxAttempts: this.options.maxAttempts,
    };
  }
  
  private async attemptReconnect(): Promise<boolean> {
    if (!this.isActive || this.isAttempting) return false;

    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }

    this.isAttempting = true;
    const { maxAttempts } = this.options;

    if (maxAttempts > 0 && this.attempts >= maxAttempts) {
      this.onStateChange?.("failed");
      this.isActive = false;
      this.isAttempting = false;
      return false;
    }

    this.attempts++;
    this.onStateChange?.(`attempt_${this.attempts}`);

    try {
      const success = await this.connectFn();

      if (!this.isActive) {
        this.isAttempting = false;
        return false;
      }

      if (success) {
        this.reset();
        return true;
      } else {
        this.scheduleNextAttempt();
        return false;
      }
    } catch (error) {
      logError("Reconnection attempt failed:", error);
      if (this.isActive) {
        this.scheduleNextAttempt();
      }
      return false;
    } finally {
      this.isAttempting = false;
    }
  }
  
  private scheduleNextAttempt(): void {
    if (!this.isActive) return;

    const { backoffFactor, maxDelay, jitter } = this.options;

    let delay = this.currentDelay;

    if (jitter) {
      const jitterValue = 0.8 + Math.random() * 0.4;
      delay *= jitterValue;
      delay = Math.max(delay, this.options.initialDelay * 0.5);
    }

    this.currentDelay = Math.min(this.currentDelay * backoffFactor, maxDelay);

    this.timeoutId = setTimeout(() => {
      this.attemptReconnect();
    }, delay);

    this.onStateChange?.(`waiting_${Math.round(delay / 1000)}s`);
  }
  
  // Static helper to determine if reconnection should be attempted
  static shouldReconnect(error: CloseEvent | Error | unknown): boolean {
    if (error instanceof CloseEvent) {
      const normalClosureCodes: readonly number[] = [1000, 1001];
      const protocolErrorCodes: readonly number[] = [1002, 1003, 1007, 1008, 1010, 1011];
      const policyViolationCodes: readonly number[] = [1008];
      
      if (normalClosureCodes.includes(error.code)) {
        return false;
      }
      if (protocolErrorCodes.includes(error.code)) {
        return false;
      }
      if (policyViolationCodes.includes(error.code)) {
        return false;
      }
      if (error.code >= 4000 && error.code <= 4999) {
        return false;
      }
      
      return true;
    }
    
    if (error instanceof Error) {
      const reconnectablePatterns: readonly RegExp[] = [
        /network/i,
        /fetch/i,
        /websocket.*not.*open/i,
        /connection.*refused/i,
        /connection.*reset/i,
        /timeout/i,
        /ECONNREFUSED/,
        /ECONNRESET/,
        /ENOTFOUND/,
      ];
      const errorMessage = error.message.toLowerCase();
      return reconnectablePatterns.some(pattern => pattern.test(errorMessage));
    }
    
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