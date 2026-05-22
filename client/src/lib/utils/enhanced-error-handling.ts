/**
 * Enhanced error handling utilities with comprehensive error management,
 * user-friendly messages, and improved error recovery mechanisms.
 */

import { createError, isNetworkError, isTimeoutError, isError } from './enhanced-utils';
import { logError, logWarn, logInfo } from './logger';

// Error categories for better error handling
export enum ErrorCategory {
  NETWORK = 'network',
  VALIDATION = 'validation',
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  SERVER = 'server',
  CLIENT = 'client',
  TIMEOUT = 'timeout',
  RATE_LIMIT = 'rate_limit',
  SESSION = 'session',
  GAME_STATE = 'game_state',
  WEBSOCKET = 'websocket',
  STORAGE = 'storage',
  UNKNOWN = 'unknown',
}

// Error severity levels
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

// Error context interface for detailed error information
export interface ErrorContext {
  category: ErrorCategory;
  severity: ErrorSeverity;
  code: string;
  message: string;
  details?: Record<string, unknown>;
  timestamp: number;
  component?: string;
  action?: string;
  userId?: string;
  sessionId?: string;
  stackTrace?: string;
  originalError?: Error;
}

// Enhanced error class for structured error handling
export class AppError extends Error {
  public readonly category: ErrorCategory;
  public readonly severity: ErrorSeverity;
  public readonly code: string;
  public readonly details: Record<string, unknown>;
  public readonly timestamp: number;
  public readonly component?: string;
  public readonly action?: string;
  public readonly userId?: string;
  public readonly sessionId?: string;

  constructor(context: Omit<ErrorContext, 'timestamp' | 'stackTrace'>) {
    super(context.message);
    this.name = 'AppError';
    this.category = context.category;
    this.severity = context.severity;
    this.code = context.code;
    this.details = context.details || {};
    this.timestamp = Date.now();
    this.component = context.component;
    this.action = context.action;
    this.userId = context.userId;
    this.sessionId = context.sessionId;
    
    // Maintain stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError);
    }
  }

  toJSON(): ErrorContext {
    return {
      category: this.category,
      severity: this.severity,
      code: this.code,
      message: this.message,
      details: this.details,
      timestamp: this.timestamp,
      component: this.component,
      action: this.action,
      userId: this.userId,
      sessionId: this.sessionId,
      stackTrace: this.stack,
    };
  }

  isCritical(): boolean {
    return this.severity === ErrorSeverity.CRITICAL;
  }

  shouldNotifyUser(): boolean {
    return (
      this.severity === ErrorSeverity.HIGH ||
      this.severity === ErrorSeverity.CRITICAL ||
      this.category === ErrorCategory.NETWORK ||
      this.category === ErrorCategory.AUTHENTICATION ||
      this.category === ErrorCategory.GAME_STATE
    );
  }
}

// Error mapping for user-friendly messages
export const ERROR_MESSAGES: Record<string, string> = {
  // Network errors
  NETWORK_CONNECTION_FAILED: 'Unable to connect to the server. Please check your internet connection.',
  NETWORK_TIMEOUT: 'The request timed out. Please try again.',
  WEBSOCKET_CONNECTION_FAILED: 'Failed to establish game connection. Please refresh the page.',
  
  // Authentication errors
  INVALID_TOKEN: 'Your session has expired. Please log in again.',
  UNAUTHORIZED: 'You are not authorized to perform this action.',
  ACCESS_DENIED: 'You do not have permission to access this resource.',
  
  // Validation errors
  INVALID_INPUT: 'Please check your input and try again.',
  INVALID_BET_AMOUNT: 'Invalid bet amount. Please enter a valid number.',
  INSUFFICIENT_CHIPS: 'You do not have enough chips for this bet.',
  INVALID_GAME_STATE: 'The game state is invalid. Please refresh the page.',
  
  // Game errors
  GAME_NOT_FOUND: 'The game you are looking for does not exist.',
  GAME_FULL: 'The game is full. Please try again later.',
  PLAYER_ALREADY_CONNECTED: 'You are already connected to this game.',
  INVALID_ACTION: 'Invalid game action. Please check the rules.',
  
  // Session errors
  SESSION_EXPIRED: 'Your session has expired. Please reconnect.',
  SESSION_INVALID: 'Invalid session. Please refresh the page.',
  STORAGE_ERROR: 'Failed to save your game data.',
  
  // Server errors
  SERVER_ERROR: 'An unexpected error occurred on the server. Please try again later.',
  MAINTENANCE_MODE: 'The server is currently undergoing maintenance. Please try again later.',
  
  // Rate limiting
  RATE_LIMIT_EXCEEDED: 'Too many requests. Please wait before trying again.',
  
  // Critical errors
  CRITICAL_ERROR: 'A critical error occurred. Please contact support.',
};

// Error severity mapping
export const ERROR_SEVERITY: Record<ErrorCategory, ErrorSeverity> = {
  [ErrorCategory.NETWORK]: ErrorSeverity.MEDIUM,
  [ErrorCategory.VALIDATION]: ErrorSeverity.LOW,
  [ErrorCategory.AUTHENTICATION]: ErrorSeverity.HIGH,
  [ErrorCategory.AUTHORIZATION]: ErrorSeverity.HIGH,
  [ErrorCategory.SERVER]: ErrorSeverity.CRITICAL,
  [ErrorCategory.CLIENT]: ErrorSeverity.MEDIUM,
  [ErrorCategory.TIMEOUT]: ErrorSeverity.MEDIUM,
  [ErrorCategory.RATE_LIMIT]: ErrorSeverity.LOW,
  [ErrorCategory.SESSION]: ErrorSeverity.HIGH,
  [ErrorCategory.GAME_STATE]: ErrorSeverity.HIGH,
  [ErrorCategory.WEBSOCKET]: ErrorSeverity.HIGH,
  [ErrorCategory.STORAGE]: ErrorSeverity.MEDIUM,
  [ErrorCategory.UNKNOWN]: ErrorSeverity.CRITICAL,
};

// Error category mapping
export const ERROR_CATEGORY_MAP: Record<string, ErrorCategory> = {
  // Network errors
  'NetworkError': ErrorCategory.NETWORK,
  'TimeoutError': ErrorCategory.TIMEOUT,
  'FetchError': ErrorCategory.NETWORK,
  'WebSocketError': ErrorCategory.WEBSOCKET,
  'ECONNREFUSED': ErrorCategory.NETWORK,
  'ETIMEDOUT': ErrorCategory.TIMEOUT,
  
  // Authentication errors
  'InvalidTokenError': ErrorCategory.AUTHENTICATION,
  'UnauthorizedError': ErrorCategory.AUTHORIZATION,
  'ForbiddenError': ErrorCategory.AUTHORIZATION,
  'SessionExpiredError': ErrorCategory.SESSION,
  
  // Validation errors
  'ValidationError': ErrorCategory.VALIDATION,
  'InvalidInputError': ErrorCategory.VALIDATION,
  
  // Server errors
  'ServerError': ErrorCategory.SERVER,
  'InternalError': ErrorCategory.SERVER,
  'MaintenanceError': ErrorCategory.SERVER,
  
  // Rate limiting
  'RateLimitError': ErrorCategory.RATE_LIMIT,
  'TooManyRequestsError': ErrorCategory.RATE_LIMIT,
  
  // Unknown errors
  'Error': ErrorCategory.UNKNOWN,
  'Exception': ErrorCategory.UNKNOWN,
};

// Error handler interface
export interface ErrorHandler {
  canHandle(error: unknown): boolean;
  handle(error: unknown, context?: Partial<ErrorContext>): AppError;
  shouldNotifyUser(error: AppError): boolean;
  shouldLogError(error: AppError): boolean;
}

// Default error handler
export class DefaultErrorHandler implements ErrorHandler {
  canHandle(error: unknown): boolean {
    return true;
  }

  handle(error: unknown, context?: Partial<ErrorContext>): AppError {
    const errorContext = this.parseError(error);
    const mergedContext = {
      ...errorContext,
      ...context,
      timestamp: Date.now(),
    };
    
    return new AppError(mergedContext);
  }

  shouldNotifyUser(error: AppError): boolean {
    return error.shouldNotifyUser();
  }

  shouldLogError(error: AppError): boolean {
    return error.severity !== ErrorSeverity.LOW || error.category === ErrorCategory.UNKNOWN;
  }

  private parseError(error: unknown): Partial<ErrorContext> {
    if (isError(error)) {
      // Check for known error types
      const errorName = error.name;
      const category = ERROR_CATEGORY_MAP[errorName] || ErrorCategory.UNKNOWN;
      const severity = ERROR_SEVERITY[category];
      const userMessage = ERROR_MESSAGES[errorName] || error.message;
      
      return {
        category,
        severity,
        code: errorName,
        message: userMessage,
        originalError: error,
        details: {
          originalMessage: error.message,
          stack: error.stack,
          ...error,
        },
      };
    }
    
    // Handle non-error objects
    if (typeof error === 'string') {
      return {
        category: ErrorCategory.UNKNOWN,
        severity: ErrorSeverity.MEDIUM,
        code: 'UnknownError',
        message: error,
        details: { originalError: error },
      };
    }
    
    // Handle objects
    if (typeof error === 'object' && error !== null) {
      return {
        category: ErrorCategory.UNKNOWN,
        severity: ErrorSeverity.MEDIUM,
        code: 'UnknownError',
        message: 'An unknown error occurred',
        details: { originalError: error },
      };
    }
    
    // Handle primitive types
    return {
      category: ErrorCategory.UNKNOWN,
      severity: ErrorSeverity.MEDIUM,
      code: 'UnknownError',
      message: 'An unknown error occurred',
      details: { originalError: String(error) },
    };
  }
}

// Error handling registry
export class ErrorHandlerRegistry {
  private handlers: ErrorHandler[] = [];
  private defaultHandler: DefaultErrorHandler;

  constructor() {
    this.defaultHandler = new DefaultErrorHandler();
  }

  register(handler: ErrorHandler): void {
    if (!this.handlers.includes(handler)) {
      this.handlers.push(handler);
    }
  }

  unregister(handler: ErrorHandler): void {
    const index = this.handlers.indexOf(handler);
    if (index > -1) {
      this.handlers.splice(index, 1);
    }
  }

  handleError(error: unknown, context?: Partial<ErrorContext>): AppError {
    // Try to find a handler that can handle this error
    for (const handler of this.handlers) {
      if (handler.canHandle(error)) {
        return handler.handle(error, context);
      }
    }
    
    // Fall back to default handler
    return this.defaultHandler.handle(error, context);
  }
}

// Global error handler registry
export const globalErrorHandlerRegistry = new ErrorHandlerRegistry();

// Utility functions for error handling
export function createAppError(
  code: string,
  message: string,
  category: ErrorCategory,
  context?: Partial<ErrorContext>
): AppError {
  const severity = context?.severity || ERROR_SEVERITY[category];
  const errorContext: ErrorContext = {
    category,
    severity,
    code,
    message,
    timestamp: Date.now(),
    ...context,
  };
  
  return new AppError(errorContext);
}

export function handleError(
  error: unknown,
  context?: Partial<ErrorContext>
): AppError {
  return globalErrorHandlerRegistry.handleError(error, context);
}

export function logErrorWithContext(error: AppError): void {
  const errorInfo = {
    category: error.category,
    severity: error.severity,
    code: error.code,
    message: error.message,
    details: error.details,
    timestamp: error.timestamp,
    component: error.component,
    action: error.action,
  };
  
  if (error.severity === ErrorSeverity.CRITICAL) {
    logError(`CRITICAL ERROR: ${error.message}`, errorInfo);
  } else if (error.severity === ErrorSeverity.HIGH) {
    logError(`High severity error: ${error.message}`, errorInfo);
  } else if (error.severity === ErrorSeverity.MEDIUM) {
    logWarn(`Medium severity error: ${error.message}`, errorInfo);
  } else {
    logError(`Low severity error: ${error.message}`, errorInfo);
  }
}

// Error recovery utilities
export class ErrorRecovery {
  static async retryWithBackoff<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 1000,
    context?: Partial<ErrorContext>
  ): Promise<T> {
    let lastError: AppError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = handleError(error, context);
        
        if (attempt === maxRetries || lastError.category !== ErrorCategory.NETWORK) {
          throw lastError;
        }
        
        const delay = baseDelay * Math.pow(2, attempt - 1);
        logWarn(`Attempt ${attempt} failed, retrying in ${delay}ms...`, lastError);
        
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw lastError!;
  }

  static fallbackOperation<T>(
    operation: () => T,
    fallback: () => T,
    errorContext?: Partial<ErrorContext>
  ): T {
    try {
      return operation();
    } catch (error) {
      const appError = handleError(error, errorContext);
      logWarn(`Operation failed, using fallback: ${appError.message}`, appError);
      return fallback();
    }
  }
}

// Error boundary utilities
export interface ErrorBoundaryState {
  hasError: boolean;
  error: AppError | null;
  errorInfo: string | null;
}

export function getErrorBoundaryState(error: unknown, errorInfo?: string): ErrorBoundaryState {
  const appError = handleError(error);
  return {
    hasError: true,
    error: appError,
    errorInfo: errorInfo || appError.stack,
  };
}

export function resetErrorBoundary(): ErrorBoundaryState {
  return {
    hasError: false,
    error: null,
    errorInfo: null,
  };
}

// Initialize error handling in development mode
if (process.env.NODE_ENV === 'development') {
  // Log unhandled errors
  window.addEventListener('error', (event) => {
    const appError = handleError(event.error, {
      component: 'Window',
      action: 'GlobalError',
    });
    logErrorWithContext(appError);
  });

  // Log unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    const appError = handleError(event.reason, {
      component: 'Window',
      action: 'UnhandledRejection',
    });
    logErrorWithContext(appError);
  });
}

// Export everything for easier use
export {
  AppError,
  ErrorCategory,
  ErrorSeverity,
  ErrorHandler,
  DefaultErrorHandler,
  ErrorHandlerRegistry,
};

export {
  createAppError,
  handleError,
  logErrorWithContext,
  ErrorRecovery,
  getErrorBoundaryState,
  resetErrorBoundary,
  globalErrorHandlerRegistry,
};