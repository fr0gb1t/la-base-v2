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
  assert.equal(senaForCard({ suit: 'bastos', value: 12 }), null);
});

test('senasForHand orders by importance and falls back to nada', () => {
  assert.deepEqual(senasForHand([{ suit: 'oros', value: 5 }, { suit: 'espadas', value: 1 }, { suit: 'copas', value: 3 }]), ['ancho-espada', 'tres', 'porno']);
  assert.deepEqual(senasForHand([{ suit: 'oros', value: 12 }, { suit: 'copas', value: 10 }]), ['nada']);
  assert.deepEqual(senasForHand([]), ['nada']);
});

test('isSena rejects unknown values', () => {
  assert.ok(isSena('dos'));
  assert.ok(!isSena('falso'));
  assert.ok(!isSena(3));
});
