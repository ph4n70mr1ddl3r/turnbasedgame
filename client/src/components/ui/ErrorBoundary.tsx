"use client";

import { Component, ReactNode, ErrorInfo } from "react";
import { logError } from "@/lib/utils/logger";
import { reloadPage } from "@/lib/utils/browser-utils";
import { useConnectionStore } from "@/lib/stores/connection-store";
import { useGameStore } from "@/lib/stores/game-store";

const IS_DEV = process.env.NODE_ENV === "development";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    logError("ErrorBoundary caught an error:", { error, errorInfo });
    queueMicrotask(() => {
      useGameStore.getState().reset();
      useConnectionStore.getState().reset();
    });
  }

  private handleRetry = (): void => {
    useGameStore.getState().reset();
    useConnectionStore.getState().reset();
    this.setState({ hasError: false, error: null });
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
            {IS_DEV && this.state.error && (
              <div className="bg-red-950 p-3 rounded text-xs text-red-300 overflow-auto mb-4 max-h-48">
                <p className="font-bold mb-1">{this.state.error.message}</p>
                {this.state.error.stack && (
                  <pre className="whitespace-pre-wrap">{this.state.error.stack}</pre>
                )}
              </div>
            )}
            <div className="flex space-x-3">
              <button
                onClick={this.handleRetry}
                className="px-4 py-2 bg-red-700 hover:bg-red-600 rounded text-sm"
              >
                Try Again
              </button>
              <button
                onClick={reloadPage}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm"
              >
                Reload Page
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
