import { useCallback, useEffect, useRef, useState } from 'react';
import { isTouch } from '../lib/device';
import { SENAS, resolveBase, type Card, type GameState, type AssignedTeam, type Sena } from '@la-base/shared';
import { useGameStore } from '../store/gameStore';
import { useSocket } from '../hooks/useSocket';
import { useGameEvents } from '../hooks/useGameEvents';
import { useToast } from '../hooks/useToast';
import { BiddingPanel, pressBidClock } from './BiddingPanel';
import { RoundScoringPanel } from './RoundScoringPanel';
import { LiveBidDisplay } from './LiveBidDisplay';
import { ToastContainer } from './ToastContainer';
import { TableScene, type TablePlayer } from '../table3d/TableScene';
import { Anotador, type AnotadorData, type AnotadorTeam } from './Anotador';
import { SettingsButton, useViewSettings, openSettings } from '../settings/SettingsPanel';
import { SenaWheel, type WheelOpen } from './senas/SenaWheel';
import { SenaEcho, type Echo } from './senas/SenaEcho';
import { Rulebook } from './rulebook/Rulebook';
import { audioState, onAudioState, resumeAudio, uiSound } from '../table3d/audio';
import { GiSpeakerOff } from 'react-icons/gi';
import { GiExitDoor, GiScrollUnfurled, GiBookCover, GiBackwardTime, GiCog } from 'react-icons/gi';
import { renderToStaticMarkup } from 'react-dom/server';
import type { HudItem } from '../table3d/hudBoard';

// First-person 3D table (La Base v2). The table shows every card movement; the non-card phases
// (initial draw, bidding, ace choices, ready gates, scoring) are dark minimal overlays over it.
// Teams are always named from YOUR point of view ("Tu equipo" / "Rivales").

type CopasChoice = 'mantener' | 'invertir';
function teamName(team?: string) {
  if (team === 'nosotros') return 'Nosotros';
  if (team === 'ellos') return 'Ellos';
  return '—';
}

export function cardName(card: Pick<Card, 'suit' | 'value'>) {
  if (card.value === 1 && card.suit === 'bastos') return 'ancho de bastos';
  const n = card.value === 1 ? 'as' : card.value === 10 ? 'sota' : card.value === 11 ? 'caballo' : card.value === 12 ? 'rey' : String(card.value);
  return `${n} de ${card.suit}`;
}

/** Who deals this round: the initial draw winner in round 1, otherwise the seat before the Mano. */
function dealerOf(gs: GameState | null, players: { id: string }[]) {
  if (!gs) return null;
  if (gs.dealerPlayerId) return gs.dealerPlayerId;
  if (gs.roundIndex === 0 && gs.initialDraw?.dealerPlayerId) return gs.initialDraw.dealerPlayerId;
  const i = players.findIndex((p) => p.id === gs.currentManoPlayerId);
  if (i < 0) return null;
  return players[(i - 1 + players.length) % players.length].id;
}

const gestureOf = (sena: Sena) => SENAS.find((x) => x.id === sena)?.gesture ?? sena;

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
  const drawRef = useRef<() => void>(() => undefined);
  // ---- game log (history panel, hidden by default)
  const [log, setLog] = useState<Array<{ id: number; round: number; text: string; kind: string }>>([]);
  const [showLog, setShowLog] = useState(false);
  const [showRules, setShowRules] = useState(false);
  // the browser keeps sound paused until the page gets a click or key (e.g. after a reload)
  const [soundOn, setSoundOn] = useState(audioState() === 'running');
  useEffect(() => onAudioState((st) => setSoundOn(st === 'running')), []);
  const [wheel, setWheel] = useState<WheelOpen | null>(null);
  const [echo, setEcho] = useState<Echo | null>(null);
  useEffect(() => {
    if (!echo) return;
    const t = window.setTimeout(() => setEcho(null), 2100);
    return () => window.clearTimeout(t);
  }, [echo]);
  const wheelAt = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  if (wheel) wheelAt.current = { x: wheel.x, y: wheel.y };
  const [aimFace, setAimFace] = useState(false);
  const view = useViewSettings();
  const nameNow = (id: string) => latest.current.roomPlayers.find((p) => p.id === id)?.name ?? '—';
  const roundRef = useRef(1);
  const logRef = useRef<(text: string, kind?: string) => void>(() => undefined);
  logRef.current = (text: string, kind = 'play') =>
    setLog((l) => [...l.slice(-299), { id: (l[l.length - 1]?.id ?? 0) + 1, round: roundRef.current, text, kind }]);
  const sceneRef = useRef<TableScene | null>(null);
  const [status, setStatus] = useState('');
  const [stamp, setStamp] = useState<{ text: string; key: number } | null>(null);
  const [announce, setAnnounce] = useState<{ title: string; sub: string; mine: boolean; key: number } | null>(null);
  // a question asked on the table itself (As de Copas / As de Oros); the DOM keeps hidden buttons
  const [tableAsk, setTableAsk] = useState<'copas' | 'oros' | null>(null);
  const [padOpen, setPadOpen] = useState(false); // the scoresheet floating in the middle of the screen
  const [padFull, setPadFull] = useState<boolean>(() => {
    try {
      return localStorage.getItem('laBase.padFull') !== '0'; // the full sheet (with the players) unless you chose the short one
    } catch {
      return true;
    }
  });
  const myId = currentPlayer?.id || socket?.id || '';

  // latest values for socket handlers / scene callbacks
  const latest = useRef({ gameState, roomPlayers, roomCode, playerHand, myId });
  latest.current = { gameState, roomPlayers, roomCode, playerHand, myId };

  const flash = useCallback((text: string) => setStamp({ text, key: Date.now() }), []);

  const setFull = useCallback((full: boolean) => {
    setPadFull(full);
    try {
      localStorage.setItem('laBase.padFull', full ? '1' : '0');
    } catch {
      /* the choice just won't persist */
    }
  }, []);
  // H (and the notepad's button) go full → short → closed, as the old scoreboard did
  const padState = useRef({ open: false, full: true });
  padState.current = { open: padOpen, full: padFull };
  const cyclePad = useCallback(() => {
    const { open, full } = padState.current;
    if (!open) setPadOpen(true);
    else if (full) setFull(false);
    else {
      setPadOpen(false);
      setFull(true);
    }
  }, [setFull]);
  const togglePad = cyclePad;

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
            // As de Copas: the card waits over the table while you choose the direction, on the table
            setTableAsk('copas');
            void (sceneRef.current?.askDirection(gs.playDirection) ?? Promise.resolve(null)).then((choice) => {
              setTableAsk(null);
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
      deckClick: () => drawRef.current(),
      clockPress: () => pressBidClock.current?.(),
      hudPress: (id) => hudActions.current[id]?.(),
      notepadPress: () => setPadOpen((v) => !v),
      notepadReady: () => readyRef.current(),
      error: (message, stack) => {
        const code = latest.current.roomCode;
        socket?.emit('client:error', { roomCode: code, message, stack: stack?.slice(0, 2000), where: 'table3d', ua: navigator.userAgent });
      },
      faceAim: (id) => setAimFace(Boolean(id)),
    });
    sceneRef.current = scene;
    if (new URLSearchParams(location.search).has('debug')) Object.assign(window, { __table: scene, __store: useGameStore });
    return () => {
      scene.dispose();
      sceneRef.current = null;
    };
  }, [socket]);

  // any uncaught error on this page goes to the server log too (so freezes can be diagnosed)
  useEffect(() => {
    if (!socket) return;
    const send = (message: string, stack?: string) =>
      socket.emit('client:error', { roomCode: latest.current.roomCode, message, stack: stack?.slice(0, 2000), where: 'window', ua: navigator.userAgent });
    const onError = (e: ErrorEvent) => send(e.message, e.error instanceof Error ? e.error.stack : undefined);
    const onRejection = (e: PromiseRejectionEvent) => send(String(e.reason?.message ?? e.reason), e.reason instanceof Error ? e.reason.stack : undefined);
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
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

  // ---- the bidding clock in the middle of the table (from your side: your team / rivals)
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    const c = gameState?.bidClock;
    const mine = (roomPlayers.find((p) => p.id === myId)?.team ?? 'nosotros') as 'nosotros' | 'ellos';
    const theirs = mine === 'nosotros' ? 'ellos' : 'nosotros';
    scene.setClock({
      off: !c,
      mine: c?.remainingMs[mine] ?? 0,
      theirs: c?.remainingMs[theirs] ?? 0,
      running: c?.running ? (c.running === mine ? 'mine' : 'theirs') : null,
      canPress: gameState?.phase === 'bidding' && gameState.currentBidPlayerId === myId,
      seats: roomPlayers.length,
    });
  }, [gameState, roomPlayers, myId]);

  // ---- tokens on the felt: dealer, who asks, asked bases with beans, kamikaze planes
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    if (!gameState || gameState.phase === 'initial_draw' || gameState.phase === 'lobby') return scene.setTokens(null);
    const firstBidder = gameState.bids[0]?.playerId ?? (gameState.phase === 'bidding' ? gameState.currentBidPlayerId : null);
    scene.setTokens({
      dealerId: gameState.dealerPlayerId ?? null,
      bidderId: firstBidder ?? null,
      bids: gameState.bids
        .filter((b) => b.playerId)
        .map((b) => ({ playerId: b.playerId as string, value: b.value, won: gameState.basesWon[b.team] })),
      kamikazeIds: (gameState.kamikazeCalls ?? []).map((k) => k.playerId),
    });
  }, [gameState, roomPlayers]);

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
      logRef.current(`As de Copas: el sentido pasa a ${gameState.playDirection}`, 'event');
      scene.moment('envido');
      flash(gameState.playDirection === 'horario' ? 'SENTIDO HORARIO' : 'SENTIDO ANTIHORARIO');
      uiSound('announce');
    }
    prevDirection.current = gameState.playDirection;
  }, [gameState, myId, flash]);

  // ---- game events that become table animations
  useEffect(() => {
    if (!socket) return;
    let prevHandLen = latest.current.playerHand.length;
    const relative = (team?: string) => {
      const mine = latest.current.roomPlayers.find((p) => p.id === latest.current.myId)?.team;
      return team && team === mine ? 'tu equipo' : 'rivales';
    };
    const onHand = (data: { hand: Card[]; dealerPlayerId?: string | null; roundIndex?: number }) => {
      const scene = sceneRef.current;
      if (!scene) return;
      const { gameState: gs, roomPlayers: players } = latest.current;
      if (data.hand.length > prevHandLen) {
        // a new round: clear the table, then the dealer deals
        const dealer = data.dealerPlayerId ?? dealerOf(gs, players);
        roundRef.current = (data.roundIndex ?? gs?.roundIndex ?? 0) + 1;
        logRef.current(`Ronda ${roundRef.current}: reparte ${players.find((p) => p.id === dealer)?.name ?? '—'}, ${data.hand.length} ${data.hand.length === 1 ? 'carta' : 'cartas'}`, 'round');
        scene.clearInitialDraw();
        scene.clearRound(dealer);
        scene.deal(dealer, data.hand.length, data.hand);
      } else scene.setHand(data.hand);
      prevHandLen = data.hand.length;
    };
    const who = (id?: string | null) => latest.current.roomPlayers.find((p) => p.id === id)?.name ?? '—';
    const onCardPlayed = (data: { playerId: string; card: Card }) => {
      sceneRef.current?.cardPlayed(data.playerId, data.card);
      logRef.current(`${who(data.playerId)} juega ${cardName(data.card)}`);
    };
    const onBaseResolved = (data: { winner: string; winnerTeam: string; winnerPlayerId?: string }) => {
      const id = data.winnerPlayerId ?? latest.current.roomPlayers.find((p) => p.name === data.winner)?.id;
      // the cards stay on the table (winner glowing) until everybody confirms
      if (id) sceneRef.current?.markWinner(id);
      logRef.current(`${data.winner} gana la base (${relative(data.winnerTeam)})`, 'base');
    };
    const onGateReleased = (data: { kind: 'base' | 'round'; winnerPlayerId: string }) => {
      sceneRef.current?.markWinner(null);
      sceneRef.current?.baseResolved(data.winnerPlayerId);
    };
    const onBid = (data: { team: string; bidValue: number; isKamikaze: boolean; playerId?: string }) => {
      // game:bidDeclared arrives before the state update: the declarer is still the current bidder
      const who = latest.current.roomPlayers.find((p) => p.id === (data.playerId ?? latest.current.gameState?.currentBidPlayerId));
      const rel = relative(data.team);
      setAnnounce({
        title: who?.id === latest.current.myId ? `Pedís ${data.bidValue}` : `${who?.name ?? teamName(data.team)} pide ${data.bidValue}`,
        sub: `${rel === 'tu equipo' ? 'Tu equipo' : 'Rivales'} (${teamName(data.team)})${data.isKamikaze ? ' · KAMIKAZE: todo o nada' : ''}`,
        mine: rel === 'tu equipo',
        key: Date.now(),
      });
      uiSound('announce'); // a bid is an event: you hear it
      sceneRef.current?.moment(data.isKamikaze ? 'muerte' : rel === 'tu equipo' ? 'envido' : 'truco');
      logRef.current(`${who?.name ?? teamName(data.team)} pide ${data.bidValue}${data.isKamikaze ? ' · KAMIKAZE' : ''} (${rel})`, data.isKamikaze ? 'kami' : 'bid');
      if (data.isKamikaze) {
        sceneRef.current?.moment('truco');
        flash('¡KAMIKAZE!');
      }
    };
    const presence = (kind: 'look' | 'arm' | 'hover') => (data: { playerId: string } & Record<string, unknown>) =>
      sceneRef.current?.presence(kind, data.playerId, data);
    const onLook = presence('look');
    const onArm = presence('arm');
    const onHover = presence('hover');
    socket.on('player:hand', onHand);
    socket.on('game:cardPlayed', onCardPlayed);
    socket.on('game:baseResolved', onBaseResolved);
    socket.on('game:gateReleased', onGateReleased);
    socket.on('game:bidDeclared', onBid);
    // the server only sends a seña you can see: your partners', or a rival's you caught
    const onSena = (d: { playerId: string; sena: Sena; yaw?: number; pitch?: number; elapsed?: number }) => {
      const gaze = typeof d.yaw === 'number' && typeof d.pitch === 'number' ? { yaw: d.yaw, pitch: d.pitch } : undefined;
      sceneRef.current?.sena(d.playerId, d.sena, gaze, d.elapsed ?? 0);
      const { roomPlayers: players, myId: me } = latest.current;
      const team = (id: string) => players.find((p) => p.id === id)?.team;
      logRef.current(
        team(d.playerId) === team(me) ? `${nameNow(d.playerId)} te hace la seña: ${gestureOf(d.sena)}` : `Viste a ${nameNow(d.playerId)}: ${gestureOf(d.sena)}`,
        'sena',
      );
    };
    socket.on('sena:made', onSena);
    const onTiebreak = (d: { rounds: number; bases: number }) => {
      setAnnounce({ title: 'Empate', sub: `${d.rounds} rondas de desempate de ${d.bases} bases`, mine: true, key: Date.now() });
      logRef.current(`Empate al final: se juegan ${d.rounds} rondas de desempate de ${d.bases} bases`, 'round');
    };
    socket.on('game:tiebreak', onTiebreak);
    // knocking on the table is a hand gesture: everybody sees and hears it
    const onAsked = (d: { playerId: string }) => {
      sceneRef.current?.askSenas(d.playerId);
      logRef.current(`${nameNow(d.playerId)} golpea la mesa: pide señas`, 'sena');
    };
    socket.on('sena:asked', onAsked);
    const onRoundScored = (d: { nosotrosScore: number; ellosScore: number; totalScores: { nosotros: number; ellos: number } }) => {
      const mine = latest.current.roomPlayers.find((p) => p.id === latest.current.myId)?.team === 'ellos' ? 'ellos' : 'nosotros';
      const other = mine === 'nosotros' ? 'ellos' : 'nosotros';
      const pts = (n: number) => (n > 0 ? `+${n}` : String(n));
      const sc = { nosotros: d.nosotrosScore, ellos: d.ellosScore };
      logRef.current(`Fin de ronda · tu equipo ${pts(sc[mine])} (total ${d.totalScores[mine]}) · rivales ${pts(sc[other])} (total ${d.totalScores[other]})`, 'round');
    };
    socket.on('game:roundScored', onRoundScored);
    socket.on('presence:look', onLook);
    socket.on('presence:arm', onArm);
    socket.on('presence:hover', onHover);
    return () => {
      socket.off('player:hand', onHand);
      socket.off('game:cardPlayed', onCardPlayed);
      socket.off('game:baseResolved', onBaseResolved);
      socket.off('game:gateReleased', onGateReleased);
      socket.off('game:bidDeclared', onBid);
      socket.off('sena:made', onSena);
      socket.off('game:tiebreak', onTiebreak);
      socket.off('sena:asked', onAsked);
      socket.off('game:roundScored', onRoundScored);
      socket.off('presence:look', onLook);
      socket.off('presence:arm', onArm);
      socket.off('presence:hover', onHover);
    };
  }, [socket, flash]);

  // transient lines fade after a while
  useEffect(() => {
    if (!status) return;
    const t = window.setTimeout(() => setStatus(''), 2600);
    return () => window.clearTimeout(t);
  }, [status]);
  useEffect(() => {
    if (!announce) return;
    const t = window.setTimeout(() => setAnnounce(null), 3600);
    return () => window.clearTimeout(t);
  }, [announce]);

  const gate = gameState?.readyGate ?? null;
  const iAmReady = Boolean(gate && gate.readyPlayerIds.includes(myId));
  const readyRef = useRef<() => void>(() => undefined);
  const handleReady = useCallback(() => {
    if (!socket || !roomCode) return;
    socket.emit('game:ready', { roomCode }, (res: { success: boolean; error?: string }) => {
      if (!res?.success) setStatus(res?.error || 'No se pudo confirmar');
    });
  }, [socket, roomCode]);
  readyRef.current = handleReady;

  const inGame = Boolean(gameState && (gameState.phase === 'bidding' || gameState.phase === 'playing'));
  const closeWheel = useCallback(() => setWheel(null), []);
  const makeSena = useCallback(
    (sena: Sena) => {
      setWheel(null);
      if (!socket || !roomCode) return;
      if (sceneRef.current?.isDealing) return setStatus('esperá a que terminen de repartir');
      socket.emit('sena:make', { roomCode, sena, ...sceneRef.current?.gaze() }, (res: { success: boolean; error?: string }) => {
        if (!res?.success) return setStatus(res?.error === 'Too fast' ? 'más despacio con las señas' : res?.error || 'No se pudo hacer la seña');
        const label = gestureOf(sena);
        setStatus(`hacés la seña: ${label}`);
        setEcho({ sena, ...wheelAt.current, key: Date.now() }); // your own face, where the wheel was
        logRef.current(`Hacés la seña: ${label}`, 'sena');
      });
    },
    [socket, roomCode],
  );
  const askSenas = useCallback(() => {
    setWheel(null);
    if (!socket || !roomCode) return;
    if (sceneRef.current?.isDealing) return setStatus('esperá a que terminen de repartir');
    socket.emit('sena:ask', { roomCode }, (res: { success: boolean; error?: string }) => {
      if (!res?.success) return setStatus(res?.error === 'Too fast' ? 'ya pediste, esperá un momento' : res?.error || 'No se pudo pedir señas');
      sceneRef.current?.askSenas(latest.current.myId);
      setStatus('golpeás la mesa: pedís señas');
      logRef.current('Pedís señas a tu equipo', 'sena');
    });
  }, [socket, roomCode]);
  const onMiddleDown = (e: React.PointerEvent | React.MouseEvent) => {
    if (e.button !== 1) return;
    e.preventDefault(); // no autoscroll
    if (e.type === 'pointerdown' && inGame) setWheel({ x: e.clientX, y: e.clientY, held: true });
  };

  // keyboard: H cycles the HUD, Enter confirms a pending gate, G opens the señas
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
      if (e.key === 'h' || e.key === 'H') togglePad();
      if (e.key === 'j' || e.key === 'J') setShowLog((v) => !v);
      if (e.key === 'r' || e.key === 'R') setShowRules(true);
      if ((e.key === 'p' || e.key === 'P') && inGame) askSenas();
      if (e.key === 'Escape' && tableAsk === 'copas') sceneRef.current?.chooseOnTable(null); // no jugarla
      if ((e.key === 'g' || e.key === 'G') && inGame) setWheel((w) => (w ? null : { x: window.innerWidth / 2, y: window.innerHeight / 2, held: false }));
      if (e.key === 'Enter' && gate && !iAmReady) handleReady();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [togglePad, gate, iAmReady, handleReady, inGame, askSenas, tableAsk]);

  // ---- the controls live on a slate at the back of the room (the DOM keeps hidden buttons)
  const hudActions = useRef<Record<string, () => void>>({});
  useEffect(() => {
    const icon = (el: JSX.Element) => renderToStaticMarkup(el);
    const items: HudItem[] = [
      { id: 'historial', label: 'historial', hint: 'Lo que pasó en la partida (J)', svg: icon(<GiBackwardTime />) },
      { id: 'reglas', label: 'reglas', hint: 'El manual de la mesa (R)', svg: icon(<GiBookCover />) },
      { id: 'ajustes', label: 'ajustes', hint: 'Sonido, cámara, dorso, señas (O)', svg: icon(<GiCog />) },
      { id: 'salir', label: 'salir', hint: 'Volver al lobby', svg: icon(<GiExitDoor />), danger: true },
    ];
    sceneRef.current?.setHud(items);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleLeaveGame = () => {
    if (socket && roomCode) socket.emit('room:leave', { roomCode });
    setRoomCode(null);
    if (!gameState) setReconnectToken(null);
    setRoomPlayers([]);
    setGameState(null);
    setPlayerHand([]);
    setCurrentPage('lobby');
  };
  hudActions.current = { historial: () => setShowLog((v) => !v), reglas: () => setShowRules(true), ajustes: () => openSettings(true), salir: handleLeaveGame };

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

  // ---- derived values, always from YOUR point of view
  const nameOf = (id?: string | null) => roomPlayers.find((p) => p.id === id)?.name || '—';
  const me = roomPlayers.find((p) => p.id === myId);
  const myTeam: AssignedTeam = me?.team === 'ellos' ? 'ellos' : 'nosotros';
  const rivalTeam: AssignedTeam = myTeam === 'nosotros' ? 'ellos' : 'nosotros';
  const relLabel = (team?: string) => (team === myTeam ? 'Tu equipo' : 'Rivales');
  const teamOfPlayer = (id?: string | null) => roomPlayers.find((p) => p.id === id)?.team;
  const maxBases = gameState ? gameState.structureSequence[gameState.roundIndex] ?? 0 : 0;
  const basesPlayed = (gameState?.basesWon.nosotros || 0) + (gameState?.basesWon.ellos || 0);
  const bidOf = (team: AssignedTeam) => gameState?.bids.find((b) => b.team === team);
  const initialDraw = gameState?.initialDraw;
  const isMyDraw = gameState?.phase === 'initial_draw' && !initialDraw?.completed && initialDraw?.currentDrawerPlayerId === myId;
  drawRef.current = () => {
    if (isMyDraw) handleInitialDraw();
  };
  useEffect(() => {
    sceneRef.current?.setDeckHint(Boolean(isMyDraw));
  }, [isMyDraw]);
  const canChooseOros = Boolean(gameState?.pendingOrosChoice && gameState.pendingOrosChoice.chooserPlayerId === myId);
  // As de Oros: asked on the table — a tag over each teammate you may pick, or click their face
  const orosOptions = canChooseOros ? gameState?.pendingOrosChoice?.options ?? [] : [];
  const orosKey = orosOptions.join(',');
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || !orosKey) return;
    let live = true;
    setTableAsk('oros');
    void scene.askOpener(orosKey.split(',').map((id) => ({ id, name: nameOf(id) }))).then((id) => {
      if (!live) return;
      setTableAsk(null);
      if (id) handleChooseOros(id);
    });
    return () => {
      live = false;
      setTableAsk(null);
      scene.cancelTableChoice();
    };
  }, [orosKey]); // eslint-disable-line react-hooks/exhaustive-deps

  let phaseLine = '';
  if (gameState?.phase === 'initial_draw') {
    phaseLine = initialDraw?.completed
      ? `${nameOf(initialDraw.dealerPlayerId)} reparte · Mano: ${nameOf(initialDraw.manoPlayerId)}`
      : isMyDraw
        ? 'Sorteo: hacé click en el mazo del centro de la mesa para sacar una carta'
        : `Sorteo: saca ${nameOf(initialDraw?.currentDrawerPlayerId)}`;
  } else if (gameState?.phase === 'bidding') {
    const bidder = gameState.currentBidPlayerId;
    const first = gameState.bids[0];
    const already = first ? `${relLabel(first.team)} pidió ${first.value}${first.isKamikaze ? ' (kamikaze)' : ''} · ` : '';
    phaseLine = already + (bidder === myId ? 'te toca declarar' : `declara ${nameOf(bidder)} (${relLabel(teamOfPlayer(bidder)).toLowerCase()})`);
  } else if (gameState?.phase === 'playing') {
    phaseLine = gameState.currentTurnPlayerId === myId
      ? (isTouch ? 'Tu turno — tocá una carta, o mantené y arrastrala' : 'Tu turno — click en una carta, o mantené para llevarla vos')
      : `Juega ${nameOf(gameState.currentTurnPlayerId)} (${relLabel(teamOfPlayer(gameState.currentTurnPlayerId)).toLowerCase()})`;
  } else if (gameState?.phase === 'base_resolution' && !gate) {
    phaseLine = !gameState.pendingOrosChoice
      ? 'Resolviendo la base…'
      : canChooseOros
        ? 'As de Oros: elegí quién abre'
        : `As de Oros: elige ${nameOf(gameState.pendingOrosChoice.chooserPlayerId)}`;
  }

  // The LED panel only says what matters, in as few words as possible: whose turn it is, what was
  // asked, what you have to choose. (The longer line above stays in the page for screen readers; the
  // transient messages — animations, hints — never go on the panel.)
  let ledLine = '';
  if (gameState?.phase === 'initial_draw') {
    ledLine = initialDraw?.completed ? '' : isMyDraw ? 'Sacá una carta' : `Saca ${nameOf(initialDraw?.currentDrawerPlayerId)}`;
  } else if (gameState?.phase === 'bidding') {
    const first = gameState.bids[0];
    const bidder = gameState.currentBidPlayerId;
    ledLine = first
      ? `${first.team === myTeam ? 'Tu equipo' : 'Rival'} pide ${first.value}${first.isKamikaze ? ' (kamikaze)' : ''}`
      : bidder === myId
        ? 'Tu turno'
        : `Turno de ${nameOf(bidder)}`;
  } else if (gameState?.phase === 'playing') {
    ledLine = gameState.currentTurnPlayerId === myId ? 'Tu turno' : `Turno de ${nameOf(gameState.currentTurnPlayerId)}`;
  } else if (gameState?.phase === 'base_resolution' && !gate && gameState.pendingOrosChoice) {
    ledLine = canChooseOros ? 'Elegí quién abre' : `Elige ${nameOf(gameState.pendingOrosChoice.chooserPlayerId)}`;
  }
  if (gate) ledLine = 'Marcá el tilde';
  useEffect(() => {
    sceneRef.current?.setHudMessage(ledLine, /^Rival pide/.test(ledLine));
  }, [ledLine]);

  // the card winning the base so far floats; it changes hands as better cards are played
  const leaderId = (() => {
    const played = gameState?.currentBaseCards ?? [];
    if (!gameState || played.length === 0 || (gameState.phase !== 'playing' && gameState.phase !== 'base_resolution')) return null;
    try {
      return resolveBase(played, gameState.acePowers, gameState.playDirection).playerId;
    } catch {
      return null;
    }
  })();
  useEffect(() => {
    sceneRef.current?.markLeader(leaderId);
  }, [leaderId]);

  // the scoresheet's content (written by hand when the notepad opens)
  const sheetTeam = (team: AssignedTeam): AnotadorTeam => {
    const bid = bidOf(team);
    return {
      label: relLabel(team),
      sub: teamName(team),
      score: gameState?.scores[team] ?? 0,
      asked: bid ? String(bid.value) : gameState?.phase === 'bidding' ? '…' : '—',
      kamikaze: Boolean(bid?.isKamikaze),
      won: gameState?.basesWon[team] ?? 0,
      bid: bid ? bid.value : null,
      kamikazes: gameState?.kamikazesRemaining[team] ?? 0,
      mine: team === myTeam,
      acting:
        (gameState?.phase === 'bidding' && teamOfPlayer(gameState.currentBidPlayerId) === team) ||
        (gameState?.phase === 'playing' && teamOfPlayer(gameState.currentTurnPlayerId) === team),
    };
  };
  const sheet: AnotadorData = {
    round: gameState ? gameState.roundIndex + 1 : 0,
    rounds: gameState?.structureSequence.length ?? 0,
    tiebreak: Boolean(gameState?.tiebreak),
    base: Math.min(basesPlayed + (gate ? 0 : 1), maxBases),
    bases: maxBases,
    clockwise: gameState?.playDirection === 'horario',
    teams: [sheetTeam(myTeam), sheetTeam(rivalTeam)],
    players: roomPlayers.map((p) => ({
      name: p.id === myId ? `${p.name} (vos)` : p.name,
      cards: p.handCount ?? 0,
      tags: [
        p.id === gameState?.currentManoPlayerId && gameState?.phase !== 'initial_draw' ? 'mano' : '',
        p.id === gameState?.currentTurnPlayerId && gameState?.phase === 'playing' ? 'juega' : '',
        p.id === gameState?.currentBidPlayerId && gameState?.phase === 'bidding' ? 'declara' : '',
        p.isBot ? 'bot' : '',
        p.isConnected ? '' : 'se fue',
      ].filter(Boolean).join(' · '),
      mine: p.team === myTeam,
      ready: gate ? gate.readyPlayerIds.includes(p.id) : null,
    })),
    room: roomCode || '',
  };

  const gateWinner = gate ? roomPlayers.find((p) => p.id === gate.winnerPlayerId) : null;
  const gateCard = gate?.baseCards.find((c) => c.playerId === gate.winnerPlayerId)?.card;

  const roundRow = (team: AssignedTeam) => {
    const r = gate?.round;
    if (!r) return null;
    const bid = r.bids.find((b) => b.team === team);
    const won = r.basesWon[team];
    const pts = r.points[team];
    const met = bid ? bid.value === won : false;
    return (
      <tr className={team === myTeam ? 'mine' : 'rival'}>
        <td>{relLabel(team)} <span className="dim">({teamName(team)})</span></td>
        <td>{bid ? bid.value : '—'}{bid?.isKamikaze ? ' ✶' : ''}</td>
        <td>{won}</td>
        <td className={met ? 'ok' : 'bad'}>{met ? 'cumplió' : 'falló'}</td>
        <td className={pts >= 0 ? 'ok' : 'bad'}>{pts > 0 ? `+${pts}` : pts}</td>
        <td><b>{r.totals[team]}</b></td>
      </tr>
    );
  };

  // the reduced scoreboard, live on the notepad's page
  const liveKey = JSON.stringify([sheet.round, sheet.rounds, sheet.tiebreak, sheet.base, sheet.bases, sheet.clockwise, sheet.teams]);
  useEffect(() => {
    sceneRef.current?.setLiveSheet(gameState ? { round: sheet.round, rounds: sheet.rounds, tiebreak: sheet.tiebreak, base: sheet.base, bases: sheet.bases, clockwise: sheet.clockwise, teams: sheet.teams } : null);
  }, [liveKey, gameState === null]); // eslint-disable-line react-hooks/exhaustive-deps

  // a round is over: the camera comes to the notepad, whose page carries the report (and the tick)
  const roundGate = gate && gate.kind === 'round' && gate.round ? gate : null;
  const baseGate = gate && gate.kind === 'base' ? gate : null;
  const reportRows = roundGate
    ? ([myTeam, rivalTeam] as AssignedTeam[]).map((team) => {
        const r = roundGate.round!;
        const bid = r.bids.find((b) => b.team === team);
        const pts = r.points[team];
        return {
          label: relLabel(team),
          asked: `${bid ? bid.value : '—'}${bid?.isKamikaze ? ' ✶' : ''}`,
          won: r.basesWon[team],
          met: bid ? bid.value === r.basesWon[team] : false,
          pts: pts > 0 ? `+${pts}` : String(pts),
          total: r.totals[team],
          mine: team === myTeam,
        };
      })
    : null;
  const standings = baseGate
    ? [
        { text: `Tu equipo lleva ${gameState?.basesWon[myTeam] ?? 0}${bidOf(myTeam) ? ` (pidió ${bidOf(myTeam)!.value})` : ''}`, mine: true },
        { text: `Rivales llevan ${gameState?.basesWon[rivalTeam] ?? 0}${bidOf(rivalTeam) ? ` (pidieron ${bidOf(rivalTeam)!.value})` : ''}`, mine: false },
      ]
    : null;
  const reportKey = gate
    ? JSON.stringify([reportRows, standings, gate.readyPlayerIds, gate.kind, gate.baseNumber, gate.round?.index, roomPlayers.map((p) => p.id + p.isConnected), gateWinner?.name, gateCard, gameState?.scores])
    : '';
  useEffect(() => {
    if (!gate || (!reportRows && !standings)) {
      // let the pencil finish the tick you just pressed before the camera goes back to your seat
      const t = window.setTimeout(() => sceneRef.current?.setRoundReport(null), 1100);
      return () => window.clearTimeout(t);
    }
    setPadOpen(false); // the floating sheet would cover the page
    const players = roomPlayers.filter((p) => p.isConnected).map((p) => ({ name: p.id === myId ? 'vos' : p.name, ready: gate.readyPlayerIds.includes(p.id), mine: p.team === myTeam }));
    const winner = `${gateWinner?.name ?? '—'} (${relLabel(gate.winnerTeam).toLowerCase()})${gateCard ? ` con ${cardName(gateCard)}` : ''}`;
    sceneRef.current?.setRoundReport(
      roundGate && reportRows
        ? { kind: 'round', title: `Ronda ${(roundGate.round?.index ?? 0) + 1} terminada`, lastBase: `Última base: ${winner}`, rows: reportRows, players, ready: iAmReady }
        : { kind: 'base', title: `Base ${gate.baseNumber} de ${gate.basesInRound}`, lastBase: `La gana ${winner}`, standings: standings ?? [], totals: { mine: gameState?.scores[myTeam] ?? 0, rival: gameState?.scores[rivalTeam] ?? 0 }, rows: [], players, ready: iAmReady },
    );
  }, [reportKey, iAmReady]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="table-page" onPointerDown={onMiddleDown} onMouseDown={onMiddleDown}>
      {view.reticle && <div className={`reticle${aimFace ? ' on-face' : ''}`} aria-hidden />}
      {echo && <SenaEcho echo={echo} />}
      {wheel && inGame && <SenaWheel open={wheel} onPick={makeSena} onAsk={askSenas} onClose={closeWheel} />}
      <div ref={mountRef} className="table-canvas" />

      <header className="hud">
        <div className="rotate-hint">girá el celular para jugar mejor</div>
        <button
          type="button"
          className="touch-senas"
          aria-label="Señas"
          onClick={() => setWheel((w) => (w ? null : { x: window.innerWidth / 2, y: window.innerHeight / 2, held: false }))}
        >
          señas
        </button>
        <nav className="sr-only" aria-label="Controles de la partida">
          <button className="hud-tab" onClick={togglePad} title="Tecla H"><GiScrollUnfurled aria-hidden /> anotador</button>
          <button className="hud-tab" onClick={() => setShowLog((v) => !v)} title="Tecla J"><GiBookCover aria-hidden /> historial</button>
          <button className="hud-tab" onClick={() => setShowRules(true)} title="Tecla R"><GiScrollUnfurled aria-hidden /> reglas</button>
          <SettingsButton />
          <button className="hud-tab danger" onClick={handleLeaveGame}><GiExitDoor aria-hidden /> salir</button>
        </nav>
      </header>

      {padOpen && <Anotador data={sheet} full={padFull} onToggleFull={() => setFull(!padFull)} onClose={() => setPadOpen(false)} />}

      {showLog && (
        <aside className="pad log-pad" aria-label="Historial de la partida">
          <div className="pad-head">
            <span>Historial</span>
            <button className="log-close" onClick={() => setShowLog(false)} aria-label="Cerrar historial">×</button>
          </div>
          <ol className="log-list" ref={(el) => { if (el) el.scrollTop = el.scrollHeight; }}>
            {log.length === 0 && <li className="dim">todavía no pasó nada</li>}
            {log.map((e) => (
              <li key={e.id} className={`log-${e.kind}`}>
                <span className="log-n">{e.round}</span>
                {e.text}
              </li>
            ))}
          </ol>
        </aside>
      )}

      {/* the text lives on the slate in the room; this copy stays for screen readers (and the tests) */}
      <div className="phase-line">{status || phaseLine}</div>

      {announce && (
        <div key={`announce-${announce.key}`} className={`announce ${announce.mine ? 'mine' : 'rival'}`}>
          <div className="announce-title">{announce.title}</div>
          <div className="announce-sub">{announce.sub}</div>
        </div>
      )}

      {!gameState && (
        <div className="overlay-center">
          <div className="ritual-panel">
            <h2>Reconectando…</h2>
            <p>Buscando la sala {roomCode || ''} en el servidor.</p>
            <button className="ritual-btn" onClick={handleLeaveGame}>volver al lobby</button>
          </div>
        </div>
      )}


      {gate && (
        <div className="overlay-bottom">
          <div className="gate-panel on-notepad">
            {gate.kind === 'base' ? (
              <>
                <h2>Base {gate.baseNumber} de {gate.basesInRound}</h2>
                <p>
                  La gana <b>{gateWinner?.name ?? '—'}</b>{' '}
                  <span className={gate.winnerTeam === myTeam ? 'mine' : 'rival'}>({relLabel(gate.winnerTeam).toLowerCase()})</span>
                  {gateCard && <> con <b>{cardName(gateCard)}</b></>}
                </p>
                <p className="dim">
                  Tu equipo lleva {gameState?.basesWon[myTeam] ?? 0}
                  {bidOf(myTeam) ? ` (pidió ${bidOf(myTeam)!.value})` : ''} · Rivales llevan {gameState?.basesWon[rivalTeam] ?? 0}
                  {bidOf(rivalTeam) ? ` (pidieron ${bidOf(rivalTeam)!.value})` : ''}
                </p>
              </>
            ) : (
              <>
                <h2>Ronda {(gate.round?.index ?? 0) + 1} terminada</h2>
                <p className="dim">
                  Última base: {gateWinner?.name ?? '—'} ({relLabel(gate.winnerTeam).toLowerCase()}){gateCard ? ` con ${cardName(gateCard)}` : ''}
                </p>
                <table className="round-table">
                  <thead>
                    <tr><th /><th>pidió</th><th>ganó</th><th /><th>puntos</th><th>total</th></tr>
                  </thead>
                  <tbody>
                    {roundRow(myTeam)}
                    {roundRow(rivalTeam)}
                  </tbody>
                </table>
              </>
            )}
            <div className="gate-ready">
              {roomPlayers.filter((p) => p.isConnected).map((p) => (
                <span key={p.id} className={gate.readyPlayerIds.includes(p.id) ? 'chip ok' : 'chip'}>
                  {gate.readyPlayerIds.includes(p.id) ? '✓' : '…'} {p.id === myId ? 'vos' : p.name}
                </span>
              ))}
            </div>
            <button className="ritual-btn" disabled={iAmReady} onClick={handleReady}>
              {iAmReady ? 'esperando a los demás…' : gate.kind === 'base' ? 'listo · siguiente base (enter)' : 'listo · repartir (enter)'}
            </button>
          </div>
        </div>
      )}

      {tableAsk && (
        <nav className="sr-only" aria-label={tableAsk === 'copas' ? 'As de Copas: sentido de juego' : 'As de Oros: quién abre la próxima base'}>
          {tableAsk === 'copas' ? (
            <>
              <button type="button" onClick={() => sceneRef.current?.chooseOnTable('mantener')}>mantener el sentido</button>
              <button type="button" onClick={() => sceneRef.current?.chooseOnTable('invertir')}>invertir el sentido</button>
              <button type="button" onClick={() => sceneRef.current?.chooseOnTable(null)}>no jugarla</button>
            </>
          ) : (
            gameState?.pendingOrosChoice?.options.map((id) => (
              <button key={id} type="button" onClick={() => sceneRef.current?.chooseOnTable(id)}>{nameOf(id)} abre la próxima base</button>
            ))
          )}
        </nav>
      )}

      {showRules && <Rulebook onClose={() => setShowRules(false)} />}

      {!soundOn && (
        <button type="button" className="sound-unlock" onClick={resumeAudio} title="El navegador espera un click para dejar sonar la página">
          <GiSpeakerOff aria-hidden /> activar sonido
        </button>
      )}

      {stamp && (
        <div key={`stamp-${stamp.key}`} className="stamp on">{stamp.text}</div>
      )}

      <div className="help-line">
        H: anotador · J: historial · R: reglas · O: ajustes · clic del medio o G: señas · P: pedir señas · arrastrá sobre la mesa: mirar · click en carta: jugar · mantené: mover el brazo y amagar · clic der: zoom
      </div>

      {gameState?.phase === 'bidding' && <BiddingPanel onAskSenas={askSenas} />}
      <LiveBidDisplay />
      <RoundScoringPanel myTeam={myTeam} />
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
