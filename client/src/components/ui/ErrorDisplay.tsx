"use client";

import React from "react";

interface ErrorDisplayProps {
  error: string;
  onClose: () => void;
}

function handleReload(): void {
  if (typeof window !== "undefined") {
    window.location.reload();
  }
}

export function ErrorDisplay({ error, onClose }: ErrorDisplayProps): React.ReactElement | null {
  return (
    <div className="fixed top-4 right-4 w-96 bg-red-900 border-l-4 border-red-500 rounded-lg shadow-xl z-50 animate-slide-in">
      <div className="p-4">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <div className="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center">
              <span className="text-white font-bold">!</span>
            </div>
          </div>
          <div className="ml-3 flex-1">
            <h3 className="text-lg font-bold text-white">Error</h3>
            <div className="mt-1 text-red-200">
              {error}
            </div>
          </div>
          <button
            onClick={onClose}
            className="ml-4 text-red-300 hover:text-white"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="mt-4 flex justify-end space-x-3">
          <button
            onClick={handleReload}
            className="px-3 py-1 bg-red-700 hover:bg-red-600 rounded text-sm"
          >
            Reload Page
          </button>
          <button
            onClick={onClose}
            className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}