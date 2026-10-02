/**
 * In-app bots (v2): each bot is a real Socket.IO client connected to this same server, so it goes
 * through exactly the same handlers and validation as a human (no special game-logic paths).
 * Bots declare, play (with arm feints and head movement for the 3D table), choose on As de Oros,
 * pick a direction on As de Copas and confirm every ready gate. They also make señas to their
 * partner (turning to face them, so a rival only catches it by luck) and read their partner's.
 */
import { randomBytes } from 'node:crypto';
import { io as connect, type Socket } from 'socket.io-client';
import { cardRank, dealAnimationMs, gazeToward, resolveBase, senaForCard, senasForHand, type AssignedTeam, type Gaze, type Card, type GameState, type PlayedCard, type Sena } from '@la-base/shared';

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

/** Bases an unknown card wins on average (the deck's mean winChance at a table of 4). */
export const AVERAGE_CARD = 0.2;

/** Expected bases a seña promises (rough, like winChance). 'nada': no figure, ancho or powered ace. */
const SENA_WORTH: Record<Sena, number> = {
  'ancho-basto': 0.9,
  'ancho-espada': 0.45,
  'ancho-oro': 0.15,
  'ancho-copa': 0.1,
  figuras: 0.35,
  porno: 0.08,
  tres: 0.03,
  dos: 0.02,
  nada: 0.03, // per card: nothing that wins
  si: 1, // 'ask at least one, I can make one'
  no: 0, // 'not telling': no information at all
};

/** What a teammate's hand is worth, from their señas (null: they haven't signed anything). */
export function partnerWorth(senas: Sena[] | undefined, handSize: number): number | null {
  const cards = (senas ?? []).filter((s) => s !== 'si' && s !== 'no'); // señas about cards
  const yes = senas?.includes('si') ?? false;
  if (!cards.length) return yes ? SENA_WORTH.si : null; // 'no' alone tells nothing
  const worth = cards.includes('nada')
    ? handSize * SENA_WORTH.nada
    : cards.reduce((sum, s) => sum + SENA_WORTH[s], 0) + Math.max(0, handSize - cards.length) * 0.15; // the cards they didn't sign
  return yes ? Math.max(worth, SENA_WORTH.si) : worth; // a 'sí' promises at least one
}

/** Bases the team should make this round: my hand, the partners' señas, what we caught on rivals. */
export function bidEstimate(
  hand: Card[],
  st: GameState,
  teamSize: number,
  players: number,
  partnerSenas: Sena[][] = [],
  rivalSenas: Sena[][] = [], // señas caught on rival faces (one list per rival seen)
): number {
  const max = st.structureSequence[st.roundIndex];
  const own = hand.reduce((sum, c) => sum + winChance(c, st.acePowers.espadas, players), 0);
  // teammates hold cards too: what their señas say, or roughly what an average hand adds
  const average = max * 0.18;
  const mates = Array.from({ length: teamSize - 1 }, (_, i) => partnerWorth(partnerSenas[i], hand.length) ?? average);
  // bases are (nearly) zero-sum: a rival caught signing strength takes what we'd otherwise get,
  // one caught signing 'nada' leaves bases on the table (difference from an average hand)
  const rivalShift = rivalSenas.reduce((sum, l) => sum + ((partnerWorth(l, hand.length) ?? average) - average), 0);
  return Math.max(0, own + mates.reduce((a, b) => a + b, 0) - rivalShift);
}

export function chooseBid(
  hand: Card[],
  st: GameState,
  teamSize: number,
  players: number,
  partnerSenas: Sena[][] = [],
  rivalSenas: Sena[][] = [],
): number {
  const max = st.structureSequence[st.roundIndex];
  const estimate = bidEstimate(hand, st, teamSize, players, partnerSenas, rivalSenas);
  const options = Array.from({ length: max + 1 }, (_, v) => v).filter((v) => st.bids.length === 0 || st.bids[0].value + v !== max);
  return options.reduce((best, v) => (Math.abs(v - estimate) < Math.abs(best - estimate) ? v : best), options[0]);
}

/**
 * As the Mano, call a kamikaze (all or nothing) when the hand is clearly lopsided: so weak (low
 * cards, a partner signalling 'nada' or porno) that the team expects next to nothing → 0, or so
 * strong it expects every base → all. A Mano that misses by 2+ without one loses the game, so on a
 * hopeless hand the 0 is cheap insurance. Only on rounds of 3+ bases and with a kamikaze left;
 * not every time. Returns the bid to declare as kamikaze, or null.
 */
export function chooseKamikaze(estimate: number, st: GameState, team: AssignedTeam, rng: () => number = Math.random): number | null {
  const max = st.structureSequence[st.roundIndex];
  if (st.bids.length !== 0 || max < 3 || (st.kamikazesRemaining?.[team] ?? 0) <= 0) return null;
  if (rng() > KAMIKAZE_WILL) return null;
  if (estimate <= max * KAMIKAZE_WEAK) return 0;
  if (estimate >= max - KAMIKAZE_STRONG) return max;
  return null;
}

export function chooseCard(
  hand: Card[],
  st: GameState,
  me: string,
  team: AssignedTeam,
  teamOf: (id: string) => string | undefined,
  partnerHolds: (sena: Sena) => string | null = () => null, // a teammate who signed it and still has it
  // bases our partners should still win with the cards they hold after this base (from their
  // señas, or an average hand): `cardsLeft` is what each partner keeps once this base is over
  partnersExpect: (cardsLeft: (partnerId: string) => number) => number = () => 0,
  tableSize = 4,
  rng: () => number = Math.random,
): number {
  const byRank = hand.map((c, i) => ({ c, i })).sort((a, b) => cardRank(a.c) - cardRank(b.c));
  const lowest = byRank[0].i;
  const highest = byRank[byRank.length - 1].i;
  const bid = st.bids.find((b) => b.team === team)?.value ?? 0;
  const need = bid - st.basesWon[team]; // > 0: we still want bases
  const played = st.currentBaseCards;
  const winsWith = (card: Card) => {
    const next: PlayedCard = { playerId: me, card, order: played.length };
    return resolveBase([...played, next], st.acePowers, st.playDirection).playerId === me;
  };
  const current = played.length ? resolveBase(played, st.acePowers, st.playDirection) : null;
  const teammateWinning = current !== null && teamOf(current.playerId) === team;
  // a partner who signed the ancho de bastos and hasn't played yet will take this base
  const ace = partnerHolds('ancho-basto');
  const partnerWillWin = ace !== null && !played.some((p) => p.playerId === ace);
  // the plan, for the whole team: the base our side is already taking counts, and so do the bases
  // our partners should still win with their remaining cards. Keep only as many strong cards as
  // the bases left for me; the rest is spare, and a spare high card kept too long wins bases
  // nobody wants later.
  const takingThis = teammateWinning || partnerWillWin ? 1 : 0;
  const theirs = partnersExpect(() => hand.length - 1); // everyone holds as many as I do once this base is over
  const mine = Math.max(0, Math.ceil(need - takingThis - theirs - 1e-9));
  const keep = new Set(byRank.slice(byRank.length - Math.min(mine, byRank.length)).map((x) => x.i));
  const spare = byRank.filter((x) => !keep.has(x.i));
  /** Shed the highest spare card that loses this base (the lowest card if none). */
  const shed = () => {
    const losing = spare.filter(({ c }) => !winsWith(c));
    return losing.length ? losing[losing.length - 1].i : lowest;
  };
  if (played.length === 0) {
    // leading: open strong if the team still counts on my cards, otherwise with the weakest
    return mine > 0 ? highest : lowest;
  }
  const lastToPlay = played.length === tableSize - 1; // nothing can change after my card
  if (teammateWinning && (need > 0 || lastToPlay)) {
    // the base is ours whatever I play (or it's ours and we want it): the free moment to get rid
    // of my highest spare card, even over my partner's — it stays ours, and that card would
    // otherwise win a base we don't want later
    return spare.length ? spare[spare.length - 1].i : lowest;
  }
  // a rival is winning with a low card (under a 7): they probably don't want this base and are
  // saving their high cards. Letting it pass makes them take a base they didn't want — but only
  // when it costs us nothing: after this base we still have enough bases and strength to make ours
  const rivalLow = current !== null && !teammateWinning && cardRank(played.find((p) => p.playerId === current.playerId)!.card) < 7;
  const basesAfter = hand.length - 1;
  const strongAfter = byRank.filter(({ c }) => cardRank(c) >= 10).length; // figures and the ancho
  // with room to spare: more strength than the bases we still need (exactly enough is a gamble)
  const affordable = need <= 0 || (need <= basesAfter && strongAfter + theirs > need);
  if (rivalLow && affordable && rng() < LET_IT_PASS) {
    const under = byRank.filter(({ c }) => !winsWith(c));
    if (under.length) return (spare.filter(({ c }) => !winsWith(c)).pop() ?? under[0]).i;
  }
  if (need > 0) {
    // the partner will take it (signed ancho, still to play): shed under it
    if (partnerWillWin) return shed();
    const winner = byRank.find(({ c }) => winsWith(c));
    if (winner) return winner.i; // the cheapest card that takes it
    return shed(); // can't win this one: get rid of a high card we won't need
  }
  // bid met and rivals still to play: shed the highest card that doesn't take it (leave it for a
  // rival); if every card wins, win with the highest (that card would only win more later)
  const losers = byRank.filter(({ c }) => !winsWith(c));
  return losers.length ? losers[losers.length - 1].i : highest;
}

/**
 * A short answer to a partner's knock, some of the time: 'sí' when this hand can surely make a
 * base, now and then a 'no' (not telling); null = answer with the card señas as usual.
 */
export function shortAnswer(hand: Card[], st: GameState | null, players: number, rng: () => number = Math.random): Sena | null {
  const r = rng();
  const expected = hand.reduce((sum, c) => sum + winChance(c, st?.acePowers.espadas ?? true, players), 0);
  if (r < SAY_YES && expected >= 0.8) return 'si';
  if (r >= SAY_YES && r < SAY_YES + SAY_NO) return 'no';
  return null;
}

/** Secret proving a connection is one of our bots (only bots may flag themselves as bots). */
export const BOT_TOKEN = randomBytes(24).toString('hex');

// Señas, played like people do: sometimes distracted, answering a knock most of the time, and
// watching the face of whoever has to answer a rival's knock.
const SIGN_ON_DEAL = 0.75; // chance to sign right after the deal (else they wait to be asked)
const ANSWER_ASK = 0.8; // chance to answer a partner's knock
const WATCH_MS = 4000;
const ASK_PATIENCE_MS = 20_000;
const SAY_YES = 0.25; // answering a knock: just 'sí' (when the hand can surely make a base)
const SAY_NO = 0.1; // …or just 'no' (not telling)
const LET_IT_PASS = 0.75;
const KAMIKAZE_WILL = 0.85; // how often a lopsided hand actually makes the Mano call it
const KAMIKAZE_WEAK = 0.12; // expecting under this share of the bases: kamikaze to 0
const KAMIKAZE_STRONG = 0.5; // expecting within half a base of all of them: kamikaze to all // how often a bot lets a rival's low card take a base they didn't want // how long a bot waits for its partners to answer its knock // how long a bot stares at the answering rival's face

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
  let lookHeldUntil = 0; // facing someone on purpose (signing, or watching a face): the idle look waits
  const partnerSenas = new Map<string, Set<Sena>>(); // teammate → señas they made this round
  const rivalSenas = new Map<string, Set<Sena>>(); // rival → señas caught on their face this round
  const emit = <T = { success: boolean; error?: string }>(ev: string, payload: unknown) =>
    new Promise<T>((resolve) => s.emit(ev, payload, (res: T) => resolve(res)));

  const stop = () => {
    clearInterval(lookTimer);
    s.disconnect();
    bots.set(roomCode, (bots.get(roomCode) ?? []).filter((b) => b !== s));
  };

  const lookTimer = setInterval(() => {
    if (Date.now() < lookHeldUntil) return;
    yaw = Math.max(-0.9, Math.min(0.9, yaw + (Math.random() - 0.5) * 0.4));
    s.emit('presence:look', { roomCode, yaw, pitch: -0.2 + Math.random() * 0.2 });
  }, 300);

  const teammates = () => {
    const mine = roster.find((p) => p.id === s.id)?.team;
    return roster.filter((p) => p.id !== s.id && p.team === mine);
  };
  s.on('player:hand', (d: { hand: Card[] }) => {
    const dealt = d.hand.length > hand.length;
    hand = d.hand;
    if (dealt) {
      // the others are still watching the cards being dealt: nothing happens before they land
      cardsVisibleAt = Date.now() + dealAnimationMs(Math.max(2, roster.length), d.hand.length);
      partnerSenas.clear();
      rivalSenas.clear();
      askedThisRound = false;
      if (Math.random() < SIGN_ON_DEAL) sign(); // sometimes distracted: forgets until asked
    }
  });
  // the server only sends a seña we can see: a partner's, or a rival's caught on their face
  let cardsVisibleAt = 0; // when the deal animation ends on the players' screens
  const untilDealt = async () => {
    while (Date.now() < cardsVisibleAt && !leaving) await sleep(150);
  };
  const lastSenaAt = new Map<string, number>(); // when each player last made a seña we saw
  s.on('sena:made', (d: { playerId: string; sena: Sena }) => {
    const seen = teammates().some((p) => p.id === d.playerId) ? partnerSenas : rivalSenas;
    seen.set(d.playerId, (seen.get(d.playerId) ?? new Set()).add(d.sena));
    lastSenaAt.set(d.playerId, Date.now());
  });
  s.on('game:cardPlayed', (d: { playerId: string; card: Card }) => {
    const sena = senaForCard(d.card);
    partnerSenas.get(d.playerId)?.delete(sena); // that card is gone
    rivalSenas.get(d.playerId)?.delete(sena);
  });

  /** Seat index of a player and the table size (seating order = roster order). */
  const gazeAt = (id: string): Gaze => {
    const order = roster.map((p) => p.id);
    return gazeToward(order.indexOf(s.id ?? ''), order.indexOf(id), order.length);
  };
  /** Keep looking at someone's face for a while (the look stream tells the server where). */
  async function holdLook(g: Gaze, ms: number) {
    lookHeldUntil = Date.now() + ms;
    yaw = g.yaw;
    while (Date.now() < lookHeldUntil && !leaving) {
      s.emit('presence:look', { roomCode, yaw: g.yaw, pitch: g.pitch });
      await sleep(200);
    }
  }

  /** Tell the partner(s) what we hold: turn to face them, make the seña, look away. */
  /**
   * Tell partners what we hold. `toward`: answer that partner (they knocked for señas), quickly;
   * otherwise a random partner, unhurried. Holding nothing that wins → 'nada' (eyes closed).
   */
  async function signHand(toward?: string) {
    const mates = teammates();
    if (!mates.length) return;
    // answering a knock, sometimes just a nod or a shake instead of the cards
    const short = toward ? shortAnswer(hand, state, Math.max(4, roster.length)) : null;
    const list = short ? [short] : senasForHand(hand, state?.acePowers).slice(0, 2);
    await untilDealt(); // no señas about cards nobody has seen yet
    for (const sena of list) {
      await sleep(toward ? 500 + Math.random() * 700 : 1500 + Math.random() * 3500);
      if (!state || (state.phase !== 'bidding' && state.phase !== 'playing') || leaving) return;
      const mate = mates.find((p) => p.id === toward) ?? mates[Math.floor(Math.random() * mates.length)];
      const g = gazeAt(mate.id);
      const facing = holdLook(g, 2000); // turn to them, make it, keep facing them a moment
      await sleep(450);
      s.emit('sena:make', { roomCode, sena, yaw: g.yaw, pitch: g.pitch });
      await facing;
    }
  }
  let signing$ = Promise.resolve(); // one seña at a time
  const sign = (toward?: string) => {
    signing$ = signing$.then(() => signHand(toward)).catch(() => undefined);
  };
  let askedThisRound = false;
  s.on('sena:asked', (d: { playerId: string }) => {
    const asker = roster.find((p) => p.id === d.playerId);
    if (!asker) return;
    // a partner knocks: answer, unless distracted (it's a reminder, not an order)
    if (teammates().some((p) => p.id === asker.id)) {
      if (Math.random() < ANSWER_ASK) sign(asker.id);
      return;
    }
    // a rival knocks: their partner is about to sign — watch that face
    const answerers = roster.filter((p) => p.team === asker.team && p.id !== asker.id);
    if (!answerers.length || Date.now() < lookHeldUntil) return;
    const target = answerers[Math.floor(Math.random() * answerers.length)];
    void holdLook(gazeAt(target.id), WATCH_MS);
  });
  const signedBy = () => teammates().map((p) => [...(partnerSenas.get(p.id) ?? [])]);
  const caughtFromRivals = () => [...rivalSenas.values()].map((set) => [...set]).filter((l) => l.length);
  const partnerHolds = (sena: Sena) => teammates().find((p) => partnerSenas.get(p.id)?.has(sena))?.id ?? null;
  // what our partners should still win: their señas if they made any, else an average hand
  const partnersExpect = (cardsLeft: (id: string) => number) =>
    teammates().reduce((sum, p) => {
      const left = cardsLeft(p.id);
      return sum + (partnerWorth([...(partnerSenas.get(p.id) ?? [])], left) ?? left * AVERAGE_CARD);
    }, 0);
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
    // a refused move (a stale view of the table) is tried again: no new state may ever come
    let retry: string | null = null;
    try {
      if (st.readyGate && !st.readyGate.readyPlayerIds.includes(me)) {
        await sleep(1500 + Math.random() * 1500);
        await emit('game:ready', { roomCode });
      } else if (st.phase === 'initial_draw' && st.initialDraw?.currentDrawerPlayerId === me && !st.initialDraw.completed) {
        await sleep(900);
        await emit('draw:initialCard', { roomCode });
      } else if (st.phase === 'bidding' && st.currentBidPlayerId === me) {
        await untilDealt(); // see the hand land before knocking or declaring
        await sleep(1200);
        // no señas from the partners yet: knock on the table and give them a moment to answer
        if (!askedThisRound && teammates().length && signedBy().every((l) => l.length === 0)) {
          askedThisRound = true;
          // knock, then wait for an answer (any seña: a 'no' counts too) from every partner, up
          // to ASK_PATIENCE_MS so a silent table doesn't stall the game
          const askedAt = Date.now();
          s.emit('sena:ask', { roomCode });
          const answered = () => teammates().every((p) => (lastSenaAt.get(p.id) ?? 0) >= askedAt);
          while (!answered() && Date.now() - askedAt < ASK_PATIENCE_MS && !leaving) await sleep(200);
          await sleep(600); // a moment to take it in
        }
        const myTeam = roster.find((p) => p.id === me)?.team;
        const teamSize = Math.max(1, roster.filter((p) => p.team === myTeam).length);
        const players = Math.max(4, roster.length);
        const estimate = bidEstimate(hand, st, teamSize, players, signedBy(), caughtFromRivals());
        const kamikaze = chooseKamikaze(estimate, st, (myTeam ?? 'nosotros') as AssignedTeam);
        const value = kamikaze ?? chooseBid(hand, st, teamSize, players, signedBy(), caughtFromRivals());
        s.emit('bid:bidValueChanged', { roomCode, bidValue: value, playerId: me });
        await sleep(800);
        const res = await emit<{ success: boolean; error?: string }>('bid:declare', { roomCode, bidValue: value, isKamikaze: kamikaze !== null });
        if (!res?.success) retry = `bid: ${res?.error}`;
      } else if (st.phase === 'playing' && st.currentTurnPlayerId === me && hand.length) {
        await sleep(900);
        const myTeam = (roster.find((p) => p.id === me)?.team ?? 'nosotros') as AssignedTeam;
        const k = chooseCard(hand, st, me, myTeam, (id) => roster.find((p) => p.id === id)?.team, partnerHolds, partnersExpect, roster.length);
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
        const res = await emit<{ success: boolean; error?: string }>('card:play', { roomCode, card, copasDirection });
        if (!res?.success) retry = `play ${card.value} ${card.suit}: ${res?.error}`;
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
    if (retry) {
      console.warn(`[bot ${name}] refused, trying again: ${retry}`);
      setTimeout(() => void act(), 1000);
      return;
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
