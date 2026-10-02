import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Card, GameState } from '@la-base/shared';
import { AVERAGE_CARD, chooseBid, chooseCard, partnerWorth } from './bots.js';

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

test("a partner's 'sí' promises at least one base; a 'no' tells nothing", () => {
  assert.ok(partnerWorth(['si'], 3)! >= 1);
  assert.equal(partnerWorth(['no'], 3), null);
  assert.ok(partnerWorth(['si', 'nada'], 3)! >= 1);
  const hand: Card[] = [{ suit: 'oros', value: 4 }, { suit: 'copas', value: 5 }, { suit: 'oros', value: 6 }];
  const st3 = state({ structureSequence: [3] });
  assert.ok(chooseBid(hand, st3, 2, 4, [['si']]) >= 1, 'with a sí the team asks at least one');
  assert.equal(chooseBid(hand, st3, 2, 4, [['no']]), chooseBid(hand, st3, 2, 4), "a 'no' is like no answer");
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
