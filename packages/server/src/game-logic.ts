/**
 * Game logic for La Base
 * Card dealing, bidding, playing, resolution
 */

import { randomInt } from 'node:crypto';
import type { Card, GameState, PlayedCard, Bid } from '@la-base/shared';
import { resolveBase, removeCardFromHand } from '@la-base/shared';
import type { RoomPlayer } from './rooms.js';

/**
 * Create a standard Spanish deck (40 cards, no 8s, 9s, or jokers)
 */
export function createDeck(deckCount = 1): Card[] {
  const suits: Array<'oros' | 'copas' | 'espadas' | 'bastos'> = [
    'oros',
    'copas',
    'espadas',
    'bastos',
  ];
  const values: Array<1 | 2 | 3 | 4 | 5 | 6 | 7 | 10 | 11 | 12> = [1, 2, 3, 4, 5, 6, 7, 10, 11, 12];

  const deck: Card[] = [];
  for (let deckNumber = 0; deckNumber < deckCount; deckNumber++) {
    for (const suit of suits) {
      for (const value of values) {
        deck.push({ suit, value });
      }
    }
  }

  return deck;
}

/**
 * Shuffle array using Fisher-Yates algorithm
 */
function shuffle<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function createShuffledDeck(deckCount = 1): Card[] {
  return shuffle(createDeck(deckCount));
}

/**
 * Deal cards to players for the current round.
 */
export function dealCards(players: RoomPlayer[], cardsPerPlayer: number): void {
  const deckCount = players.length >= 8 ? 2 : 1;
  const deck = createShuffledDeck(deckCount);

  players.forEach((player) => {
    player.hand = [];
  });

  // Deal cards in order
  let cardIndex = 0;
  for (let i = 0; i < cardsPerPlayer; i++) {
    for (const player of players) {
      if (cardIndex < deck.length) {
        player.hand.push(deck[cardIndex]);
        cardIndex++;
      }
    }
  }
}

/**
 * Play a card and validate
 */
export function playCard(
  player: RoomPlayer,
  card: Card,
  gameState: GameState,
  playedCards: PlayedCard[]
): { success: boolean; error?: string; playedCard?: PlayedCard } {
  // Validate card is in hand
  if (!player.hand.some((c) => c.suit === card.suit && c.value === card.value)) {
    return { success: false, error: 'Card not in hand' };
  }

  // Create played card with order based on current plays
  const playedCard: PlayedCard = {
    playerId: player.id,
    card,
    order: playedCards.length,
  };

  // Remove card from hand
  player.hand = removeCardFromHand(player.hand, card);

  return { success: true, playedCard };
}

/**
 * Check if all players have played a card in current base
 */
export function allPlayersPlayed(playedCards: PlayedCard[], playerCount: number): boolean {
  return playedCards.length === playerCount;
}

/**
 * Get next player in turn order
 */
export function getNextPlayerInTurn(
  players: RoomPlayer[],
  currentPlayerId: string,
  direction: 'antihorario' | 'horario',
  manoPlayerId: string
): RoomPlayer | null {
  const currentIndex = players.findIndex((p) => p.id === currentPlayerId);
  if (currentIndex === -1) return null;

  const manoIndex = players.findIndex((p) => p.id === manoPlayerId);

  let nextIndex: number;
  if (direction === 'antihorario') {
    // Counter-clockwise (decreasing index)
    nextIndex = (currentIndex - 1 + players.length) % players.length;
  } else {
    // Clockwise (increasing index)
    nextIndex = (currentIndex + 1) % players.length;
  }

  return players[nextIndex];
}

/**
 * Find the first player in turn order from another team.
 */
export function getFirstPlayerFromOtherTeam(
  players: RoomPlayer[],
  currentPlayerId: string,
  direction: 'antihorario' | 'horario'
): RoomPlayer | null {
  const currentPlayer = players.find((p) => p.id === currentPlayerId);
  if (!currentPlayer) return null;

  let nextPlayer = getNextPlayerInTurn(players, currentPlayerId, direction, currentPlayerId);
  for (let i = 0; i < players.length - 1; i++) {
    if (!nextPlayer) return null;
    if (nextPlayer.team !== currentPlayer.team) {
      return nextPlayer;
    }
    nextPlayer = getNextPlayerInTurn(players, nextPlayer.id, direction, currentPlayerId);
  }

  return null;
}

/**
 * Complete a base and determine winner
 */
export function completeBase(
  playedCards: PlayedCard[],
  gameState: GameState,
  players: RoomPlayer[]
): { winner: RoomPlayer; winnerTeam: 'nosotros' | 'ellos' } {
  // Use shared resolveBase function
  const winningCard = resolveBase(playedCards, gameState.acePowers, gameState.playDirection);

  const winner = players.find((p) => p.id === winningCard.playerId)!;
  // By game time, all teams are assigned (random gets resolved at game start)
  const winnerTeam = winner.team as 'nosotros' | 'ellos';

  return { winner, winnerTeam };
}

/**
 * Update bases won count
 */
export function updateBasesWon(
  gameState: GameState,
  winnerTeam: 'nosotros' | 'ellos'
): void {
  gameState.basesWon[winnerTeam]++;
}

/**
 * Check if round is complete
 */
export function isRoundComplete(gameState: GameState, maxBasesInRound: number): boolean {
  const totalBases = gameState.basesWon.nosotros + gameState.basesWon.ellos;
  return totalBases === maxBasesInRound;
}

/**
 * Calculate round scores and determine round winner
 */
export function scoreRound(gameState: GameState): {
  nosotrosScore: number;
  ellosScore: number;
  roundWinner: 'nosotros' | 'ellos' | 'both_lost';
} {
  const manoBid = gameState.bids[0]; // Mano always first
  const pieBid = gameState.bids[1]; // Pie always second

  if (!manoBid || !pieBid) {
    return { nosotrosScore: 0, ellosScore: 0, roundWinner: 'both_lost' };
  }

  // Determine which team is Mano and Pie
  const manoTeam = manoBid.team;
  const pieTeam = pieBid.team;

  // Get bases won by each team
  const manoBasesWon = manoTeam === 'nosotros' ? gameState.basesWon.nosotros : gameState.basesWon.ellos;
  const pieBasesWon = pieTeam === 'nosotros' ? gameState.basesWon.nosotros : gameState.basesWon.ellos;

  // Calculate scores using shared scoring logic
  // For now, simple scoring: +10+bases if met, -difference if not
  const manoScore = manoBid.value === manoBasesWon ? 10 + manoBasesWon : -(Math.abs(manoBid.value - manoBasesWon));

  const pieScore = pieBid.value === pieBasesWon ? 10 + pieBasesWon : -(Math.abs(pieBid.value - pieBasesWon));

  // Determine round winner
  let roundWinner: 'nosotros' | 'ellos' | 'both_lost' = 'both_lost';
  if (manoScore > 0 && pieScore <= 0) {
    roundWinner = manoTeam;
  } else if (pieScore > 0 && manoScore <= 0) {
    roundWinner = pieTeam;
  } else if (manoScore > pieScore) {
    roundWinner = manoTeam;
  } else if (pieScore > manoScore) {
    roundWinner = pieTeam;
  }

  // Distribute scores
  const nosotrosScore = manoTeam === 'nosotros' ? manoScore : pieScore;
  const ellosScore = manoTeam === 'ellos' ? manoScore : pieScore;

  return { nosotrosScore, ellosScore, roundWinner };
}

/**
 * Apply round scores to cumulative game scores
 */
export function applyRoundScores(gameState: GameState, nosotrosScore: number, ellosScore: number): void {
  gameState.scores.nosotros += nosotrosScore;
  gameState.scores.ellos += ellosScore;
}

/**
 * Check for Kamikaze violation (Mano loses by 2+ without declaring Kamikaze)
 */
export function checkKamikazeViolation(gameState: GameState): boolean {
  const manoBid = gameState.bids[0];
  if (!manoBid || manoBid.isKamikaze) {
    return false; // No violation if Kamikaze was declared
  }

  const manoTeam = manoBid.team;
  const manoBasesWon = manoTeam === 'nosotros' ? gameState.basesWon.nosotros : gameState.basesWon.ellos;

  const difference = Math.abs(manoBid.value - manoBasesWon);
  return difference >= 2; // Violation if lost by 2+ bases
}

/**
 * Reset round state for next round
 */
export function resetRoundState(gameState: GameState): void {
  gameState.basesWon = { nosotros: 0, ellos: 0 };
  gameState.bids = [];
  gameState.currentBaseCards = [];
  gameState.playDirection = 'antihorario'; // Reset to default direction
  gameState.lastBaseWinnerPlayerId = null;
  gameState.pendingOrosChoice = null;
  gameState.roundIndex++;
}

/**
 * Validate Pie's bid respects the constraint: sum ≠ total bases
 */
export function validatePieBid(manoBidValue: number, pieBidValue: number, maxBases: number): boolean {
  const sum = manoBidValue + pieBidValue;
  return sum !== maxBases; // Valid if sum does NOT equal total
}

/**
 * Get valid bid range for Pie
 */
export function getValidPieBidRange(manoBidValue: number, maxBases: number): number[] {
  const validBids: number[] = [];
  for (let i = 0; i <= maxBases; i++) {
    if (validatePieBid(manoBidValue, i, maxBases)) {
      validBids.push(i);
    }
  }
  return validBids;
}
