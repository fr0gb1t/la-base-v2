import { useEffect, useState } from 'react';
import { GiCardPlay, GiDoorway, GiScrollUnfurled, GiExitDoor, GiWoodenChair, GiReturnArrow } from 'react-icons/gi';
import { useMenuScene } from '../menu/MenuBackdrop';
import { MENU_OPTIONS } from '../menu/MenuScene';
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
  const back = (
    <button type="button" className="text-btn" onClick={() => { setMode('home'); setError(''); }}>
      <GiReturnArrow aria-hidden /> volver
    </button>
  );

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
          <div className="menu-option-row">
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
        <section className="ledger" aria-label="Armar mesa">
          <h2><GiCardPlay aria-hidden /> Armar mesa</h2>
          <p className="ledger-note">¿Cuántos se sientan? Se juega en dos equipos alternados.</p>
          <div className="seat-picker" role="radiogroup" aria-label="Cantidad de jugadores">
            {[4, 6, 8].map((count) => (
              <button
                key={count}
                type="button"
                role="radio"
                aria-checked={playerCount === count}
                className={`seat-btn ${playerCount === count ? 'on' : ''}`}
                onClick={() => setPlayerCount(count)}
              >
                <GiWoodenChair aria-hidden /> {count}
                <small>{count / 2} contra {count / 2}</small>
              </button>
            ))}
          </div>
          {error && <p className="ledger-error" role="alert">{error}</p>}
          <button type="button" className="stamp-btn" onClick={handleCreateRoom} disabled={loading || !isSocketConnected}>
            {loading ? 'Abriendo…' : 'Crear sala'}
          </button>
          {back}
        </section>
      )}

      {mode === 'join' && (
        <section className="ledger" aria-label="Sentarse a una mesa">
          <h2><GiDoorway aria-hidden /> Sentarse</h2>
          <label className="ledger-field">
            <span>Código de sala</span>
            <input
              type="text"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === 'Enter' && handleJoinRoom()}
              placeholder="Ej: ABCD1234"
              maxLength={8}
              className="code-input"
              autoFocus
            />
          </label>
          {error && <p className="ledger-error" role="alert">{error}</p>}
          <button type="button" className="stamp-btn" onClick={handleJoinRoom} disabled={loading || !isSocketConnected}>
            {loading ? 'Entrando…' : 'Entrar'}
          </button>
          {back}
        </section>
      )}

      {mode === 'rules' && (
        <section className="rules-panel" aria-label="Reglamento">
          <h2><GiScrollUnfurled aria-hidden /> Reglamento</h2>
          <ol>
            <li><b>Equipos.</b> Nosotros contra Ellos, sentados alternados. Se juegan rondas; en cada una se reparten tantas cartas como bases tiene.</li>
            <li><b>Declaración.</b> Primero pide el equipo Mano cuántas bases va a ganar; después el Pie. La suma de los dos pedidos nunca puede ser igual a las bases de la ronda.</li>
            <li><b>Bases.</b> Cada uno tira una carta; gana la más alta. Ancho de bastos &gt; reyes &gt; caballos &gt; sotas &gt; 7 … 2 &gt; ases. Empate: gana la que salió primero. Quien gana abre la siguiente.</li>
            <li><b>Puntos.</b> Si cumplís lo pedido: 10 + las bases ganadas. Si no: perdés la diferencia.</li>
            <li><b>Cuidado.</b> Si la Mano erra por 2 o más sin haber declarado kamikaze, pierde la partida.</li>
            <li><b>Kamikaze.</b> Todo o nada: pedir 0 o todas las bases. Cada equipo tiene pocos.</li>
            <li><b>Ases con poder</b> (si están activados). Espadas mata al ancho si sale después; Copas puede invertir el sentido de la ronda; Oros, si su equipo gana la base, elige quién abre la siguiente.</li>
          </ol>
          <p className="credits">Iconos: game-icons.net (CC BY 3.0) · Sonidos: Kenney (CC0)</p>
          {back}
        </section>
      )}
    </main>
  );
}
