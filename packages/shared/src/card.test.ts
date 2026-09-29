/**
 * Unit tests for card hierarchy and comparison logic
 */

import { describe, it, test } from 'node:test';
import { strict as assert } from 'node:assert';
import { cardRank, compareCards, resolveBase, isAnchodeBastos } from './card.js';
import type { Card, PlayedCard, AcePowers } from './types.js';

describe('Card Hierarchy', () => {
  test('Ancho de Bastos has highest rank (13)', () => {
    const ancho: Card = { suit: 'bastos', value: 1 };
    assert.equal(cardRank(ancho), 13);
  });

  test('Rey (12) ranks as 12', () => {
    const rey: Card = { suit: 'oros', value: 12 };
    assert.equal(cardRank(rey), 12);
  });

  test('Caballo (11) ranks as 11', () => {
    const caballo: Card = { suit: 'copas', value: 11 };
    assert.equal(cardRank(caballo), 11);
  });

  test('Sota (10) ranks as 10', () => {
    const sota: Card = { suit: 'espadas', value: 10 };
    assert.equal(cardRank(sota), 10);
  });

  test('7 of any suit ranks as 7', () => {
    assert.equal(cardRank({ suit: 'oros', value: 7 }), 7);
    assert.equal(cardRank({ suit: 'copas', value: 7 }), 7);
    assert.equal(cardRank({ suit: 'espadas', value: 7 }), 7);
    assert.equal(cardRank({ suit: 'bastos', value: 7 }), 7);
  });

  test('As (1) of non-bastos suits ranks as 1', () => {
    assert.equal(cardRank({ suit: 'oros', value: 1 }), 1);
    assert.equal(cardRank({ suit: 'copas', value: 1 }), 1);
    assert.equal(cardRank({ suit: 'espadas', value: 1 }), 1);
  });

  test('Hierarchy is correct: Ancho > Rey > Caballo > Sota > 7 > 6 > 5 > 4 > 3 > 2 > As', () => {
    const cards: Card[] = [
      { suit: 'bastos', value: 1 }, // Ancho = 13
      { suit: 'oros', value: 12 }, // Rey = 12
      { suit: 'copas', value: 11 }, // Caballo = 11
      { suit: 'espadas', value: 10 }, // Sota = 10
      { suit: 'oros', value: 7 }, // 7 = 7
      { suit: 'copas', value: 6 }, // 6 = 6
      { suit: 'espadas', value: 5 }, // 5 = 5
      { suit: 'bastos', value: 4 }, // 4 = 4
      { suit: 'oros', value: 3 }, // 3 = 3
      { suit: 'copas', value: 2 }, // 2 = 2
      { suit: 'espadas', value: 1 }, // As = 1
    ];

    const ranks = cards.map((c) => cardRank(c));
    for (let i = 0; i < ranks.length - 1; i++) {
      assert.ok(
        ranks[i] > ranks[i + 1],
        `Card ${i} (rank ${ranks[i]}) should beat card ${i + 1} (rank ${ranks[i + 1]})`,
      );
    }
  });
});

describe('Card Comparison', () => {
  test('Higher card beats lower card', () => {
    const rey: PlayedCard = { playerId: '1', card: { suit: 'oros', value: 12 }, order: 0 };
    const dos: PlayedCard = { playerId: '2', card: { suit: 'copas', value: 2 }, order: 1 };
    const acePowers: AcePowers = { espadas: false, copas: false, oros: false };

    assert.ok(compareCards(rey, dos, acePowers), 'Rey should beat 2');
  });

  test('First played card wins on tie (same rank)', () => {
    const rey1: PlayedCard = { playerId: '1', card: { suit: 'oros', value: 12 }, order: 0 };
    const rey2: PlayedCard = { playerId: '2', card: { suit: 'copas', value: 12 }, order: 1 };
    const acePowers: AcePowers = { espadas: false, copas: false, oros: false };

    assert.ok(compareCards(rey1, rey2, acePowers), 'First Rey should beat second Rey');
    assert.ok(!compareCards(rey2, rey1, acePowers), 'Second Rey should NOT beat first Rey');
  });

  test('Ancho de Bastos beats all other cards', () => {
    const ancho: PlayedCard = {
      playerId: '1',
      card: { suit: 'bastos', value: 1 },
      order: 0,
    };
    const rey: PlayedCard = { playerId: '2', card: { suit: 'oros', value: 12 }, order: 1 };
    const acePowers: AcePowers = { espadas: false, copas: false, oros: false };

    assert.ok(compareCards(ancho, rey, acePowers), 'Ancho de Bastos should beat Rey');
  });

  test('As de Espadas kills Ancho de Bastos ONLY if played after', () => {
    const ancho: PlayedCard = {
      playerId: '1',
      card: { suit: 'bastos', value: 1 },
      order: 0,
    };
    const asEspadas: PlayedCard = {
      playerId: '2',
      card: { suit: 'espadas', value: 1 },
      order: 1,
    };
    const acePowersEnabled: AcePowers = { espadas: true, copas: false, oros: false };

    // compareCards(card1, card2) returns true if card1 beats card2
    // As Espadas played AFTER Ancho → As Espadas wins
    assert.ok(!compareCards(ancho, asEspadas, acePowersEnabled), 'Ancho (card1) should NOT beat As Espadas (card2) if As is played after');
    assert.ok(compareCards(asEspadas, ancho, acePowersEnabled), 'As Espadas (card1) should beat Ancho (card2) if As is played after Ancho');

    // Disabled power → normal behavior (Ancho always wins)
    const acePowersDisabled: AcePowers = { espadas: false, copas: false, oros: false };
    assert.ok(compareCards(ancho, asEspadas, acePowersDisabled), 'Ancho should beat As Espadas when power is disabled');
    assert.ok(!compareCards(asEspadas, ancho, acePowersDisabled), 'As Espadas should NOT beat Ancho when power is disabled');
  });

  test('As de Espadas played BEFORE Ancho de Bastos behaves as normal 1', () => {
    const asEspadas: PlayedCard = {
      playerId: '1',
      card: { suit: 'espadas', value: 1 },
      order: 0,
    };
    const ancho: PlayedCard = {
      playerId: '2',
      card: { suit: 'bastos', value: 1 },
      order: 1,
    };
    const acePowersEnabled: AcePowers = { espadas: true, copas: false, oros: false };

    // As Espadas played BEFORE Ancho → doesn't kill it, acts as normal 1
    assert.ok(!compareCards(asEspadas, ancho, acePowersEnabled), 'As Espadas played before should NOT kill Ancho');
    assert.ok(compareCards(ancho, asEspadas, acePowersEnabled), 'Ancho should beat As Espadas if As is played before');
  });
});

describe('Base Resolution', () => {
  test('Resolve base with single winner (higher card)', () => {
    const playedCards: PlayedCard[] = [
      { playerId: '1', card: { suit: 'oros', value: 5 }, order: 0 },
      { playerId: '2', card: { suit: 'copas', value: 12 }, order: 1 },
      { playerId: '3', card: { suit: 'espadas', value: 7 }, order: 2 },
      { playerId: '4', card: { suit: 'bastos', value: 3 }, order: 3 },
    ];
    const acePowers: AcePowers = { espadas: false, copas: false, oros: false };

    const winner = resolveBase(playedCards, acePowers, 'antihorario');
    assert.equal(winner.playerId, '2', 'Player 2 with Rey should win');
  });

  test('Resolve base with Ancho de Bastos (always wins unless As Espadas after)', () => {
    const playedCards: PlayedCard[] = [
      { playerId: '1', card: { suit: 'oros', value: 12 }, order: 0 }, // Rey
      { playerId: '2', card: { suit: 'bastos', value: 1 }, order: 1 }, // Ancho
      { playerId: '3', card: { suit: 'espadas', value: 7 }, order: 2 },
      { playerId: '4', card: { suit: 'copas', value: 11 }, order: 3 }, // Caballo
    ];
    const acePowers: AcePowers = { espadas: false, copas: false, oros: false };

    const winner = resolveBase(playedCards, acePowers, 'antihorario');
    assert.equal(winner.playerId, '2', 'Ancho de Bastos should win');
  });
});

describe('Utility Functions', () => {
  test('isAnchodeBastos correctly identifies Ancho de Bastos', () => {
    assert.ok(isAnchodeBastos({ suit: 'bastos', value: 1 }));
    assert.ok(!isAnchodeBastos({ suit: 'oros', value: 1 }));
    assert.ok(!isAnchodeBastos({ suit: 'bastos', value: 2 }));
    assert.ok(!isAnchodeBastos({ suit: 'copas', value: 12 }));
  });
});
