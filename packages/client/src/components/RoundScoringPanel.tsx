import { useEffect } from 'react';
import { useGameStore } from '../store/gameStore';

// The server starts the next round right away, so the round summary must never block the table:
// it floats over it without catching clicks and closes by itself. Game over still blocks.
const ROUND_SUMMARY_MS = 5000;

const REASONS: Record<string, string> = {
  'All rounds complete': 'se jugaron todas las rondas',
  'Kamikaze violation - Mano lost by 2+ bases': 'kamikaze fallido: el Mano perdió por 2 bases o más',
};

export function RoundScoringPanel({ myTeam }: { myTeam: 'nosotros' | 'ellos' }) {
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

  // v2: the round summary lives in the table's ready-gate panel; this component only shows game over
  if (!gameOver) {
    return null;
  }

  if (gameOver) {
    const rivalTeam = myTeam === 'nosotros' ? 'ellos' : 'nosotros';
    const won = gameOver.winner === myTeam;
    const tie = gameOver.winner !== 'nosotros' && gameOver.winner !== 'ellos';
    const row = (team: 'nosotros' | 'ellos') => (
      <tr className={team === myTeam ? 'mine' : 'rival'}>
        <td>{team === myTeam ? 'Tu equipo' : 'Rivales'} <span className="dim">({team === 'nosotros' ? 'Nosotros' : 'Ellos'})</span></td>
        <td><b>{gameOver.finalScores[team]}</b></td>
      </tr>
    );
    const leave = () => {
      setGameOver(null);
      setRoomCode(null);
      setReconnectToken(null);
      setRoomPlayers([]);
      setGameState(null);
      setPlayerHand([]);
      setCurrentPage('lobby');
    };
    return (
      <div className="overlay-center game-over" role="dialog" aria-labelledby="game-over-title">
        <div className="gate-panel">
          <h2 id="game-over-title">Partida terminada</h2>
          <p className={`game-over-result ${tie ? '' : won ? 'mine' : 'rival'}`}>
            {tie ? 'Empate' : won ? 'Ganó tu equipo' : 'Ganaron los rivales'}
          </p>
          <p className="dim">{REASONS[gameOver.reason] ?? gameOver.reason}</p>
          <table className="round-table">
            <thead>
              <tr><th /><th>puntos</th></tr>
            </thead>
            <tbody>
              {row(myTeam)}
              {row(rivalTeam)}
            </tbody>
          </table>
          <div className="game-over-actions">
            <button className="ritual-btn" onClick={leave}>volver al menú</button>
            <button className="ritual-btn quiet" onClick={() => setGameOver(null)}>mirar la mesa</button>
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
