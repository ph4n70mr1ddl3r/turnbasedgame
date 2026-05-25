"use client";

import { ReactNode, memo, type ReactElement } from "react";

interface PokerTableProps {
  children: ReactNode;
  dealerPlayerIndex?: number | null;
}

function PokerTableInner({ children, dealerPlayerIndex }: PokerTableProps): ReactElement {
  const safeDealerIndex =
    dealerPlayerIndex !== null && dealerPlayerIndex !== undefined && dealerPlayerIndex >= 0 && dealerPlayerIndex <= 1
      ? dealerPlayerIndex
      : null;
  return (
    <div
      className="relative w-full min-h-96 sm:h-96 bg-green-800 rounded-3xl border-8 border-yellow-900 shadow-2xl overflow-hidden"
      role="region"
      aria-label="Poker table"
    >
      <div className="absolute inset-4 bg-green-900 rounded-2xl border-4 border-green-950">
        <div className="absolute inset-0 opacity-10 pointer-events-none" aria-hidden="true">
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 border-4 border-white rounded-full" />
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-48 h-48 border-2 border-white rounded-full" />
        </div>

        <div className={`absolute pointer-events-none ${
          safeDealerIndex === 0
            ? 'top-[15%] left-1/2 -translate-x-1/2'
            : safeDealerIndex === 1
              ? 'bottom-[15%] left-1/2 -translate-x-1/2'
              : 'top-1/4 left-1/2 -translate-x-1/2'
        }`} aria-hidden="true">
          <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-lg">
            <span className="text-black font-bold text-xs">DEALER</span>
          </div>
        </div>

        {/* Responsive layout: vertical stack on mobile, absolute on sm+ */}
        <div className="flex flex-col items-center gap-4 p-4 sm:absolute sm:inset-0 sm:p-0">
          {children}
        </div>
      </div>
    </div>
  );
}

export const PokerTable = memo(PokerTableInner);