import { useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { useSocket } from '../hooks/useSocket';

export function GameConfig() {
  const socket = useSocket();
  const { roomCode, setCurrentPage } = useGameStore();
  const [loading, setLoading] = useState(false);

  const [structure, setStructure] = useState<'clasica' | 'alternativa' | 'postpandemia'>('clasica');
  const [acePowers, setAcePowers] = useState({
    espadas: true,
    copas: true,
    oros: true,
  });
  const [kamikazesPerTeam, setKamikazesPerTeam] = useState(2);

  const handleTogglePower = (power: 'espadas' | 'copas' | 'oros') => {
    setAcePowers((prev) => ({
      ...prev,
      [power]: !prev[power],
    }));
  };

  const handleStartGame = () => {
    if (!socket) return;

    setLoading(true);

    // Emit config
    socket.emit('game:config', {
      roomCode,
      structure,
      acePowers,
      kamikazesPerTeam,
    }, (response: any) => {
      if (!response.success) {
          console.error('Error de configuración:', response.error);
        setLoading(false);
        return;
      }

      // Start game
      socket.emit('game:start', {
        roomCode,
      }, (startResponse: any) => {
        setLoading(false);
        if (startResponse.success) {
          setCurrentPage('game');
        } else {
          console.error('No se pudo iniciar:', startResponse.error);
        }
      });
    });
  };

  const handleBack = () => {
    setCurrentPage('game:waiting');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-950 p-6">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Configurar partida</h1>
          <p className="text-slate-400">Sala: {roomCode}</p>
        </div>

        {/* Config Card */}
        <div className="bg-slate-900 rounded-lg shadow-xl p-8 border border-slate-700">
          {/* Game Structure */}
          <div className="mb-8">
            <h2 className="text-xl font-bold text-white mb-4">Estructura</h2>
            <div className="grid grid-cols-3 gap-3">
              {(['clasica', 'alternativa', 'postpandemia'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setStructure(mode)}
                  className={`py-3 px-4 rounded-lg font-bold transition ${
                    structure === mode
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  {mode === 'clasica' && '🎴 Clásica'}
                  {mode === 'alternativa' && '🔄 Alternativa'}
                  {mode === 'postpandemia' && '🌍 Postpandemia'}
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-400 mt-3">
              {structure === 'clasica' && 'Clásica: [1,3,5,5,3,1,1,3,5,5,3,1]'}
              {structure === 'alternativa' && 'Alternativa: [1,3,5,6,6,5,3,1,1,3,5,6,6,5,3,1]'}
              {structure === 'postpandemia' && 'Postpandemia: [1,2,3,4,5,6,6,5,4,3,2,1]'}
            </p>
          </div>

          {/* Ace Powers */}
          <div className="mb-8 pb-8 border-b border-slate-700">
            <h2 className="text-xl font-bold text-white mb-4">Poderes especiales</h2>
            <div className="space-y-3">
              {[
                { key: 'espadas', name: '⚔️ As de Espadas', desc: 'Mata al Ancho de Bastos si se juega después' },
                { key: 'copas', name: '🏆 As de Copas', desc: 'Permite invertir el sentido de juego' },
                { key: 'oros', name: '💰 As de Oros', desc: 'Permite elegir quién abre la próxima base' },
              ].map(({ key, name, desc }) => (
                <button
                  key={key}
                  onClick={() => handleTogglePower(key as 'espadas' | 'copas' | 'oros')}
                  className={`w-full p-4 rounded-lg text-left font-bold transition border-2 ${
                    acePowers[key as 'espadas' | 'copas' | 'oros']
                      ? 'bg-emerald-950 border-emerald-600 text-emerald-300'
                      : 'bg-slate-800 border-slate-600 text-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p>{name}</p>
                      <p className="text-xs opacity-75">{desc}</p>
                    </div>
                    <div className="text-2xl">
                      {acePowers[key as 'espadas' | 'copas' | 'oros'] ? '✅' : '❌'}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="mb-8">
            <h2 className="text-xl font-bold text-white mb-4">Kamikazes por equipo</h2>
            <div className="grid grid-cols-4 gap-2">
              {[0, 1, 2, 3].map((count) => (
                <button
                  key={count}
                  onClick={() => setKamikazesPerTeam(count)}
                  className={`py-3 rounded font-bold transition ${
                    kamikazesPerTeam === count
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  {count}
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-3">
            <button
              onClick={handleStartGame}
              disabled={loading}
              className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-600 disabled:text-slate-400 text-white font-bold py-4 rounded-lg transition text-lg"
            >
              {loading ? 'Iniciando...' : '🎮 Iniciar partida'}
            </button>

            <button
              onClick={handleBack}
              className="w-full bg-slate-700 hover:bg-slate-600 text-slate-100 font-bold py-3 rounded-lg transition"
            >
              Volver
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
