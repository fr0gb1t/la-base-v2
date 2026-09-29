/**
 * Unit tests for game engine and state machine
 */

import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  createGameState,
  transitionPhase,
  getMaxBasesForRound,
  isRoundComplete,
  isGameComplete,
  getPlayerTeam,
  getNextPlayer,
  rotateMano,
  canPlayCard,
  removeCardFromHand,
} from './engine.js';
import type { Player, Card } from './types.js';

// Test helpers
function createTestPlayers(count: number): Player[] {
  const players: Player[] = [];
  const teams = ['nosotros', 'ellos'] as const;

  for (let i = 0; i < count; i++) {
    players.push({
      id: `player-${i + 1}`,
      name: `Player ${i + 1}`,
      team: teams[i % 2],
      hand: [
        { suit: 'oros', value: 1 },
        { suit: 'copas', value: 2 },
        { suit: 'espadas', value: 3 },
        { suit: 'bastos', value: 4 },
        { suit: 'oros', value: 5 },
      ],
      isMano: i === 0,
      reconnectToken: `token-${i + 1}`,
      isAuthenticated: true,
    });
  }

  return players;
}

describe('Game State Initialization', () => {
  test('createGameState initializes game with correct structure', () => {
    const players = createTestPlayers(4);
    const state = createGameState(players, 'clasica', {
      espadas: false,
      copas: false,
      oros: false,
    });

    assert.equal(state.phase, 'round_setup');
    assert.equal(state.roundIndex, 0);
    assert.deepEqual(state.scores, { nosotros: 0, ellos: 0 });
    assert.deepEqual(state.basesWon, { nosotros: 0, ellos: 0 });
    assert.equal(state.currentManoPlayerId, players[0].id);
    assert.equal(state.playDirection, 'antihorario');
  });

  test('createGameState with custom structure', () => {
    const players = createTestPlayers(4);
    const customStructure = [1, 2, 3];
    const state = createGameState(players, 'custom', { espadas: false, copas: false, oros: false }, customStructure);

    assert.deepEqual(state.structureSequence, customStructure);
  });

  test('createGameState activates ace powers', () => {
    const players = createTestPlayers(4);
    const state = createGameState(players, 'clasica', {
      espadas: true,
      copas: true,
      oros: true,
    });

    assert.equal(state.acePowers.espadas, true);
    assert.equal(state.acePowers.copas, true);
    assert.equal(state.acePowers.oros, true);
  });
});

describe('Phase Transitions', () => {
  test('Basic phase transitions follow state machine', () => {
    assert.equal(transitionPhase('lobby'), 'config');
    assert.equal(transitionPhase('config'), 'round_setup');
    assert.equal(transitionPhase('round_setup'), 'bidding');
    assert.equal(transitionPhase('bidding'), 'playing');
    assert.equal(transitionPhase('playing'), 'base_resolution');
  });

  test('Base resolution loops back to playing with base_resolution condition', () => {
    assert.equal(transitionPhase('base_resolution'), 'playing');
  });

  test('Base resolution moves to round_scoring with all_bases_played condition', () => {
    assert.equal(transitionPhase('base_resolution', 'all_bases_played'), 'round_scoring');
  });

  test('Round scoring moves to round_setup with round_complete condition', () => {
    assert.equal(transitionPhase('round_scoring', 'round_complete'), 'round_setup');
  });

  test('Game over is terminal state', () => {
    assert.equal(transitionPhase('game_over'), 'game_over');
  });
});

describe('Round and Game Completion', () => {
  test('isRoundComplete checks if all bases played', () => {
    const players = createTestPlayers(4);
    const state = createGameState(players, 'clasica', { espadas: false, copas: false, oros: false });

    // Ronda 0 (Clásica) has 1 base
    assert.equal(isRoundComplete(state), false);

    state.basesWon.nosotros = 1;
    assert.equal(isRoundComplete(state), true);
  });

  test('isRoundComplete accounts for both teams bases', () => {
    const players = createTestPlayers(4);
    const state = createGameState(players, 'clasica', { espadas: false, copas: false, oros: false });

    // Ronda 0 has 1 base total
    state.basesWon.nosotros = 0;
    state.basesWon.ellos = 1;
    assert.equal(isRoundComplete(state), true);

    state.basesWon.nosotros = 1;
    state.basesWon.ellos = 0;
    assert.equal(isRoundComplete(state), true);
  });

  test('isGameComplete checks if all rounds played', () => {
    const players = createTestPlayers(4);
    const state = createGameState(players, 'clasica', { espadas: false, copas: false, oros: false });

    // Clásica has 12 rounds
    assert.equal(isGameComplete(state), false);

    state.roundIndex = 12;
    assert.equal(isGameComplete(state), true);

    state.roundIndex = 11;
    assert.equal(isGameComplete(state), false);
  });

  test('isGameComplete with custom structure', () => {
    const players = createTestPlayers(4);
    const customStructure = [1, 2, 3];
    const state = createGameState(players, 'custom', { espadas: false, copas: false, oros: false }, customStructure);

    state.roundIndex = 2;
    assert.equal(isGameComplete(state), false);

    state.roundIndex = 3;
    assert.equal(isGameComplete(state), true);
  });
});

describe('Player Team and Turn Management', () => {
  test('getPlayerTeam returns correct team', () => {
    const players = createTestPlayers(4);
    assert.equal(getPlayerTeam(players, 'player-1'), 'nosotros');
    assert.equal(getPlayerTeam(players, 'player-2'), 'ellos');
    assert.equal(getPlayerTeam(players, 'player-3'), 'nosotros');
    assert.equal(getPlayerTeam(players, 'player-4'), 'ellos');
  });

  test('getPlayerTeam returns null for invalid player', () => {
    const players = createTestPlayers(4);
    assert.equal(getPlayerTeam(players, 'invalid'), null);
  });

  test('getNextPlayer antihorario goes backwards', () => {
    const players = createTestPlayers(4);

    // From player-1 (index 0), antihorario goes to player-4 (index 3)
    let next = getNextPlayer(players, 'player-1', 'antihorario');
    assert.equal(next?.id, 'player-4');

    // From player-2 (index 1), antihorario goes to player-1 (index 0)
    next = getNextPlayer(players, 'player-2', 'antihorario');
    assert.equal(next?.id, 'player-1');
  });

  test('getNextPlayer horario goes forward', () => {
    const players = createTestPlayers(4);

    // From player-1 (index 0), horario goes to player-2 (index 1)
    let next = getNextPlayer(players, 'player-1', 'horario');
    assert.equal(next?.id, 'player-2');

    // From player-4 (index 3), horario goes to player-1 (index 0, wraps around)
    next = getNextPlayer(players, 'player-4', 'horario');
    assert.equal(next?.id, 'player-1');
  });

  test('getNextPlayer returns null for invalid player', () => {
    const players = createTestPlayers(4);
    const next = getNextPlayer(players, 'invalid', 'antihorario');
    assert.equal(next, null);
  });

  test('rotateMano moves to next player', () => {
    const players = createTestPlayers(4);

    let manoId = players[0].id;
    manoId = rotateMano(players, manoId);
    assert.equal(manoId, 'player-2');

    manoId = rotateMano(players, manoId);
    assert.equal(manoId, 'player-3');

    manoId = rotateMano(players, manoId);
    assert.equal(manoId, 'player-4');

    // Wraps around
    manoId = rotateMano(players, manoId);
    assert.equal(manoId, 'player-1');
  });

  test('rotateMano handles invalid player', () => {
    const players = createTestPlayers(4);
    const result = rotateMano(players, 'invalid');
    assert.equal(result, 'invalid'); // Returns unchanged if not found
  });
});

describe('Card Management', () => {
  test('canPlayCard checks if card exists in hand', () => {
    const hand: Card[] = [
      { suit: 'oros', value: 1 },
      { suit: 'copas', value: 2 },
      { suit: 'espadas', value: 3 },
    ];

    assert.ok(canPlayCard(hand, { suit: 'oros', value: 1 }));
    assert.ok(canPlayCard(hand, { suit: 'copas', value: 2 }));
    assert.ok(!canPlayCard(hand, { suit: 'bastos', value: 4 }));
    assert.ok(!canPlayCard(hand, { suit: 'oros', value: 5 })); // Different value
  });

  test('canPlayCard with empty hand', () => {
    const hand: Card[] = [];
    assert.ok(!canPlayCard(hand, { suit: 'oros', value: 1 }));
  });

  test('removeCardFromHand removes exact card', () => {
    const hand: Card[] = [
      { suit: 'oros', value: 1 },
      { suit: 'copas', value: 2 },
      { suit: 'espadas', value: 3 },
    ];

    const result = removeCardFromHand(hand, { suit: 'copas', value: 2 });
    assert.equal(result.length, 2);
    assert.ok(result.some((c) => c.suit === 'oros' && c.value === 1));
    assert.ok(result.some((c) => c.suit === 'espadas' && c.value === 3));
    assert.ok(!result.some((c) => c.suit === 'copas' && c.value === 2));
  });

  test('removeCardFromHand with duplicate cards removes only first', () => {
    const hand: Card[] = [
      { suit: 'oros', value: 1 },
      { suit: 'oros', value: 1 }, // Duplicate
      { suit: 'copas', value: 2 },
    ];

    const result = removeCardFromHand(hand, { suit: 'oros', value: 1 });
    assert.equal(result.length, 2);
    assert.ok(result.some((c) => c.suit === 'oros' && c.value === 1)); // One remains
    assert.ok(result.some((c) => c.suit === 'copas' && c.value === 2));
  });

  test('removeCardFromHand returns original hand if card not found', () => {
    const hand: Card[] = [
      { suit: 'oros', value: 1 },
      { suit: 'copas', value: 2 },
    ];

    const result = removeCardFromHand(hand, { suit: 'bastos', value: 4 });
    assert.deepEqual(result, hand); // Unchanged
  });

  test('removeCardFromHand preserves order of remaining cards', () => {
    const hand: Card[] = [
      { suit: 'oros', value: 1 },
      { suit: 'copas', value: 2 },
      { suit: 'espadas', value: 3 },
      { suit: 'bastos', value: 4 },
    ];

    const result = removeCardFromHand(hand, { suit: 'espadas', value: 3 });
    assert.equal(result[0].suit, 'oros');
    assert.equal(result[1].suit, 'copas');
    assert.equal(result[2].suit, 'bastos');
  });
});
