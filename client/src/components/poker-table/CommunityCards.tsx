import React from "react";
import { Card } from "@/types/game-types";

interface CommunityCardsProps {
  cards: Card[];
}

const CARD_POSITIONS = ["Flop 1", "Flop 2", "Flop 3", "Turn", "River"] as const;

export function CommunityCards({ cards }: CommunityCardsProps): React.ReactElement {
  return (
    <div className="bg-green-950/70 p-6 rounded-xl border-2 border-green-800">
      <h3 className="text-center text-green-300 font-bold mb-4">Community Cards</h3>
      
      <div className="flex justify-center space-x-4">
        {cards.length === 0 ? (
          <div className="text-green-500 italic">No cards yet</div>
        ) : (
          <>
            {cards.map((card, index) => (
              <div key={card} className="flex flex-col items-center">
                <div className="w-14 h-20 bg-white text-black rounded-lg flex items-center justify-center font-bold text-xl shadow-lg mb-2">
                  {card}
                </div>
                <div className="text-xs text-green-300">
                  {CARD_POSITIONS[index] ?? `Card ${index + 1}`}
                </div>
              </div>
            ))}
            
            {Array.from({ length: 5 - cards.length }).map((_, index) => (
              <div key={`placeholder-${index}`} className="flex flex-col items-center">
                <div className="w-14 h-20 bg-green-900 border-2 border-dashed border-green-700 rounded-lg flex items-center justify-center mb-2">
                  <span className="text-green-600 text-xs">?</span>
                </div>
                <div className="text-xs text-green-700">
                  {CARD_POSITIONS[cards.length + index] ?? "Coming"}
                </div>
              </div>
            ))}
          </>
        )}
      </div>
      
      <div className="mt-4 text-center">
        <div className="inline-block bg-green-800 px-3 py-1 rounded text-sm">
          {cards.length === 0 && "Pre-flop"}
          {cards.length === 3 && "Flop"}
          {cards.length === 4 && "Turn"}
          {cards.length === 5 && "River"}
          {cards.length > 0 && cards.length < 3 && "Deal in progress"}
        </div>
      </div>
    </div>
  );
}