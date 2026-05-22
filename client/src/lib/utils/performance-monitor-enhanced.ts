/**
 * Enhanced performance monitoring utilities with real-time tracking,
  * metrics collection, and performance optimization features.
 */

import { logError, logWarn, logInfo } from './logger';

// Performance metrics types
export interface PerformanceMetric {
  name: string;
  value: number;
  unit: string;
  timestamp: number;
  tags?: Record<string, string>;
}

export interface PerformanceMetrics {
  render: PerformanceMetric[];
  network: PerformanceMetric[];
  memory: PerformanceMetric[];
  custom: PerformanceMetric[];
  errors: PerformanceMetric[];
}

// Performance thresholds
export interface PerformanceThresholds {
  slowRenderTime: number;     // ms
  slowNetworkTime: number;     // ms
  slowMemoryUsage: number;     // bytes
  maxErrorRate: number;        // errors per minute
  highCpuUsage: number;        // percentage
}

// Default performance thresholds
export const DEFAULT_PERFORMANCE_THRESHOLDS: PerformanceThresholds = {
  slowRenderTime: 100,      // 100ms for slow render
  slowNetworkTime: 5000,    // 5s for slow network
  slowMemoryUsage: 50 * 1024 * 1024, // 50MB for slow memory
  maxErrorRate: 10,         // 10 errors per minute
  highCpuUsage: 80,         // 80% CPU usage
};

// Performance metric categories
export enum MetricCategory {
  RENDER = 'render',
  NETWORK = 'network',
  MEMORY = 'memory',
  CUSTOM = 'custom',
  ERROR = 'error',
}

// Performance monitoring configuration
export interface PerformanceConfig {
  enabled: boolean;
  thresholds: PerformanceThresholds;
  maxMetrics: number;
  reportingInterval: number;
  alertCallbacks: ((metric: PerformanceMetric) => void)[];
}

// Default performance configuration
export const DEFAULT_PERFORMANCE_CONFIG: PerformanceConfig = {
  enabled: true,
  thresholds: DEFAULT_PERFORMANCE_THRESHOLDS,
  maxMetrics: 1000,
  reportingInterval: 30000, // 30 seconds
  alertCallbacks: [],
};

// Performance monitor class
export class PerformanceMonitor {
  private metrics: PerformanceMetrics = {
    render: [],
    network: [],
    memory: [],
    custom: [],
    errors: [],
  };

  private config: PerformanceConfig;
  private intervals: NodeJS.Timeout[] = [];
  private isInitialized = false;

  constructor(config: Partial<PerformanceConfig> = {}) {
    this.config = { ...DEFAULT_PERFORMANCE_CONFIG, ...config };
  }

  // Initialize performance monitoring
  initialize(): void {
    if (this.isInitialized) {
      logWarn('Performance monitor already initialized');
      return;
    }

    this.isInitialized = true;

    if (this.config.enabled) {
      // Start periodic metrics collection
      this.startPeriodicCollection();
      
      // Start performance reporting
      this.startPeriodicReporting();
      
      // Monitor navigation changes
      this.monitorNavigation();
      
      // Monitor visibility changes
      this.monitorVisibility();
      
      logInfo('Performance monitoring initialized');
    }
  }

  // Cleanup performance monitoring
  destroy(): void {
    this.isInitialized = false;
    
    // Clear all intervals
    this.intervals.forEach(interval => clearInterval(interval));
    this.intervals = [];
    
    // Clear metrics
    this.metrics = {
      render: [],
      network: [],
      memory: [],
      custom: [],
      errors: [],
    };
    
    logInfo('Performance monitoring destroyed');
  }

  // Track performance metrics
  trackMetric(
    name: string,
    value: number,
    unit: string,
    category: MetricCategory,
    tags?: Record<string, string>
  ): void {
    if (!this.config.enabled) return;

    const metric: PerformanceMetric = {
      name,
      value,
      unit,
      timestamp: Date.now(),
      tags,
    };

    // Add metric to appropriate category
    switch (category) {
      case MetricCategory.RENDER:
        this.metrics.render.push(metric);
        break;
      case MetricCategory.NETWORK:
        this.metrics.network.push(metric);
        break;
      case MetricCategory.MEMORY:
        this.metrics.memory.push(metric);
        break;
      case MetricCategory.CUSTOM:
        this.metrics.custom.push(metric);
        break;
      case MetricCategory.ERROR:
        this.metrics.errors.push(metric);
        break;
    }

    // Check performance thresholds
    this.checkThresholds(metric);

    // Enforce max metrics limit
    this.enforceMaxMetrics();
  }

  // Track render performance
  trackRenderTime(componentName: string, renderTime: number): void {
    this.trackMetric(
      `${componentName} render time`,
      renderTime,
      'ms',
      MetricCategory.RENDER,
      { component: componentName }
    );
  }

  // Track network performance
  trackNetworkTime(endpoint: string, responseTime: number): void {
    this.trackMetric(
      `${endpoint} response time`,
      responseTime,
      'ms',
      MetricCategory.NETWORK,
      { endpoint }
    );
  }

  // Track memory usage
  trackMemoryUsage(componentName: string, memoryUsage: number): void {
    this.trackMetric(
      `${componentName} memory usage`,
      memoryUsage,
      'bytes',
      MetricCategory.MEMORY,
      { component: componentName }
    );
  }

  // Track custom metrics
  trackCustomMetric(name: string, value: number, unit: string, tags?: Record<string, string>): void {
    this.trackMetric(name, value, unit, MetricCategory.CUSTOM, tags);
  }

  // Track errors
  trackError(errorName: string, errorCount: number): void {
    this.trackMetric(
      errorName,
      errorCount,
      'count',
      MetricCategory.ERROR,
      { error: errorName }
    );
  }

  // Get performance metrics
  getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  // Get performance summary
  getSummary(): {
    totalMetrics: number;
    averageRenderTime: number;
    averageNetworkTime: number;
    averageMemoryUsage: number;
    errorCount: number;
    slowOperations: PerformanceMetric[];
  } {
    const allMetrics = [
      ...this.metrics.render,
      ...this.metrics.network,
      ...this.metrics.memory,
      ...this.metrics.custom,
      ...this.metrics.errors,
    ];

    const renderMetrics = this.metrics.render;
    const networkMetrics = this.metrics.network;
    const memoryMetrics = this.metrics.memory;
    const errorMetrics = this.metrics.errors;

    const slowOperations = allMetrics.filter(metric => {
      if (metric.unit === 'ms' && metric.value > this.config.thresholds.slowNetworkTime) {
        return true;
      }
      if (metric.unit === 'bytes' && metric.value > this.config.thresholds.slowMemoryUsage) {
        return true;
      }
      return false;
    });

    return {
      totalMetrics: allMetrics.length,
      averageRenderTime: renderMetrics.length > 0 
        ? renderMetrics.reduce((sum, m) => sum + m.value, 0) / renderMetrics.length 
        : 0,
      averageNetworkTime: networkMetrics.length > 0 
        ? networkMetrics.reduce((sum, m) => sum + m.value, 0) / networkMetrics.length 
        : 0,
      averageMemoryUsage: memoryMetrics.length > 0 
        ? memoryMetrics.reduce((sum, m) => sum + m.value, 0) / memoryMetrics.length 
        : 0,
      errorCount: errorMetrics.length,
      slowOperations,
    };
  }

  // Add alert callback
  addAlertCallback(callback: (metric: PerformanceMetric) => void): void {
    this.config.alertCallbacks.push(callback);
  }

  // Remove alert callback
  removeAlertCallback(callback: (metric: PerformanceMetric) => void): void {
    const index = this.config.alertCallbacks.indexOf(callback);
    if (index > -1) {
      this.config.alertCallbacks.splice(index, 1);
    }
  }

  // Start periodic metrics collection
  private startPeriodicCollection(): void {
    // Monitor memory usage every 5 seconds
    this.intervals.push(setInterval(() => {
      this.collectMemoryMetrics();
    }, 5000));

    // Monitor performance API metrics every 1 second
    this.intervals.push(setInterval(() => {
      this.collectPerformanceAPIMetrics();
    }, 1000));
  }

  // Start periodic reporting
  private startPeriodicReporting(): void {
    this.intervals.push(setInterval(() => {
      this.reportMetrics();
    }, this.config.reportingInterval));
  }

  // Monitor navigation changes
  private monitorNavigation(): void {
    if (typeof window !== 'undefined') {
      window.addEventListener('popstate', () => {
        this.trackCustomMetric('navigation', 1, 'count', { type: 'popstate' });
      });

      window.addEventListener('pushstate', () => {
        this.trackCustomMetric('navigation', 1, 'count', { type: 'pushstate' });
      });

      window.addEventListener('replacestate', () => {
        this.trackCustomMetric('navigation', 1, 'count', { type: 'replacestate' });
      });
    }
  }

  // Monitor visibility changes
  private monitorVisibility(): void {
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        this.trackCustomMetric(
          'visibility_change',
          document.visibilityState === 'visible' ? 1 : 0,
          'count',
          { state: document.visibilityState }
        );
      });
    }
  }

  // Collect memory metrics
  private collectMemoryMetrics(): void {
    if (typeof performance !== 'undefined' && performance.memory) {
      const memory = performance.memory;
      this.trackMemoryUsage('total', memory.usedJSHeapSize);
      this.trackMemoryUsage('total_limit', memory.jsHeapSizeLimit);
      this.trackMemoryUsage('total_used', memory.totalJSHeapSize);
    }
  }

  // Collect Performance API metrics
  private collectPerformanceAPIMetrics(): void {
    if (typeof performance !== 'undefined') {
      // Collect navigation timing metrics
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      if (navigation) {
        this.trackNetworkTime('page_load', navigation.loadEventEnd - navigation.navigationStart);
      }

      // Collect resource timing metrics
      const resources = performance.getEntriesByType('resource');
      resources.forEach(resource => {
        if (resource.duration > this.config.thresholds.slowNetworkTime) {
          this.trackNetworkTime(resource.name, resource.duration);
        }
      });

      // Collect paint timing metrics
      const paints = performance.getEntriesByType('paint');
      paints.forEach(paint => {
        this.trackCustomMetric(`${paint.name} paint`, paint.startTime, 'ms', { type: paint.name });
      });
    }
  }

  // Check performance thresholds
  private checkThresholds(metric: PerformanceMetric): void {
    // Check slow render time
    if (metric.unit === 'ms' && metric.value > this.config.thresholds.slowRenderTime) {
      logWarn(`Slow render detected: ${metric.name} took ${metric.value}ms`);
      this.notifyAlert(metric);
    }

    // Check slow network time
    if (metric.unit === 'ms' && metric.value > this.config.thresholds.slowNetworkTime) {
      logWarn(`Slow network detected: ${metric.name} took ${metric.value}ms`);
      this.notifyAlert(metric);
    }

    // Check slow memory usage
    if (metric.unit === 'bytes' && metric.value > this.config.thresholds.slowMemoryUsage) {
      logWarn(`High memory usage detected: ${metric.name} used ${metric.value} bytes`);
      this.notifyAlert(metric);
    }

    // Check error rate
    if (metric.unit === 'count' && metric.name.includes('error')) {
      const recentErrors = this.metrics.errors.filter(
        m => m.timestamp > Date.now() - 60000 // Last minute
      );
      
      if (recentErrors.length > this.config.thresholds.maxErrorRate) {
        logWarn(`High error rate detected: ${recentErrors.length} errors in last minute`);
        this.notifyAlert(metric);
      }
    }
  }

  // Notify alert callbacks
  private notifyAlert(metric: PerformanceMetric): void {
    this.config.alertCallbacks.forEach(callback => {
      try {
        callback(metric);
      } catch (error) {
        logError('Error in performance alert callback:', error);
      }
    });
  }

  // Enforce max metrics limit
  private enforceMaxMetrics(): void {
    const maxMetrics = this.config.maxMetrics;
    const totalMetrics = this.getTotalMetricsCount();
    
    if (totalMetrics > maxMetrics) {
      // Remove oldest metrics from each category
      Object.keys(this.metrics).forEach(category => {
        const categoryMetrics = this.metrics[category as keyof PerformanceMetrics];
        const excess = totalMetrics - maxMetrics;
        
        if (excess > 0 && categoryMetrics.length > 0) {
          const removeCount = Math.min(excess, categoryMetrics.length);
          categoryMetrics.splice(0, removeCount);
        }
      });
    }
  }

  // Get total metrics count
  private getTotalMetricsCount(): number {
    return Object.values(this.metrics).reduce((sum, metrics) => sum + metrics.length, 0);
  }

  // Report metrics
  private reportMetrics(): void {
    const summary = this.getSummary();
    
    logInfo('Performance metrics summary:', {
      totalMetrics: summary.totalMetrics,
      averageRenderTime: summary.averageRenderTime.toFixed(2) + 'ms',
      averageNetworkTime: summary.averageNetworkTime.toFixed(2) + 'ms',
      averageMemoryUsage: this.formatBytes(summary.averageMemoryUsage),
      errorCount: summary.errorCount,
      slowOperations: summary.slowOperations.length,
    });

    // If there are slow operations, log them
    if (summary.slowOperations.length > 0) {
      logWarn('Slow operations detected:', {
        slowOperations: summary.slowOperations.map(m => ({
          name: m.name,
          value: m.value + m.unit,
          tags: m.tags,
        })),
      });
    }
  }

  // Format bytes for human readability
  private formatBytes(bytes: number): string {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  }
}

// Global performance monitor instance
export const globalPerformanceMonitor = new PerformanceMonitor();

// Performance monitoring hooks
export function usePerformance(componentName: string) {
  return {
    trackRenderTime: (renderTime: number) => {
      globalPerformanceMonitor.trackRenderTime(componentName, renderTime);
    },
    trackCustomMetric: (name: string, value: number, unit: string, tags?: Record<string, string>) => {
      globalPerformanceMonitor.trackCustomMetric(`${componentName}_${name}`, value, unit, { ...tags, component: componentName });
    },
    trackError: (errorName: string, errorCount: number) => {
      globalPerformanceMonitor.trackError(`${componentName}_${errorName}`, errorCount);
    },
  };
}

// Performance monitoring decorators
export function measurePerformance<T>(
  target: any,
  propertyKey: string,
  descriptor: PropertyDescriptor
) {
  const originalMethod = descriptor.value;

  descriptor.value = function (...args: any[]) {
    const startTime = performance.now();
    const result = originalMethod.apply(this, args);
    const endTime = performance.now();

    globalPerformanceMonitor.trackCustomMetric(
      `${propertyKey} execution time`,
      endTime - startTime,
      'ms',
      { method: propertyKey }
    );

    return result;
  };

  return descriptor;
}

// Initialize performance monitoring on module load
if (typeof window !== 'undefined') {
  globalPerformanceMonitor.initialize();
  
  // Cleanup on page unload
  window.addEventListener('beforeunload', () => {
    globalPerformanceMonitor.destroy();
  });
}

export { PerformanceMonitor, globalPerformanceMonitor };
export type { PerformanceMetric, PerformanceMetrics, PerformanceConfig, PerformanceThresholds };