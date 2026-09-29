import { useEffect } from 'react';
import { useGameStore } from '../store/gameStore';

// The server starts the next round right away, so the round summary must never block the table:
// it floats over it without catching clicks and closes by itself. Game over still blocks.
const ROUND_SUMMARY_MS = 5000;

export function RoundScoringPanel() {
  const {
    roundScore,
    gameOver,
    setRoundScore,
    setGameOver,
    setCurrentPage,
    setRoomCode,
    setReconnectToken,
    setRoomPlayers,
    setGameState,
    setPlayerHand,
  } = useGameStore();

  useEffect(() => {
    if (!roundScore || gameOver) return;
    const t = window.setTimeout(() => setRoundScore(null), ROUND_SUMMARY_MS);
    return () => window.clearTimeout(t);
  }, [roundScore, gameOver, setRoundScore]);

  if (!roundScore && !gameOver) {
    return null;
  }

  if (gameOver) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-slate-900 rounded-lg p-8 max-w-2xl w-full mx-4 shadow-2xl">
          {/* Header */}
          <h2 className="text-4xl font-bold mb-8 text-center text-white">
            Partida terminada
          </h2>

          {/* Winner */}
          <div className={`mb-8 p-8 rounded-lg text-center border-4 ${
            gameOver.winner === 'nosotros'
              ? 'bg-emerald-950 border-emerald-600'
              : 'bg-orange-950 border-orange-600'
          }`}>
            <p className="text-lg text-slate-300 mb-2">Ganador:</p>
            <p className={`text-5xl font-bold mb-2 ${
              gameOver.winner === 'nosotros'
                ? 'text-emerald-700'
                : 'text-orange-700'
            }`}>
              {gameOver.winner.toUpperCase()}
            </p>
            <p className="text-sm text-slate-400 italic">{gameOver.reason}</p>
          </div>

          {/* Final Scores */}
          <div className="mb-8 grid grid-cols-2 gap-6">
            <div className="bg-slate-800 rounded-lg p-6 text-center border-2 border-slate-700">
              <p className="text-sm text-emerald-700 font-semibold mb-2">Nosotros</p>
              <p className="text-4xl font-bold text-emerald-700">
                {gameOver.finalScores.nosotros}
              </p>
              <p className="text-xs text-emerald-600 mt-2">puntos totales</p>
            </div>
            <div className="bg-orange-950 rounded-lg p-6 text-center border-2 border-orange-700">
              <p className="text-sm text-orange-700 font-semibold mb-2">Ellos</p>
              <p className="text-4xl font-bold text-orange-700">
                {gameOver.finalScores.ellos}
              </p>
              <p className="text-xs text-orange-600 mt-2">puntos totales</p>
            </div>
          </div>

          {/* Play Again Button */}
          <div className="flex gap-3">
            <button
              onClick={() => {
                // Return to lobby and reset game state
                setGameOver(null);
                setRoomCode(null);
                setReconnectToken(null);
                setRoomPlayers([]);
                setGameState(null);
                setPlayerHand([]);
                setCurrentPage('lobby');
              }}
              className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-bold py-4 rounded-lg transition text-lg"
            >
              Volver al menú
            </button>
            <button
              onClick={() => {
                setGameOver(null);
              }}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-lg transition text-lg"
            >
              Nueva partida
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (roundScore) {
    return (
      <div className="fixed top-14 right-4 z-50 pointer-events-none">
        {/* compact card in the corner: the next round's bidding panel owns the centre */}
        <div className="bg-slate-900/90 rounded-lg p-6 w-[30rem] shadow-2xl pointer-events-auto origin-top-right scale-[0.62]">
          {/* Header */}
          <h2 className="text-3xl font-bold mb-6 text-center text-white">
            Ronda {roundScore.round + 1} puntuada
          </h2>

          {/* Round Points */}
          <div className="mb-8 grid grid-cols-2 gap-4">
            <div className="bg-slate-800 rounded-lg p-4 text-center border-2 border-slate-700">
              <p className="text-sm text-emerald-700 font-semibold">Nosotros</p>
              <p className="text-4xl font-bold text-emerald-700 mt-2">
                {roundScore.nosotrosScore > 0 ? '+' : ''}{roundScore.nosotrosScore}
              </p>
              <p className="text-xs text-emerald-600 mt-2">puntos esta ronda</p>
            </div>
            <div className="bg-orange-950 rounded-lg p-4 text-center border-2 border-orange-700">
              <p className="text-sm text-orange-700 font-semibold">Ellos</p>
              <p className="text-4xl font-bold text-orange-700 mt-2">
                {roundScore.ellosScore > 0 ? '+' : ''}{roundScore.ellosScore}
              </p>
              <p className="text-xs text-orange-600 mt-2">puntos esta ronda</p>
            </div>
          </div>

          {/* Total Scores */}
          <div className="mb-8 bg-slate-800 rounded-lg p-6">
            <p className="text-sm text-slate-300 font-semibold mb-4 text-center">Puntaje total</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center">
                <p className="text-sm text-slate-400">Nosotros</p>
                <p className="text-3xl font-bold text-emerald-700 mt-1">
                  {roundScore.totalScores.nosotros}
                </p>
              </div>
              <div className="text-center">
                <p className="text-sm text-slate-400">Ellos</p>
                <p className="text-3xl font-bold text-orange-700 mt-1">
                  {roundScore.totalScores.ellos}
                </p>
              </div>
            </div>
          </div>

          {/* Continue Button */}
          <button
            onClick={() => {
              setRoundScore(null);
            }}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-lg transition text-lg"
          >
            Cerrar
          </button>
        </div>
      </div>
    );
  }

  return null;
}
