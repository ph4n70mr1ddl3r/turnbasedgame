import React from "react";
import { PlayerState } from "@/types/game-types";
import { DEFAULT_TURN_TIME_MS } from "@/lib/constants/game";

interface PlayerSeatProps {
  player?: PlayerState;
  isCurrentPlayer: boolean;
}

export function PlayerSeat({ player, isCurrentPlayer }: PlayerSeatProps): React.ReactElement {
  if (!player) {
    return (
      <div className="bg-green-950/70 p-4 rounded-lg border-2 border-dashed border-green-700">
        <div className="text-center text-green-500">
          <div className="font-bold">Waiting for player...</div>
          <div className="text-sm">Empty seat</div>
        </div>
      </div>
    );
  }
  
  const { player_id, chip_stack, hole_cards, current_bet, is_folded, is_all_in, time_remaining } = player;
  
  // Determine seat styling based on position and state
  const seatClasses = [
    "p-4 rounded-lg min-w-48 transition-all duration-300",
    isCurrentPlayer ? "ring-4 ring-yellow-400 bg-green-900" : "bg-green-950/80",
    is_folded ? "opacity-60" : "",
  ].join(" ");
  
  return (
    <div
      className={seatClasses}
      role="region"
      aria-label={`${player_id === "p1" ? "Player 1" : "Player 2"} seat`}
    >
      {/* Player header */}
      <div className="flex justify-between items-start mb-3">
        <div>
          <div className="flex items-center space-x-2">
            <div className={`w-3 h-3 rounded-full ${isCurrentPlayer ? "bg-yellow-400 animate-pulse" : "bg-green-500"}`} />
            <h3 className="font-bold text-lg">{player_id === "p1" ? "Player 1" : "Player 2"}</h3>
          </div>
          {is_folded && (
            <span className="text-xs bg-red-900 px-2 py-1 rounded">FOLDED</span>
          )}
          {is_all_in && (
            <span className="text-xs bg-yellow-900 px-2 py-1 rounded">ALL-IN</span>
          )}
        </div>
        
        {/* Player status indicators */}
        <div className="text-right">
          <div className="text-2xl font-bold">${chip_stack}</div>
          <div className="text-sm text-green-300">Chips</div>
        </div>
      </div>
      
      {/* Hole cards */}
      <div className="mb-3">
        <div className="text-sm text-green-300 mb-1">Cards</div>
        <div className="flex space-x-2">
          {hole_cards && hole_cards.length > 0 ? (
            hole_cards.map((card) => (
              <div
                key={card}
                className="w-10 h-14 bg-white text-black rounded flex items-center justify-center font-bold shadow-md"
              >
                {card}
              </div>
            ))
          ) : (
            <div className="flex space-x-2">
              <div className="w-10 h-14 bg-green-900 border-2 border-green-700 rounded"></div>
              <div className="w-10 h-14 bg-green-900 border-2 border-green-700 rounded"></div>
            </div>
          )}
        </div>
      </div>
      
      {/* Current bet */}
      {current_bet > 0 && (
        <div className="mb-2">
          <div className="text-sm text-green-300">Current bet</div>
          <div className="text-xl font-bold text-yellow-300">${current_bet}</div>
        </div>
      )}
      
      {/* Timer (if current player) */}
      {isCurrentPlayer && time_remaining > 0 && (
        <div className="mt-2" aria-live="polite" aria-atomic="true">
          <div className="text-xs text-green-300 mb-1">Time remaining</div>
          <div className="w-full bg-green-900 h-2 rounded-full overflow-hidden">
            <div
              className="bg-yellow-500 h-full transition-all duration-1000"
              style={{ width: `${(time_remaining / DEFAULT_TURN_TIME_MS) * 100}%` }}
            />
          </div>
          <div className="text-xs text-right mt-1">
            {Math.ceil(time_remaining / 1000)}s
          </div>
        </div>
      )}
      
      {/* Position indicator */}
      <div className="mt-2 text-xs text-center text-green-400">
        {player.position !== "none" && (
          <span className="bg-green-800 px-2 py-1 rounded">
            {player.position.replace("_", " ").toUpperCase()}
          </span>
        )}
      </div>
    </div>
  );
}