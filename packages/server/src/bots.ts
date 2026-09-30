/**
 * In-app bots (v2): each bot is a real Socket.IO client connected to this same server, so it goes
 * through exactly the same handlers and validation as a human (no special game-logic paths).
 * Bots declare, play (with arm feints and head movement for the 3D table), choose on As de Oros,
 * pick a direction on As de Copas and confirm every ready gate.
 */
import { randomBytes } from 'node:crypto';
import { io as connect, type Socket } from 'socket.io-client';
import { cardRank, resolveBase, type AssignedTeam, type Card, type GameState, type PlayedCard } from '@la-base/shared';

// ---------------------------------------------------------------- strategy
// Not an expert, but it plays La Base on purpose: bids from hand strength, tries to win exactly
// what its team asked for, doesn't overtake a teammate, and dumps high cards once the bid is met.

/** Rough chance that a single card wins a base (4 players; scaled for more). */
function winChance(card: Card, espadasPower: boolean, players: number): number {
  const r = cardRank(card);
  const base = r === 13 ? 0.95 : r === 12 ? 0.6 : r === 11 ? 0.42 : r === 10 ? 0.3 : r === 7 ? 0.16 : r >= 5 ? 0.06 : 0.02;
  const espadas = espadasPower && card.suit === 'espadas' && card.value === 1 ? 0.2 : 0;
  return Math.min(0.97, (base + espadas) * (4 / Math.max(4, players)) ** 0.7);
}

export function chooseBid(hand: Card[], st: GameState, teamSize: number, players: number): number {
  const max = st.structureSequence[st.roundIndex];
  const own = hand.reduce((sum, c) => sum + winChance(c, st.acePowers.espadas, players), 0);
  // teammates hold cards too: expect them to add roughly what an average hand adds
  const estimate = own + (teamSize - 1) * max * 0.18;
  const options = Array.from({ length: max + 1 }, (_, v) => v).filter((v) => st.bids.length === 0 || st.bids[0].value + v !== max);
  return options.reduce((best, v) => (Math.abs(v - estimate) < Math.abs(best - estimate) ? v : best), options[0]);
}

export function chooseCard(hand: Card[], st: GameState, me: string, team: AssignedTeam, teamOf: (id: string) => string | undefined): number {
  const byRank = hand.map((c, i) => ({ c, i })).sort((a, b) => cardRank(a.c) - cardRank(b.c));
  const lowest = byRank[0].i;
  const bid = st.bids.find((b) => b.team === team)?.value ?? 0;
  const need = bid - st.basesWon[team]; // > 0: we still want bases
  const played = st.currentBaseCards;
  const winsWith = (card: Card) => {
    const next: PlayedCard = { playerId: me, card, order: played.length };
    return resolveBase([...played, next], st.acePowers, st.playDirection).playerId === me;
  };
  if (played.length === 0) {
    // leading: open strong if we need bases, otherwise get rid of the weakest card
    return need > 0 ? byRank[byRank.length - 1].i : lowest;
  }
  const current = resolveBase(played, st.acePowers, st.playDirection);
  const teammateWinning = teamOf(current.playerId) === team;
  if (need > 0) {
    if (teammateWinning) return lowest; // don't overtake your partner
    const winner = byRank.find(({ c }) => winsWith(c));
    return winner ? winner.i : lowest; // cheapest card that takes the base
  }
  // bid already met: dump the highest card that still loses (keeps strong cards out of our hand)
  const losers = byRank.filter(({ c }) => !winsWith(c));
  return losers.length ? losers[losers.length - 1].i : lowest;
}

/** Secret proving a connection is one of our bots (only bots may flag themselves as bots). */
export const BOT_TOKEN = randomBytes(24).toString('hex');

const NAMES = ['Ana', 'Beto', 'Caro', 'Dani', 'Eli', 'Fede', 'Gabi', 'Hugo'];
const bots = new Map<string, Socket[]>(); // roomCode → bot clients
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function botNameFor(roomCode: string, taken: string[]): string {
  const free = NAMES.find((n) => !taken.includes(n) && !taken.includes(`${n} (bot)`));
  return `${free ?? `Bot ${(bots.get(roomCode)?.length ?? 0) + 1}`} (bot)`;
}

export function spawnBot(roomCode: string, name: string): Promise<{ success: boolean; error?: string }> {
  const port = Number(process.env.PORT || 3000);
  const s = connect(`http://127.0.0.1:${port}`, { transports: ['websocket'], auth: { botToken: BOT_TOKEN }, reconnection: false });
  const list = bots.get(roomCode) ?? [];
  list.push(s);
  bots.set(roomCode, list);

  let hand: Card[] = [];
  let roster: Array<{ id: string; team: string }> = [];
  let state: GameState | null = null;
  let busy = false;
  let yaw = 0;
  let leaving = false;
  const emit = <T = { success: boolean; error?: string }>(ev: string, payload: unknown) =>
    new Promise<T>((resolve) => s.emit(ev, payload, (res: T) => resolve(res)));

  const stop = () => {
    clearInterval(lookTimer);
    s.disconnect();
    bots.set(roomCode, (bots.get(roomCode) ?? []).filter((b) => b !== s));
  };

  const lookTimer = setInterval(() => {
    yaw = Math.max(-0.9, Math.min(0.9, yaw + (Math.random() - 0.5) * 0.4));
    s.emit('presence:look', { roomCode, yaw, pitch: -0.2 + Math.random() * 0.2 });
  }, 300);

  s.on('player:hand', (d: { hand: Card[] }) => (hand = d.hand));
  s.on('room:kicked', stop);
  s.on('game:gameOver', () => setTimeout(stop, 60_000));
  s.on('room:updated', (d: { players: Array<{ id: string; team: string; isBot?: boolean; isConnected: boolean }> }) => {
    roster = d.players;
    // nobody left to play with: leave
    if (!leaving && !d.players.some((p) => !p.isBot && p.isConnected)) {
      leaving = true;
      setTimeout(() => {
        s.emit('room:leave', { roomCode });
        stop();
      }, 30_000);
    }
  });
  s.on('game:state', (st: GameState) => {
    state = st;
    void act();
  });

  async function act(): Promise<void> {
    const st = state;
    const me = s.id;
    if (!st || busy || !me) return;
    busy = true;
    try {
      if (st.readyGate && !st.readyGate.readyPlayerIds.includes(me)) {
        await sleep(1500 + Math.random() * 1500);
        await emit('game:ready', { roomCode });
      } else if (st.phase === 'initial_draw' && st.initialDraw?.currentDrawerPlayerId === me && !st.initialDraw.completed) {
        await sleep(900);
        await emit('draw:initialCard', { roomCode });
      } else if (st.phase === 'bidding' && st.currentBidPlayerId === me) {
        await sleep(1200);
        const myTeam = roster.find((p) => p.id === me)?.team;
        const teamSize = Math.max(1, roster.filter((p) => p.team === myTeam).length);
        const value = chooseBid(hand, st, teamSize, Math.max(4, roster.length));
        s.emit('bid:bidValueChanged', { roomCode, bidValue: value, playerId: me });
        await sleep(800);
        await emit('bid:declare', { roomCode, bidValue: value, isKamikaze: false });
      } else if (st.phase === 'playing' && st.currentTurnPlayerId === me && hand.length) {
        await sleep(900);
        const myTeam = (roster.find((p) => p.id === me)?.team ?? 'nosotros') as AssignedTeam;
        const k = chooseCard(hand, st, me, myTeam, (id) => roster.find((p) => p.id === id)?.team);
        const card = hand[k];
        const feint = Math.random() < 0.35;
        for (let i = 0; i <= 14; i++) {
          const fwd = -0.35 + (feint ? Math.sin((i / 14) * Math.PI) * 0.55 : (i / 14) * 0.59);
          s.emit('presence:arm', { roomCode, slot: k, fwd, lat: 0, holding: true });
          await sleep(70);
        }
        if (feint) {
          s.emit('presence:arm', { roomCode, slot: k, fwd: -0.35, lat: 0, holding: false });
          await sleep(900);
        }
        const copasDirection = card.suit === 'copas' && card.value === 1 ? (Math.random() < 0.5 ? 'invertir' : 'mantener') : undefined;
        await emit('card:play', { roomCode, card, copasDirection });
        if (!feint) s.emit('presence:arm', { roomCode, slot: k, fwd: 0.24, lat: 0, holding: false });
      } else if (st.pendingOrosChoice?.chooserPlayerId === me) {
        await sleep(900);
        await emit('ace:oros:choose', { roomCode, playerId: st.pendingOrosChoice.options[0] });
      }
    } catch (err) {
      console.error(`[bot ${name}]`, err);
    } finally {
      busy = false;
    }
    if (state !== st) void act();
  }

  return new Promise((resolve) => {
    s.on('connect', async () => {
      const res = await emit('room:join', { roomCode, playerName: name, isBot: true });
      if (!res.success) stop();
      resolve(res);
    });
    s.on('connect_error', (err) => {
      stop();
      resolve({ success: false, error: err.message });
    });
  });
}

export function removeBots(roomCode: string) {
  (bots.get(roomCode) ?? []).forEach((s) => s.disconnect());
  bots.delete(roomCode);
}
