import { useMemo } from 'react';
import { useGameStore } from '../store/gameStore';

export function LiveBidDisplay() {
  const { gameState, roomPlayers, currentPlayer, currentBidValue } = useGameStore();

  const biddingPlayer = useMemo(() => {
    if (!gameState?.currentBidPlayerId) return null;
    return roomPlayers.find((p) => p.id === gameState.currentBidPlayerId);
  }, [gameState?.currentBidPlayerId, roomPlayers]);

  const isMyBid = biddingPlayer?.id === currentPlayer?.id;

  // Only show if someone is bidding, it's not my bid, and there's a bid value to display
  if (!biddingPlayer || isMyBid || currentBidValue === null || gameState?.phase !== 'bidding') {
    return null;
  }

  return (
    <div className="fixed bottom-6 left-6 z-30 pointer-events-none">
      <div className="bg-slate-900 border-2 border-emerald-600 rounded-lg p-4 shadow-lg animate-pulse">
        <p className="text-sm text-slate-400 mb-1">Considerando:</p>
        <div className="flex items-baseline gap-2">
          <p className="text-slate-200 font-semibold">{biddingPlayer.name}</p>
          <p className="text-4xl font-bold text-emerald-400">{currentBidValue}</p>
          <p className="text-sm text-slate-400">bases</p>
        </div>
      </div>
    </div>
  );
}
