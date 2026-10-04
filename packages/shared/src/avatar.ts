/**
 * A player's avatar: the face of their mask, put together from four parts (eyes, mouth, brows,
 * hair), five kinds of each, with a colour for the eyes and one for the hair. Players pick it in the
 * settings and it travels with them to the table; the server only checks it is well formed (a made-up
 * number never reaches another player's screen). The drawing, and the colour palette (always inside the
 * game's muted range: no neon), live in the client.
 */
export const AVATAR_KINDS = 5; // kinds of eyes, mouths, brows and hair
export const EYE_COLORS = 6; // colours to pick for the eyes
export const HAIR_COLORS = 7; // colours to pick for the hair

export interface AvatarSpec {
  eyes: number; // 0..4
  mouth: number; // 0..4
  brows: number; // 0..4
  hair: number; // 0..4
  eyeColor: number; // 0..5
  hairColor: number; // 0..6
}

export const AVATAR_PARTS = ['eyes', 'mouth', 'brows', 'hair'] as const;
export type AvatarPart = (typeof AVATAR_PARTS)[number];

const inRange = (v: unknown, n: number): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < n;

/** The avatar if it is well formed, `null` otherwise (use it on anything that came over the network or from storage). */
export function sanitizeAvatar(v: unknown): AvatarSpec | null {
  if (!v || typeof v !== 'object') return null;
  const a = v as Record<string, unknown>;
  if (!inRange(a.eyes, AVATAR_KINDS) || !inRange(a.mouth, AVATAR_KINDS) || !inRange(a.brows, AVATAR_KINDS) || !inRange(a.hair, AVATAR_KINDS)) return null;
  if (!inRange(a.eyeColor, EYE_COLORS) || !inRange(a.hairColor, HAIR_COLORS)) return null;
  return { eyes: a.eyes, mouth: a.mouth, brows: a.brows, hair: a.hair, eyeColor: a.eyeColor, hairColor: a.hairColor };
}

/** A random face: every part and both colours drawn independently. `rng` returns [0, 1) (Math.random by default). */
export function randomAvatar(rng: () => number = Math.random): AvatarSpec {
  const pick = (n: number) => Math.min(n - 1, Math.floor(rng() * n));
  return { eyes: pick(AVATAR_KINDS), mouth: pick(AVATAR_KINDS), brows: pick(AVATAR_KINDS), hair: pick(AVATAR_KINDS), eyeColor: pick(EYE_COLORS), hairColor: pick(HAIR_COLORS) };
}

/** Well formed as given, or a fresh random one. */
export const avatarOrRandom = (v: unknown, rng?: () => number): AvatarSpec => sanitizeAvatar(v) ?? randomAvatar(rng);

export const sameAvatar = (a: AvatarSpec, b: AvatarSpec) =>
  a.eyes === b.eyes && a.mouth === b.mouth && a.brows === b.brows && a.hair === b.hair && a.eyeColor === b.eyeColor && a.hairColor === b.hairColor;
