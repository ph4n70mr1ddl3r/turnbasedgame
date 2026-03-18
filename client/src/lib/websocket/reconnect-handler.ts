import { logError } from "@/lib/utils/logger";
import {
  RECONNECT_MAX_ATTEMPTS,
  RECONNECT_INITIAL_DELAY_MS,
  RECONNECT_MAX_DELAY_MS,
  RECONNECT_BACKOFF_FACTOR,
} from "@/lib/constants/game";

const NON_RECONNECTABLE_WS_CODES: readonly number[] = [
  1000, 1001,
  1002, 1003, 1007, 1008, 1010, 1011,
];

const RECONNECTABLE_ERROR_PATTERNS: readonly RegExp[] = [
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

export interface ReconnectOptions {
  maxAttempts?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffFactor?: number;
  jitter?: boolean;
  onError?: (error: unknown) => void;
}

const DEFAULT_OPTIONS: Required<Omit<ReconnectOptions, 'onError'>> & { onError: undefined } = {
  maxAttempts: RECONNECT_MAX_ATTEMPTS,
  initialDelay: RECONNECT_INITIAL_DELAY_MS,
  maxDelay: RECONNECT_MAX_DELAY_MS,
  backoffFactor: RECONNECT_BACKOFF_FACTOR,
  jitter: true,
  onError: undefined,
};

export type ReconnectState = "connected" | "disconnected" | "stopped" | "failed" | `attempt_${number}` | `waiting_${number}s`;

export type ConnectFunction = () => Promise<boolean>;

export class ReconnectHandler {
  private attempts = 0;
  private currentDelay: number;
  private timeoutId: ReturnType<typeof setTimeout> | null = null;
  private isActive = false;
  private isAttempting = false;
  private getConnectFn: () => ConnectFunction;
  private abortController: AbortController | null = null;
  private boundHandleOnline: () => void;

  private onStateChange?: (state: ReconnectState) => void;
  private onError?: (error: unknown) => void;
  private options: Required<Omit<ReconnectOptions, 'onError'>> & Pick<ReconnectOptions, 'onError'>;
  
  constructor(
    getConnectFn: () => ConnectFunction,
    onStateChange?: (state: ReconnectState) => void,
    options: ReconnectOptions = {}
  ) {
    this.getConnectFn = getConnectFn;
    this.onStateChange = onStateChange;
    this.onError = options.onError;
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.currentDelay = this.options.initialDelay;
    this.boundHandleOnline = () => this.handleOnline();
    this.setupOnlineListener();
  }

  private setupOnlineListener(): void {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', this.boundHandleOnline);
    }
  }

  private removeOnlineListener(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this.boundHandleOnline);
    }
  }

  private handleOnline(): void {
    if (this.isActive && !this.isAttempting) {
      this.reconnectNow();
    }
  }

  start(): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }

    if (this.abortController) {
      this.abortController.abort();
    }
    this.abortController = new AbortController();

    if (this.isActive) {
      this.attempts = 0;
      this.currentDelay = this.options.initialDelay;
      this.onStateChange?.("disconnected");
      this.attemptReconnect();
      return;
    }

    this.isActive = true;
    this.attempts = 0;
    this.currentDelay = this.options.initialDelay;
    this.onStateChange?.("disconnected");

    this.attemptReconnect();
  }

  stop(): void {
    this.isActive = false;
    this.isAttempting = false;
    this.removeOnlineListener();
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
    this.onStateChange?.("stopped");
  }

  destroy(): void {
    this.stop();
  }

  reset(): void {
    this.attempts = 0;
    this.currentDelay = this.options.initialDelay;
    this.isActive = false;
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
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

    if (this.abortController?.signal.aborted) {
      this.isAttempting = false;
      this.isActive = false;
      return false;
    }

    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }

    this.isAttempting = true;
    const { maxAttempts } = this.options;
    const currentAbortController = this.abortController;

    if (maxAttempts > 0 && this.attempts >= maxAttempts) {
      this.onStateChange?.("failed");
      this.isActive = false;
      this.isAttempting = false;
      return false;
    }

    this.attempts++;
    this.onStateChange?.(`attempt_${this.attempts}`);

    try {
      const connectFn = this.getConnectFn();
      const success = await connectFn();

      if (currentAbortController?.signal.aborted) {
        this.isAttempting = false;
        return false;
      }

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
      if (currentAbortController?.signal.aborted) {
        this.isAttempting = false;
        return false;
      }
      logError("Reconnection attempt failed:", error);
      this.onError?.(error);
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

    this.currentDelay = Math.min(this.currentDelay * backoffFactor, maxDelay);

    if (jitter) {
      const jitterValue = 0.8 + Math.random() * 0.4;
      delay *= jitterValue;
      delay = Math.max(delay, this.options.initialDelay * 0.5);
    }

    this.timeoutId = setTimeout(() => {
      this.attemptReconnect();
    }, delay);

    this.onStateChange?.(`waiting_${Math.round(delay / 1000)}s`);
  }
  
  // Static helper to determine if reconnection should be attempted
  static shouldReconnect(error: CloseEvent | Error | DOMException | unknown): boolean {
    if (error instanceof CloseEvent) {
      if (NON_RECONNECTABLE_WS_CODES.includes(error.code)) {
        return false;
      }
      if (error.code >= 4000 && error.code <= 4999) {
        return false;
      }
      
      return true;
    }
    
    if (error instanceof DOMException) {
      const errorName = error.name.toLowerCase();
      const errorMessage = error.message.toLowerCase();
      
      if (errorName === 'aborterror' || errorName === 'notallowederror') {
        return false;
      }
      
      return RECONNECTABLE_ERROR_PATTERNS.some(pattern => 
        pattern.test(errorMessage) || pattern.test(errorName)
      );
    }
    
    if (error instanceof Error) {
      const errorMessage = error.message.toLowerCase();
      return RECONNECTABLE_ERROR_PATTERNS.some(pattern => pattern.test(errorMessage));
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