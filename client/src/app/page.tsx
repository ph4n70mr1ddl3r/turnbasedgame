"use client";

import { useWebSocket } from "@/hooks/useWebSocket";
import { PokerTable } from "@/components/poker-table/PokerTable";
import { BettingControls } from "@/components/poker-table/BettingControls";
import { PlayerSeat } from "@/components/poker-table/PlayerSeat";
import { CommunityCards } from "@/components/poker-table/CommunityCards";
import { PotDisplay } from "@/components/poker-table/PotDisplay";
import { ErrorDisplay } from "@/components/ui/ErrorDisplay";
import { BetAction, PlayerState } from "@/types/game-types";
import { logError } from "@/lib/utils/logger";

export default function Home() {
  const {
    isConnected,
    gameState,
    isMyTurn,
    availableActions,
    sendBetAction,
    lastError,
    clearError,
    playerId,
  } = useWebSocket({
    autoConnect: true,
  });

  const handleBetAction = (action: BetAction, amount?: number) => {
    const success = sendBetAction(action, amount);
    if (!success) {
      logError("Failed to send bet action");
    }
  };

  const players = gameState?.players ?? [];
  const player1 = players[0];
  const player2 = players[1];
  const myPlayer = players.find((p: PlayerState) => p.player_id === playerId);

  const formatTimeRemaining = (ms: number | undefined): string => {
    if (!ms || ms <= 0) return "-";
    return `${Math.ceil(ms / 1000)}s`;
  };
  
  return (
    <div className="flex flex-col items-center justify-center p-4">
      {lastError && (
        <ErrorDisplay error={lastError} onClose={clearError} />
      )}

      {!isConnected && (
        <div className="w-full max-w-6xl bg-yellow-900 border border-yellow-700 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-yellow-500 rounded-full animate-pulse" />
              <span className="font-medium">Connecting to game server...</span>
            </div>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-yellow-700 hover:bg-yellow-600 rounded"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      <div className="w-full max-w-6xl">
        <div className="bg-green-800 rounded-t-lg p-4 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold">
              {gameState ? `Game: ${gameState.round.toUpperCase()}` : "Waiting for game..."}
            </h2>
            <p className="text-green-300">
              {gameState?.game_status === "active"
                ? "Hand in progress"
                : gameState?.game_status === "waiting"
                ? "Waiting for players"
                : "Hand finished"}
            </p>
          </div>

          <PotDisplay pot={gameState?.pot ?? 0} />
        </div>

        <div className="relative bg-green-700 p-8 rounded-b-lg">
          <PokerTable>
            <div className="absolute top-4 left-1/2 transform -translate-x-1/2">
              <PlayerSeat
                player={player1}
                isCurrentPlayer={gameState?.current_player === player1?.player_id}
                position="top"
              />
            </div>

            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
              <CommunityCards cards={gameState?.community_cards ?? []} />
            </div>

            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2">
              <PlayerSeat
                player={player2}
                isCurrentPlayer={gameState?.current_player === player2?.player_id}
                position="bottom"
              />
            </div>
          </PokerTable>
        </div>

        <div className="mt-8">
          <BettingControls
            isMyTurn={isMyTurn}
            availableActions={availableActions}
            onBetAction={handleBetAction}
            minBet={gameState?.min_bet ?? 0}
            maxBet={gameState?.max_bet ?? 0}
          />
        </div>

        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-green-800 p-4 rounded">
            <h3 className="font-bold mb-2">Game Status</h3>
            <div className="space-y-1">
              <div className="flex justify-between">
                <span>Round:</span>
                <span className="font-mono">{gameState?.round ?? "-"}</span>
              </div>
              <div className="flex justify-between">
                <span>Current Player:</span>
                <span className="font-mono">{gameState?.current_player ?? "-"}</span>
              </div>
              <div className="flex justify-between">
                <span>Time Remaining:</span>
                <span className="font-mono">
                  {formatTimeRemaining(gameState?.time_remaining)}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-green-800 p-4 rounded">
            <h3 className="font-bold mb-2">Your Hand</h3>
            {myPlayer?.hole_cards?.length ? (
              <div className="flex space-x-2">
                {myPlayer.hole_cards.map((card, idx) => (
                  <div key={idx} className="bg-white text-black w-12 h-16 rounded flex items-center justify-center font-bold">
                    {card}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-green-300">Cards not revealed</p>
            )}
          </div>

          <div className="bg-green-800 p-4 rounded">
            <h3 className="font-bold mb-2">Connection</h3>
            <div className="space-y-1">
              <div className="flex justify-between">
                <span>Status:</span>
                <span className={isConnected ? "text-green-400" : "text-red-400"}>
                  {isConnected ? "Connected" : "Disconnected"}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Player ID:</span>
                <span className="font-mono">{playerId ?? "-"}</span>
              </div>
              <div className="flex justify-between">
                <span>Session:</span>
                <span className="font-mono text-xs">
                  {isConnected ? "Active" : "Inactive"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
