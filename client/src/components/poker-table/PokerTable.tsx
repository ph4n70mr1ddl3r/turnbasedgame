"use client";

import React, { ReactNode } from "react";

interface PokerTableProps {
  children: ReactNode;
}

export function PokerTable({ children }: PokerTableProps): React.ReactElement {
  return (
    <div className="relative w-full h-96 bg-green-800 rounded-3xl border-8 border-yellow-900 shadow-2xl overflow-hidden">
      <div className="absolute inset-4 bg-green-900 rounded-2xl border-4 border-green-950">
        <div className="absolute inset-0 opacity-10 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 border-4 border-white rounded-full" />
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-48 h-48 border-2 border-white rounded-full" />
        </div>
        
        <div className="absolute top-1/4 left-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none">
          <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-lg">
            <span className="text-black font-bold text-xs">D</span>
          </div>
        </div>
        
        {children}
      </div>
    </div>
  );
}