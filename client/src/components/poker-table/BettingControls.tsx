"use client";

import { useState, useEffect, useMemo } from "react";
import { BetAction, isValidBetAction } from "@/types/game-types";

interface BettingControlsProps {
  isMyTurn: boolean;
  availableActions: BetAction[];
  onBetAction: (_action: BetAction, _amount?: number) => void;
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

  useEffect(() => {
    setRaiseAmount(minBet);
  }, [minBet]);

  const validatedActions = availableActions.filter(isValidBetAction);

  const handleRaise = (): void => {
    const clampedAmount = Math.max(minBet, Math.min(maxBet, raiseAmount));
    onBetAction("raise", clampedAmount);
    setShowRaiseInput(false);
    setRaiseAmount(minBet);
  };

  const handleAction = (action: string): void => {
    if (isValidBetAction(action)) {
      onBetAction(action);
    }
  };

  const handleRaiseAmountChange = (value: string): void => {
    const numValue = parseInt(value, 10);
    if (!isNaN(numValue)) {
      setRaiseAmount(Math.max(0, numValue));
    }
  };

  const quickRaiseAmounts = useMemo(
    () => {
      const amounts = [minBet, minBet * 2, minBet * 3, maxBet]
        .map((amount) => Math.min(amount, maxBet))
        .filter((amount) => amount > 0 && amount >= minBet);
      return [...new Set(amounts)];
    },
    [minBet, maxBet],
  );
  
  if (!isMyTurn) {
    return (
      <div className="bg-gray-800 p-6 rounded-lg text-center">
        <div className="flex items-center justify-center space-x-2">
          <div className="w-4 h-4 bg-yellow-500 rounded-full animate-pulse" />
          <p className="text-xl font-semibold">Waiting for opponent&apos;s action...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-green-800 p-6 rounded-lg">
      <div className="flex flex-col md:flex-row items-center justify-between space-y-4 md:space-y-0">
        <div className="flex flex-wrap gap-3">
          {validatedActions.includes("check") && (
            <button
              onClick={() => handleAction("check")}
              aria-label="Check your hand"
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-bold text-white transition-colors"
            >
              Check
            </button>
          )}

          {validatedActions.includes("call") && (
            <button
              onClick={() => handleAction("call")}
              aria-label="Call the current bet"
              className="px-6 py-3 bg-green-600 hover:bg-green-700 rounded-lg font-bold text-white transition-colors"
            >
              Call
            </button>
          )}

          {validatedActions.includes("raise") && (
            <>
              {!showRaiseInput ? (
                <button
                  onClick={() => setShowRaiseInput(true)}
                  aria-label="Open raise amount input"
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
                    onChange={(e) => handleRaiseAmountChange(e.target.value)}
                    aria-label="Raise amount"
                    className="w-32 px-3 py-2 bg-white text-black rounded"
                  />
                  <button
                    onClick={handleRaise}
                    aria-label={`Raise by ${raiseAmount} chips`}
                    className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 rounded font-bold"
                  >
                    Raise {raiseAmount}
                  </button>
                  <button
                    onClick={() => {
                      setShowRaiseInput(false);
                      setRaiseAmount(minBet);
                    }}
                    aria-label="Cancel raise"
                    className="px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </>
          )}

          {validatedActions.includes("fold") && (
            <button
              onClick={() => handleAction("fold")}
              aria-label="Fold your hand"
              className="px-6 py-3 bg-red-600 hover:bg-red-700 rounded-lg font-bold text-white transition-colors"
            >
              Fold
            </button>
          )}
        </div>

        {showRaiseInput && quickRaiseAmounts.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <span className="text-green-300 mr-2">Quick raise:</span>
            {quickRaiseAmounts.map((amount) => (
              <button
                key={amount}
                onClick={() => {
                  const clamped = Math.max(minBet, Math.min(maxBet, amount));
                  onBetAction("raise", clamped);
                  setShowRaiseInput(false);
                }}
                aria-label={amount === maxBet ? "Go all-in" : `Raise to ${amount}`}
                className="px-3 py-1 bg-green-700 hover:bg-green-600 rounded text-sm"
              >
                {amount === maxBet ? "All-in" : amount}
              </button>
            ))}
          </div>
        )}

        <div className="text-sm text-green-300">
          <div>Min bet: {minBet}</div>
          <div>Max bet: {maxBet}</div>
        </div>
      </div>

      <div className="mt-4 text-center text-green-300 text-sm">
        {validatedActions.length === 0 ? (
          <p>No actions available. Waiting for game state.</p>
        ) : (
          <p>It&apos;s your turn! Choose an action above.</p>
        )}
      </div>
    </div>
  );
}