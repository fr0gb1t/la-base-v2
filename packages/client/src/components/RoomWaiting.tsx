import { useMemo, useEffect, useState } from 'react';
import { GiRobotGolem, GiExitDoor, GiCancel, GiPapers, GiCardPlay, GiCheckMark } from 'react-icons/gi';
import { useMenuScene } from '../menu/MenuBackdrop';
import { useGameStore } from '../store/gameStore';
import { useSocket } from '../hooks/useSocket';

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

  const scene = useMenuScene();
  const [copied, setCopied] = useState(false);
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

  const [botError, setBotError] = useState('');
  const handleAddBot = () => {
    if (!socket || !roomCode || !isHost) return;
    setBotError('');
    socket.emit('room:addBot', { roomCode }, (res: { success: boolean; error?: string }) => {
      if (!res?.success) setBotError(res?.error || 'No se pudo agregar el bot');
    });
  };

  const handleKickPlayer = (playerId: string) => {
    if (!socket || !roomCode || !isHost) return;
    socket.emit('room:kick', {
      roomCode,
      playerId,
    });
  };

  // 3D: the table from above; everyone who joins appears seated with their mask, names in chalk
  const capacity = players.length <= 4 ? 4 : players.length <= 6 ? 6 : 8;
  useEffect(() => {
    if (!scene) return;
    scene.setStation('sala');
    scene.setPlayers(players.map((p) => ({ name: p.name, team: (p.team as 'nosotros' | 'ellos' | 'random') || 'random', isBot: p.isBot })), capacity);
  }, [scene, players, capacity]);

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(roomCode ?? '');
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  const teamLabel: Record<string, string> = { nosotros: 'Nosotros', ellos: 'Ellos', random: 'Al azar' };
  const myTeam = currentPlayerData?.team ?? 'random';
  const startLabel = players.length < 4
    ? `Faltan ${4 - players.length} jugadores`
    : !canGameStart
      ? 'Equilibrá los equipos'
      : !isHost
        ? 'Esperando al anfitrión'
        : 'Configurar y empezar';

  return (
    <main className="menu-screen sala">
      <section className="code-tag" aria-label="Código de la sala">
        <span className="code-label">mesa</span>
        <button type="button" className="code-value" onClick={copyCode} title="Copiar código">
          {roomCode}
          <span className="code-copy">{copied ? <><GiCheckMark aria-hidden /> copiado</> : <><GiPapers aria-hidden /> copiar</>}</span>
        </button>
        <span className="code-note">pasale este código a los demás</span>
      </section>

      <aside className="room-panel" aria-label="Sala">
        <h2>Sala · {players.length} {players.length === 1 ? 'jugador' : 'jugadores'}</h2>

        <div className="team-picker" role="radiogroup" aria-label="Tu equipo">
          {(['nosotros', 'random', 'ellos'] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={myTeam === t}
              className={`team-opt ${t} ${myTeam === t ? 'on' : ''}`}
              onClick={() => handleSelectTeam(t)}
            >
              {teamLabel[t]}
            </button>
          ))}
        </div>

        <ul className="room-players">
          {players.map((p) => (
            <li key={p.id} className={`room-player ${p.team}`}>
              <span className={`led ${p.isConnected ? 'on' : ''}`} />
              <span className="room-player-name">{p.name}{p.id === currentPlayer?.id ? ' (vos)' : ''}</span>
              {p.isBot && <span className="tag"><GiRobotGolem aria-hidden /> bot</span>}
              {p.id === hostPlayer?.id && <span className="tag">anfitrión</span>}
              <span className="room-player-team">{teamLabel[p.team] ?? '—'}</span>
              {isHost && p.id !== currentPlayer?.id && (
                <button type="button" className="icon-btn" onClick={() => handleKickPlayer(p.id)} title={`Sacar a ${p.name}`} aria-label={`Sacar a ${p.name}`}>
                  <GiCancel aria-hidden />
                </button>
              )}
            </li>
          ))}
        </ul>
        {players.length >= 4 && !canGameStart && randomPlayers.length === 0 && (
          <p className="ledger-error">Los equipos tienen que quedar parejos.</p>
        )}
        {botError && <p className="ledger-error" role="alert">{botError}</p>}

        <div className="room-actions">
          {isHost && players.length < 8 && (
            <button type="button" className="text-btn" onClick={handleAddBot} title="Agregar un jugador controlado por la computadora">
              <GiRobotGolem aria-hidden /> + bot
            </button>
          )}
          <button type="button" className="stamp-btn" disabled={!(canGameStart && isHost)} onClick={handleConfigGame}>
            <GiCardPlay aria-hidden /> {startLabel}
          </button>
          <button type="button" className="text-btn danger" onClick={handleLeaveRoom}>
            <GiExitDoor aria-hidden /> Salir
          </button>
        </div>
      </aside>
    </main>
  );
}
