/**
 * Performance monitoring utilities for tracking application performance
 */

interface PerformanceMetrics {
  renderTime: number;
  componentLoadTime: number;
  websocketLatency: number;
  actionResponseTime: number;
}

interface PerformanceEntry {
  timestamp: number;
  type: 'render' | 'load' | 'websocket' | 'action';
  duration: number;
  metadata?: Record<string, unknown>;
}

class PerformanceMonitor {
  private metrics: PerformanceMetrics = {
    renderTime: 0,
    componentLoadTime: 0,
    websocketLatency: 0,
    actionResponseTime: 0,
  };

  private entries: PerformanceEntry[] = [];
  private maxEntries = 100;

  /**
   * Records a performance entry
   */
  recordEntry(entry: Omit<PerformanceEntry, 'timestamp'>): void {
    const fullEntry: PerformanceEntry = {
      timestamp: Date.now(),
      ...entry,
    };
    
    this.entries.push(fullEntry);

    // Keep only recent entries
    if (this.entries.length > this.maxEntries) {
      this.entries.shift();
    }

    // Update aggregated metrics
    this.updateMetrics(fullEntry);
  }

  /**
   * Updates aggregated metrics from entry
   */
  private updateMetrics(entry: PerformanceEntry): void {
    switch (entry.type) {
      case 'render':
        this.metrics.renderTime = this.calculateAverage(entry.type);
        break;
      case 'load':
        this.metrics.componentLoadTime = this.calculateAverage(entry.type);
        break;
      case 'websocket':
        this.metrics.websocketLatency = this.calculateAverage(entry.type);
        break;
      case 'action':
        this.metrics.actionResponseTime = this.calculateAverage(entry.type);
        break;
    }
  }

  /**
   * Calculates average duration for a specific entry type
   */
  private calculateAverage(type: PerformanceEntry['type']): number {
    const entries = this.entries.filter(entry => entry.type === type);
    if (entries.length === 0) return 0;

    const total = entries.reduce((sum, entry) => sum + entry.duration, 0);
    return total / entries.length;
  }

  /**
   * Records component render time
   */
  recordRenderTime(componentName: string, duration: number): void {
    this.recordEntry({
      type: 'render',
      duration,
      metadata: { component: componentName },
    });
  }

  /**
   * Records component load time
   */
  recordComponentLoadTime(componentName: string, duration: number): void {
    this.recordEntry({
      type: 'load',
      duration,
      metadata: { component: componentName },
    });
  }

  /**
   * Records WebSocket latency
   */
  recordWebSocketLatency(duration: number): void {
    this.recordEntry({
      type: 'websocket',
      duration,
    });
  }

  /**
   * Records action response time
   */
  recordActionResponseTime(action: string, duration: number): void {
    this.recordEntry({
      type: 'action',
      duration,
      metadata: { action },
    });
  }

  /**
   * Gets current performance metrics
   */
  getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  /**
   * Gets performance entries for a specific type
   */
  getEntries(type?: PerformanceEntry['type']): PerformanceEntry[] {
    if (!type) {
      return [...this.entries];
    }
    return this.entries.filter(entry => entry.type === type);
  }

  /**
   * Checks if performance is within acceptable thresholds
   */
  checkPerformanceThresholds(): {
    isHealthy: boolean;
    warnings: string[];
  } {
    const warnings: string[] = [];

    // Check render time
    if (this.metrics.renderTime > 100) {
      warnings.push(`High average render time: ${this.metrics.renderTime.toFixed(2)}ms`);
    }

    // Check component load time
    if (this.metrics.componentLoadTime > 200) {
      warnings.push(`High average component load time: ${this.metrics.componentLoadTime.toFixed(2)}ms`);
    }

    // Check WebSocket latency
    if (this.metrics.websocketLatency > 200) {
      warnings.push(`High WebSocket latency: ${this.metrics.websocketLatency.toFixed(2)}ms`);
    }

    // Check action response time
    if (this.metrics.actionResponseTime > 1000) {
      warnings.push(`High action response time: ${this.metrics.actionResponseTime.toFixed(2)}ms`);
    }

    return {
      isHealthy: warnings.length === 0,
      warnings,
    };
  }

  /**
   * Resets all metrics and entries
   */
  reset(): void {
    this.metrics = {
      renderTime: 0,
      componentLoadTime: 0,
      websocketLatency: 0,
      actionResponseTime: 0,
    };
    this.entries = [];
  }

  /**
   * Gets performance summary for debugging
   */
  getSummary(): string {
    const { isHealthy, warnings } = this.checkPerformanceThresholds();
    
    let summary = `Performance Summary (Healthy: ${isHealthy})\n`;
    summary += `-------------------------------\n`;
    summary += `Render Time: ${this.metrics.renderTime.toFixed(2)}ms\n`;
    summary += `Component Load: ${this.metrics.componentLoadTime.toFixed(2)}ms\n`;
    summary += `WebSocket Latency: ${this.metrics.websocketLatency.toFixed(2)}ms\n`;
    summary += `Action Response: ${this.metrics.actionResponseTime.toFixed(2)}ms\n`;
    summary += `Total Entries: ${this.entries.length}\n`;

    if (warnings.length > 0) {
      summary += `\nWarnings:\n`;
      warnings.forEach(warning => summary += `- ${warning}\n`);
    }

    return summary;
  }
}

// Global instance
export const performanceMonitor = new PerformanceMonitor();

// Performance measurement decorator
export function measurePerformance(type: PerformanceEntry['type'], metadata?: Record<string, unknown>) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return function (_target: any, _propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = function (this: unknown, ...args: unknown[]) {
      const startTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
      
      try {
        const result = originalMethod.apply(this, args);
        
        if (result instanceof Promise) {
          return result.finally(() => {
            const endTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
            performanceMonitor.recordEntry({
              type,
              duration: endTime - startTime,
              metadata,
            });
          });
        } else {
          const endTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
          performanceMonitor.recordEntry({
            type,
            duration: endTime - startTime,
            metadata,
          });
          return result;
        }
      } catch (error) {
        const endTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
        performanceMonitor.recordEntry({
          type,
          duration: endTime - startTime,
          metadata: { ...metadata, error: error instanceof Error ? error.message : 'Unknown error' },
        });
        throw error;
      }
    };

    return descriptor;
  };
}