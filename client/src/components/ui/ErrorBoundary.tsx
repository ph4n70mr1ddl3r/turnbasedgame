"use client";

import { Component, ReactNode, ErrorInfo } from "react";
import { logError } from "@/lib/utils/logger";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    logError("ErrorBoundary caught an error:", error);
    logError("Component stack:", errorInfo.componentStack);
    // Only set errorInfo here since getDerivedStateFromError already set hasError and error
    this.setState({ errorInfo });
  }

  handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
    // Clear any persisted error in game store so the retry starts clean
    import('@/lib/stores/game-store')
      .then(({ useGameStore }) => useGameStore.getState().clearError())
      .catch(() => {
        // Game store may not be available in all contexts
      });
  };

  handleReload = (): void => {
    window.location.reload();
  };

  handleBackToHome = (): void => {
    window.location.assign('/');
  };

  render(): ReactNode {
    if (this.state.hasError) {
      // You can render any custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // User-friendly error messages based on error type
      const getErrorMessage = () => {
        if (!this.state.error) return 'An unexpected error occurred.';
        
        const errorStr = this.state.error.message.toLowerCase();
        
        if (errorStr.includes('network') || errorStr.includes('connection')) {
          return 'Network connection error. Please check your internet connection and try again.';
        }
        
        if (errorStr.includes('timeout')) {
          return 'Request timeout. The server took too long to respond. Please try again.';
        }
        
        if (errorStr.includes('websocket')) {
          return 'Connection error. Unable to connect to the game server.';
        }
        
        if (errorStr.includes('invalid') || errorStr.includes('unauthorized')) {
          return 'Authentication error. Please log in again.';
        }
        
        if (errorStr.includes('server') || errorStr.includes('internal')) {
          return 'Server error. Our team has been notified. Please try again later.';
        }
        
        return 'An unexpected error occurred. Please try again.';
      };

      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-red-50">
          <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6 border border-red-200">
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
                <svg
                  className="h-6 w-6 text-red-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Oops! Something went wrong
              </h3>
              <p className="text-sm text-gray-500 mb-4">
                {getErrorMessage()}
              </p>
              
              {process.env.NODE_ENV === 'development' && this.state.error && (
                <details className="text-left mb-4">
                  <summary className="text-sm font-medium text-gray-700 cursor-pointer hover:text-gray-900">
                    Technical Details (Development)
                  </summary>
                  <div className="mt-2 text-xs text-gray-600 bg-gray-100 p-2 rounded overflow-auto max-h-40">
                    <p className="font-mono text-red-600">{this.state.error.toString()}</p>
                    {this.state.errorInfo && (
                      <pre className="mt-2 text-xs text-gray-700 overflow-x-auto">
                        {this.state.errorInfo.componentStack}
                      </pre>
                    )}
                  </div>
                </details>
              )}
              
              <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3 justify-center">
                <button
                  onClick={this.handleReset}
                  className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors duration-200"
                >
                  Try Again
                </button>
                <button
                  onClick={this.handleReload}
                  className="px-4 py-2 bg-gray-600 text-white text-sm font-medium rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-colors duration-200"
                >
                  Refresh Page
                </button>
                <button
                  onClick={this.handleBackToHome}
                  className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200"
                >
                  Back to Home
                </button>
              </div>
              
              <p className="text-xs text-gray-400 mt-4">
                Error ID: {this.state.error?.message ? this.state.error.message.slice(0, 8) : 'unknown'}
              </p>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Wrapper component for easier usage
interface ErrorBoundaryWrapperProps {
  children: ReactNode;
  fallback?: ReactNode;
}

export function ErrorBoundaryWrapper({ children, fallback }: ErrorBoundaryWrapperProps): ReactNode {
  return (
    <ErrorBoundary fallback={fallback}>
      {children}
    </ErrorBoundary>
  );
}