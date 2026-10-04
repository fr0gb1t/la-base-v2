/**
 * A player's avatar: the face of their mask, put together from four parts (eyes, mouth, brows and the
 * symbol on the forehead), five kinds of each, and a colour for the eyes. There is no hair: everybody
 * wears the same black hood over a black mask, and what tells them apart is the light on it. Players pick it in the
 * settings and it travels with them to the table; the server only checks it is well formed (a made-up
 * number never reaches another player's screen). The drawing, and the colour palette (always inside the
 * game's muted range: no neon), live in the client.
 */
export const AVATAR_KINDS = 5; // kinds of eyes, mouths, brows and symbols
export const EYE_COLORS = 6; // colours to pick for the eyes

export interface AvatarSpec {
  eyes: number; // 0..4
  mouth: number; // 0..4
  brows: number; // 0..4
  symbol: number; // 0..4 (circle, triangle, square, diamond, pentagon)
  eyeColor: number; // 0..5
}

export const AVATAR_PARTS = ['eyes', 'mouth', 'brows', 'symbol'] as const;
export type AvatarPart = (typeof AVATAR_PARTS)[number];

const inRange = (v: unknown, n: number): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < n;

/** The avatar if it is well formed, `null` otherwise (use it on anything that came over the network or from storage). */
export function sanitizeAvatar(v: unknown): AvatarSpec | null {
  if (!v || typeof v !== 'object') return null;
  const a = v as Record<string, unknown>;
  if (!inRange(a.eyes, AVATAR_KINDS) || !inRange(a.mouth, AVATAR_KINDS) || !inRange(a.brows, AVATAR_KINDS)) return null;
  if (!inRange(a.eyeColor, EYE_COLORS)) return null;
  // an avatar from before the symbol existed gets the first one; one with the old hair fields is still good (only the known fields are kept)
  const symbol = a.symbol === undefined ? 0 : a.symbol;
  if (!inRange(symbol, AVATAR_KINDS)) return null;
  return { eyes: a.eyes, mouth: a.mouth, brows: a.brows, symbol, eyeColor: a.eyeColor };
}

/** A random face: every part and the eye colour drawn independently. `rng` returns [0, 1) (Math.random by default). */
export function randomAvatar(rng: () => number = Math.random): AvatarSpec {
  const pick = (n: number) => Math.min(n - 1, Math.floor(rng() * n));
  return { eyes: pick(AVATAR_KINDS), mouth: pick(AVATAR_KINDS), brows: pick(AVATAR_KINDS), symbol: pick(AVATAR_KINDS), eyeColor: pick(EYE_COLORS) };
}

/** Well formed as given, or a fresh random one. */
export const avatarOrRandom = (v: unknown, rng?: () => number): AvatarSpec => sanitizeAvatar(v) ?? randomAvatar(rng);

export const sameAvatar = (a: AvatarSpec, b: AvatarSpec) =>
  a.eyes === b.eyes && a.mouth === b.mouth && a.brows === b.brows && a.symbol === b.symbol && a.eyeColor === b.eyeColor;
