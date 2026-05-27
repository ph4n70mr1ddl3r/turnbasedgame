"use client";

import { memo, useMemo, type ReactElement } from "react";
import { CHIP_VISUAL_DIVISOR } from "@/lib/constants/game";
import { formatChipAmount } from "@/lib/utils/format-utils";

interface PotDisplayProps {
  pot: number;
}

const MAX_VISUAL_CHIPS = 10;

function PotDisplayInner({ pot }: PotDisplayProps): ReactElement {
  const safePot = Math.max(0, typeof pot === 'number' && Number.isFinite(pot) ? pot : 0);
  const chipCount = useMemo(
    () => Math.min(
      Math.floor(safePot / CHIP_VISUAL_DIVISOR),
      MAX_VISUAL_CHIPS,
    ),
    [safePot],
  );
  return (
    <div
      className="bg-yellow-900/80 border-2 border-yellow-700 rounded-lg p-4 min-w-48"
      role="region"
      aria-label="Pot display"
    >
      <div className="text-center">
        <div className="text-yellow-300 text-sm font-bold uppercase tracking-wider">
          Total Pot
        </div>
        <div className="text-4xl font-bold text-yellow-200 my-2">
          ${formatChipAmount(safePot)}
        </div>
        <div className="text-yellow-400 text-sm">
          {safePot === 0 ? "No bets yet" : "In the middle"}
        </div>
        
        {/* Visual chip stack — capped at MAX_VISUAL_CHIPS to avoid DOM explosion */}
        <div className="mt-3 flex justify-center">
          {safePot > 0 && chipCount > 0 && (
            <div className="flex -space-x-2">
              {Array.from({ length: chipCount }, (_, i) => (
                <div
                  key={`chip-${i}`}
                  className="w-8 h-8 bg-yellow-500 border-2 border-yellow-600 rounded-full"
                  style={{
                    transform: `translateY(${i * -2}px)`,
                    zIndex: MAX_VISUAL_CHIPS - i,
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export const PotDisplay = memo(PotDisplayInner);