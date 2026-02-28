"use client";

import {
  useConnectionStore,
  connectionStatusSelector,
  isConnectedSelector,
  latencySelector,
} from "@/lib/stores/connection-store";

export function ConnectionStatus() {
  const isConnected = useConnectionStore(isConnectedSelector);
  const connectionStatus = useConnectionStore(connectionStatusSelector);
  const latency = useConnectionStore(latencySelector);

  const statusColors = {
    connected: "bg-green-500",
    disconnected: "bg-red-500",
    reconnecting: "bg-yellow-500",
  };

  const statusText = {
    connected: "Connected",
    disconnected: "Disconnected",
    reconnecting: "Reconnecting...",
  };
  
  const currentColor = statusColors[connectionStatus] || "bg-gray-500";
  const currentText = statusText[connectionStatus] || connectionStatus;
  
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
      
      {latency && (
        <div className="text-sm bg-green-900 px-2 py-1 rounded">
          {latency < 100 ? "✓" : "⚠"} {latency}ms
        </div>
      )}
      
      {!isConnected && connectionStatus === "disconnected" && (
        <button
          onClick={() => window.location.reload()}
          className="text-sm bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded"
        >
          Reconnect
        </button>
      )}
    </div>
  );
}