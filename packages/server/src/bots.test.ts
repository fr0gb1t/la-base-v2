import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Card, GameState } from '@la-base/shared';
import { AVERAGE_CARD, wantsSenasBeforeBidding, bidEstimate, chooseBid, chooseCard, chooseKamikaze, partnerWorth, shortAnswer, keepWaitingForSenas, SETTLE_MS } from './bots.js';

const state = (over: Partial<GameState> = {}): GameState =>
  ({
    phase: 'bidding',
    roundIndex: 0,
    structureSequence: [5],
    bids: [],
    basesWon: { nosotros: 0, ellos: 0 },
    acePowers: { espadas: true, copas: true, oros: true },
    playDirection: 'antihorario',
    currentBaseCards: [],
    ...over,
  }) as unknown as GameState;

test('partnerWorth reads señas: nothing signed → unknown, ancho de bastos → strong, nada → weak', () => {
  assert.equal(partnerWorth(undefined, 5), null);
  assert.ok(partnerWorth(['ancho-basto'], 1)! > 0.8);
  assert.ok(partnerWorth(['nada'], 5)! < 0.2);
  assert.ok(partnerWorth(['nada'], 5)! < partnerWorth(['dos', 'tres'], 5)!); // 3 cards they didn't sign
});

test('a partner who signed strength makes the bot ask for more', () => {
  const hand: Card[] = [{ suit: 'oros', value: 4 }, { suit: 'copas', value: 5 }, { suit: 'oros', value: 6 }, { suit: 'copas', value: 2 }, { suit: 'oros', value: 3 }];
  const blind = chooseBid(hand, state(), 2, 4);
  const told = chooseBid(hand, state(), 2, 4, [['ancho-basto', 'ancho-espada']]);
  assert.ok(told > blind, `blind ${blind} told ${told}`);
});

test('the bot ducks when its partner signed the ancho de bastos and has yet to play', () => {
  const hand: Card[] = [{ suit: 'oros', value: 12 }, { suit: 'copas', value: 4 }];
  const st = state({
    phase: 'playing',
    bids: [{ team: 'nosotros', value: 1 }] as GameState['bids'],
    currentBaseCards: [{ playerId: 'rival', card: { suit: 'espadas', value: 5 }, order: 0 }],
  });
  const teamOf = (id: string) => (id === 'mate' || id === 'me' ? 'nosotros' : 'ellos');
  assert.equal(chooseCard(hand, st, 'me', 'nosotros', teamOf), 0); // alone: takes it with the king
  assert.equal(chooseCard(hand, st, 'me', 'nosotros', teamOf, (s) => (s === 'ancho-basto' ? 'mate' : null)), 1); // partner will
});

test('what a bot caught on rival faces moves its bid: strong rivals down, empty-handed rivals up', () => {
  const hand: Card[] = [{ suit: 'oros', value: 12 }, { suit: 'copas', value: 11 }, { suit: 'oros', value: 6 }, { suit: 'copas', value: 10 }, { suit: 'oros', value: 4 }];
  const blind = chooseBid(hand, state(), 2, 4);
  const strongRivals = chooseBid(hand, state(), 2, 4, [], [['ancho-basto', 'ancho-espada'], ['figuras']]);
  const weakRivals = chooseBid(hand, state(), 2, 4, [], [['nada'], ['nada']]);
  assert.ok(strongRivals < blind, `blind ${blind} strong ${strongRivals}`);
  assert.ok(weakRivals >= blind, `blind ${blind} weak ${weakRivals}`);
});

// The whole-team plan, base by base (round of 3, the team asked 2). Partner: rey, rey, 2.
// Bot: rey, caballo, as. The partner holds two cards after each base it wins.
const teamOf2 = (id: string) => (id === 'mate' || id === 'me' ? 'nosotros' : 'ellos');
const averagePartner = (cardsLeft: (id: string) => number) => cardsLeft('mate') * AVERAGE_CARD;

test('base 1: the partner leads a rey and is taking it — the bot already sheds one of its two high cards', () => {
  const hand: Card[] = [{ suit: 'copas', value: 12 }, { suit: 'oros', value: 11 }, { suit: 'oros', value: 1 }];
  const st = state({
    phase: 'playing',
    bids: [{ team: 'nosotros', value: 2 }] as GameState['bids'],
    basesWon: { nosotros: 0, ellos: 0 },
    currentBaseCards: [
      { playerId: 'mate', card: { suit: 'espadas', value: 12 }, order: 0 },
      { playerId: 'rival', card: { suit: 'copas', value: 5 }, order: 1 },
    ],
  });
  // one base is ours, the partner still has cards: the bot keeps one high card, sheds the caballo
  assert.equal(chooseCard(hand, st, 'me', 'nosotros', teamOf2, () => null, averagePartner), 1);
});

test('base 2: the ancho de bastos kills the partner rey — the bot throws the as and saves its rey for the last base', () => {
  const hand: Card[] = [{ suit: 'copas', value: 12 }, { suit: 'oros', value: 1 }];
  const st = state({
    phase: 'playing',
    bids: [{ team: 'nosotros', value: 2 }] as GameState['bids'],
    basesWon: { nosotros: 1, ellos: 0 },
    currentBaseCards: [
      { playerId: 'mate', card: { suit: 'oros', value: 12 }, order: 0 },
      { playerId: 'rival', card: { suit: 'bastos', value: 1 }, order: 1 },
    ],
  });
  assert.equal(chooseCard(hand, st, 'me', 'nosotros', teamOf2, () => null, averagePartner), 1);
});

test('when the partner takes the only base the team needs, the bot sheds its highest card under it', () => {
  const hand: Card[] = [{ suit: 'oros', value: 12 }, { suit: 'copas', value: 10 }, { suit: 'espadas', value: 3 }];
  const st = state({
    phase: 'playing',
    bids: [{ team: 'nosotros', value: 1 }] as GameState['bids'],
    basesWon: { nosotros: 0, ellos: 0 },
    currentBaseCards: [{ playerId: 'mate', card: { suit: 'bastos', value: 1 }, order: 0 }], // ancho de bastos
  });
  const teamOf = (id: string) => (id === 'mate' || id === 'me' ? 'nosotros' : 'ellos');
  // asked 1 and the partner's ancho is taking it: the bot needs nothing more, so the rey goes now
  // (kept, it would win a base nobody wants)
  assert.equal(chooseCard(hand, st, 'me', 'nosotros', teamOf), 0);
});

test('bid met and every card wins: win with the highest, so it cannot win again later', () => {
  const hand: Card[] = [{ suit: 'oros', value: 12 }, { suit: 'copas', value: 11 }];
  const st = state({
    phase: 'playing',
    bids: [{ team: 'nosotros', value: 0 }] as GameState['bids'],
    basesWon: { nosotros: 0, ellos: 0 },
    currentBaseCards: [{ playerId: 'rival', card: { suit: 'espadas', value: 4 }, order: 0 }],
  });
  const teamOf = (id: string) => (id === 'me' ? 'nosotros' : 'ellos');
  assert.equal(chooseCard(hand, st, 'me', 'nosotros', teamOf), 0);
});

test("a partner's 'sí' promises at least one base; a 'no' means «don't ask anything for me»", () => {
  assert.ok(partnerWorth(['si'], 3)! >= 1);
  assert.equal(partnerWorth(['no'], 3), 0);
  assert.equal(partnerWorth(['figuras', 'no'], 3), 0, 'a no overrides what else they signed');
  assert.ok(partnerWorth(['no', 'si'], 3)! >= 1, 'the last one wins: no, then sí');
  assert.equal(partnerWorth(['si', 'no'], 3), 0, 'the last one wins: sí, then no');
  assert.ok(partnerWorth(['si', 'nada'], 3)! >= 1);
  const hand: Card[] = [{ suit: 'oros', value: 4 }, { suit: 'copas', value: 5 }, { suit: 'oros', value: 6 }];
  const st3 = state({ structureSequence: [3] });
  assert.ok(chooseBid(hand, st3, 2, 4, [['si']]) >= 1, 'with a sí the team asks at least one');
  assert.ok(chooseBid(hand, st3, 2, 4, [['no']]) <= chooseBid(hand, st3, 2, 4), 'with a no the team does not count on the partner');
  const rich: Card[] = [{ suit: 'bastos', value: 1 }, { suit: 'oros', value: 12 }, { suit: 'copas', value: 11 }];
  const withNo = bidEstimate(rich, st3, 2, 4, [['no']]);
  const withNothing = bidEstimate(rich, st3, 2, 4, [[]]);
  assert.ok(withNo < withNothing, "a partner's no lowers what the team expects (an unknown partner counts as an average hand)");
});

test('the partner is taking the base we need and I play last: my rey goes now, over the partner (real game, round 3)', () => {
  // the team asked 1, won 0. Caro (rival) 3 de bastos, the partner sota de oros, Ana (rival) 7 de
  // oros; I'm last. The base is ours whatever I play: keeping the rey made us win one too many later
  const hand: Card[] = [{ suit: 'espadas', value: 4 }, { suit: 'bastos', value: 12 }, { suit: 'copas', value: 5 }];
  const st = state({
    phase: 'playing',
    bids: [{ team: 'nosotros', value: 1 }] as GameState['bids'],
    basesWon: { nosotros: 0, ellos: 2 },
    currentBaseCards: [
      { playerId: 'rival', card: { suit: 'bastos', value: 3 }, order: 0 },
      { playerId: 'mate', card: { suit: 'oros', value: 10 }, order: 1 },
      { playerId: 'rival2', card: { suit: 'oros', value: 7 }, order: 2 },
    ],
  });
  assert.equal(chooseCard(hand, st, 'me', 'nosotros', teamOf2, () => null, averagePartner, 4), 1);
});

test('bid met, the partner is taking it and rivals still play: shed under it, leave it to a rival', () => {
  const hand: Card[] = [{ suit: 'espadas', value: 4 }, { suit: 'bastos', value: 12 }];
  const st = state({
    phase: 'playing',
    bids: [{ team: 'nosotros', value: 1 }] as GameState['bids'],
    basesWon: { nosotros: 1, ellos: 0 },
    currentBaseCards: [{ playerId: 'mate', card: { suit: 'oros', value: 10 }, order: 0 }],
  });
  assert.equal(chooseCard(hand, st, 'me', 'nosotros', teamOf2, () => null, averagePartner, 4), 0);
});

test("a rival's low card is let through (they're saving high cards) — when it costs us nothing", () => {
  // asked 1, already made it; a rival leads a 5 and nobody has beaten it: the bot could take it
  // with its caballo, but lets it pass with the 4 so the rival wins a base they didn't want
  const hand: Card[] = [{ suit: 'oros', value: 11 }, { suit: 'copas', value: 4 }, { suit: 'espadas', value: 12 }];
  const met = state({
    phase: 'playing',
    bids: [{ team: 'nosotros', value: 1 }, { team: 'ellos', value: 1 }] as GameState['bids'],
    basesWon: { nosotros: 1, ellos: 1 },
    currentBaseCards: [{ playerId: 'rival', card: { suit: 'bastos', value: 5 }, order: 0 }],
  });
  assert.equal(chooseCard(hand, met, 'me', 'nosotros', teamOf2, () => null, averagePartner, 4, () => 0), 1);
  // we still need 2 of the 2 bases left after this one: no favours, take it
  const short = state({
    phase: 'playing',
    bids: [{ team: 'nosotros', value: 3 }] as GameState['bids'],
    basesWon: { nosotros: 0, ellos: 0 },
    currentBaseCards: [{ playerId: 'rival', card: { suit: 'bastos', value: 5 }, order: 0 }],
  });
  assert.equal(chooseCard(hand, short, 'me', 'nosotros', teamOf2, () => null, averagePartner, 4, () => 0), 0, 'cheapest card that takes it');
});

test("answering a knock, a bot sometimes just nods 'sí' (only with a hand that makes a base) or shakes 'no'", () => {
  const strong: Card[] = [{ suit: 'bastos', value: 1 }, { suit: 'oros', value: 12 }, { suit: 'copas', value: 4 }];
  const weak: Card[] = [{ suit: 'bastos', value: 4 }, { suit: 'oros', value: 2 }, { suit: 'copas', value: 3 }];
  const st = state();
  assert.equal(shortAnswer(strong, st, 4, () => 0.1), 'si');
  assert.equal(shortAnswer(weak, st, 4, () => 0.5), 'no', "a weak hand: don't ask anything for me");
  assert.equal(shortAnswer(weak, st, 4, () => 0.1), 'no', 'no false promises of a base');
  assert.equal(shortAnswer(strong, st, 4, () => 0.9), null);
  // a high card I can shed, because the rivals already asked most of the bases
  const onePower: Card[] = [{ suit: 'oros', value: 12 }, { suit: 'copas', value: 4 }, { suit: 'copas', value: 5 }];
  const rivalsAsked = state({ structureSequence: [5], roundIndex: 0, bids: [{ team: 'ellos', value: 4 }] as GameState['bids'] } as Partial<GameState>);
  assert.equal(shortAnswer(onePower, rivalsAsked, 4, () => 0.5, 'nosotros'), 'no');
  const rivalsAskedLittle = state({ structureSequence: [5], roundIndex: 0, bids: [{ team: 'ellos', value: 1 }] as GameState['bids'] } as Partial<GameState>);
  assert.equal(shortAnswer(onePower, rivalsAskedLittle, 4, () => 0.5, 'nosotros'), null, 'rivals asked little: sign the cards');
});

test('the Mano calls a kamikaze on a lopsided hand: to 0 when the team has nothing, to all when it has everything', () => {
  const st5 = state({ structureSequence: [5], kamikazesRemaining: { nosotros: 2, ellos: 2 } } as Partial<GameState>);
  const porno: Card[] = [{ suit: 'oros', value: 4 }, { suit: 'copas', value: 5 }, { suit: 'espadas', value: 6 }, { suit: 'oros', value: 3 }, { suit: 'copas', value: 2 }];
  const weak = bidEstimate(porno, st5, 2, 4, [['nada']]);
  assert.equal(chooseKamikaze(weak, st5, 'nosotros', () => 0), 0);
  assert.equal(chooseKamikaze(4.8, st5, 'nosotros', () => 0), 5);
  assert.equal(chooseKamikaze(2.4, st5, 'nosotros', () => 0), null, 'a middling hand bids normally');
  // not the Mano, no kamikazes left, or a small round: never
  const pie = state({ structureSequence: [5], kamikazesRemaining: { nosotros: 2, ellos: 2 }, bids: [{ team: 'ellos', value: 2 }] } as Partial<GameState>);
  assert.equal(chooseKamikaze(weak, pie, 'nosotros', () => 0), null);
  const none = state({ structureSequence: [5], kamikazesRemaining: { nosotros: 0, ellos: 2 } } as Partial<GameState>);
  assert.equal(chooseKamikaze(weak, none, 'nosotros', () => 0), null);
  const small = state({ structureSequence: [1], kamikazesRemaining: { nosotros: 2, ellos: 2 } } as Partial<GameState>);
  assert.equal(chooseKamikaze(0, small, 'nosotros', () => 0), null);
});

test('a bot does not knock or wait for señas when they cannot change its bid', () => {
  const weak: Card[] = [{ suit: 'oros', value: 4 }, { suit: 'copas', value: 5 }, { suit: 'oros', value: 6 }];
  const strong: Card[] = [{ suit: 'bastos', value: 1 }];
  // the Mano with a weak hand and bids to choose from: worth asking
  assert.equal(wantsSenasBeforeBidding(weak, state({ structureSequence: [5], roundIndex: 0 }), 4), true);
  // answering a bid that leaves a single legal answer (3 bases, the rivals asked 3: only 1): nothing to ask
  const forced = state({ structureSequence: [3], roundIndex: 0, bids: [{ team: 'ellos', value: 3 }] as GameState['bids'] });
  assert.equal(wantsSenasBeforeBidding(weak, forced, 4), false);
  // a hand that makes every base on its own (the ancho de bastos in a 1-base round)
  assert.equal(wantsSenasBeforeBidding(strong, state({ structureSequence: [1], roundIndex: 0 }), 4), false);
});

test('no señas when no answer from the partner could change the bid', () => {
  const oneBase = state({ structureSequence: [1], roundIndex: 0 });
  // a Rey in the 1-card round: bids 1 whatever the partner holds, so knocking is pointless
  assert.equal(wantsSenasBeforeBidding([{ suit: 'oros', value: 12 }], oneBase, 4, 2), false);
  // a Sota (0 alone, 1 if the partner has the ancho): worth asking
  assert.equal(wantsSenasBeforeBidding([{ suit: 'oros', value: 10 }], oneBase, 4, 2), true);
  // a weak card: the partner may well have the base
  assert.equal(wantsSenasBeforeBidding([{ suit: 'oros', value: 4 }], oneBase, 4, 2), true);
});

test('in a one-card round the Mano with a Rey only fears the ancho de bastos; the last seat also loses ties', () => {
  const oneBase = state({ structureSequence: [1], roundIndex: 0 });
  const rey: Card[] = [{ suit: 'oros', value: 12 }];
  const asMano = bidEstimate(rey, oneBase, 1, 4, [], [], 0);
  const asLast = bidEstimate(rey, oneBase, 1, 4, [], [], 3);
  assert.ok(asMano > 0.9, `Mano ${asMano}`); // 3 rivals, 1 card in 39 beats it: (38/39)^3 ≈ 0.92
  assert.ok(asLast < asMano, `last ${asLast} Mano ${asMano}`); // the 3 other Reyes beat it too, they played first
  assert.ok(asLast > 0.65 && asLast < 0.8, `last ${asLast}`); // (35/39)^3 ≈ 0.72
});

test('as Mano in the one-card round a Caballo does not ask for señas, a Sota does', () => {
  const oneBase = state({ structureSequence: [1], roundIndex: 0 });
  const caballo: Card[] = [{ suit: 'oros', value: 11 }];
  assert.equal(wantsSenasBeforeBidding(caballo, oneBase, 4, 2, 0), false); // Mano: (34/39)^3 ≈ 0.66 → 1 either way
  const sota: Card[] = [{ suit: 'oros', value: 10 }];
  assert.equal(wantsSenasBeforeBidding(sota, oneBase, 4, 2, 0), true); // Mano: (30/39)^3 ≈ 0.46 → 0, unless the partner has the ancho
});

test('3-card round: the Mano with one winner and two weak cards asks the partner; once told, or forced, it does not', () => {
  const three = state({ structureSequence: [3], roundIndex: 0 });
  const hand: Card[] = [{ suit: 'oros', value: 12 }, { suit: 'copas', value: 4 }, { suit: 'oros', value: 3 }];
  assert.ok(chooseBid(hand, three, 2, 4, [], [], 0) >= 1); // the Rey is worth a base on its own
  assert.equal(wantsSenasBeforeBidding(hand, three, 4, 2, 0), true); // the other two bases depend on the partner
  // the Pie with a single legal bid (the rivals asked 3 of 3: only 1): the hand has nothing to ask about
  const forced = state({ structureSequence: [3], roundIndex: 0, bids: [{ team: 'ellos', value: 3 }] as GameState['bids'] });
  assert.equal(wantsSenasBeforeBidding(hand, forced, 4, 2, 1), false);
  // even the ancho and two Reyes are worth ≈ 2 bases, not 3: the last one depends on the partner
  const strong: Card[] = [{ suit: 'bastos', value: 1 }, { suit: 'bastos', value: 12 }, { suit: 'espadas', value: 12 }];
  assert.equal(wantsSenasBeforeBidding(strong, three, 4, 2, 0), true);
});

test("a partner's 'no' (no high cards) lowers the bid: a weak hand asks 0 instead of counting on an average partner", () => {
  const weak: Card[] = [{ suit: 'oros', value: 4 }, { suit: 'copas', value: 3 }, { suit: 'oros', value: 2 }];
  const five = state({ structureSequence: [5], roundIndex: 0 });
  assert.equal(chooseBid(weak, five, 2, 4), 1); // no seña: it guesses an average hand for the partner (≈ 0.9 bases)
  assert.equal(chooseBid(weak, five, 2, 4, [['no']]), 0); // told 'no': only its own hand counts
  assert.ok(chooseBid(weak, five, 2, 4, [['ancho-basto', 'ancho-espada']]) >= 2); // told about two anchos: asks more
});

test('the bot keeps waiting for more señas until the partner has been quiet for a while, up to a limit', () => {
  const t0 = 100_000;
  // nothing signed this round: no reason to wait
  assert.equal(keepWaitingForSenas(t0, 0, t0 - 10, false), false);
  // a seña just arrived: the partner may still be making others
  assert.equal(keepWaitingForSenas(t0 + 1000, t0, t0, true), true);
  assert.equal(keepWaitingForSenas(t0 + SETTLE_MS - 1, t0, t0, true), true);
  // quiet for long enough: decide
  assert.equal(keepWaitingForSenas(t0 + SETTLE_MS, t0, t0, true), false);
  // a new seña restarts the quiet period
  assert.equal(keepWaitingForSenas(t0 + SETTLE_MS + 500, t0 + 3000, t0, true), true);
  // but not forever
  assert.equal(keepWaitingForSenas(t0 + 20_000, t0 + 19_000, t0, true), false);
});
