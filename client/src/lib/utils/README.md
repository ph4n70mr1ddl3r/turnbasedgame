# Utility Functions Documentation

This document provides an overview of the utility functions and their usage in the application.

## Environment Utils (`env-utils.ts`)

### Purpose
Handles environment variable validation and WebSocket URL configuration with proper error handling.

### Functions

#### `getRequiredEnvVar(key: string): string`
Gets a required environment variable and throws if missing.

**Usage:**
```typescript
const apiUrl = getRequiredEnvVar('NEXT_PUBLIC_API_URL');
```

#### `getOptionalEnvVar(key: string, defaultValue?: string): string | undefined`
Gets an optional environment variable with default fallback.

**Usage:**
```typescript
const port = getOptionalEnvVar('NEXT_PUBLIC_PORT', ':3000');
```

#### `validateWebSocketConfig(): { isValid: boolean; errors: string[] }`
Validates WebSocket URL configuration and returns validation result.

**Usage:**
```typescript
const validation = validateWebSocketConfig();
if (!validation.isValid) {
  console.error(validation.errors);
}
```

#### `getValidWebSocketUrl(): string`
Gets validated WebSocket URL with proper fallbacks.

**Usage:**
```typescript
const wsUrl = getValidWebSocketUrl();
```

#### `validateEnvironment(): void`
Validates all environment variables on startup.

**Usage:**
```typescript
// In your app initialization
validateEnvironment();
```

## Performance Monitor (`performance-monitor.ts`)

### Purpose
Monitors application performance metrics including render times, WebSocket latency, and action response times.

### Features
- Real-time performance tracking
- Performance threshold monitoring
- Performance measurement decorator
- Debug information and warnings

### Usage

#### Basic Usage
```typescript
import { performanceMonitor } from '@/lib/utils/performance-monitor';

// Record a custom metric
performanceMonitor.recordEntry({
  type: 'action',
  duration: 150,
  metadata: { action: 'bet' }
});
```

#### Using the Decorator
```typescript
import { measurePerformance } from '@/lib/utils/performance-monitor';

@measurePerformance('action', { action: 'bet' })
async function placeBet(amount: number) {
  // Your betting logic here
}
```

#### Getting Metrics
```typescript
const metrics = performanceMonitor.getMetrics();
console.log('Average render time:', metrics.renderTime);

const warnings = performanceMonitor.checkPerformanceThresholds();
if (!warnings.isHealthy) {
  console.warn('Performance issues:', warnings.warnings);
}
```

#### Performance Monitor Component
```typescript
import { PerformanceMonitorComponent } from '@/components/ui/PerformanceMonitor';

// In your component
<PerformanceMonitorComponent showWarnings={true} maxWarnings={5} />
```

## Error Handling

### Error Boundary
The application includes comprehensive error boundaries to catch and display errors gracefully.

```typescript
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';

// Wrap your application
<ErrorBoundary fallback={<CustomErrorFallback />}>
  <YourApp />
</ErrorBoundary>
```

## Logging Utils (`logger.ts`)

### Purpose
Provides centralized logging with different severity levels and context information.

### Functions

#### `logInfo(message: string, context?: Record<string, unknown>)`
Logs informational messages.

**Usage:**
```typescript
logInfo('User connected', { userId: 'p1', timestamp: Date.now() });
```

#### `logError(message: string, error?: unknown, context?: Record<string, unknown>)`
Logs error messages with optional error object and context.

**Usage:**
```typescript
try {
  // Some operation that might fail
} catch (error) {
  logError('Failed to process bet', error, { userId: 'p1', betAmount: 100 });
}
```

#### `logWarn(message: string, context?: Record<string, unknown>)`
Logs warning messages.

**Usage:**
```typescript
logWarn('Slow WebSocket detected', { latency: 300ms });
```

## Browser Utils (`browser-utils.ts`)

### Purpose
Provides browser-specific utility functions and environment detection.

### Functions

#### `isBrowser(): boolean`
Checks if code is running in a browser environment.

**Usage:**
```typescript
if (isBrowser()) {
  // Browser-specific code
}
```

#### `reloadPage(): void`
Reloads the current page with cache busting.

**Usage:**
```typescript
import { reloadPage } from '@/lib/utils/browser-utils';

// In a button click handler
<button onClick={reloadPage}>Reload</button>
```

## Format Utils (`format-utils.ts`)

### Purpose
Provides formatting utilities for various data types commonly used in the application.

### Functions

#### `formatTimeRemaining(milliseconds: number): string`
Formats time remaining in a human-readable format.

**Usage:**
```typescript
const time = formatTimeRemaining(65000); // Returns "1:05"
```

#### `formatChips(amount: number): string`
Formats chip amounts with proper separators and suffixes.

**Usage:**
```typescript
const chips = formatChips(1500); // Returns "1.5K"
```

## WebSocket Constants (`game.ts`)

### Purpose
Centralizes all WebSocket-related constants and configuration.

### Key Constants

- `WS_CONNECTION_TIMEOUT_MS`: WebSocket connection timeout (10s)
- `WS_HEARTBEAT_INTERVAL_MS`: Heartbeat interval (30s)
- `WS_MAX_MESSAGE_SIZE`: Maximum message size (16KB)
- `RECONNECT_MAX_ATTEMPTS`: Maximum reconnection attempts (10)

### Usage

```typescript
import { WS_CONNECTION_TIMEOUT_MS, RECONNECT_MAX_ATTEMPTS } from '@/lib/constants/game';

const timeout = WS_CONNECTION_TIMEOUT_MS; // 10000
const maxAttempts = RECONNECT_MAX_ATTEMPTS; // 10
```

## Best Practices

### Environment Variables
1. Always validate environment variables at startup
2. Use `getRequiredEnvVar` for required variables
3. Use `getOptionalEnvVar` for optional variables with defaults
4. Provide fallbacks for development environments

### Performance Monitoring
1. Monitor critical user interactions
2. Set appropriate thresholds for warnings
3. Use the decorator for automatic performance measurement
4. Check performance health regularly in development

### Error Handling
1. Wrap critical components with ErrorBoundary
2. Use specific error messages
3. Provide user-friendly fallbacks
4. Log errors for debugging

### Logging
1. Use appropriate log levels (info, warn, error)
2. Include relevant context in logs
3. Avoid logging sensitive information
4. Use consistent formatting

## Testing

### Environment Utils
```typescript
test('should validate WebSocket URL', () => {
  const result = validateWebSocketConfig();
  expect(result.isValid).toBe(true);
});
```

### Performance Monitor
```typescript
test('should record performance entry', () => {
  performanceMonitor.recordEntry({
    type: 'render',
    duration: 50,
    metadata: { component: 'TestComponent' }
  });
  
  const metrics = performanceMonitor.getMetrics();
  expect(metrics.renderTime).toBeGreaterThan(0);
});
```

### Error Boundary
```typescript
test('should catch component errors', () => {
  render(
    <ErrorBoundary>
      <BrokenComponent />
    </ErrorBoundary>
  );
  
  expect(screen.getByText('Something went wrong')).toBeInTheDocument();
});
```