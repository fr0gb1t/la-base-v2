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
 * Resolve a base (trick) and determine the winning card
 * Takes all played cards in order and returns the winning PlayedCard
 */
export function resolveBase(
  playedCards: PlayedCard[],
  acePowers: AcePowers,
  playDirection: 'antihorario' | 'horario'
): PlayedCard {
  if (playedCards.length === 0) {
    throw new Error('No cards played in this base');
  }

  let winner = playedCards[0];

  // If direction is horario (reversed), we need to read cards in reverse order
  // but Mano is always treated as first
  const cardsToCheck = playDirection === 'horario' ? [...playedCards].reverse() : playedCards;

  for (let i = 1; i < cardsToCheck.length; i++) {
    const current = cardsToCheck[i];
    if (!compareCards(winner, current, acePowers)) {
      winner = current;
    }
  }

  return winner;
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
