import { useMemo, useEffect, useState } from 'react';
import { GiRobotGolem, GiCancel } from 'react-icons/gi';
import { useMenuScene } from '../menu/MenuBackdrop';
import { TableMenu } from '../menu/TableMenu';
import { useGameStore } from '../store/gameStore';
import { useSocket } from '../hooks/useSocket';
import { avatarKey } from '@la-base/shared';
import { FACE_INFO } from '../table3d/faces/catalog';
import { openSettings } from '../settings/SettingsPanel';

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

  // two people with the same face: both are told, and asked to change it; «Me la quedo» if not (once everybody
  // wearing it says so, the first to sit keeps it and the others wear it in another colour)
  const keyOf = (p: { avatar?: { face: string; tint?: number } }) => (p.avatar ? avatarKey(p.avatar as never) : '');
  const sameFace = currentPlayerData?.avatar ? players.filter((p) => p.id !== currentPlayerData.id && keyOf(p) === keyOf(currentPlayerData)) : [];
  const clashing = (p: (typeof players)[number]) => Boolean(p.avatar) && players.some((q) => q.id !== p.id && keyOf(q) === keyOf(p));
  const handleKeepFace = () => {
    if (!socket || !roomCode) return;
    socket.emit('avatar:keep', { roomCode });
  };
  const names = (ps: typeof players) => (ps.length === 1 ? ps[0].name : `${ps.slice(0, -1).map((p) => p.name).join(', ')} y ${ps[ps.length - 1].name}`);

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
    scene.setPlayers(players.map((p) => ({ name: p.name, team: (p.team as 'nosotros' | 'ellos' | 'random') || 'random', isBot: p.isBot, avatar: p.avatar })), capacity);
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

  const canStart = canGameStart && isHost;
  return (
    <main className="menu-screen sala">
      <TableMenu
        input={{ label: copied ? 'Copiado' : 'Mesa', value: roomCode ?? '', placeholder: '', onChange: () => undefined, onSubmit: copyCode, mono: true, readOnly: true, at: [0, 0.22] }}
        note="pasale el código de la carta a los demás (click para copiarlo)"
        items={[
          ...(['nosotros', 'random', 'ellos'] as const).map((t, i) => ({
            id: `team-${t}`,
            label: teamLabel[t],
            at: [(i - 1) * 0.3, 0.54] as [number, number],
            selected: myTeam === t,
            hint: t === 'random' ? 'El equipo se sortea al empezar' : `Jugar para ${teamLabel[t]}`,
            onPick: () => handleSelectTeam(t),
          })),
          ...(isHost && players.length < 8
            ? [{ id: 'bot', label: '+ bot', at: [-0.42, 0.72] as [number, number], hint: 'Sumar un jugador controlado por la computadora', onPick: handleAddBot }]
            : []),
          { id: 'empezar', label: startLabel, kind: canStart ? ('stamp' as const) : ('tag' as const), at: [0.02, 0.74], disabled: !canStart, hint: canStart ? 'Elegir las reglas de la casa y empezar' : undefined, onPick: handleConfigGame },
          { id: 'salir', label: 'Salir', at: [0.44, 0.72], onPick: handleLeaveRoom },
        ]}
      />

      <aside className="pad room-pad" aria-label="Sala">
        <div className="pad-head">
          <span>Sala</span>
          <span>{players.length}<small> {players.length === 1 ? 'jugador' : 'jugadores'}</small></span>
        </div>
        <ul className="room-list">
          {players.map((p) => (
            <li key={p.id} className={`room-item ${p.team}`}>
              <span className={`ink-dot ${p.isConnected ? 'on' : ''}`} title={p.isConnected ? 'conectado' : 'desconectado'} />
              <span className="room-item-name">
                {p.name}{p.id === currentPlayer?.id ? ' (vos)' : ''}
                {p.isBot && <GiRobotGolem aria-label="bot" className="room-item-icon" />}
                {p.id === hostPlayer?.id && <small> anfitrión</small>}
              </span>
              <span className="room-item-team">{clashing(p) && <small className="room-item-clash">misma cara · </small>}{teamLabel[p.team] ?? '—'}</span>
              {isHost && p.id !== currentPlayer?.id && (
                <button type="button" className="icon-btn" onClick={() => handleKickPlayer(p.id)} title={`Sacar a ${p.name}`} aria-label={`Sacar a ${p.name}`}>
                  <GiCancel aria-hidden />
                </button>
              )}
            </li>
          ))}
        </ul>
        {players.length >= 4 && !canGameStart && randomPlayers.length === 0 && (
          <p className="pad-error">Los equipos tienen que quedar parejos.</p>
        )}
        {sameFace.length > 0 && currentPlayerData?.avatar && (
          <div className="face-clash" role="alert">
            <p>
              {names(sameFace)} {sameFace.length > 1 ? 'eligieron' : 'eligió'} tu misma cara, <b>{FACE_INFO[currentPlayerData.avatar.face].name}</b>.
              En una mesa no puede haber dos iguales: alguno tiene que cambiarla.
            </p>
            {currentPlayerData.avatarKeep ? (
              <p className="face-clash-wait">
                Te la quedás. Si {sameFace.length > 1 ? 'ellos también se la quedan' : `${sameFace[0].name} también se la queda`}, la usa quien llegó primero y el resto, en otro color.
              </p>
            ) : (
              <div className="face-clash-actions">
                <button type="button" className="face-clash-btn" onClick={() => openSettings()}>Cambiar la mía</button>
                <button type="button" className="face-clash-btn" onClick={handleKeepFace}>Me la quedo</button>
              </div>
            )}
          </div>
        )}
        {currentPlayerData?.avatar?.tint ? (
          <p className="ledger-note face-clash-tint">Tu cara, {FACE_INFO[currentPlayerData.avatar.face].name}, va en otro color: alguien más la eligió primero.</p>
        ) : null}
        {botError && <p className="pad-error" role="alert">{botError}</p>}
      </aside>
    </main>
  );
}
