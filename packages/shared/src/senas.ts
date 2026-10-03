import type { AcePowers, Card } from './types.js';

/**
 * Señas: facial signals a player makes to tell their partner what they hold. Teammates always see
 * them; a rival only catches one by looking straight at the signer's face (decided client-side).
 * Bluffing is allowed: nothing checks that a seña matches the hand.
 */
export type Sena =
  | 'ancho-espada' // raise both eyebrows
  | 'ancho-basto' // wink the right eye
  | 'ancho-copa' // lips to the right
  | 'ancho-oro' // lips to the left
  | 'figuras' // stretch the mouth to both sides at once (10, 11 or 12)
  | 'tres' // bite the lower lip
  | 'dos' // kiss
  | 'porno' // mouth slightly open, like a fish (any 4–7)
  | 'nada' // close the eyes and open them again: nothing that wins (no 10/11/12, ancho de bastos or powered ace)
  | 'si' // nod: ask at least one base, I can make one
  | 'no'; // shake the head: "don't ask anything for me" (weak cards, or a high one I can shed because the rivals already asked a lot)

export const SENAS: ReadonlyArray<{ id: Sena; label: string; gesture: string }> = [
  { id: 'ancho-espada', label: 'As de espadas', gesture: 'levantar las cejas' },
  { id: 'ancho-basto', label: 'Ancho de bastos', gesture: 'guiñar el ojo derecho' },
  { id: 'ancho-copa', label: 'As de copas', gesture: 'labios a la derecha' },
  { id: 'ancho-oro', label: 'As de oros', gesture: 'labios a la izquierda' },
  { id: 'figuras', label: 'Figuras (10, 11, 12)', gesture: 'estirar la boca a los dos lados' },
  { id: 'tres', label: 'Un tres', gesture: 'morder el labio inferior' },
  { id: 'dos', label: 'Un dos', gesture: 'dar un beso' },
  { id: 'porno', label: 'Carta porno (4 a 7)', gesture: 'boca de pescado' },
  { id: 'nada', label: 'Nada: ni figuras ni ases', gesture: 'cerrar los ojos' },
  { id: 'si', label: 'Sí: pedí al menos una', gesture: 'asentir con la cabeza' },
  { id: 'no', label: 'No: por mí no pidas nada', gesture: 'negar con la cabeza' },
];

/** Señas made with the whole head (a nod, a shake) rather than with the face. */
export const isHeadSena = (s: Sena) => s === 'si' || s === 'no';

export const isSena = (v: unknown): v is Sena => typeof v === 'string' && SENAS.some((s) => s.id === v);

/** The seña that describes one card. */
export function senaForCard(card: Card): Sena {
  if (card.value === 1) return card.suit === 'espadas' ? 'ancho-espada' : card.suit === 'bastos' ? 'ancho-basto' : card.suit === 'copas' ? 'ancho-copa' : 'ancho-oro';
  if (card.value === 3) return 'tres';
  if (card.value === 2) return 'dos';
  if (card.value >= 10) return 'figuras';
  return 'porno'; // 4–7
}

const ALL_POWERS: AcePowers = { espadas: true, copas: true, oros: true };

/** A card that matters: a figure (10, 11, 12), the ancho de bastos or an ace whose power is on. */
export function isStrongCard(card: Card, powers: AcePowers = ALL_POWERS): boolean {
  if (card.value >= 10) return true;
  if (card.value !== 1) return false;
  return card.suit === 'bastos' || powers[card.suit as keyof AcePowers] === true;
}

/**
 * The señas that describe a hand, most important first. 'nada' (eyes closed) when it holds no
 * strong card at all; otherwise its aces, figures, then low cards (3, 2, 4–7). An ace whose power
 * is off is just a low card: it gets no seña of its own.
 */
export function senasForHand(hand: Card[], powers: AcePowers = ALL_POWERS): Sena[] {
  if (!hand.some((c) => isStrongCard(c, powers))) return ['nada'];
  const found = new Set(
    hand.map((c) => (c.value === 1 && !isStrongCard(c, powers) ? null : senaForCard(c))).filter((s): s is Sena => s !== null),
  );
  return SENAS.map((s) => s.id).filter((id) => found.has(id) && !isHeadSena(id));
}

/**
 * How long the 3D table takes to show a new hand (sweep the last round, shuffle, deal one card at a
 * time): nobody should sign, knock or declare before their cards are visible. Mirrors the
 * client's animateSweep + animateDeal timings.
 */
export function dealAnimationMs(players: number, perPlayer: number): number {
  const SWEEP = 1400; // the last round's cards (or the draw) go back to the dealer
  const SHUFFLE = 500;
  const PER_CARD = 110; // one card leaves the dealer every 0.11 s…
  const FLIGHT = 420; // …and lands 0.42 s later
  return SWEEP + SHUFFLE + players * perPlayer * PER_CARD + FLIGHT + 400;
}
