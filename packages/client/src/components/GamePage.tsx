import { useEffect, useState, useMemo } from 'react';
import type { Card } from '@la-base/shared';
import { resolveBase } from '@la-base/shared';
import { useGameStore, type RoomPlayer } from '../store/gameStore';
import { useSocket } from '../hooks/useSocket';
import { useGameEvents } from '../hooks/useGameEvents';
import { useToast } from '../hooks/useToast';
import { BiddingPanel } from './BiddingPanel';
import { BaseResolutionPanel } from './BaseResolutionPanel';
import { RoundScoringPanel } from './RoundScoringPanel';
import { LiveBidDisplay } from './LiveBidDisplay';
import { ToastContainer } from './ToastContainer';

const teamClass = {
  nosotros: 'border-blue-400 bg-blue-950/90 text-blue-50',
  ellos: 'border-rose-400 bg-rose-950/90 text-rose-50',
};

const teamBadgeClass = {
  nosotros: 'bg-blue-400 text-blue-950',
  ellos: 'bg-rose-400 text-rose-950',
};

function cardLabel(card: { value: number; suit: string }) {
  const suitSymbol: Record<string, string> = {
    oros: '♦',
    copas: '♥',
    espadas: '♠',
    bastos: '♣',
  };

  return `${card.value}${suitSymbol[card.suit] || card.suit}`;
}

function directionLabel(direction?: string) {
  if (direction === 'antihorario') return 'Antihorario';
  if (direction === 'horario') return 'Horario';
  return '-';
}

function playerPosition(index: number, total: number) {
  const angle = 90 + (360 / Math.max(total, 1)) * index;
  const radiusX = 38;
  const radiusY = 38;
  const x = 50 + radiusX * Math.cos((angle * Math.PI) / 180);
  const y = 50 + radiusY * Math.sin((angle * Math.PI) / 180);

  return {
    left: `${x}%`,
    top: `${y}%`,
    transform: 'translate(-50%, -50%)',
  };
}

function PlayerSeat({
  player,
  index,
  total,
  isCurrentPlayer,
  isTurn,
  isMano,
  isBidder,
  isHost,
  onKick,
}: {
  player: RoomPlayer;
  index: number;
  total: number;
  isCurrentPlayer: boolean;
  isTurn: boolean;
  isMano: boolean;
  isBidder: boolean;
  isHost: boolean;
  onKick: (playerId: string) => void;
}) {
  const initials = player.name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div
      className={`absolute w-40 rounded border-2 p-3 shadow-xl transition ${teamClass[player.team as 'nosotros' | 'ellos']} ${
        isTurn || isBidder ? 'action-seat border-emerald-400 ring-4 ring-emerald-300 scale-105' : ''
      } ${isCurrentPlayer ? 'ring-4 ring-yellow-300 border-yellow-300' : ''}`}
      style={playerPosition(index, total)}
    >
      <div className="flex items-center gap-3">
        <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-2 text-lg font-black shadow-lg ${
          isCurrentPlayer ? 'border-yellow-200 bg-yellow-300 text-yellow-950' : 'border-white/40 bg-slate-900/15 text-white'
        }`}>
          {initials || '?'}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold">{player.name}</p>
          <span className={`mt-1 inline-block rounded px-2 py-1 text-[10px] font-bold ${teamBadgeClass[player.team as 'nosotros' | 'ellos']}`}>
            {player.team === 'nosotros' ? 'NOS' : 'ELL'}
          </span>
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between text-xs opacity-90">
        <span>{player.isConnected ? 'En línea' : 'Desconectado'}</span>
        <span>{player.handCount ?? 0} cartas</span>
      </div>
      <div className="mt-2 flex flex-wrap gap-1 text-[10px] font-bold uppercase">
        {isCurrentPlayer && <span className="rounded bg-yellow-300 px-2 py-1 text-yellow-950">Vos</span>}
        {isMano && <span className="rounded bg-cyan-300 px-2 py-1 text-cyan-950">Mano</span>}
        {isTurn && <span className="rounded bg-emerald-300 px-2 py-1 text-emerald-950">Turno</span>}
        {isBidder && <span className="rounded bg-emerald-300 px-2 py-1 text-emerald-950">Canta</span>}
        {isHost && !isCurrentPlayer && (
          <button
            onClick={() => onKick(player.id)}
            className="rounded bg-red-600 hover:bg-red-700 px-2 py-1 text-white transition"
            title="Echar jugador"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}

function rotatePlayersToBottom(players: RoomPlayer[], currentPlayerId?: string | null, socketId?: string) {
  const currentIndex = players.findIndex((player) => player.id === currentPlayerId || player.id === socketId);
  if (currentIndex === -1) return players;

  return [
    ...players.slice(currentIndex),
    ...players.slice(0, currentIndex),
  ];
}

function BaseProgress({
  label,
  team,
  bid,
  won,
}: {
  label: string;
  team: 'nosotros' | 'ellos';
  bid?: number;
  won: number;
}) {
  const requested = bid ?? 0;
  const circles = Array.from({ length: requested }, (_, index) => index < won);
  const extras = Math.max(0, won - requested);

  return (
    <div className={`rounded p-3 ${team === 'nosotros' ? 'bg-blue-950' : 'bg-rose-950'}`}>
      <div className="flex items-center justify-between gap-2">
        <p className={`text-sm font-bold ${team === 'nosotros' ? 'text-blue-200' : 'text-rose-200'}`}>{label}</p>
        <p className="text-xs text-zinc-300">pidió {bid ?? '-'}</p>
      </div>
      <div className="mt-3 flex min-h-5 flex-wrap gap-2">
        {circles.length > 0 ? circles.map((filled, index) => (
          <span
            key={index}
            className={`h-4 w-4 rounded-full border-2 ${
              filled
                ? team === 'nosotros' ? 'border-blue-300 bg-blue-300' : 'border-rose-300 bg-rose-300'
                : team === 'nosotros' ? 'border-blue-300' : 'border-rose-300'
            }`}
          />
        )) : <span className="text-xs text-zinc-400">sin pedido</span>}
        {Array.from({ length: extras }, (_, index) => (
          <span key={`extra-${index}`} className="h-4 w-4 rounded-full border-2 border-yellow-300 bg-yellow-300" />
        ))}
      </div>
      <p className="mt-2 text-xs text-zinc-300">ganadas {won}</p>
    </div>
  );
}

export function GamePage() {
  const socket = useSocket();
  useGameEvents();
  const { toasts, removeToast } = useToast();
  const [keepMeAtBottom, setKeepMeAtBottom] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('laBase.keepMeAtBottom') === 'true';
  });
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const [copasDirection, setCopasDirection] = useState<'mantener' | 'invertir'>('mantener');
  const [actionError, setActionError] = useState('');
  const [isPlayingCard, setIsPlayingCard] = useState(false);
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

  const isBiddingPhase = gameState?.phase === 'bidding';
  const isMyTurn = gameState?.phase === 'playing' && (gameState.currentTurnPlayerId === currentPlayer?.id || gameState.currentTurnPlayerId === socket?.id);
  const hostPlayer = roomPlayers[0];
  const isHost = Boolean(hostPlayer && hostPlayer.id === currentPlayer?.id);
  const currentTurnPlayer = roomPlayers.find((player) => player.id === gameState?.currentTurnPlayerId);
  const lastBaseWinner = roomPlayers.find((player) => player.id === gameState?.lastBaseWinnerPlayerId);
  const maxBases = gameState?.structureSequence[gameState.roundIndex] || 0;
  const basesPlayed = (gameState?.basesWon.nosotros || 0) + (gameState?.basesWon.ellos || 0);
  const orderedPlayers = keepMeAtBottom
    ? rotatePlayersToBottom(roomPlayers, currentPlayer?.id, socket?.id)
    : roomPlayers;
  const nosotrosBid = gameState?.bids.find((bid) => bid.team === 'nosotros')?.value;
  const ellosBid = gameState?.bids.find((bid) => bid.team === 'ellos')?.value;
  const selectedIsCopas = Boolean(selectedCard && selectedCard.suit === 'copas' && selectedCard.value === 1 && gameState?.acePowers.copas);
  const canChooseOros = Boolean(gameState?.pendingOrosChoice && (gameState.pendingOrosChoice.chooserPlayerId === currentPlayer?.id || gameState.pendingOrosChoice.chooserPlayerId === socket?.id));
  const isInitialDrawPhase = gameState?.phase === 'initial_draw';
  const initialDraw = gameState?.initialDraw;
  const currentDrawerPlayer = roomPlayers.find((player) => player.id === initialDraw?.currentDrawerPlayerId);
  const initialDealerPlayer = roomPlayers.find((player) => player.id === initialDraw?.dealerPlayerId);
  const initialManoPlayer = roomPlayers.find((player) => player.id === initialDraw?.manoPlayerId);
  const isMyInitialDrawTurn = Boolean(
    isInitialDrawPhase &&
    initialDraw?.currentDrawerPlayerId &&
    (initialDraw.currentDrawerPlayerId === currentPlayer?.id || initialDraw.currentDrawerPlayerId === socket?.id)
  );

  useEffect(() => {
    localStorage.setItem('laBase.keepMeAtBottom', String(keepMeAtBottom));
  }, [keepMeAtBottom]);

  // Calculate winning card once, not in every render iteration
  const winningCard = useMemo(() => {
    try {
      if (!gameState?.currentBaseCards || gameState.currentBaseCards.length === 0) return null;
      return resolveBase(gameState.currentBaseCards, gameState.acePowers, gameState.playDirection);
    } catch (err) {
      console.warn('[GamePage] Could not resolve base:', err);
      return null;
    }
  }, [gameState?.currentBaseCards, gameState?.acePowers, gameState?.playDirection]);

  const handleLeaveGame = () => {
    if (socket && roomCode) {
      socket.emit('room:leave', { roomCode });
    }
    setRoomCode(null);
    if (!gameState) {
      setReconnectToken(null);
    }
    setRoomPlayers([]);
    setGameState(null);
    setPlayerHand([]);
    setCurrentPage('lobby');
  };

  const handleKickPlayer = (playerId: string) => {
    if (!socket || !roomCode || !isHost) return;
    socket.emit('room:kick', {
      roomCode,
      playerId,
    });
  };

  const handleSelectCard = (card: Card) => {
    if (!isMyTurn) return;
    setActionError('');
    if (selectedCard?.suit === card.suit && selectedCard.value === card.value) {
      handlePlaySelectedCard();
      return;
    }
    setSelectedCard(card);
    setCopasDirection('mantener');
  };

  const handlePlaySelectedCard = () => {
    if (!socket || !roomCode || !selectedCard || !isMyTurn) return;

    setIsPlayingCard(true);
    setActionError('');
    socket.emit('card:play', {
      roomCode,
      card: selectedCard,
      copasDirection: selectedIsCopas ? copasDirection : undefined,
    }, (response: any) => {
      setIsPlayingCard(false);
      if (response.success) {
        setSelectedCard(null);
        setCopasDirection('mantener');
      } else {
        setActionError(response.error || 'No se pudo jugar la carta');
      }
    });
  };

  const handleChooseOros = (playerId: string) => {
    if (!socket || !roomCode) return;
    socket.emit('ace:oros:choose', { roomCode, playerId }, (response: any) => {
      if (!response.success) {
        setActionError(response.error || 'No se pudo elegir la mano');
      }
    });
  };

  const handleInitialDraw = () => {
    if (!socket || !roomCode || !isMyInitialDrawTurn) return;

    setActionError('');
    socket.emit('draw:initialCard', { roomCode }, (response: any) => {
      if (!response.success) {
        setActionError(response.error || 'No se pudo sacar carta');
      }
    });
  };

  return (
    <div className="h-screen bg-zinc-950 p-3 text-white flex flex-col">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">La Base</h1>
          <p className="text-xs text-zinc-300">Sala {roomCode || 'cargando...'}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <div className="rounded bg-zinc-900 px-3 py-1">
            <p className="text-zinc-400">Vos</p>
            <p className="font-bold text-sm">{currentPlayer?.name}</p>
          </div>
          <div className="rounded bg-zinc-900 px-3 py-1">
            <p className="text-zinc-400">Ronda</p>
            <p className="font-bold text-sm">{gameState ? gameState.roundIndex + 1 : 0} · {basesPlayed}/{maxBases}</p>
          </div>
          <button
            onClick={handleLeaveGame}
            className="rounded bg-red-600 px-3 py-2 font-semibold text-white hover:bg-red-700 text-xs"
          >
            Salir
          </button>
        </div>
      </div>

      <div className="flex-1 grid gap-2 grid-cols-[1fr_250px] overflow-hidden">
        <div className="relative overflow-hidden rounded bg-[radial-gradient(circle_at_center,#374151_0,#1f2937_50%,#09090b_82%)] shadow-2xl">
          <div className="absolute inset-8 rounded-full border-[18px] border-zinc-900/75 bg-zinc-700/60 shadow-inner" />
          <div className="absolute inset-[18%] rounded-full border border-white/10 bg-zinc-950/35" />

          <label className="absolute left-4 top-4 z-30 flex cursor-pointer items-center gap-3 rounded bg-zinc-950/80 px-3 py-2 text-xs font-bold text-zinc-100 shadow-lg ring-1 ring-white/10">
            <span>Mi asiento abajo</span>
            <button
              type="button"
              role="switch"
              aria-checked={keepMeAtBottom}
              onClick={() => setKeepMeAtBottom((enabled) => !enabled)}
              className={`relative h-6 w-11 rounded-full transition ${
                keepMeAtBottom ? 'bg-emerald-500' : 'bg-zinc-700'
              }`}
            >
              <span
                className={`absolute top-1 h-4 w-4 rounded-full bg-white transition ${
                  keepMeAtBottom ? 'left-6' : 'left-1'
                }`}
              />
            </button>
          </label>

          <div className="absolute left-1/2 top-1/2 z-20 w-[min(620px,62%)] -translate-x-1/2 -translate-y-1/2 rounded bg-emerald-950/35 p-5 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12),0_20px_48px_rgba(0,0,0,0.35)] backdrop-blur-sm">
            {isInitialDrawPhase ? (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-emerald-200">Sorteo inicial</p>
                    <p className="text-xs text-zinc-300">
                      {initialDraw?.completed
                        ? `${initialDealerPlayer?.name || 'Alguien'} reparte · Mano: ${initialManoPlayer?.name || '-'}`
                        : `Saca ${currentDrawerPlayer?.name || '-'}`}
                    </p>
                  </div>
                  <button
                    onClick={handleInitialDraw}
                    disabled={!isMyInitialDrawTurn || initialDraw?.completed}
                    className={`h-28 w-20 rounded border-2 p-2 text-center font-black shadow-xl transition ${
                      isMyInitialDrawTurn && !initialDraw?.completed
                        ? 'border-emerald-300 bg-emerald-500 text-emerald-950 hover:-translate-y-1'
                        : 'border-zinc-600 bg-zinc-900 text-zinc-500'
                    }`}
                  >
                    <span className="block text-3xl">▥</span>
                    <span className="mt-3 block text-xs uppercase">
                      {isMyInitialDrawTurn ? 'Sacar' : 'Mazo'}
                    </span>
                  </button>
                </div>

                <div className="mt-4 flex min-h-32 flex-wrap items-center justify-center gap-3">
                  {initialDraw?.drawnCards.length ? (
                    initialDraw.drawnCards.map((drawn) => {
                      const player = roomPlayers.find((p) => p.id === drawn.playerId);
                      const isDealer = drawn.playerId === initialDraw.dealerPlayerId;

                      return (
                        <div
                          key={drawn.playerId}
                          className={`card-drawn h-28 w-20 rounded bg-white p-2 text-zinc-900 shadow-xl transition ${
                            isDealer ? 'border-4 border-emerald-400 scale-105' : ''
                          }`}
                          style={{ animationDelay: `${drawn.order * 90}ms` }}
                        >
                          <p className="text-2xl font-black">{cardLabel(drawn.card)}</p>
                          <p className="mt-6 truncate text-xs font-bold">{player?.name || 'Jugador'}</p>
                        </div>
                      );
                    })
                  ) : (
                    <div className="h-28 w-20 rounded border-2 border-dashed border-white/20 bg-slate-900/5" />
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                  <div className="rounded bg-blue-950/90 p-2 text-center">
                    <p className="text-blue-300">Nosotros</p>
                    <p className="text-2xl font-bold">{gameState?.basesWon.nosotros || 0}</p>
                  </div>
                  <div className="rounded bg-rose-950/90 p-2 text-center">
                    <p className="text-rose-300">Ellos</p>
                    <p className="text-2xl font-bold">{gameState?.basesWon.ellos || 0}</p>
                  </div>
                  <div className="col-span-2 flex items-center justify-center rounded bg-zinc-950/65 px-3 py-2 text-center text-zinc-300 sm:col-span-2">
                    {gameState?.currentBaseCards?.length
                      ? `${gameState.currentBaseCards.length}/${roomPlayers.length} cartas jugadas`
                      : 'Esperando cartas'}
                  </div>
                </div>

                <div className="mt-4 flex min-h-32 items-center justify-center gap-3">
                  {gameState?.currentBaseCards && gameState.currentBaseCards.length > 0 ? (
                    gameState.currentBaseCards.map((played, idx) => {
                      const player = roomPlayers.find((p) => p.id === played.playerId);
                      // Check if this is the winning card (calculated once, not per render)
                      const isWinning = winningCard && played.card.suit === winningCard.card.suit && played.card.value === winningCard.card.value && played.playerId === winningCard.playerId;

                      return (
                        <div
                          key={`${played.playerId}-${idx}`}
                          className={`card-played h-28 w-20 rounded bg-white p-2 text-zinc-900 shadow-xl transition ${
                            isWinning ? 'border-4 border-green-500 scale-105' : ''
                          }`}
                          style={{ animationDelay: `${idx * 70}ms` }}
                        >
                          <p className="text-2xl font-black">{cardLabel(played.card)}</p>
                          <p className="mt-6 truncate text-xs font-bold">{player?.name || 'Jugador'}</p>
                        </div>
                      );
                    })
                  ) : (
                    <div className="h-28 w-20 rounded border-2 border-dashed border-white/20 bg-slate-900/5" />
                  )}
                </div>
              </>
            )}
          </div>

          {orderedPlayers.map((player, idx) => (
            <PlayerSeat
              key={player.id}
              player={player}
              index={idx}
              total={roomPlayers.length}
              isCurrentPlayer={player.id === currentPlayer?.id || player.id === socket?.id}
              isTurn={player.id === gameState?.currentTurnPlayerId}
              isMano={Boolean((!isInitialDrawPhase || initialDraw?.completed) && player.id === gameState?.currentManoPlayerId)}
              isBidder={player.id === gameState?.currentBidPlayerId}
              isHost={isHost}
              onKick={handleKickPlayer}
            />
          ))}
        </div>

        <aside className="rounded bg-zinc-900 p-4 shadow-xl">
          <h2 className="text-lg font-bold">Marcador</h2>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded bg-blue-950 p-3">
              <p className="text-sm text-blue-300">Nosotros</p>
              <p className="text-3xl font-black">{gameState?.scores.nosotros || 0}</p>
            </div>
            <div className="rounded bg-rose-950 p-3">
              <p className="text-sm text-rose-300">Ellos</p>
              <p className="text-3xl font-black">{gameState?.scores.ellos || 0}</p>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            <BaseProgress
              label="Nosotros"
              team="nosotros"
              bid={nosotrosBid}
              won={gameState?.basesWon.nosotros || 0}
            />
            <BaseProgress
              label="Ellos"
              team="ellos"
              bid={ellosBid}
              won={gameState?.basesWon.ellos || 0}
            />
          </div>

          <div className="mt-4 rounded bg-zinc-950 p-3 text-sm">
            <p className="text-zinc-400">Sentido</p>
            <p className="font-bold">{directionLabel(gameState?.playDirection)}</p>
          </div>

          <div className="mt-4 rounded bg-zinc-950 p-3 text-sm">
            <p className="text-zinc-400">Última base</p>
            <p className="font-bold">{lastBaseWinner?.name || '-'}</p>
          </div>

          <div className="mt-4 rounded bg-zinc-950 p-3 text-sm">
            <p className="text-zinc-400">Tu mano</p>
            <p className="font-bold">{playerHand.length} cartas</p>
          </div>

          <div className="mt-4 rounded bg-zinc-950 p-3 text-sm">
            <p className="text-zinc-400">Kamikazes</p>
            <p className="font-bold">Nosotros {gameState?.kamikazesRemaining.nosotros ?? '-'} · Ellos {gameState?.kamikazesRemaining.ellos ?? '-'}</p>
          </div>
        </aside>
      </div>

      <div className="mt-2 rounded bg-zinc-900 p-3 shadow-xl overflow-hidden">
        <div className="mb-2 flex items-center justify-between gap-3">
          <p className="font-semibold text-sm">Tu mano ({playerHand.length} cartas)</p>
          <p className={`rounded px-2 py-1 text-xs font-bold ${isMyTurn ? 'bg-emerald-300 text-emerald-950' : 'bg-zinc-800 text-zinc-300'}`}>
            {isInitialDrawPhase
              ? isMyInitialDrawTurn ? 'Sacá una carta' : `Saca ${currentDrawerPlayer?.name || '-'}`
              : isMyTurn ? 'Tu turno' : `Juega ${currentTurnPlayer?.name || '-'}`}
          </p>
        </div>
        {actionError && <div className="mb-2 rounded bg-red-100 p-2 text-red-700 text-sm">{actionError}</div>}
        <div className="flex flex-wrap gap-2 items-center justify-center">
          {playerHand.length > 0 ? (
            playerHand.map((card, idx) => (
              <button
                key={`${gameState?.roundIndex ?? 0}-${card.suit}-${card.value}-${idx}`}
                onClick={() => handleSelectCard(card)}
                disabled={!isMyTurn}
                className={`card-deal h-32 w-20 rounded bg-white text-zinc-900 shadow-lg transition hover:-translate-y-2 hover:shadow-2xl disabled:opacity-50 disabled:hover:translate-y-0 ${
                  selectedCard?.suit === card.suit && selectedCard.value === card.value
                    ? 'scale-110 ring-4 ring-emerald-300 -translate-y-3'
                    : ''
                }`}
                style={{ animationDelay: `${idx * 95}ms` }}
              >
                <p className="text-2xl font-black">{cardLabel(card)}</p>
                <p className="mt-10 text-xs font-bold uppercase text-zinc-500">{card.suit}</p>
              </button>
            ))
          ) : (
            <p className="text-zinc-400">Esperando el reparto...</p>
          )}
        </div>
      </div>

      {selectedCard && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-t-2xl bg-slate-900/95 p-5 text-white shadow-2xl border border-slate-700 backdrop-blur">
            <p className="text-sm uppercase tracking-wide text-slate-400">Carta seleccionada</p>
            <div className="mx-auto my-5 flex h-44 w-28 flex-col items-center justify-center rounded bg-white text-zinc-900 shadow-xl">
              <p className="text-4xl font-black">{cardLabel(selectedCard)}</p>
              <p className="mt-10 text-xs font-bold uppercase text-zinc-500">{selectedCard.suit}</p>
            </div>

            {selectedIsCopas && (
              <div className="mb-4 grid grid-cols-2 gap-2">
                <button
                  onClick={() => setCopasDirection('mantener')}
                  className={`rounded p-3 font-bold ${copasDirection === 'mantener' ? 'bg-blue-500 text-white' : 'bg-slate-700 text-slate-200'}`}
                >
                  Mantener sentido
                </button>
                <button
                  onClick={() => setCopasDirection('invertir')}
                  className={`rounded p-3 font-bold ${copasDirection === 'invertir' ? 'bg-blue-500 text-white' : 'bg-slate-700 text-slate-200'}`}
                >
                  Invertir sentido
                </button>
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => setSelectedCard(null)}
                className="flex-1 rounded bg-slate-700 p-3 font-bold hover:bg-slate-600"
              >
                Cancelar
              </button>
              <button
                onClick={handlePlaySelectedCard}
                disabled={isPlayingCard}
                className="flex-1 rounded bg-emerald-500 p-3 font-bold text-emerald-950 hover:bg-emerald-400 disabled:opacity-60"
              >
                {isPlayingCard ? 'Jugando...' : 'Jugar carta'}
              </button>
            </div>
          </div>
        </div>
      )}

      {canChooseOros && gameState?.pendingOrosChoice && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded bg-slate-900/95 p-5 text-white shadow-2xl border border-slate-700 backdrop-blur">
            <h2 className="text-2xl font-bold">As de Oros</h2>
            <p className="mt-2 text-slate-300">Elegí quién abre la próxima base.</p>
            <div className="mt-4 grid gap-2">
              {gameState.pendingOrosChoice.options.map((playerId) => {
                const player = roomPlayers.find((p) => p.id === playerId);
                return (
                  <button
                    key={playerId}
                    onClick={() => handleChooseOros(playerId)}
                    className="rounded bg-yellow-500 p-3 font-bold text-yellow-950 hover:bg-yellow-400"
                  >
                    {player?.name || 'Jugador'}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {isBiddingPhase && <BiddingPanel />}
      <LiveBidDisplay />
      <BaseResolutionPanel />
      <RoundScoringPanel />

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
