import { useCallback, useEffect, useRef, useState } from 'react';
import type { Card, GameState } from '@la-base/shared';
import { useGameStore } from '../store/gameStore';
import { useSocket } from '../hooks/useSocket';
import { useGameEvents } from '../hooks/useGameEvents';
import { useToast } from '../hooks/useToast';
import { BiddingPanel } from './BiddingPanel';
import { RoundScoringPanel } from './RoundScoringPanel';
import { LiveBidDisplay } from './LiveBidDisplay';
import { ToastContainer } from './ToastContainer';
import { TableScene, type TablePlayer } from '../table3d/TableScene';

// First-person 3D table (La Base v2). The table shows every card movement; the non-card phases
// (initial draw, bidding, ace choices, scoring) are dark minimal overlays over the live table.

type CopasChoice = 'mantener' | 'invertir';

function teamName(team?: string) {
  if (team === 'nosotros') return 'Nosotros';
  if (team === 'ellos') return 'Ellos';
  return '—';
}

/** Who deals this round: the initial draw winner in round 1, otherwise the seat before the Mano. */
function dealerOf(gs: GameState | null, players: { id: string }[]) {
  if (!gs) return null;
  if (gs.roundIndex === 0 && gs.initialDraw?.dealerPlayerId) return gs.initialDraw.dealerPlayerId;
  const i = players.findIndex((p) => p.id === gs.currentManoPlayerId);
  if (i < 0) return null;
  return players[(i - 1 + players.length) % players.length].id;
}

export function GamePage() {
  const socket = useSocket();
  useGameEvents();
  const { toasts, removeToast } = useToast();
  const {
    gameState,
    playerHand,
    roomCode,
    currentPlayer,
    roomPlayers,
    setCurrentPage,
    setRoomCode,
    setReconnectToken,
    setRoomPlayers,
    setGameState,
    setPlayerHand,
  } = useGameStore();

  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<TableScene | null>(null);
  const [status, setStatus] = useState('');
  const [stamp, setStamp] = useState<{ text: string; key: number } | null>(null);
  const [copasAsk, setCopasAsk] = useState<((choice: CopasChoice | null) => void) | null>(null);
  const [muted, setMuted] = useState(false);
  const myId = currentPlayer?.id || socket?.id || '';

  // latest values for socket handlers / scene callbacks
  const latest = useRef({ gameState, roomPlayers, roomCode, playerHand, myId });
  latest.current = { gameState, roomPlayers, roomCode, playerHand, myId };

  const flash = useCallback((text: string) => {
    setStamp({ text, key: Date.now() });
  }, []);

  // ---- mount the scene once
  useEffect(() => {
    if (!mountRef.current) return;
    const scene = new TableScene(mountRef.current, {
      requestPlay: (card: Card) =>
        new Promise<boolean>((resolve) => {
          const { gameState: gs, roomCode: code } = latest.current;
          if (!socket || !code || !gs) return resolve(false);
          const emit = (copasDirection?: CopasChoice) =>
            socket.emit('card:play', { roomCode: code, card, copasDirection }, (res: { success: boolean; error?: string }) => {
              if (!res?.success) setStatus(res?.error || 'No se pudo jugar la carta');
              resolve(Boolean(res?.success));
            });
          if (gs.acePowers.copas && card.suit === 'copas' && card.value === 1) {
            // As de Copas: the card waits over the table while you choose the direction
            setCopasAsk(() => (choice: CopasChoice | null) => {
              setCopasAsk(null);
              if (choice === null) resolve(false);
              else emit(choice);
            });
          } else emit();
        }),
      look: (yaw, pitch) => {
        const code = latest.current.roomCode;
        if (socket && code) socket.emit('presence:look', { roomCode: code, yaw, pitch });
      },
      arm: (slot, fwd, lat, holding) => {
        const code = latest.current.roomCode;
        if (socket && code) socket.emit('presence:arm', { roomCode: code, slot, fwd, lat, holding });
      },
      hover: (slot) => {
        const code = latest.current.roomCode;
        if (socket && code) socket.emit('presence:hover', { roomCode: code, slot });
      },
      status: (text) => setStatus(text),
    });
    sceneRef.current = scene;
    if (new URLSearchParams(location.search).has('debug')) Object.assign(window, { __table: scene });
    return () => {
      scene.dispose();
      sceneRef.current = null;
    };
  }, [socket]);

  // ---- players / seats
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || !myId || roomPlayers.length === 0) return;
    const players: TablePlayer[] = roomPlayers.map((p) => ({
      id: p.id,
      name: p.name,
      team: (p.team as TablePlayer['team']) || 'random',
      handCount: p.handCount ?? 0,
      isConnected: p.isConnected,
    }));
    scene.setPlayers(players, myId);
  }, [roomPlayers, myId]);

  useEffect(() => {
    sceneRef.current?.setHand(playerHand);
  }, [playerHand]);

  // ---- turn, initial draw, dramatic moments
  const prevDirection = useRef<string | undefined>(undefined);
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || !gameState) return;
    const myTurn = gameState.phase === 'playing' && gameState.currentTurnPlayerId === myId;
    scene.setTurn(gameState.phase === 'playing' ? gameState.currentTurnPlayerId : null, myTurn);
    if (gameState.phase === 'initial_draw' && gameState.initialDraw) {
      scene.initialDraw(
        gameState.initialDraw.drawnCards.map((d) => ({ playerId: d.playerId, card: d.card })),
        gameState.initialDraw.completed,
      );
    }
    if (prevDirection.current && prevDirection.current !== gameState.playDirection && gameState.phase === 'playing') {
      scene.moment('envido');
      flash(gameState.playDirection === 'horario' ? 'SENTIDO HORARIO' : 'SENTIDO ANTIHORARIO');
    }
    prevDirection.current = gameState.playDirection;
  }, [gameState, myId, flash]);

  // ---- game events that become table animations
  useEffect(() => {
    if (!socket) return;
    let prevHandLen = latest.current.playerHand.length;
    const onHand = (data: { hand: Card[] }) => {
      const scene = sceneRef.current;
      if (!scene) return;
      const { gameState: gs, roomPlayers: players } = latest.current;
      if (data.hand.length > prevHandLen) {
        // a new round: clear the table, then the dealer deals
        const dealer = dealerOf(gs, players);
        scene.clearInitialDraw();
        scene.clearRound(dealer);
        scene.deal(dealer, data.hand.length, data.hand);
      } else scene.setHand(data.hand);
      prevHandLen = data.hand.length;
    };
    const onCardPlayed = (data: { playerId: string; card: Card }) => sceneRef.current?.cardPlayed(data.playerId, data.card);
    const onBaseResolved = (data: { winner: string; winnerTeam: string; winnerPlayerId?: string }) => {
      const id = data.winnerPlayerId ?? latest.current.roomPlayers.find((p) => p.name === data.winner)?.id;
      if (id) sceneRef.current?.baseResolved(id);
      setStatus(`${data.winner} ganó la base (${teamName(data.winnerTeam)})`);
    };
    const onBid = (data: { team: string; bidValue: number; isKamikaze: boolean }) => {
      if (data.isKamikaze) {
        sceneRef.current?.moment('truco');
        flash('¡KAMIKAZE!');
      }
      setStatus(`${teamName(data.team)} pide ${data.bidValue}${data.isKamikaze ? ' (kamikaze)' : ''}`);
    };
    const presence = (kind: 'look' | 'arm' | 'hover') => (data: { playerId: string } & Record<string, unknown>) =>
      sceneRef.current?.presence(kind, data.playerId, data);
    const onLook = presence('look');
    const onArm = presence('arm');
    const onHover = presence('hover');
    socket.on('player:hand', onHand);
    socket.on('game:cardPlayed', onCardPlayed);
    socket.on('game:baseResolved', onBaseResolved);
    socket.on('game:bidDeclared', onBid);
    socket.on('presence:look', onLook);
    socket.on('presence:arm', onArm);
    socket.on('presence:hover', onHover);
    return () => {
      socket.off('player:hand', onHand);
      socket.off('game:cardPlayed', onCardPlayed);
      socket.off('game:baseResolved', onBaseResolved);
      socket.off('game:bidDeclared', onBid);
      socket.off('presence:look', onLook);
      socket.off('presence:arm', onArm);
      socket.off('presence:hover', onHover);
    };
  }, [socket, flash]);

  // transient status lines fade after a while
  useEffect(() => {
    if (!status) return;
    const t = window.setTimeout(() => setStatus(''), 2600);
    return () => window.clearTimeout(t);
  }, [status]);

  const handleLeaveGame = () => {
    if (socket && roomCode) socket.emit('room:leave', { roomCode });
    setRoomCode(null);
    if (!gameState) setReconnectToken(null);
    setRoomPlayers([]);
    setGameState(null);
    setPlayerHand([]);
    setCurrentPage('lobby');
  };

  const handleInitialDraw = () => {
    if (!socket || !roomCode) return;
    socket.emit('draw:initialCard', { roomCode }, (res: { success: boolean; error?: string }) => {
      if (!res.success) setStatus(res.error || 'No se pudo sacar carta');
    });
  };

  const handleChooseOros = (playerId: string) => {
    if (!socket || !roomCode) return;
    socket.emit('ace:oros:choose', { roomCode, playerId }, (res: { success: boolean; error?: string }) => {
      if (!res.success) setStatus(res.error || 'No se pudo elegir');
    });
  };

  // ---- derived HUD values
  const nameOf = (id?: string | null) => roomPlayers.find((p) => p.id === id)?.name || '—';
  const me = roomPlayers.find((p) => p.id === myId);
  const maxBases = gameState ? gameState.structureSequence[gameState.roundIndex] ?? 0 : 0;
  const basesPlayed = (gameState?.basesWon.nosotros || 0) + (gameState?.basesWon.ellos || 0);
  const bidOf = (team: 'nosotros' | 'ellos') => gameState?.bids.find((b) => b.team === team);
  const initialDraw = gameState?.initialDraw;
  const isMyDraw = gameState?.phase === 'initial_draw' && !initialDraw?.completed && initialDraw?.currentDrawerPlayerId === myId;
  const canChooseOros = Boolean(gameState?.pendingOrosChoice && gameState.pendingOrosChoice.chooserPlayerId === myId);

  let phaseLine = '';
  if (gameState?.phase === 'initial_draw') {
    phaseLine = initialDraw?.completed
      ? `${nameOf(initialDraw.dealerPlayerId)} reparte · Mano: ${nameOf(initialDraw.manoPlayerId)}`
      : isMyDraw
        ? 'Sorteo: sacá una carta del mazo'
        : `Sorteo: saca ${nameOf(initialDraw?.currentDrawerPlayerId)}`;
  } else if (gameState?.phase === 'bidding') {
    phaseLine = gameState.currentBidPlayerId === myId ? 'Te toca declarar' : `Declara ${nameOf(gameState.currentBidPlayerId)}`;
  } else if (gameState?.phase === 'playing') {
    phaseLine = gameState.currentTurnPlayerId === myId
      ? 'Tu turno — click en una carta, o mantené para llevarla vos'
      : `Juega ${nameOf(gameState.currentTurnPlayerId)}`;
  } else if (gameState?.phase === 'base_resolution') {
    phaseLine = canChooseOros ? 'As de Oros: elegí quién abre' : 'Resolviendo la base…';
  }

  const teamRow = (team: 'nosotros' | 'ellos') => {
    const bid = bidOf(team);
    return (
      <div className={`hud-team ${team}`}>
        <span className="hud-team-name">{teamName(team)}</span>
        <span className="hud-score">{gameState?.scores[team] ?? 0}</span>
        <span className="hud-bases">
          {bid ? `pidió ${bid.value}${bid.isKamikaze ? ' ✶' : ''}` : 'sin pedido'} · ganó {gameState?.basesWon[team] ?? 0}
        </span>
      </div>
    );
  };

  return (
    <div className="table-page">
      <div ref={mountRef} className="table-canvas" />

      <header className="hud">
        <div className="hud-block">
          <div className="hud-title">LA BASE · sala {roomCode || '…'}</div>
          <div className="hud-line">
            Ronda {gameState ? gameState.roundIndex + 1 : 0}/{gameState?.structureSequence.length ?? 0} · base {Math.min(basesPlayed + 1, maxBases)}/{maxBases}
            {' · '}
            {gameState?.playDirection === 'horario' ? 'horario ↻' : 'antihorario ↺'}
          </div>
          {teamRow('nosotros')}
          {teamRow('ellos')}
          <div className="hud-line dim">
            Vos: {me?.name || '—'} ({teamName(me?.team)}) · kamikazes N{gameState?.kamikazesRemaining.nosotros ?? '-'} E{gameState?.kamikazesRemaining.ellos ?? '-'}
          </div>
        </div>
        <div className="hud-actions">
          <button className="hud-btn" onClick={() => setMuted(Boolean(sceneRef.current?.toggleMute()))}>{muted ? 'sonido: no' : 'sonido: sí'}</button>
          <button className="hud-btn danger" onClick={handleLeaveGame}>salir</button>
        </div>
      </header>

      <div className="phase-line">{status || phaseLine}</div>

      {!gameState && (
        <div className="overlay-center">
          <div className="ritual-panel">
            <h2>Reconectando…</h2>
            <p>Buscando la sala {roomCode || ''} en el servidor.</p>
            <button className="ritual-btn" onClick={handleLeaveGame}>volver al lobby</button>
          </div>
        </div>
      )}

      {gameState?.phase === 'initial_draw' && !initialDraw?.completed && (
        <div className="overlay-bottom">
          <button className="ritual-btn" disabled={!isMyDraw} onClick={handleInitialDraw}>
            {isMyDraw ? 'sacar carta del mazo' : `esperando a ${nameOf(initialDraw?.currentDrawerPlayerId)}`}
          </button>
        </div>
      )}

      {copasAsk && (
        <div className="overlay-center">
          <div className="ritual-panel">
            <h2>As de Copas</h2>
            <p>¿Cambiás el sentido de juego para el resto de la ronda?</p>
            <div className="ritual-row">
              <button className="ritual-btn" onClick={() => copasAsk('mantener')}>mantener</button>
              <button className="ritual-btn" onClick={() => copasAsk('invertir')}>invertir</button>
            </div>
            <button className="ritual-link" onClick={() => copasAsk(null)}>no jugarla</button>
          </div>
        </div>
      )}

      {canChooseOros && gameState?.pendingOrosChoice && (
        <div className="overlay-center">
          <div className="ritual-panel">
            <h2>As de Oros</h2>
            <p>Elegí quién de tu equipo abre la próxima base.</p>
            <div className="ritual-row wrap">
              {gameState.pendingOrosChoice.options.map((id) => (
                <button key={id} className="ritual-btn" onClick={() => handleChooseOros(id)}>{nameOf(id)}</button>
              ))}
            </div>
          </div>
        </div>
      )}

      {stamp && (
        <div key={stamp.key} className="stamp on">{stamp.text}</div>
      )}

      <div className="help-line">
        click en la mesa: mirar / soltar la vista · click en carta: jugar · mantené: mover el brazo y amagar · clic der: zoom (en la mitad lejana te parás)
      </div>

      {gameState?.phase === 'bidding' && <BiddingPanel />}
      <LiveBidDisplay />
      <RoundScoringPanel />
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
