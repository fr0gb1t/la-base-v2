/**
 * Game state machine and core logic for La Base
 */

import type {
  GameState,
  GamePhase,
  Card,
  Player,
  Team,
  GameStructure,
  AcePowers,
} from './types.js';
import { getBasesForRound, getStructure } from './structures.js';
import type { PieBidRule } from './scoring.js';

/**
 * Create initial game state
 */
export function createGameState(
  players: Player[],
  structure: GameStructure,
  acePowers: AcePowers,
  customStructure?: number[],
  kamikazesPerTeam = 2,
  pieBidRule: PieBidRule = 'estricta'
): GameState {
  const manoPlayer = players[0]; // First player is Mano

  return {
    phase: 'round_setup',
    structure,
    structureSequence: getStructure(structure, customStructure),
    roundIndex: 0,
    acePowers,
    pieBidRule,
    scores: {
      nosotros: 0,
      ellos: 0,
    },
    bids: [],
    kamikazesRemaining: {
      nosotros: kamikazesPerTeam,
      ellos: kamikazesPerTeam,
    },
    playDirection: 'antihorario',
    currentManoPlayerId: manoPlayer.id,
    currentTurnPlayerId: manoPlayer.id,
    currentBidPlayerId: manoPlayer.id,
    pendingOrosChoice: null,
    currentBaseCards: [],
    basesWon: {
      nosotros: 0,
      ellos: 0,
    },
    lastBaseWinnerPlayerId: null,
    readyGate: null,
    kamikazeTeam: null,
    initialDraw: null,
  };
}

/**
 * Transition game to next phase
 */
export function transitionPhase(
  currentPhase: GamePhase,
  condition?: 'all_bases_played' | 'round_complete' | 'game_complete'
): GamePhase {
  const transitions: Record<GamePhase, GamePhase> = {
    lobby: 'config',
    config: 'round_setup',
    initial_draw: 'bidding',
    round_setup: 'bidding',
    bidding: 'playing',
    playing: 'base_resolution',
    base_resolution: 'playing', // loops until all bases played
    round_scoring: 'round_setup', // loops until game complete
    game_over: 'game_over',
  };

  if (condition === 'all_bases_played') {
    // Move from base_resolution to next round
    return 'round_scoring';
  }

  if (condition === 'round_complete') {
    // Move from round_scoring to next round or game over
    return 'round_setup';
  }

  return transitions[currentPhase] || currentPhase;
}

/**
 * Get the number of bases available in the current round
 */
export function getMaxBasesForRound(state: GameState): number {
  return getBasesForRound(state.structure, state.roundIndex, state.structureSequence);
}

/**
 * Check if current round is complete (all bases played)
 */
export function isRoundComplete(state: GameState): boolean {
  const maxBases = getMaxBasesForRound(state);
  const totalBases = state.basesWon.nosotros + state.basesWon.ellos;
  return totalBases === maxBases;
}

/**
 * Check if game is complete (all rounds played)
 */
export function isGameComplete(state: GameState): boolean {
  const totalRounds = state.structureSequence.length;
  return state.roundIndex >= totalRounds;
}

/**
 * Get team of a player
 */
export function getPlayerTeam(players: Player[], playerId: string): Team | null {
  const player = players.find((p) => p.id === playerId);
  return player?.team || null;
}

/**
 * Get next player in turn order
 */
export function getNextPlayer(
  players: Player[],
  currentPlayerId: string,
  direction: 'antihorario' | 'horario'
): Player | null {
  const currentIndex = players.findIndex((p) => p.id === currentPlayerId);
  if (currentIndex === -1) return null;

  const step = direction === 'antihorario' ? -1 : 1;
  const nextIndex = (currentIndex + step + players.length) % players.length;
  return players[nextIndex];
}

/**
 * Rotate Mano to next player
 */
export function rotateMano(players: Player[], currentManoId: string): string {
  const manoIndex = players.findIndex((p) => p.id === currentManoId);
  if (manoIndex === -1) return currentManoId;

  const nextIndex = (manoIndex + 1) % players.length;
  return players[nextIndex].id;
}

/**
 * Check if a player can play a card
 */
export function canPlayCard(hand: Card[], card: Card): boolean {
  return hand.some((c) => c.suit === card.suit && c.value === card.value);
}

/**
 * Remove card from hand
 */
export function removeCardFromHand(hand: Card[], card: Card): Card[] {
  const index = hand.findIndex((c) => c.suit === card.suit && c.value === card.value);
  if (index === -1) return hand;

  return [...hand.slice(0, index), ...hand.slice(index + 1)];
}
