import { useState, useMemo, useEffect } from 'react';
import { useGameStore } from '../store/gameStore';
import { useSocket } from '../hooks/useSocket';
import { useToast } from '../hooks/useToast';

export function BiddingPanel() {
  const socket = useSocket();
  const { gameState, roomCode, currentPlayer, roomPlayers } = useGameStore();
  const { error: showError } = useToast();
  const [bidValue, setBidValue] = useState(0);
  const [isKamikaze, setIsKamikaze] = useState(false);
  const [loading, setLoading] = useState(false);

  const currentRoomPlayer = useMemo(
    () => roomPlayers.find((player) => player.id === currentPlayer?.id),
    [currentPlayer?.id, roomPlayers]
  );

  const manoPlayer = useMemo(
    () => roomPlayers.find((player) => player.id === gameState?.currentManoPlayerId),
    [gameState?.currentManoPlayerId, roomPlayers]
  );

  const expectedTeam = useMemo(() => {
    if (!manoPlayer || !gameState?.bids) return null;
    if (gameState.bids.length === 0) return manoPlayer.team;
    if (gameState.bids.length === 1) return manoPlayer.team === 'nosotros' ? 'ellos' : 'nosotros';
    return null;
  }, [gameState?.bids, manoPlayer]);

  const isMyTeamTurn = currentRoomPlayer?.team === expectedTeam;
  const isMyBidTurn = isMyTeamTurn && gameState?.currentBidPlayerId === currentRoomPlayer?.id;

  // Emit bid value changes in real-time
  useEffect(() => {
    if (!socket || !roomCode || !isMyBidTurn) return;

    socket.emit('bid:bidValueChanged', {
      roomCode,
      bidValue,
      playerId: currentPlayer?.id,
    });
  }, [bidValue, isMyBidTurn, socket, roomCode, currentPlayer?.id]);
  const bidPlayer = useMemo(
    () => roomPlayers.find((player) => player.id === gameState?.currentBidPlayerId),
    [gameState?.currentBidPlayerId, roomPlayers]
  );

  const isMano = useMemo(() => {
    if (!gameState?.bids) return false;
    return gameState.bids.length === 0 && isMyBidTurn;
  }, [gameState?.bids, isMyBidTurn]);

  const isPie = useMemo(() => {
    if (!gameState?.bids) return false;
    return gameState.bids.length === 1 && isMyBidTurn;
  }, [gameState?.bids, isMyBidTurn]);

  const maxBases = useMemo(() => {
    if (!gameState?.structureSequence || gameState.roundIndex === undefined) return 0;
    return gameState.structureSequence[gameState.roundIndex] || 0;
  }, [gameState?.structureSequence, gameState?.roundIndex]);

  const validBidsForPie = useMemo(() => {
    if (!isPie || !gameState?.bids || gameState.bids.length === 0) return [];

    const manoBid = gameState.bids[0].value;
    const validBids = [];

    for (let i = 0; i <= maxBases; i++) {
      if (manoBid + i !== maxBases) {
        validBids.push(i);
      }
    }

    return validBids;
  }, [isPie, gameState?.bids, maxBases]);

  const isValidPieBid = useMemo(() => {
    if (!isPie) return true;
    return validBidsForPie.includes(bidValue);
  }, [isPie, bidValue, validBidsForPie]);

  const handleBid = () => {
    if (!socket || !roomCode) return;

    if (isKamikaze && bidValue !== 0 && bidValue !== maxBases) {
      showError(`Kamikaze solo puede cantar 0 o ${maxBases}`);
      return;
    }

    if (!isValidPieBid) {
      showError(`Suma inválida: ${gameState?.bids[0]?.value || 0} + ${bidValue} = ${(gameState?.bids[0]?.value || 0) + bidValue}`);
      return;
    }

    setLoading(true);

    socket.emit(
      'bid:declare',
      {
        roomCode,
        bidValue,
        isKamikaze: isMano ? isKamikaze : false,
      },
      (response: any) => {
        setLoading(false);
        if (!response.success) {
          showError(response.error || 'No se pudo cantar');
        } else {
          setBidValue(0);
          setIsKamikaze(false);
        }
      }
    );
  };

  const isOpen = gameState?.phase === 'bidding';
  // Only show the bidding panel to the player who has to act.
  if (!(isOpen && isMyBidTurn)) return null;

  return (
    <div className="fixed inset-0 z-40 pointer-events-none">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30 pointer-events-auto" onClick={() => {}} />

      {/* Modal positioned at top */}
      <div className="absolute left-1/2 top-6 -translate-x-1/2 z-50 w-full max-w-xl pointer-events-auto">
        <div className="mx-4 rounded-lg bg-slate-900 shadow-2xl border border-slate-700 overflow-hidden">
          {/* Header */}
          <div className="border-b border-slate-700 px-6 py-4 bg-slate-800">
            <h2 className="text-lg font-bold text-white">
              {isMyBidTurn
                ? isMano
                  ? '📣 Cantar bases (Mano)'
                  : '📣 Responder (Pie)'
                : `Esperando a ${bidPlayer?.name || expectedTeam || 'el otro equipo'}`}
            </h2>
          </div>

          {/* Content */}
          <div className="px-6 py-6">
            {/* Mano's bid info for Pie */}
            {isPie && gameState?.bids && gameState.bids.length > 0 && (
              <div className="mb-6 p-4 bg-blue-950 border border-blue-700 rounded-lg">
                <p className="text-blue-300 font-semibold">
                  🎯 Mano cantó <span className="text-2xl font-bold">{gameState.bids[0].value}</span> bases
                </p>
              </div>
            )}

            {/* Bid Selection */}
            <div className="mb-6">
              <div className="flex justify-between items-center mb-4">
                <label className="text-slate-200 font-bold">Elige bases:</label>
                <div className="text-5xl font-bold text-emerald-400">{bidValue}</div>
              </div>

              <div className="grid grid-cols-6 gap-2">
                {Array.from({ length: maxBases + 1 }, (_, value) => {
                  const disabledByPie = isPie && !validBidsForPie.includes(value);
                  const disabledByKamikaze = isMano && isKamikaze && value !== 0 && value !== maxBases;
                  const disabled = !isMyBidTurn || disabledByPie || disabledByKamikaze;

                  return (
                    <button
                      key={value}
                      onClick={() => setBidValue(value)}
                      disabled={disabled}
                      className={`rounded-lg py-3 font-bold border-2 transition text-lg ${
                        bidValue === value
                          ? 'bg-emerald-600 border-emerald-700 text-white shadow-lg'
                          : 'bg-slate-700 border-slate-600 text-slate-200 hover:border-emerald-600'
                      } disabled:bg-slate-800 disabled:text-slate-500 disabled:border-slate-600 disabled:cursor-not-allowed`}
                    >
                      {value}
                    </button>
                  );
                })}
              </div>

              {/* Valid bids hint for Pie */}
              {isPie && !isValidPieBid && (
                <div className="mt-4 p-3 bg-amber-950 border border-amber-700 rounded-lg">
                  <p className="text-amber-300 text-sm">
                    <span className="font-semibold">Opciones válidas:</span> {validBidsForPie.join(', ')}
                  </p>
                </div>
              )}
            </div>

            {/* Kamikaze Toggle */}
            {isMano && (
              <div className="p-4 bg-purple-950 border border-purple-700 rounded-lg">
                <button
                  onClick={() => setIsKamikaze(!isKamikaze)}
                  className={`w-full p-3 rounded-lg font-bold transition border-2 ${
                    isKamikaze
                      ? 'bg-purple-800 border-purple-600 text-purple-200'
                      : 'bg-slate-800 border-slate-600 text-slate-300 hover:border-purple-600'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span>💣 Kamikaze (Todo o nada: 0 o {maxBases})</span>
                    <span className="text-2xl">{isKamikaze ? '✅' : '❌'}</span>
                  </div>
                </button>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-slate-700 bg-slate-800 px-6 py-4">
            <button
              onClick={handleBid}
              disabled={loading || !isMyBidTurn || (isPie && !isValidPieBid)}
              className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-600 disabled:text-slate-400 text-white font-bold py-3 rounded-lg transition"
            >
              {loading ? 'Cantando...' : isMano ? 'Cantar' : 'Responder'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
