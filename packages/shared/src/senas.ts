import type { Card } from './types.js';

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
  | 'tres' // bite the lower lip
  | 'dos' // kiss
  | 'porno' // mouth slightly open, like a fish (any 4–7)
  | 'nada'; // close the eyes and open them again (nothing / blind)

export const SENAS: ReadonlyArray<{ id: Sena; label: string; gesture: string }> = [
  { id: 'ancho-espada', label: 'As de espadas', gesture: 'levantar las cejas' },
  { id: 'ancho-basto', label: 'Ancho de bastos', gesture: 'guiñar el ojo derecho' },
  { id: 'ancho-copa', label: 'As de copas', gesture: 'labios a la derecha' },
  { id: 'ancho-oro', label: 'As de oros', gesture: 'labios a la izquierda' },
  { id: 'tres', label: 'Un tres', gesture: 'morder el labio inferior' },
  { id: 'dos', label: 'Un dos', gesture: 'dar un beso' },
  { id: 'porno', label: 'Carta porno (4 a 7)', gesture: 'boca de pescado' },
  { id: 'nada', label: 'Nada / ciego', gesture: 'cerrar los ojos' },
];

export const isSena = (v: unknown): v is Sena => typeof v === 'string' && SENAS.some((s) => s.id === v);

/** The seña that describes one card, or null when no seña covers it (10, 11, 12). */
export function senaForCard(card: Card): Sena | null {
  if (card.value === 1) return card.suit === 'espadas' ? 'ancho-espada' : card.suit === 'bastos' ? 'ancho-basto' : card.suit === 'copas' ? 'ancho-copa' : 'ancho-oro';
  if (card.value === 3) return 'tres';
  if (card.value === 2) return 'dos';
  if (card.value >= 4 && card.value <= 7) return 'porno';
  return null;
}

/** Every seña worth making for a hand, most important first; ['nada'] when nothing applies. */
export function senasForHand(hand: Card[]): Sena[] {
  const found = new Set(hand.map(senaForCard).filter((s): s is Sena => s !== null));
  const list = SENAS.map((s) => s.id).filter((id) => found.has(id));
  return list.length ? list : ['nada'];
}
