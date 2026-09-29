import { useMemo, useEffect } from 'react';
import { useGameStore } from '../store/gameStore';
import { useSocket } from '../hooks/useSocket';

const TEAMS = [
  { id: 'nosotros', label: '👕 Nosotros', colorStart: '#3b82f6', colorEnd: '#2563eb' },
  { id: 'random', label: '🎲 Aleatorio', colorStart: '#facc15', colorEnd: '#eab308' },
  { id: 'ellos', label: '👕 Ellos', colorStart: '#ef4444', colorEnd: '#dc2626' },
] as const;

function TeamToggleSelector({
  currentTeam,
  currentPlayerName,
  onSelectTeam,
}: {
  currentTeam: string;
  currentPlayerName?: string;
  onSelectTeam: (team: string) => void;
}) {
  const selectedIndex = TEAMS.findIndex(t => t.id === currentTeam);
  const selectedTeam = TEAMS[selectedIndex];

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        const newIndex = selectedIndex === 0 ? TEAMS.length - 1 : selectedIndex - 1;
        onSelectTeam(TEAMS[newIndex].id);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        const newIndex = selectedIndex === TEAMS.length - 1 ? 0 : selectedIndex + 1;
        onSelectTeam(TEAMS[newIndex].id);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIndex, onSelectTeam]);

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="text-center">
        <p className="text-white text-sm font-semibold">{currentPlayerName}</p>
      </div>

      {/* Toggle Switch */}
      <div className="relative bg-slate-900/10 backdrop-blur-sm rounded-full p-1 border border-white/20 w-80 overflow-hidden">
        {/* Animated background indicator with smooth color transition */}
        <div
          className="
            absolute top-1 bottom-1 rounded-full
            shadow-lg
          "
          style={{
            left: `calc(${selectedIndex * 33.333}% + 2px)`,
            width: 'calc(33.333% - 4px)',
            background: `linear-gradient(90deg, ${selectedTeam.colorStart}, ${selectedTeam.colorEnd})`,
            transition: 'all 700ms cubic-bezier(0.4, 0.0, 0.2, 1)',
          }}
        />

        {/* Toggle buttons */}
        <div className="relative flex gap-0">
          {TEAMS.map((team, idx) => (
            <button
              key={team.id}
              onClick={() => onSelectTeam(team.id)}
              className={`
                flex-1 py-4 px-4 rounded-full font-bold
                relative z-10 text-sm cursor-pointer
                transition-all duration-700 ease-in-out
                flex flex-col items-center justify-center
                ${
                  selectedIndex === idx
                    ? 'text-white'
                    : 'text-white/50 hover:text-white/70'
                }
              `}
            >
              <span className="text-lg leading-none">
                {team.id === 'nosotros' && '👕'}
                {team.id === 'ellos' && '👕'}
                {team.id === 'random' && '🎲'}
              </span>
              <span className="text-xs mt-1">{team.label.split(' ')[1] || team.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function RoomWaiting() {
  const socket = useSocket();
  const {
    roomCode,
    currentPlayer,
    roomPlayers: players,
    setCurrentPage,
    setRoomCode,
    setReconnectToken,
    setRoomPlayers,
  } = useGameStore();

  const hostPlayer = players[0];
  const isHost = Boolean(hostPlayer && hostPlayer.id === currentPlayer?.id);
  const currentPlayerData = players.find(p => p.id === currentPlayer?.id);

  // Group players by team
  const nosotrosPlayers = useMemo(() => players.filter(p => p.team === 'nosotros'), [players]);
  const ellosPayers = useMemo(() => players.filter(p => p.team === 'ellos'), [players]);
  const randomPlayers = useMemo(() => players.filter(p => p.team === 'random'), [players]);

  // Balance validation: simulate assigning random players and check if result would be balanced
  const canGameStart = useMemo(() => {
    if (players.length < 4) return false;

    const fixedNosotros = nosotrosPlayers.length;
    const fixedEllos = ellosPayers.length;
    const randomCount = randomPlayers.length;

    // Simulate distributing random players
    let simNosotros = fixedNosotros;
    let simEllos = fixedEllos;

    // Distribute random players to balance
    for (let i = 0; i < randomCount; i++) {
      if (simNosotros < simEllos) {
        simNosotros++;
      } else if (simEllos < simNosotros) {
        simEllos++;
      } else {
        // If equal, distribute to larger side (or alternate)
        if (i % 2 === 0) simNosotros++;
        else simEllos++;
      }
    }

    // Game can start if simulated result would be balanced
    return simNosotros === simEllos;
  }, [nosotrosPlayers.length, ellosPayers.length, randomPlayers.length, players.length]);

  const handleSelectTeam = (team: string) => {
    if (!socket || !roomCode || !currentPlayer) return;
    socket.emit('player:selectTeam', {
      roomCode,
      playerId: currentPlayer.id,
      teamChoice: team as any,
    });
  };

  const handleConfigGame = () => {
    setCurrentPage('game:config');
  };

  const handleLeaveRoom = () => {
    if (socket && roomCode) {
      socket.emit('room:leave', { roomCode });
    }
    setRoomCode(null);
    setReconnectToken(null);
    setRoomPlayers([]);
    setCurrentPage('lobby');
  };

  const handleKickPlayer = (playerId: string) => {
    if (!socket || !roomCode || !isHost) return;
    socket.emit('room:kick', {
      roomCode,
      playerId,
    });
  };

  const PlayerCard = ({ player, isCurrentPlayer = false }: { player: any; isCurrentPlayer?: boolean }) => (
    <div className={`flex items-center justify-between rounded p-2 text-sm ${
      isCurrentPlayer
        ? 'bg-slate-900/20 border border-white/40'
        : 'bg-slate-900/10'
    }`}>
      <p className="text-white font-semibold flex-1">{player.name}{isCurrentPlayer && ' (tú)'}</p>
      <div className="flex items-center gap-2">
        <span className="ml-2">{player.isConnected ? '🟢' : '⚪'}</span>
        {isHost && !isCurrentPlayer && (
          <button
            onClick={() => handleKickPlayer(player.id)}
            className="ml-2 px-2 py-1 bg-red-600 hover:bg-red-700 text-white text-xs rounded transition"
            title="Echar jugador"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );

  const TeamColumn = ({
    title,
    playerList,
    color
  }: {
    title: string
    playerList: any[]
    color: string
  }) => (
    <div className="flex-1">
      <h3 className="text-white font-bold text-sm mb-2">{title}</h3>
      <div className={`rounded-lg p-3 bg-gradient-to-br ${color} min-h-24`}>
        {playerList.length > 0 ? (
          <div className="space-y-2">
            {playerList.map(player => (
              <PlayerCard
                key={player.id}
                player={player}
                isCurrentPlayer={player.id === currentPlayer?.id}
              />
            ))}
          </div>
        ) : (
          <p className="text-white/50 text-sm text-center py-6">Sin jugadores</p>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-950 p-6">
      {/* Header */}
      <div className="max-w-3xl mx-auto mb-8">
        <h1 className="text-4xl font-bold text-white mb-2">La Base</h1>
        <p className="text-slate-400">
          Sala: <span className="font-mono text-lg font-bold">{roomCode}</span>
        </p>
        <div className="mt-3 flex items-center gap-4">
          <span className="text-slate-400 text-sm">Jugadores: {players.length}/4+</span>
          {canGameStart && players.length >= 4 && (
            <span className="text-emerald-400 text-sm">✅ Listo para empezar</span>
          )}
        </div>
      </div>

      {/* Current Player Team Selector - Toggle Switch */}
      <div className="max-w-3xl mx-auto mb-8 bg-slate-900/5 backdrop-blur-sm rounded-xl p-8 border border-white/10">
        <TeamToggleSelector
          currentTeam={currentPlayerData?.team || 'random'}
          currentPlayerName={currentPlayer?.name}
          onSelectTeam={handleSelectTeam}
        />
      </div>

      {/* Team Columns */}
      <div className="max-w-3xl mx-auto mb-8">
        <h2 className="text-white font-bold text-lg mb-4">Equipos</h2>
        <div className="grid grid-cols-3 gap-4">
          <TeamColumn
            title="👕 Nosotros"
            playerList={nosotrosPlayers}
            color="from-blue-600 to-blue-800"
          />
          <TeamColumn
            title="🎲 Aleatorio"
            playerList={randomPlayers}
            color="from-yellow-500 to-yellow-700"
          />
          <TeamColumn
            title="👕 Ellos"
            playerList={ellosPayers}
            color="from-red-600 to-red-800"
          />
        </div>
      </div>

      {/* Status Message */}
      {players.length >= 4 && !canGameStart && randomPlayers.length === 0 && (
        <div className="max-w-3xl mx-auto mb-8 bg-amber-950 border border-amber-700 rounded-lg p-4">
          <p className="text-amber-300 text-center font-semibold">
            ⚠️ Los equipos deben estar balanceados
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="max-w-3xl mx-auto flex gap-3">
        {canGameStart && isHost ? (
          <button
            onClick={handleConfigGame}
            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-4 rounded-lg transition text-lg"
          >
            ⚙️ Configurar y empezar
          </button>
        ) : (
          <button
            disabled
            className="flex-1 bg-slate-600 text-white font-bold py-4 rounded-lg cursor-not-allowed text-lg"
          >
            {players.length < 4
              ? `Faltan ${4 - players.length} jugadores`
              : !canGameStart
              ? 'Equilibra los equipos'
              : !isHost
              ? 'Esperando al host'
              : 'No disponible'}
          </button>
        )}

        <button
          onClick={handleLeaveRoom}
          className="px-6 bg-red-600 hover:bg-red-700 text-white font-bold py-4 rounded-lg transition"
        >
          Salir
        </button>
      </div>
    </div>
  );
}