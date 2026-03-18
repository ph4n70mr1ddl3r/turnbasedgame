type ErrorHandler = (message: string, error?: unknown) => void;

const IS_DEV = process.env.NODE_ENV === 'development';
const LOG_PREFIX_ERROR = '[ERROR]';
const LOG_PREFIX_WARN = '[WARN]';
const LOG_PREFIX_INFO = '[INFO]';

let globalErrorHandler: ErrorHandler | null = null;

export function setGlobalErrorHandler(handler: ErrorHandler | null): void {
  globalErrorHandler = handler;
}

export function logError(message: string, error?: unknown): void {
  if (IS_DEV) {
    console.error(`${LOG_PREFIX_ERROR} ${message}`, error ?? '');
  }

  if (globalErrorHandler) {
    try {
      globalErrorHandler(message, error);
    } catch (handlerError) {
      if (IS_DEV) {
        console.error(`${LOG_PREFIX_ERROR} Error handler failed:`, handlerError);
        console.error(`${LOG_PREFIX_ERROR} Original: ${message}`, error ?? '');
      }
    }
  }
}

export function logWarn(message: string, error?: unknown): void {
  if (IS_DEV) {
    console.warn(`${LOG_PREFIX_WARN} ${message}`, error ?? '');
  }
}

export function logInfo(message: string, data?: unknown): void {
  if (IS_DEV) {
    console.warn(`${LOG_PREFIX_INFO} ${message}`, data ?? '');
  }
}

export function isDevelopment(): boolean {
  return IS_DEV;
}
