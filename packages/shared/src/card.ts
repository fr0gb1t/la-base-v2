/**
 * Card hierarchy and comparison logic for La Base
 *
 * Hierarchy (highest to lowest):
 * Ancho de Bastos (1♠) → Rey(12) → Caballo(11) → Sota(10) → 7 → 6 → 5 → 4 → 3 → 2 → As(1) other suits
 */

import type { Card, AcePowers, PlayedCard } from './types.js';

/**
 * Get the numeric rank of a card (higher = stronger)
 * Ancho de Bastos = 13, Rey = 12, down to As (other) = 1
 */
export function cardRank(card: Card): number {
  if (card.suit === 'bastos' && card.value === 1) return 13; // Ancho de Bastos
  if (card.value === 12) return 12; // Rey
  if (card.value === 11) return 11; // Caballo
  if (card.value === 10) return 10; // Sota
  if (card.value === 7) return 7;
  if (card.value === 6) return 6;
  if (card.value === 5) return 5;
  if (card.value === 4) return 4;
  if (card.value === 3) return 3;
  if (card.value === 2) return 2;
  if (card.value === 1) return 1; // As (other suits)
  return 0;
}

/**
 * Compare two cards and determine winner
 * Returns true if card1 beats card2, false otherwise
 * Tie-breaking: first played (lower order) wins
 */
export function compareCards(
  card1: PlayedCard,
  card2: PlayedCard,
  acePowers: AcePowers
): boolean {
  const rank1 = cardRank(card1.card);
  const rank2 = cardRank(card2.card);

  // Handle As de Espadas killing Ancho de Bastos
  if (acePowers.espadas) {
    const isCard1AsEspadas = card1.card.suit === 'espadas' && card1.card.value === 1;
    const isCard2AsEspadas = card2.card.suit === 'espadas' && card2.card.value === 1;
    const isCard1Ancho = card1.card.suit === 'bastos' && card1.card.value === 1;
    const isCard2Ancho = card2.card.suit === 'bastos' && card2.card.value === 1;

    // As de Espadas played AFTER Ancho de Bastos → kills it and wins
    if (isCard1AsEspadas && isCard2Ancho && card1.order > card2.order) {
      return true; // As Espadas (card1) beats Ancho (card2)
    }
    if (isCard2AsEspadas && isCard1Ancho && card2.order > card1.order) {
      return false; // Ancho (card1) loses to As Espadas (card2)
    }
  }

  if (rank1 > rank2) return true;
  if (rank1 < rank2) return false;

  // Tie: first played wins
  return card1.order < card2.order;
}

/**
 * Cards of a base in reading order: from the Mano, seat by seat, in the direction in force when
 * the base closes. After an As de Copas reverses the table mid-base, this is not the order the
 * cards were played in (the Mano is read first, then the seats the other way round).
 * `seatIds` is the table order, where index +1 is horario and index -1 antihorario; without it
 * (or with an unknown player) the play order is kept.
 */
export function readingOrder(
  playedCards: PlayedCard[],
  playDirection: 'antihorario' | 'horario',
  seatIds: string[]
): PlayedCard[] {
  const mano = playedCards[0];
  const manoSeat = seatIds.indexOf(mano.playerId);
  const step = playDirection === 'horario' ? 1 : -1;
  const distance = (c: PlayedCard) => {
    const seat = seatIds.indexOf(c.playerId);
    return (((seat - manoSeat) * step) % seatIds.length + seatIds.length) % seatIds.length;
  };
  if (manoSeat === -1 || playedCards.some((c) => seatIds.indexOf(c.playerId) === -1)) {
    return playedCards;
  }
  return [...playedCards].sort((a, b) => distance(a) - distance(b));
}

/**
 * Resolve a base (trick) and determine the winning card.
 * Ties, and the As de Espadas "after the Ancho" rule, follow the reading order.
 */
export function resolveBase(
  playedCards: PlayedCard[],
  acePowers: AcePowers,
  playDirection: 'antihorario' | 'horario',
  seatIds: string[]
): PlayedCard {
  if (playedCards.length === 0) {
    throw new Error('No cards played in this base');
  }

  const reading = readingOrder(playedCards, playDirection, seatIds).map((c, i) => ({ ...c, order: i }));

  let winner = reading[0];
  for (let i = 1; i < reading.length; i++) {
    if (!compareCards(winner, reading[i], acePowers)) {
      winner = reading[i];
    }
  }

  return playedCards.find((c) => c.playerId === winner.playerId)!;
}

/**
 * Check if a card is an ace with special powers
 */
export function isAce(card: Card): boolean {
  return card.value === 1;
}

/**
 * Check if a card is the Ancho de Bastos (most powerful card)
 */
export function isAnchodeBastos(card: Card): boolean {
  return card.suit === 'bastos' && card.value === 1;
}
