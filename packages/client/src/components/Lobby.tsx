import { useEffect, useState } from 'react';
import { GiCardPlay, GiDoorway, GiScrollUnfurled, GiExitDoor } from 'react-icons/gi';
import { useMenuScene } from '../menu/MenuBackdrop';
import { MENU_OPTIONS } from '../menu/MenuScene';
import { TableMenu } from '../menu/TableMenu';
import { Rulebook } from './rulebook/Rulebook';
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
  const scene = useMenuScene();

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

  // 3D: sit at the empty table; the three big cards are the options (click them or the buttons)
  useEffect(() => {
    if (!scene) return;
    scene.setStation(mode === 'home' ? 'lobby' : mode === 'create' ? 'crear' : mode === 'join' ? 'unirse' : 'reglas');
    scene.setMyName(currentPlayer?.name ?? '');
    scene.onPick = (id) => {
      setError('');
      setMode(id === 'crear' ? 'create' : id === 'unirse' ? 'join' : 'rules');
    };
    return () => {
      scene.onPick = () => undefined;
    };
  }, [scene, mode, currentPlayer?.name]);
  useEffect(() => {
    if (scene && mode === 'create') scene.setSeatCount(playerCount);
  }, [scene, mode, playerCount]);

  const icons = [GiCardPlay, GiDoorway, GiScrollUnfurled];
  return (
    <main className="menu-screen lobby">
      <header className="menu-bar">
        <span className="menu-brand">LA BASE</span>
        <span className="menu-who">
          hola, <b>{currentPlayer?.name}</b>
          <span className={`led ${isSocketConnected ? 'on' : ''}`} title={isSocketConnected ? 'conectado al servidor' : 'sin conexión'} />
          {isSocketConnected ? 'conectado' : 'sin conexión'}
        </span>
        <button type="button" className="text-btn" onClick={handleLogout}><GiExitDoor aria-hidden /> cerrar sesión</button>
      </header>

      {mode === 'home' && (
        <nav className="menu-options" aria-label="Opciones">
          <p className="menu-hint">elegí una carta de la mesa</p>
          <div className="menu-option-row sr-only">
            {MENU_OPTIONS.map((o, i) => {
              const Icon = icons[i];
              return (
                <button
                  key={o.id}
                  type="button"
                  className="option-btn"
                  onMouseEnter={() => scene?.focusOption(i)}
                  onMouseLeave={() => scene?.focusOption(-1)}
                  onFocus={() => scene?.focusOption(i)}
                  onBlur={() => scene?.focusOption(-1)}
                  onClick={() => setMode(o.id === 'crear' ? 'create' : o.id === 'unirse' ? 'join' : 'rules')}
                >
                  <Icon aria-hidden /> {o.title}
                </button>
              );
            })}
          </div>
        </nav>
      )}

      {mode === 'create' && (
        <>
          {error && <p className="menu-error" role="alert">{error}</p>}
          <TableMenu
            note="¿cuántos se sientan? elegí y abrí la mesa"
            items={[
              { id: 't-jugadores', label: 'Jugadores', kind: 'label', at: [-0.56, 0.34], onPick: () => undefined }, // row title on the left
              ...[4, 6, 8].map((count, i) => ({
                id: `n${count}`,
                label: String(count),
                kind: 'chip' as const,
                at: [(i - 1) * 0.2, 0.34] as [number, number],
                selected: playerCount === count,
                hint: `${count} jugadores · ${count / 2} contra ${count / 2}`,
                onPick: () => setPlayerCount(count),
              })),
              { id: 'abrir', label: loading ? 'Abriendo…' : 'Abrir la mesa', kind: 'stamp', at: [0.08, 0.62], disabled: loading || !isSocketConnected, hint: `Crear una sala para ${playerCount}`, onPick: handleCreateRoom },
              { id: 'volver', label: 'Volver', at: [-0.36, 0.62], onPick: () => { setMode('home'); setError(''); } },
            ]}
          />
        </>
      )}

      {mode === 'join' && (
        <>
          {error && <p className="menu-error" role="alert">{error}</p>}
          <TableMenu
            input={{ label: 'Código de mesa', value: joinCode, placeholder: '······', onChange: (v) => { setJoinCode(v.replace(/[^A-Z0-9]/g, '')); setError(''); }, onSubmit: handleJoinRoom, mono: true, maxLength: 8, at: [0, 0.34] }}
            items={[
              { id: 'entrar', label: loading ? 'Entrando…' : 'Sentarse', kind: 'stamp', at: [0.1, 0.7], disabled: loading || !isSocketConnected || !joinCode.trim(), hint: 'Entrar a la mesa con ese código', onPick: handleJoinRoom },
              { id: 'volver', label: 'Volver', at: [-0.38, 0.66], onPick: () => { setMode('home'); setError(''); } },
            ]}
          />
        </>
      )}

      {mode === 'rules' && <Rulebook onClose={() => setMode('home')} />}
    </main>
  );
}
