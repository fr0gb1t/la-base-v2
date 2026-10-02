import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Card, GameState } from '@la-base/shared';
import { chooseBid, chooseCard, partnerWorth, yawToward } from './bots.js';

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

test('yawToward faces the opposite seat straight and neighbours at 45° on a table of 4', () => {
  assert.equal(yawToward(2, 4), 0);
  assert.ok(Math.abs(yawToward(1, 4) - Math.PI / 4) < 1e-9); // next seat: to the left
  assert.ok(Math.abs(yawToward(-1, 4) + Math.PI / 4) < 1e-9); // previous seat: to the right
  assert.ok(Math.abs(yawToward(3, 4) + Math.PI / 4) < 1e-9);
});

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
