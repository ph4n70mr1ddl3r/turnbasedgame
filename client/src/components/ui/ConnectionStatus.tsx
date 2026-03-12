"use client";

import React from "react";
import {
  useConnectionStore,
  connectionStatusSelector,
  latencySelector,
} from "@/lib/stores/connection-store";
import { ConnectionStatus as ConnectionStatusType } from "@/types/game-types";
import { reloadPage } from "@/lib/utils/browser-utils";

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
      
      {latency !== null && (
        <div className="text-sm bg-green-900 px-2 py-1 rounded">
          {latency < 100 ? "✓" : "⚠"} {latency}ms
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