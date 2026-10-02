import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isSena, senaForCard, senasForHand } from './senas.js';

test('senaForCard maps aces by suit and low cards by value', () => {
  assert.equal(senaForCard({ suit: 'espadas', value: 1 }), 'ancho-espada');
  assert.equal(senaForCard({ suit: 'bastos', value: 1 }), 'ancho-basto');
  assert.equal(senaForCard({ suit: 'copas', value: 1 }), 'ancho-copa');
  assert.equal(senaForCard({ suit: 'oros', value: 1 }), 'ancho-oro');
  assert.equal(senaForCard({ suit: 'oros', value: 3 }), 'tres');
  assert.equal(senaForCard({ suit: 'copas', value: 2 }), 'dos');
  assert.equal(senaForCard({ suit: 'bastos', value: 4 }), 'porno');
  assert.equal(senaForCard({ suit: 'bastos', value: 7 }), 'porno');
  assert.equal(senaForCard({ suit: 'bastos', value: 12 }), 'figuras');
  assert.equal(senaForCard({ suit: 'oros', value: 10 }), 'figuras');
});

test('every hand has at least one seña to make', () => {
  const suits = ['oros', 'copas', 'espadas', 'bastos'] as const;
  const values = [1, 2, 3, 4, 5, 6, 7, 10, 11, 12] as const;
  for (const suit of suits) for (const value of values) assert.ok(senasForHand([{ suit, value }]).length > 0, `${value} ${suit}`);
});

test('senasForHand orders by importance: aces first, then figures, then low cards', () => {
  assert.deepEqual(senasForHand([{ suit: 'oros', value: 5 }, { suit: 'espadas', value: 1 }, { suit: 'copas', value: 3 }]), ['ancho-espada', 'tres', 'porno']);
});

test('nada means no strong card: no figure, no ancho de bastos, no powered ace', () => {
  assert.deepEqual(senasForHand([{ suit: 'oros', value: 4 }, { suit: 'copas', value: 3 }, { suit: 'espadas', value: 7 }]), ['nada']);
  assert.deepEqual(senasForHand([]), ['nada']);
  // figures are strong: their own seña, never 'nada'
  assert.deepEqual(senasForHand([{ suit: 'oros', value: 12 }, { suit: 'copas', value: 10 }]), ['figuras']);
  assert.deepEqual(senasForHand([{ suit: 'oros', value: 12 }, { suit: 'copas', value: 2 }]), ['figuras', 'dos']);
  // an ace whose power is off is a low card
  const noCopas = { espadas: true, copas: false, oros: true };
  assert.deepEqual(senasForHand([{ suit: 'copas', value: 1 }, { suit: 'oros', value: 5 }], noCopas), ['nada']);
  assert.deepEqual(senasForHand([{ suit: 'copas', value: 1 }, { suit: 'bastos', value: 1 }], noCopas), ['ancho-basto']);
});

test('isSena rejects unknown values', () => {
  assert.ok(isSena('dos'));
  assert.ok(!isSena('falso'));
  assert.ok(!isSena(3));
});
