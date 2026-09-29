import { useEffect } from 'react';
import { useGameStore } from '../store/gameStore';

export function BaseResolutionPanel() {
  const { baseResolved, setBaseResolved } = useGameStore();

  useEffect(() => {
    if (!baseResolved) return;

    const timeout = window.setTimeout(() => {
      setBaseResolved(null);
    }, 1800);

    return () => window.clearTimeout(timeout);
  }, [baseResolved, setBaseResolved]);

  if (!baseResolved) {
    return null;
  }

  const handleContinue = () => {
    // Modal will close when game:nextBase/roundComplete/gameOver event is received and updates store
    setBaseResolved(null);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-slate-900 rounded-lg p-8 max-w-2xl w-full mx-4 shadow-2xl">
        {/* Header */}
        <h2 className="text-3xl font-bold mb-6 text-center text-white">
          🏆 Base resuelta
        </h2>

        {/* Winner Announcement */}
        <div
          className={`mb-6 p-6 rounded-lg text-center ${
            baseResolved.winnerTeam === 'nosotros'
              ? 'bg-blue-950 border-2 border-blue-700'
              : 'bg-rose-950 border-2 border-rose-700'
          }`}
        >
          <p className="text-lg text-slate-300 mb-2">Ganó la base:</p>
          <p className={`text-4xl font-bold ${baseResolved.winnerTeam === 'nosotros' ? 'text-blue-400' : 'text-rose-400'}`}>
            {baseResolved.winner}
          </p>
          <p className="text-sm text-slate-400 mt-2">({baseResolved.winnerTeam})</p>
        </div>

        {/* Cards Played */}
        <div className="mb-6">
          <p className="text-sm font-semibold text-slate-300 mb-3">Cartas jugadas:</p>
          <div className="grid grid-cols-4 gap-3">
            {baseResolved.cards
              .sort((a, b) => a.order - b.order)
              .map((pc, idx) => (
                <div
                  key={idx}
                  className="bg-slate-800 rounded-lg p-3 text-center border-2 border-slate-700"
                >
                  <p className="text-2xl font-bold text-white">{pc.card.value}</p>
                  <p className="text-xs text-slate-400 mt-1">{pc.card.suit}</p>
                </div>
              ))}
          </div>
        </div>

        {/* Bases Won */}
        <div className="mb-6 grid grid-cols-2 gap-4">
          <div className="bg-blue-50 rounded-lg p-4 text-center border-2 border-blue-300">
            <p className="text-sm text-blue-700 font-semibold">Nosotros</p>
            <p className="text-3xl font-bold text-blue-700 mt-2">{baseResolved.basesWon.nosotros}</p>
            <p className="text-xs text-blue-600 mt-1">bases ganadas</p>
          </div>
          <div className="bg-rose-50 rounded-lg p-4 text-center border-2 border-rose-300">
            <p className="text-sm text-rose-700 font-semibold">Ellos</p>
            <p className="text-3xl font-bold text-rose-700 mt-2">{baseResolved.basesWon.ellos}</p>
            <p className="text-xs text-rose-600 mt-1">bases ganadas</p>
          </div>
        </div>

        {/* Continue Button */}
        <button
          onClick={handleContinue}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg transition text-lg"
        >
          Continuando...
        </button>
      </div>
    </div>
  );
}
