import { useMemo } from "react";

interface PotDisplayProps {
  pot: number;
}

export function PotDisplay({ pot }: PotDisplayProps) {
  const chipCount = useMemo(
    () => Math.min(Math.floor(pot / 100), 5),
    [pot],
  );
  return (
    <div className="bg-yellow-900/80 border-2 border-yellow-700 rounded-lg p-4 min-w-48">
      <div className="text-center">
        <div className="text-yellow-300 text-sm font-bold uppercase tracking-wider">
          Total Pot
        </div>
        <div className="text-4xl font-bold text-yellow-200 my-2">
          ${pot}
        </div>
        <div className="text-yellow-400 text-sm">
          {pot === 0 ? "No bets yet" : "In the middle"}
        </div>
        
        {/* Visual chip stack */}
        <div className="mt-3 flex justify-center">
          {pot > 0 && chipCount > 0 && (
            <div className="flex -space-x-2">
              {[...Array(chipCount)].map((_, i) => (
                <div
                  key={i}
                  className="w-8 h-8 bg-yellow-500 border-2 border-yellow-600 rounded-full"
                  style={{
                    transform: `translateY(${i * -2}px)`,
                    zIndex: 5 - i,
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