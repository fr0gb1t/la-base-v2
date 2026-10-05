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

    const winner = resolveBase(playedCards, acePowers, 'antihorario', []);
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

    const winner = resolveBase(playedCards, acePowers, 'antihorario', []);
    assert.equal(winner.playerId, '2', 'Ancho de Bastos should win');
  });

  // Seats in table order (index +1 = horario, index -1 = antihorario), as in the room's player list.
  const seats = ['jorgito', 'franco', 'pepe', 'alvaro'];
  const acePowers: AcePowers = { espadas: true, copas: true, oros: true };
  const jorgito5 = { playerId: 'jorgito', card: { suit: 'oros', value: 5 }, order: 0 } as PlayedCard;
  const alvaroRey = { playerId: 'alvaro', card: { suit: 'espadas', value: 12 }, order: 1 } as PlayedCard;
  const pepeRey = { playerId: 'pepe', card: { suit: 'copas', value: 12 }, order: 2 } as PlayedCard;
  const francoAs = { playerId: 'franco', card: { suit: 'copas', value: 1 }, order: 3 } as PlayedCard;

  test('horario: the cards are read from the Mano the other way round, so the tied Rey nearer in that direction wins', () => {
    // Antihorario they sat Jorgito, Álvaro, Pepe, Franco; Franco's As de Copas flips it to horario:
    // reading goes Jorgito, Franco, Pepe, Álvaro → Pepe's Rey comes before Álvaro's.
    const winner = resolveBase([jorgito5, alvaroRey, pepeRey, francoAs], acePowers, 'horario', seats);
    assert.equal(winner.playerId, 'pepe');
  });

  test('antihorario: the same cards read in play order, first Rey wins the tie', () => {
    const winner = resolveBase([jorgito5, alvaroRey, pepeRey, francoAs], acePowers, 'antihorario', seats);
    assert.equal(winner.playerId, 'alvaro');
  });

  test('horario base played already in horario: reading order equals play order', () => {
    // Mano Jorgito, then Franco, Pepe, Álvaro actually play in that order.
    const played: PlayedCard[] = [
      { ...jorgito5 },
      { playerId: 'franco', card: { suit: 'oros', value: 2 }, order: 1 },
      { playerId: 'pepe', card: { suit: 'copas', value: 12 }, order: 2 },
      { playerId: 'alvaro', card: { suit: 'espadas', value: 12 }, order: 3 },
    ];
    assert.equal(resolveBase(played, acePowers, 'horario', seats).playerId, 'pepe');
  });

  test('horario: the last card played still counts (a later 5 beats an earlier 3)', () => {
    const played: PlayedCard[] = [
      { playerId: 'jorgito', card: { suit: 'oros', value: 3 }, order: 0 },
      { playerId: 'franco', card: { suit: 'copas', value: 2 }, order: 1 },
      { playerId: 'pepe', card: { suit: 'espadas', value: 4 }, order: 2 },
      { playerId: 'alvaro', card: { suit: 'bastos', value: 5 }, order: 3 },
    ];
    assert.equal(resolveBase(played, acePowers, 'horario', seats).playerId, 'alvaro');
  });

  test('horario: As de Copas played mid-base, the Rey of the player read first from the Mano wins the tie', () => {
    // Played antihorario Jorgito, Álvaro, Pepe (As, flips), then Franco (the skipped seats had played).
    const played: PlayedCard[] = [
      { playerId: 'jorgito', card: { suit: 'oros', value: 6 }, order: 0 },
      { playerId: 'alvaro', card: { suit: 'espadas', value: 12 }, order: 1 },
      { playerId: 'pepe', card: { suit: 'copas', value: 1 }, order: 2 },
      { playerId: 'franco', card: { suit: 'bastos', value: 12 }, order: 3 },
    ];
    assert.equal(resolveBase(played, acePowers, 'horario', seats).playerId, 'franco');
  });

  test('horario: As de Copas second, the turn skips to Franco; the Mano wins the tie of Reyes', () => {
    // Played Jorgito, Álvaro (As, flips), Franco (Pepe is no longer next), Pepe.
    const played: PlayedCard[] = [
      { playerId: 'jorgito', card: { suit: 'oros', value: 12 }, order: 0 },
      { playerId: 'alvaro', card: { suit: 'copas', value: 1 }, order: 1 },
      { playerId: 'franco', card: { suit: 'bastos', value: 12 }, order: 2 },
      { playerId: 'pepe', card: { suit: 'espadas', value: 10 }, order: 3 },
    ];
    assert.equal(resolveBase(played, acePowers, 'horario', seats).playerId, 'jorgito');
  });
});

describe('As de Espadas after the Ancho de Bastos', () => {
  const powers: AcePowers = { espadas: true, copas: false, oros: false };
  const P = (playerId: string, suit: PlayedCard['card']['suit'], value: PlayedCard['card']['value'], order: number): PlayedCard => ({ playerId, card: { suit, value }, order });

  test('once it kills the Ancho it wins the base: a card played after it does not beat it (the 5 de copas)', () => {
    const played = [P('beto', 'bastos', 1, 0), P('ana', 'espadas', 1, 1), P('vos', 'copas', 5, 2)];
    assert.equal(resolveBase(played, powers, 'antihorario', []).playerId, 'ana');
  });

  test('not even a Rey played after it, or before it, beats it', () => {
    assert.equal(resolveBase([P('a', 'bastos', 1, 0), P('b', 'espadas', 1, 1), P('c', 'oros', 12, 2)], powers, 'antihorario', []).playerId, 'b');
    assert.equal(resolveBase([P('c', 'oros', 12, 0), P('a', 'bastos', 1, 1), P('b', 'espadas', 1, 2)], powers, 'antihorario', []).playerId, 'b');
  });

  test('it need not come right after the Ancho', () => {
    const played = [P('a', 'bastos', 1, 0), P('c', 'copas', 7, 1), P('b', 'espadas', 1, 2), P('d', 'oros', 11, 3)];
    assert.equal(resolveBase(played, powers, 'antihorario', []).playerId, 'b');
  });

  test('read before the Ancho it is just an ace, and the Ancho wins', () => {
    const played = [P('b', 'espadas', 1, 0), P('a', 'bastos', 1, 1), P('c', 'copas', 5, 2)];
    assert.equal(resolveBase(played, powers, 'antihorario', []).playerId, 'a');
  });

  test('with no Ancho on the table it is just an ace', () => {
    const played = [P('b', 'espadas', 1, 0), P('c', 'copas', 5, 1)];
    assert.equal(resolveBase(played, powers, 'antihorario', []).playerId, 'c');
  });

  test('without the power, the Ancho wins and a 5 played after does not change it', () => {
    const played = [P('a', 'bastos', 1, 0), P('b', 'espadas', 1, 1), P('c', 'copas', 5, 2)];
    assert.equal(resolveBase(played, { espadas: false, copas: false, oros: false }, 'antihorario', []).playerId, 'a');
  });

  test('two decks (8 players): the As after an Ancho kills it; one before stays an ace', () => {
    const played = [P('x', 'espadas', 1, 0), P('a', 'bastos', 1, 1), P('b', 'espadas', 1, 2), P('c', 'oros', 12, 3)];
    assert.equal(resolveBase(played, powers, 'antihorario', []).playerId, 'b');
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
