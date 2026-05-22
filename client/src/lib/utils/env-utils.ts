/**
 * Environment variable utilities with validation
 */

/**
 * Gets a required environment variable and throws if missing
 */
export function getRequiredEnvVar(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Required environment variable ${key} is missing`);
  }
  return value;
}

/**
 * Gets an optional environment variable with default fallback
 */
export function getOptionalEnvVar(key: string, defaultValue?: string): string | undefined {
  return process.env[key] ?? defaultValue;
}

/**
 * Validates WebSocket URL configuration
 */
export function validateWebSocketConfig(): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check if WebSocket URL is configured
  const wsUrl = getOptionalEnvVar('NEXT_PUBLIC_WS_URL');
  const wsHost = getOptionalEnvVar('NEXT_PUBLIC_WS_HOST');

  if (!wsUrl && !wsHost) {
    errors.push('WebSocket URL not configured. Set NEXT_PUBLIC_WS_URL or NEXT_PUBLIC_WS_HOST');
  }

  // Validate production environment
  if (process.env.NODE_ENV === 'production') {
    if (!wsUrl) {
      errors.push('WebSocket URL must be configured in production via NEXT_PUBLIC_WS_URL');
    } else {
      try {
        const parsed = new URL(wsUrl);
        if (parsed.protocol !== 'wss:') {
          errors.push('Production WebSocket URL must use wss:// protocol');
        }
      } catch {
        errors.push('Invalid WebSocket URL format');
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Gets validated WebSocket URL
 */
export function getValidWebSocketUrl(): string {
  const validation = validateWebSocketConfig();
  if (!validation.isValid) {
    throw new Error(`WebSocket configuration error: ${validation.errors.join(', ')}`);
  }

  // Prefer explicit URL, otherwise construct from host/port
  const explicitUrl = getOptionalEnvVar('NEXT_PUBLIC_WS_URL');
  if (explicitUrl) {
    return explicitUrl;
  }

  const protocol = process.env.NODE_ENV === 'production' ? 'wss:' : 'ws:';
  const host = getRequiredEnvVar('NEXT_PUBLIC_WS_HOST');
  
  return `${protocol}//${host}:8080`;
}

/**
 * Validates environment variables on startup
 */
export function validateEnvironment(): void {
  const validation = validateWebSocketConfig();
  if (!validation.isValid) {
    console.error('Environment validation failed:', validation.errors);
    throw new Error('Invalid environment configuration');
  }
}