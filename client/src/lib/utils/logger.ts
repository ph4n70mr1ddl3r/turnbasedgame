type ErrorHandler = (message: string, error?: unknown) => void;

let globalErrorHandler: ErrorHandler | null = null;

export function isDevelopment(): boolean {
  return typeof process !== "undefined" && process.env?.NODE_ENV === "development";
}

const IS_DEV = isDevelopment();

export function setErrorHandler(handler: ErrorHandler | null): void {
  globalErrorHandler = handler;
}

export function logError(message: string, error?: unknown): void {
  if (IS_DEV) {
    console.error(`[ERROR] ${message}`, error ?? "");
  }

  if (globalErrorHandler) {
    try {
      globalErrorHandler(message, error);
    } catch (handlerError) {
      if (IS_DEV) {
        console.error("[ERROR] Error handler failed:", handlerError);
        console.error(`[ERROR] Original: ${message}`, error ?? "");
      }
    }
  }
}

export function logWarn(message: string, data?: unknown): void {
  if (IS_DEV) {
    console.warn(`[WARN] ${message}`, data ?? "");
  }
}

export function logInfo(message: string, data?: unknown): void {
  if (IS_DEV) {
    // eslint-disable-next-line no-console
    console.info(`[INFO] ${message}`, data ?? "");
  }
}

export function logDebug(message: string, data?: unknown): void {
  if (IS_DEV) {
    // eslint-disable-next-line no-console
    console.debug(`[DEBUG] ${message}`, data ?? "");
  }
}
