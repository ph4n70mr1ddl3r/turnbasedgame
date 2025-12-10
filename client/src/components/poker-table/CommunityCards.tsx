import { Card } from "@/types/game-types";

interface CommunityCardsProps {
  cards: Card[];
}

export function CommunityCards({ cards }: CommunityCardsProps) {
  const cardPositions = [
    "Flop 1",
    "Flop 2", 
    "Flop 3",
    "Turn",
    "River"
  ];
  
  return (
    <div className="bg-green-950/70 p-6 rounded-xl border-2 border-green-800">
      <h3 className="text-center text-green-300 font-bold mb-4">Community Cards</h3>
      
      <div className="flex justify-center space-x-4">
        {cards.length === 0 ? (
          <div className="text-green-500 italic">No cards yet</div>
        ) : (
          <>
            {/* Display actual cards */}
            {cards.map((card, index) => (
              <div key={index} className="flex flex-col items-center">
                <div className="w-14 h-20 bg-white text-black rounded-lg flex items-center justify-center font-bold text-xl shadow-lg mb-2">
                  {card}
                </div>
                <div className="text-xs text-green-300">
                  {cardPositions[index] || `Card ${index + 1}`}
                </div>
              </div>
            ))}
            
            {/* Placeholder for remaining cards */}
            {Array.from({ length: 5 - cards.length }).map((_, index) => (
              <div key={`placeholder-${index}`} className="flex flex-col items-center">
                <div className="w-14 h-20 bg-green-900 border-2 border-dashed border-green-700 rounded-lg flex items-center justify-center mb-2">
                  <span className="text-green-600 text-xs">?</span>
                </div>
                <div className="text-xs text-green-700">
                  {cardPositions[cards.length + index] || "Coming"}
                </div>
              </div>
            ))}
          </>
        )}
      </div>
      
      {/* Round indicator */}
      {cards.length > 0 && (
        <div className="mt-4 text-center">
          <div className="inline-block bg-green-800 px-3 py-1 rounded text-sm">
            {cards.length === 3 && "Flop"}
            {cards.length === 4 && "Turn"}
            {cards.length === 5 && "River"}
            {cards.length < 3 && "Pre-flop"}
          </div>
        </div>
      )}
    </div>
  );
}