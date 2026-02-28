"use client";

import { Component, ReactNode, ErrorInfo } from "react";
import { logError } from "@/lib/utils/logger";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  retryKey: number;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, retryKey: 0 };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error, retryKey: 0 };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    logError("ErrorBoundary caught an error:", { error, errorInfo });
  }

  private handleRetry = (): void => {
    this.setState((prev) => ({ hasError: false, error: null, retryKey: prev.retryKey + 1 }));
  };

  private handleReload = (): void => {
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 p-4">
          <div className="max-w-md w-full bg-red-900 border border-red-700 rounded-lg p-6">
            <h2 className="text-xl font-bold text-white mb-4">Something went wrong</h2>
            <p className="text-red-200 mb-4">
              An unexpected error occurred. Please try again or reload the page.
            </p>
            {process.env.NODE_ENV === "development" && this.state.error && (
              <pre className="bg-red-950 p-2 rounded text-xs text-red-300 overflow-auto mb-4">
                {this.state.error.message}
              </pre>
            )}
            <div className="flex space-x-3">
              <button
                onClick={this.handleRetry}
                className="px-4 py-2 bg-red-700 hover:bg-red-600 rounded text-sm"
              >
                Try Again
              </button>
              <button
                onClick={this.handleReload}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm"
              >
                Reload Page
              </button>
            </div>
          </div>
        </div>
      );
    }

    return <div key={this.state.retryKey}>{this.props.children}</div>;
  }
}
