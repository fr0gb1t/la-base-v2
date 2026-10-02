import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Card, GameState } from '@la-base/shared';
import { chooseBid, chooseCard, partnerWorth } from './bots.js';

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

test('needing one more base and unable to win this one, the bot sheds a spare high card', () => {
  // asked 2, already won 1; a rival leads a rey and nothing of ours beats it
  const hand: Card[] = [{ suit: 'oros', value: 12 }, { suit: 'copas', value: 11 }, { suit: 'espadas', value: 4 }];
  const st = state({
    phase: 'playing',
    bids: [{ team: 'nosotros', value: 2 }] as GameState['bids'],
    basesWon: { nosotros: 1, ellos: 0 },
    currentBaseCards: [{ playerId: 'rival', card: { suit: 'espadas', value: 12 }, order: 0 }],
  });
  const teamOf = (id: string) => (id === 'mate' || id === 'me' ? 'nosotros' : 'ellos');
  // keeps the rey for the base still needed, sheds the caballo (not the 4)
  assert.equal(chooseCard(hand, st, 'me', 'nosotros', teamOf), 1);
});

test('while the partner takes the base, the bot sheds a spare card under it', () => {
  const hand: Card[] = [{ suit: 'oros', value: 12 }, { suit: 'copas', value: 10 }, { suit: 'espadas', value: 3 }];
  const st = state({
    phase: 'playing',
    bids: [{ team: 'nosotros', value: 1 }] as GameState['bids'],
    basesWon: { nosotros: 0, ellos: 0 },
    currentBaseCards: [{ playerId: 'mate', card: { suit: 'bastos', value: 1 }, order: 0 }], // ancho de bastos
  });
  const teamOf = (id: string) => (id === 'mate' || id === 'me' ? 'nosotros' : 'ellos');
  assert.equal(chooseCard(hand, st, 'me', 'nosotros', teamOf), 1); // the sota goes, the rey stays for later
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
