"use client";

import { useWebSocket } from "@/hooks/useWebSocket";

export function ConnectionStatus() {
  const { isConnected, connectionStatus, latency } = useWebSocket({
    autoConnect: true,
  });
  
  // Status color mapping
  const statusColors = {
    connected: "bg-green-500",
    disconnected: "bg-red-500",
    reconnecting: "bg-yellow-500",
    waiting: "bg-yellow-300",
    failed: "bg-red-700",
  };
  
  const statusText = {
    connected: "Connected",
    disconnected: "Disconnected",
    reconnecting: "Reconnecting...",
    waiting: "Waiting",
    failed: "Connection Failed",
  };
  
  const currentColor = statusColors[connectionStatus] || "bg-gray-500";
  const currentText = statusText[connectionStatus] || connectionStatus;
  
  return (
    <div className="flex items-center space-x-4">
      {/* Connection status indicator */}
      <div className="flex items-center space-x-2">
        <div className={`w-3 h-3 rounded-full ${currentColor} animate-pulse`} />
        <span className="font-medium">{currentText}</span>
      </div>
      
      {/* Latency indicator */}
      {latency && (
        <div className="text-sm bg-green-900 px-2 py-1 rounded">
          {latency < 100 ? "✓" : "⚠"} {latency}ms
        </div>
      )}
      
      {/* Reconnect button for disconnected state */}
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