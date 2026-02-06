"use client";

import { useState } from "react";

interface BettingControlsProps {
  isMyTurn: boolean;
  availableActions: string[];
  onBetAction: (_action: string, _amount?: number) => void;  
  minBet: number;
  maxBet: number;
}

export function BettingControls({
  isMyTurn,
  availableActions,
  onBetAction,
  minBet,
  maxBet,
}: BettingControlsProps) {
  const [raiseAmount, setRaiseAmount] = useState(minBet);
  const [showRaiseInput, setShowRaiseInput] = useState(false);
  
  // Handle raise action
  const handleRaise = () => {
    if (raiseAmount >= minBet && raiseAmount <= maxBet) {
      onBetAction("raise", raiseAmount);
      setShowRaiseInput(false);
    }
  };
  
  // Quick raise buttons
  const quickRaiseAmounts = [minBet, minBet * 2, minBet * 3, maxBet];
  
  if (!isMyTurn) {
    return (
      <div className="bg-gray-800 p-6 rounded-lg text-center">
        <div className="flex items-center justify-center space-x-2">
          <div className="w-4 h-4 bg-yellow-500 rounded-full animate-pulse" />
          <p className="text-xl font-semibold">Waiting for opponent's action...</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="bg-green-800 p-6 rounded-lg">
      <div className="flex flex-col md:flex-row items-center justify-between space-y-4 md:space-y-0">
        {/* Action buttons */}
        <div className="flex flex-wrap gap-3">
          {availableActions.includes("check") && (
            <button
              onClick={() => onBetAction("check")}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-bold text-white transition-colors"
            >
              Check
            </button>
          )}
          
          {availableActions.includes("call") && (
            <button
              onClick={() => onBetAction("call")}
              className="px-6 py-3 bg-green-600 hover:bg-green-700 rounded-lg font-bold text-white transition-colors"
            >
              Call
            </button>
          )}
          
          {availableActions.includes("raise") && (
            <>
              {!showRaiseInput ? (
                <button
                  onClick={() => setShowRaiseInput(true)}
                  className="px-6 py-3 bg-yellow-600 hover:bg-yellow-700 rounded-lg font-bold text-white transition-colors"
                >
                  Raise
                </button>
              ) : (
                <div className="flex items-center space-x-2">
                  <input
                    type="number"
                    min={minBet}
                    max={maxBet}
                    value={raiseAmount}
                    onChange={(e) => setRaiseAmount(Number(e.target.value))}
                    className="w-32 px-3 py-2 bg-white text-black rounded"
                  />
                  <button
                    onClick={handleRaise}
                    className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 rounded font-bold"
                  >
                    Raise {raiseAmount}
                  </button>
                  <button
                    onClick={() => setShowRaiseInput(false)}
                    className="px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </>
          )}
          
          {availableActions.includes("fold") && (
            <button
              onClick={() => onBetAction("fold")}
              className="px-6 py-3 bg-red-600 hover:bg-red-700 rounded-lg font-bold text-white transition-colors"
            >
              Fold
            </button>
          )}
        </div>
        
        {/* Quick raise buttons (when raise input is shown) */}
        {showRaiseInput && (
          <div className="flex flex-wrap gap-2">
            <span className="text-green-300 mr-2">Quick raise:</span>
            {quickRaiseAmounts.map((amount) => (
              <button
                key={amount}
                onClick={() => {
                  setRaiseAmount(amount);
                  handleRaise();
                }}
                className="px-3 py-1 bg-green-700 hover:bg-green-600 rounded text-sm"
              >
                {amount === maxBet ? "All-in" : amount}
              </button>
            ))}
          </div>
        )}
        
        {/* Betting limits */}
        <div className="text-sm text-green-300">
          <div>Min bet: {minBet}</div>
          <div>Max bet: {maxBet}</div>
        </div>
      </div>
      
      {/* Action hints */}
      <div className="mt-4 text-center text-green-300 text-sm">
        {availableActions.length === 0 ? (
          <p>No actions available. Waiting for game state.</p>
        ) : (
          <p>It's your turn! Choose an action above.</p>
        )}
      </div>
    </div>
  );
}