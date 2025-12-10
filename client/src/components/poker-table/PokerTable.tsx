import { ReactNode } from "react";

interface PokerTableProps {
  children: ReactNode;
}

export function PokerTable({ children }: PokerTableProps) {
  return (
    <div className="relative w-full h-96 bg-green-800 rounded-3xl border-8 border-yellow-900 shadow-2xl overflow-hidden">
      {/* Table felt */}
      <div className="absolute inset-4 bg-green-900 rounded-2xl border-4 border-green-950">
        {/* Table design elements */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 border-4 border-white rounded-full" />
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-48 h-48 border-2 border-white rounded-full" />
        </div>
        
        {/* Dealer button position */}
        <div className="absolute top-1/4 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
          <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-lg">
            <span className="text-black font-bold text-xs">D</span>
          </div>
        </div>
        
        {/* Player positions */}
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2">
          <div className="w-24 h-12 bg-yellow-900/30 rounded-lg border-2 border-yellow-800/50" />
        </div>
        
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2">
          <div className="w-24 h-12 bg-yellow-900/30 rounded-lg border-2 border-yellow-800/50" />
        </div>
        
        {/* Community card area */}
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
          <div className="w-72 h-24 bg-green-950/50 rounded-xl border-2 border-green-800/50" />
        </div>
        
        {/* Children (actual components) */}
        {children}
      </div>
    </div>
  );
}