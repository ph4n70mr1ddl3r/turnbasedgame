"use client";

import React, { useState, useMemo, useRef, useCallback, useEffect, memo } from "react";
import { BetAction, isValidBetAction } from "@/types/game-types";
import { MAX_QUICK_RAISE_OPTIONS, UI_ACTION_COOLDOWN_MS, UI_ACTION_PROCESSING_DELAY_MS, UI_MAX_BET_INPUT_LENGTH } from "@/lib/constants/game";

interface BettingControlsProps {
  isMyTurn: boolean;
  availableActions: BetAction[];
  onBetAction: (action: BetAction, amount?: number) => void;
  minBet: number;
  maxBet: number;
}

function BettingControlsInner({
  isMyTurn,
  availableActions,
  onBetAction,
  minBet,
  maxBet,
}: BettingControlsProps): React.ReactElement {
  const validMinBet = Math.max(0, Number.isFinite(minBet) ? minBet : 0);
  const validMaxBet = Math.max(validMinBet, Number.isFinite(maxBet) ? maxBet : validMinBet);
  
  const [raiseAmountInput, setRaiseAmountInput] = useState(String(validMinBet));
  const [showRaiseInput, setShowRaiseInput] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const lastActionTimeRef = useRef<number>(0);
  const processingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (processingTimeoutRef.current) {
        clearTimeout(processingTimeoutRef.current);
        processingTimeoutRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    setRaiseAmountInput(String(validMinBet));
  }, [validMinBet]);

  const effectiveRaiseAmount = useMemo(() => {
    if (!raiseAmountInput?.trim()) return validMinBet;
    const parsed = parseInt(raiseAmountInput, 10);
    if (!Number.isFinite(parsed)) return validMinBet;
    return Math.max(validMinBet, Math.min(validMaxBet, parsed));
  }, [raiseAmountInput, validMinBet, validMaxBet]);

  const validatedActions = useMemo(
    () => (availableActions ?? []).filter(isValidBetAction),
    [availableActions],
  );

  const clearProcessingTimeout = useCallback((): void => {
    if (processingTimeoutRef.current) {
      clearTimeout(processingTimeoutRef.current);
      processingTimeoutRef.current = null;
    }
  }, []);

  const executeWithCooldown = useCallback((action: () => void, resetRaiseInput?: boolean): void => {
    const now = Date.now();
    if (now - lastActionTimeRef.current < UI_ACTION_COOLDOWN_MS) return;
    lastActionTimeRef.current = now;
    clearProcessingTimeout();
    setIsProcessing(true);
    try {
      action();
      if (resetRaiseInput) {
        setShowRaiseInput(false);
        setRaiseAmountInput(String(validMinBet));
      }
    } finally {
      processingTimeoutRef.current = setTimeout(() => setIsProcessing(false), UI_ACTION_PROCESSING_DELAY_MS);
    }
  }, [clearProcessingTimeout, validMinBet]);

  const handleRaise = useCallback((): void => {
    executeWithCooldown(() => onBetAction("raise", effectiveRaiseAmount), true);
  }, [effectiveRaiseAmount, onBetAction, executeWithCooldown]);

  const handleAction = useCallback((action: string): void => {
    if (isValidBetAction(action)) {
      executeWithCooldown(() => onBetAction(action));
    }
  }, [onBetAction, executeWithCooldown]);

  const handleRaiseAmountChange = useCallback((value: string): void => {
    if (value === "") {
      setRaiseAmountInput("");
      return;
    }
    const sanitized = value.replace(/^0+/, "") || "0";
    if (/^\d+$/.test(sanitized) && sanitized.length <= UI_MAX_BET_INPUT_LENGTH) {
      const parsed = parseInt(sanitized, 10);
      if (Number.isFinite(parsed) && parsed >= 0 && parsed <= validMaxBet) {
        setRaiseAmountInput(sanitized);
      }
    }
  }, [validMaxBet]);

  const handleRaiseAmountBlur = useCallback((): void => {
    const parsed = parseInt(raiseAmountInput, 10);
    if (isNaN(parsed) || parsed < validMinBet) {
      setRaiseAmountInput(String(validMinBet));
    } else if (parsed > validMaxBet) {
      setRaiseAmountInput(String(validMaxBet));
    }
  }, [raiseAmountInput, validMinBet, validMaxBet]);

  const handleQuickRaise = useCallback((amount: number): void => {
    executeWithCooldown(() => {
      const clamped = Math.max(validMinBet, Math.min(validMaxBet, amount));
      onBetAction("raise", clamped);
    }, true);
  }, [validMinBet, validMaxBet, onBetAction, executeWithCooldown]);

  const handleCancelRaise = useCallback((): void => {
    setShowRaiseInput(false);
    setRaiseAmountInput(String(validMinBet));
  }, [validMinBet]);

  const quickRaiseAmounts = useMemo(
    () => {
      const amounts = [validMinBet, validMinBet * 2, validMinBet * 3, validMaxBet]
        .map((amount) => Math.min(amount, validMaxBet))
        .filter((amount) => amount > 0 && amount >= validMinBet && Number.isFinite(amount));
      const uniqueAmounts = [...new Set(amounts)];
      return uniqueAmounts.slice(0, MAX_QUICK_RAISE_OPTIONS);
    },
    [validMinBet, validMaxBet],
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
    <div className="bg-green-800 p-6 rounded-lg" aria-busy={isProcessing}>
      <div className="flex flex-col md:flex-row items-center justify-between space-y-4 md:space-y-0">
        <div className="flex flex-wrap gap-3">
          {validatedActions.includes("check") && (
            <button
              onClick={() => handleAction("check")}
              disabled={isProcessing}
              aria-label="Check your hand"
              aria-disabled={isProcessing}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:opacity-50 rounded-lg font-bold text-white transition-colors"
            >
              Check
            </button>
          )}

          {validatedActions.includes("call") && (
            <button
              onClick={() => handleAction("call")}
              disabled={isProcessing}
              aria-label="Call the current bet"
              aria-disabled={isProcessing}
              className="px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-green-800 disabled:opacity-50 rounded-lg font-bold text-white transition-colors"
            >
              Call
            </button>
          )}

          {validatedActions.includes("raise") && (
            <>
              {!showRaiseInput ? (
                <button
                  onClick={() => setShowRaiseInput(true)}
                  disabled={isProcessing}
                  aria-label="Open raise amount input"
                  aria-disabled={isProcessing}
                  className="px-6 py-3 bg-yellow-600 hover:bg-yellow-700 disabled:bg-yellow-800 disabled:opacity-50 rounded-lg font-bold text-white transition-colors"
                >
                  Raise
                </button>
              ) : (
                <div className="flex items-center space-x-2">
                  <input
                    type="number"
                    min={validMinBet}
                    max={validMaxBet}
                    value={raiseAmountInput}
                    onChange={(e) => handleRaiseAmountChange(e.target.value)}
                    onBlur={handleRaiseAmountBlur}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleRaise();
                      } else if (e.key === 'Escape') {
                        handleCancelRaise();
                      }
                    }}
                    aria-label="Raise amount"
                    className="w-32 px-3 py-2 bg-white text-black rounded"
                  />
                  <button
                    onClick={handleRaise}
                    disabled={isProcessing}
                    aria-label={`Raise by ${effectiveRaiseAmount} chips`}
                    aria-disabled={isProcessing}
                    className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 disabled:bg-yellow-800 disabled:opacity-50 rounded font-bold"
                  >
                    Raise {effectiveRaiseAmount}
                  </button>
                  <button
                    onClick={handleCancelRaise}
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
              disabled={isProcessing}
              aria-label="Fold your hand"
              aria-disabled={isProcessing}
              className="px-6 py-3 bg-red-600 hover:bg-red-700 disabled:bg-red-800 disabled:opacity-50 rounded-lg font-bold text-white transition-colors"
            >
              Fold
            </button>
          )}

          {showRaiseInput && quickRaiseAmounts.length > 0 && (
            <div className="flex flex-wrap gap-2" role="group" aria-label="Quick raise options">
              <span className="text-green-300 mr-2">Quick raise:</span>
              {quickRaiseAmounts.map((amount) => (
                <button
                  key={amount}
                  onClick={() => handleQuickRaise(amount)}
                  disabled={isProcessing}
                  aria-label={amount === validMaxBet ? 'Go all-in' : `Raise to ${amount}`}
                  aria-disabled={isProcessing}
                  className="px-3 py-1 bg-green-700 hover:bg-green-600 disabled:bg-green-800 disabled:opacity-50 rounded text-sm"
                >
                  {amount === validMaxBet ? 'All-in' : amount}
                </button>
              ))}
            </div>
          )}

          <div className="text-sm text-green-300">
            <div>Min bet: {validMinBet}</div>
            <div>Max bet: {validMaxBet}</div>
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
    </div>
  );
}

export const BettingControls = memo(BettingControlsInner);