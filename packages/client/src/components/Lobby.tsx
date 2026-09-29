import { useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { useSocket } from '../hooks/useSocket';

export function Lobby() {
  const socket = useSocket();
  const {
    currentPlayer,
    setCurrentPage,
    setRoomCode,
    setReconnectToken,
    setRoomPlayers,
    setCurrentPlayer,
    isSocketConnected,
    setAuthStatus,
  } = useGameStore();

  const [mode, setMode] = useState<'home' | 'create' | 'join' | 'rules'>('home');
  const [playerCount, setPlayerCount] = useState(4);
  const [joinCode, setJoinCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCreateRoom = () => {
    if (!socket) return;

    setLoading(true);
    setError('');

    socket.emit('room:create', {
      playerName: currentPlayer?.name,
      playerCount,
    }, (response: any) => {
      setLoading(false);
      if (response.success) {
        setRoomCode(response.roomCode);
        setReconnectToken(response.reconnectToken);
        if (response.player) {
          setCurrentPlayer({
            id: response.player.id,
            name: response.player.name,
            token: currentPlayer?.token,
          });
          setRoomPlayers([{
            id: response.player.id,
            name: response.player.name,
            team: response.player.team,
            isConnected: response.player.isConnected,
          }]);
        }
        setCurrentPage('game:waiting');
      } else {
        setError(response.error || 'No se pudo crear la sala');
      }
    });
  };

  const handleJoinRoom = () => {
    if (!socket || !joinCode.trim()) {
      setError('Ingresá el código de la sala');
      return;
    }

    setLoading(true);
    setError('');

    socket.emit('room:join', {
      roomCode: joinCode.toUpperCase(),
      playerName: currentPlayer?.name,
    }, (response: any) => {
      setLoading(false);
      if (response.success) {
        setRoomCode(response.roomCode);
        setReconnectToken(response.reconnectToken);
        if (response.player) {
          setCurrentPlayer({
            id: response.player.id,
            name: response.player.name,
            token: currentPlayer?.token,
          });
        }
        if (response.players) {
          setRoomPlayers(response.players.map((player: any) => ({
            id: player.id,
            name: player.name,
            team: player.team,
            isConnected: player.isConnected,
          })));
        }
        setCurrentPage('game:waiting');
      } else {
        setError(response.error || 'No se pudo entrar a la sala');
      }
    });
  };

  const handleLogout = () => {
    setAuthStatus('logged_out');
    setCurrentPage('auth');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-950 p-4">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-4xl font-bold text-white">La Base</h1>
          <p className="text-slate-400">Hola, {currentPlayer?.name}</p>
        </div>
        <button
          onClick={handleLogout}
          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded font-semibold"
        >
          Cerrar sesión
        </button>
      </div>

      {/* Connection Status */}
      <div className="mb-6">
        <div
          className={`inline-block px-4 py-2 rounded text-white font-semibold ${
            isSocketConnected ? 'bg-emerald-600' : 'bg-red-600'
          }`}
        >
          {isSocketConnected ? 'Conectado' : 'Desconectado'}
        </div>
      </div>

      {/* Error Message */}
      {error && <div className="mb-6 p-4 bg-red-950 border border-red-700 text-red-300 rounded">{error}</div>}

      {/* Main Content */}
      <div className="max-w-2xl mx-auto">
        {mode === 'home' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Create Room */}
            <div className="bg-slate-900 rounded-lg shadow-xl p-6">
              <div className="text-3xl mb-2">🎲</div>
              <h2 className="text-2xl font-bold mb-4 text-white">Crear sala</h2>
              <p className="text-slate-400 mb-4">Armá una mesa nueva</p>
              <button
                onClick={() => setMode('create')}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded transition"
              >
                Nueva partida
              </button>
            </div>

            {/* Join Room */}
            <div className="bg-slate-900 rounded-lg shadow-xl p-6">
              <div className="text-3xl mb-2">🤝</div>
              <h2 className="text-2xl font-bold mb-4 text-white">Entrar a sala</h2>
              <p className="text-slate-400 mb-4">Usá el código de una mesa</p>
              <button
                onClick={() => setMode('join')}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded transition"
              >
                Entrar
              </button>
            </div>

            {/* Rules */}
            <div className="bg-slate-900 rounded-lg shadow-xl p-6">
              <div className="text-3xl mb-2">📖</div>
              <h2 className="text-2xl font-bold mb-4 text-white">Reglas</h2>
              <p className="text-slate-400 mb-4">Repasá la lógica de La Base</p>
              <button
                onClick={() => setMode('rules')}
                className="w-full bg-yellow-600 hover:bg-yellow-700 text-white font-bold py-3 rounded transition"
              >
                Leer reglas
              </button>
            </div>
          </div>
        )}

        {mode === 'rules' && (
          <div className="bg-slate-900 rounded-lg shadow-xl p-8 max-w-2xl mx-auto">
            <h2 className="text-2xl font-bold mb-5 text-white">Reglas rápidas</h2>
            <div className="space-y-4 text-slate-300">
              <p>Se juega por equipos: Nosotros contra Ellos. En cada ronda se reparten tantas cartas como bases tenga esa ronda.</p>
              <p>Primero canta el jugador mano de un equipo y después canta el primer jugador del otro equipo. La suma de ambos cantos no puede coincidir con el total de bases de la ronda.</p>
              <p>Cada base la gana la carta más fuerte según la jerarquía. Quien gana una base abre la siguiente, salvo que un efecto cambie la mano.</p>
              <p>Los kamikazes son cantos de todo o nada: 0 bases o todas las bases de la ronda. La cantidad disponible se configura antes de empezar.</p>
              <p>As de Copas puede invertir el sentido, As de Oros permite elegir quién abre la próxima base si su equipo ganó, y As de Espadas se aplica automáticamente según las reglas activadas.</p>
            </div>
            <button
              onClick={() => setMode('home')}
              className="mt-6 w-full bg-slate-700 hover:bg-slate-600 text-white font-bold py-3 rounded transition"
            >
              Volver
            </button>
          </div>
        )}

        {/* Create Room Mode */}
        {mode === 'create' && (
          <div className="bg-slate-900 rounded-lg shadow-xl p-8 max-w-md mx-auto">
            <h2 className="text-2xl font-bold mb-6 text-white">Crear partida</h2>

            <div className="mb-6">
              <label className="block text-slate-300 font-semibold mb-3">Cantidad de jugadores</label>
              <div className="grid grid-cols-3 gap-2">
                {[4, 6, 8].map((count) => (
                  <button
                    key={count}
                    onClick={() => setPlayerCount(count)}
                    className={`py-2 rounded font-bold transition ${
                      playerCount === count
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-700 text-white hover:bg-slate-600'
                    }`}
                  >
                    {count}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleCreateRoom}
              disabled={loading || !isSocketConnected}
              className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-600 text-white font-bold py-3 rounded transition mb-3"
            >
              {loading ? 'Creando...' : 'Crear partida'}
            </button>

            <button
              onClick={() => setMode('home')}
              className="w-full bg-slate-700 hover:bg-slate-600 text-white font-bold py-3 rounded transition"
            >
              Volver
            </button>
          </div>
        )}

        {/* Join Room Mode */}
        {mode === 'join' && (
          <div className="bg-slate-900 rounded-lg shadow-xl p-8 max-w-md mx-auto">
            <h2 className="text-2xl font-bold mb-6 text-white">Entrar a partida</h2>

            <div className="mb-6">
              <label className="block text-slate-300 font-semibold mb-2">Código de sala</label>
              <input
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="Ej: ABCD1234"
                maxLength={8}
                className="w-full px-4 py-2 border border-slate-700 rounded focus:outline-none focus:border-emerald-600 font-mono text-center text-lg"
              />
            </div>

            <button
              onClick={handleJoinRoom}
              disabled={loading || !isSocketConnected}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 text-white font-bold py-3 rounded transition mb-3"
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </button>

            <button
              onClick={() => setMode('home')}
              className="w-full bg-slate-700 hover:bg-slate-600 text-white font-bold py-3 rounded transition"
            >
              Volver
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
