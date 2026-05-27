"use client";

import { useEffect, useState, type ReactElement } from "react";
import { performanceMonitor } from "@/lib/utils/performance-monitor";

interface PerformanceMonitorProps {
  showWarnings?: boolean;
  maxWarnings?: number;
}

export function PerformanceMonitorComponent({ 
  showWarnings = false, 
  maxWarnings = 3 
}: PerformanceMonitorProps): ReactElement | null {
  const [metrics, setMetrics] = useState(performanceMonitor.getMetrics());
  const [warnings, setWarnings] = useState<string[]>([]);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setMetrics(performanceMonitor.getMetrics());
      const perfCheck = performanceMonitor.checkPerformanceThresholds();
      setWarnings(perfCheck.warnings.slice(0, maxWarnings));
    }, 5000);

    return () => clearInterval(interval);
  }, [maxWarnings]);

  const toggleVisibility = (): void => {
    setIsVisible(!isVisible);
  };

  if (!isVisible) {
    return (
      <button
        onClick={toggleVisibility}
        className="fixed bottom-4 right-4 z-50 p-2 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 transition-colors"
        aria-label="Open performance monitor panel"
        title="Performance Monitor"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      </button>
    );
  }

  const isHealthy = warnings.length === 0;

  return (
    <div className="fixed bottom-4 right-4 z-50 w-80 bg-white rounded-lg shadow-xl border border-gray-200">
      <div className="flex items-center justify-between p-3 border-b border-gray-200">
        <h3 className="text-sm font-semibold text-gray-800">
          Performance Monitor
        </h3>
        <button
          onClick={toggleVisibility}
          className="p-1 hover:bg-gray-100 rounded"
          aria-label="Hide performance monitor"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="p-3 space-y-2">
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="bg-gray-50 p-2 rounded">
            <div className="text-gray-600">Render</div>
            <div className={`font-medium ${metrics.renderTime > 100 ? 'text-red-600' : 'text-green-600'}`}>
              {metrics.renderTime.toFixed(1)}ms
            </div>
          </div>
          <div className="bg-gray-50 p-2 rounded">
            <div className="text-gray-600">Load</div>
            <div className={`font-medium ${metrics.componentLoadTime > 200 ? 'text-red-600' : 'text-green-600'}`}>
              {metrics.componentLoadTime.toFixed(1)}ms
            </div>
          </div>
          <div className="bg-gray-50 p-2 rounded">
            <div className="text-gray-600">WS Latency</div>
            <div className={`font-medium ${metrics.websocketLatency > 200 ? 'text-red-600' : 'text-green-600'}`}>
              {metrics.websocketLatency.toFixed(1)}ms
            </div>
          </div>
          <div className="bg-gray-50 p-2 rounded">
            <div className="text-gray-600">Actions</div>
            <div className={`font-medium ${metrics.actionResponseTime > 1000 ? 'text-red-600' : 'text-green-600'}`}>
              {metrics.actionResponseTime.toFixed(1)}ms
            </div>
          </div>
        </div>

        {showWarnings && warnings.length > 0 && (
          <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded">
            <h4 className="text-xs font-semibold text-red-800 mb-1">Performance Warnings</h4>
            <ul className="text-xs text-red-700 space-y-1">
              {warnings.map((warning, index) => (
                <li key={index}>• {warning}</li>
              ))}
            </ul>
          </div>
        )}

        {isHealthy && (
          <div className="mt-3 p-2 bg-green-50 border border-green-200 rounded">
            <div className="flex items-center text-xs text-green-700">
              <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              All metrics within normal ranges
            </div>
          </div>
        )}
      </div>
    </div>
  );
}