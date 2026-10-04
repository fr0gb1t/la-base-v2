/**
 * A player's avatar: the face they sit at the table with. Nobody has a body: a face floats over the table and two
 * hands play the cards, as in Buckshot Roulette. The face is one of two kinds:
 *  · an LED mask (a black visor-shaped mask whose face is a matrix of LEDs, drawn in light);
 *  · a sculpted head (a whole head, worked like clay: a horse, a rooster, a ram, a devil, a dummy, a saint).
 * Players pick it in the settings and it travels with them to the table; the server only checks it is one of
 * these (a made-up id never reaches another player's screen). The drawing lives in the client.
 */
export const LED_FACES = [
  'payaso', 'calavera', 'muneca', 'cosido', 'demonio', 'vacio',
  'kitsune', 'oni', 'grito', 'arquero', 'purga', 'glitch',
  'ciclope', 'llorona', 'gato', 'lobo', 'rey', 'polilla',
  'opera', 'calabaza', 'sonrisa', 'zombi', 'arlequin', 'llamas',
  'calavera-rosa', 'espiral', 'goteo', 'payaso-triste', 'zorro', 'calavera-llamas',
] as const;
export const HEAD_FACES = ['caballo', 'gallo', 'carnero', 'diablo', 'ventrilocuo', 'santo'] as const;

export type LedFace = (typeof LED_FACES)[number];
export type HeadFace = (typeof HEAD_FACES)[number];
/** `led:<name>` or `cabeza:<name>`. */
export type FaceId = `led:${LedFace}` | `cabeza:${HeadFace}`;

export const FACES: readonly FaceId[] = [...LED_FACES.map((f) => `led:${f}` as const), ...HEAD_FACES.map((f) => `cabeza:${f}` as const)];

export interface AvatarSpec {
  face: FaceId;
}

export const isFace = (v: unknown): v is FaceId => typeof v === 'string' && (FACES as readonly string[]).includes(v);

/** The avatar if it is well formed, `null` otherwise (use it on anything that came over the network or from storage). */
export function sanitizeAvatar(v: unknown): AvatarSpec | null {
  if (!v || typeof v !== 'object') return null;
  const face = (v as Record<string, unknown>).face;
  // (an avatar from before, made of eyes, mouth and brows, has no face: it is refused and a new one is drawn)
  return isFace(face) ? { face } : null;
}

/** A random face. `rng` returns [0, 1) (Math.random by default). */
export function randomAvatar(rng: () => number = Math.random): AvatarSpec {
  return { face: FACES[Math.min(FACES.length - 1, Math.floor(rng() * FACES.length))] };
}

/** Well formed as given, or a fresh random one. */
export const avatarOrRandom = (v: unknown, rng?: () => number): AvatarSpec => sanitizeAvatar(v) ?? randomAvatar(rng);

export const sameAvatar = (a: AvatarSpec, b: AvatarSpec) => a.face === b.face;

/** Which kind of face it is, and its name within the kind. */
export function faceKind(id: FaceId): { kind: 'led'; name: LedFace } | { kind: 'cabeza'; name: HeadFace } {
  const [kind, name] = id.split(':') as ['led' | 'cabeza', string];
  return kind === 'led' ? { kind, name: name as LedFace } : { kind, name: name as HeadFace };
}
