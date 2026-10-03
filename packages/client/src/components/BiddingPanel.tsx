import { useState, useMemo, useEffect } from 'react';
import { useGameStore } from '../store/gameStore';
import { useSocket } from '../hooks/useSocket';
import { GiDynamite, GiKnockout } from 'react-icons/gi';
import { getPieValidBidRange } from '@la-base/shared';

/** Pressing the bidding clock on the table confirms your bid (set while it's your turn). */
export const pressBidClock: { current: (() => void) | null } = { current: null };

export function BiddingPanel({ onAskSenas }: { onAskSenas?: () => void }) {
  const socket = useSocket();
  const { gameState, roomCode, currentPlayer, roomPlayers } = useGameStore();
  const [error, setError] = useState('');
  const showError = (msg: string) => setError(msg);
  const [bidValue, setBidValue] = useState(0);
  const [isKamikaze, setIsKamikaze] = useState(false);
  const [loading, setLoading] = useState(false);

  const currentRoomPlayer = useMemo(
    () => roomPlayers.find((player) => player.id === currentPlayer?.id),
    [currentPlayer?.id, roomPlayers]
  );

  const manoPlayer = useMemo(
    () => roomPlayers.find((player) => player.id === gameState?.currentManoPlayerId),
    [gameState?.currentManoPlayerId, roomPlayers]
  );

  const expectedTeam = useMemo(() => {
    if (!manoPlayer || !gameState?.bids) return null;
    if (gameState.bids.length === 0) return manoPlayer.team;
    if (gameState.bids.length === 1) return manoPlayer.team === 'nosotros' ? 'ellos' : 'nosotros';
    return null;
  }, [gameState?.bids, manoPlayer]);

  const isMyTeamTurn = currentRoomPlayer?.team === expectedTeam;
  const isMyBidTurn = isMyTeamTurn && gameState?.currentBidPlayerId === currentRoomPlayer?.id;

  // Emit bid value changes in real-time
  useEffect(() => {
    if (!socket || !roomCode || !isMyBidTurn) return;

    socket.emit('bid:bidValueChanged', {
      roomCode,
      bidValue,
      playerId: currentPlayer?.id,
    });
  }, [bidValue, isMyBidTurn, socket, roomCode, currentPlayer?.id]);

  const isMano = useMemo(() => {
    if (!gameState?.bids) return false;
    return gameState.bids.length === 0 && isMyBidTurn;
  }, [gameState?.bids, isMyBidTurn]);

  const isPie = useMemo(() => {
    if (!gameState?.bids) return false;
    return gameState.bids.length === 1 && isMyBidTurn;
  }, [gameState?.bids, isMyBidTurn]);

  const maxBases = useMemo(() => {
    if (!gameState?.structureSequence || gameState.roundIndex === undefined) return 0;
    return gameState.structureSequence[gameState.roundIndex] || 0;
  }, [gameState?.structureSequence, gameState?.roundIndex]);

  const validBidsForPie = useMemo(() => {
    if (!isPie || !gameState?.bids || gameState.bids.length === 0) return [];

    return getPieValidBidRange(gameState.bids[0].value, maxBases, gameState.pieBidRule ?? 'estricta');
  }, [isPie, gameState?.bids, gameState?.pieBidRule, maxBases]);

  const isValidPieBid = useMemo(() => {
    if (!isPie) return true;
    return validBidsForPie.includes(bidValue);
  }, [isPie, bidValue, validBidsForPie]);

  const handleBid = () => {
    if (!socket || !roomCode) return;

    if (isKamikaze && bidValue !== 0 && bidValue !== maxBases) {
      showError(`Kamikaze solo puede cantar 0 o ${maxBases}`);
      return;
    }

    if (!isValidPieBid) {
      showError(`Suma inválida: ${gameState?.bids[0]?.value || 0} + ${bidValue} = ${(gameState?.bids[0]?.value || 0) + bidValue}`);
      return;
    }

    setError('');
    setLoading(true);

    socket.emit(
      'bid:declare',
      {
        roomCode,
        bidValue,
        isKamikaze: isMano ? isKamikaze : false,
      },
      (response: any) => {
        setLoading(false);
        if (!response.success) {
          showError(response.error || 'No se pudo cantar');
        } else {
          setBidValue(0);
          setIsKamikaze(false);
        }
      }
    );
  };

  const isOpen = gameState?.phase === 'bidding';
  const hasClock = Boolean(gameState?.bidClock);

  // the clock on the table is the real way to confirm: select, then press it (kept current on
  // every render, so a press never lands between an old and a new registration)
  pressBidClock.current = isOpen && isMyBidTurn
    ? () => {
        if (!loading && !(isPie && !isValidPieBid)) handleBid();
      }
    : null;
  useEffect(() => () => {
    pressBidClock.current = null;
  }, []);

  // Only the player who has to act sees it. It never covers the table: a compact tally sheet in
  // the bottom-right corner (your cards are on the left), no backdrop, the 3D view stays usable
  // behind it so you can keep looking at your partner's face.
  if (!(isOpen && isMyBidTurn)) return null;

  const myTeam = currentRoomPlayer?.team === 'ellos' ? 'ellos' : 'nosotros';
  const kamikazesLeft = gameState?.kamikazesRemaining?.[myTeam] ?? 0;
  const manoBid = gameState?.bids?.[0];

  return (
    <aside className="tally" aria-label="Declarar bases">
      <header className="tally-head">
        <span className="tally-title">{isMano ? 'Declarás (mano)' : 'Respondés (pie)'}</span>
        <span className="tally-sub">{maxBases} {maxBases === 1 ? 'base' : 'bases'} en juego</span>
      </header>

      {isPie && manoBid && (
        <p className="tally-line">
          rivales pidieron <b>{manoBid.value}</b>
          {manoBid.isKamikaze && <span className="kami"> · kamikaze</span>}
          <span className="dim"> · podés pedir {validBidsForPie.join(' o ')}</span>
        </p>
      )}

      <div className="tally-nums" role="radiogroup" aria-label="Cantidad de bases">
        {Array.from({ length: maxBases + 1 }, (_, value) => {
          const disabledByPie = isPie && !validBidsForPie.includes(value);
          const disabledByKamikaze = isMano && isKamikaze && value !== 0 && value !== maxBases;
          const disabled = disabledByPie || disabledByKamikaze;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={bidValue === value}
              disabled={disabled}
              className={`tally-num ${bidValue === value ? 'on' : ''}`}
              onClick={() => { setBidValue(value); setError(''); }}
            >
              {value}
            </button>
          );
        })}
      </div>

      {isMano && (
        <button
          type="button"
          role="switch"
          aria-checked={isKamikaze}
          disabled={kamikazesLeft <= 0}
          className={`tally-kami ${isKamikaze ? 'on' : ''}`}
          onClick={() => {
            const next = !isKamikaze;
            setIsKamikaze(next);
            if (next && bidValue !== 0 && bidValue !== maxBases) setBidValue(maxBases);
          }}
          title="Todo o nada: 0 o todas las bases"
        >
          <GiDynamite aria-hidden /> kamikaze {isKamikaze ? 'sí' : 'no'}
          <span className="dim"> · quedan {kamikazesLeft}</span>
        </button>
      )}

      {onAskSenas && (
        <button type="button" className="tally-kami" onClick={onAskSenas} title="Golpecitos en la mesa: tus compañeros te hacen las señas (P)">
          <GiKnockout aria-hidden /> pedir señas <span className="dim">· P</span>
        </button>
      )}

      {error && <p className="tally-error" role="alert">{error}</p>}

      <button
        type="button"
        className="stamp-btn"
        onClick={handleBid}
        disabled={loading || (isPie && !isValidPieBid)}
      >
        {loading ? 'anotando…' : `pedir ${bidValue}${isMano && isKamikaze ? ' · kamikaze' : ''}`}
      </button>
      <p className="tally-line dim">pedir = tocar el reloj del centro{hasClock ? ': le pasa el turno al rival' : ''}</p>
    </aside>
  );
}
