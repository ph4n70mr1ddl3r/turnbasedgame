type ErrorHandler = (message: string, error?: unknown) => void;

let globalErrorHandler: ErrorHandler | null = null;

export function setErrorHandler(handler: ErrorHandler | null): void {
  globalErrorHandler = handler;
}

const isDev = process.env.NODE_ENV === "development";

export function logError(message: string, error?: unknown): void {
  if (isDev) {
    console.error(`[ERROR] ${message}`, error ?? "");
  }

  if (globalErrorHandler) {
    try {
      globalErrorHandler(message, error);
    } catch {
      // Silently fail to prevent error handler loops
    }
  }
}

export function logWarn(message: string, data?: unknown): void {
  if (isDev) {
    console.warn(`[WARN] ${message}`, data ?? "");
  }
}

export function logInfo(message: string, data?: unknown): void {
  if (isDev) {
    // eslint-disable-next-line no-console
    console.info(`[INFO] ${message}`, data ?? "");
  }
}

export function logDebug(message: string, data?: unknown): void {
  if (isDev) {
    // eslint-disable-next-line no-console
    console.debug(`[DEBUG] ${message}`, data ?? "");
  }
}
