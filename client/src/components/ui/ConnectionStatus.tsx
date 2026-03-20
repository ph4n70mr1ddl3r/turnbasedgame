"use client";

import React from "react";
import {
  useConnectionStore,
  connectionStatusSelector,
  latencySelector,
} from "@/lib/stores/connection-store";
import { ConnectionStatus as ConnectionStatusType } from "@/types/game-types";
import { reloadPage } from "@/lib/utils/browser-utils";
import { LATENCY_GOOD_THRESHOLD_MS } from "@/lib/constants/game";

const STATUS_COLORS: Record<ConnectionStatusType, string> = {
  connected: "bg-green-500",
  disconnected: "bg-red-500",
  reconnecting: "bg-yellow-500",
};

const STATUS_TEXT: Record<ConnectionStatusType, string> = {
  connected: "Connected",
  disconnected: "Disconnected",
  reconnecting: "Reconnecting...",
};

export function ConnectionStatusIndicator(): React.ReactElement {
  const connectionStatus = useConnectionStore(connectionStatusSelector);
  const latency = useConnectionStore(latencySelector);

  const currentColor = STATUS_COLORS[connectionStatus];
  const currentText = STATUS_TEXT[connectionStatus];
  
  return (
    <div 
      className="flex items-center space-x-4" 
      data-testid="connection-status-container"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <div className="flex items-center space-x-2">
        <div 
          className={`w-3 h-3 rounded-full ${currentColor} animate-pulse`}
          data-testid="connection-status-icon"
          aria-label={currentText}
        />
        <span className="font-medium" data-testid="connection-status">{currentText}</span>
      </div>
      
      {latency !== null && Number.isFinite(latency) && latency >= 0 && (
        <div className="text-sm bg-green-900 px-2 py-1 rounded flex items-center gap-1" aria-label={`Latency: ${latency}ms, ${latency < LATENCY_GOOD_THRESHOLD_MS ? 'good' : 'warning'}`}>
          {latency < LATENCY_GOOD_THRESHOLD_MS ? (
            <svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          ) : (
            <svg className="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          )}
          <span className="sr-only">{latency < LATENCY_GOOD_THRESHOLD_MS ? "Good" : "Warning"}</span>
          <span>{latency}ms</span>
        </div>
      )}
      
      {connectionStatus === "disconnected" && (
        <button
          onClick={reloadPage}
          className="text-sm bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded"
        >
          Reconnect
        </button>
      )}
    </div>
  );
}

export const ConnectionStatus = ConnectionStatusIndicator;