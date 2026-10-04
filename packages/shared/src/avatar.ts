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
  /**
   * A colour variant of the face (0 or missing: as designed). Nobody picks it: two players at one table never wear
   * the same face, and when two of them insist on the same one, the server gives the later one a variant.
   */
  tint?: number;
}

/** How many colour variants a face has (the design itself included). */
export const TINT_COUNT = 6;

export const isFace = (v: unknown): v is FaceId => typeof v === 'string' && (FACES as readonly string[]).includes(v);

/** The avatar if it is well formed, `null` otherwise (use it on anything that came over the network or from storage). */
export function sanitizeAvatar(v: unknown): AvatarSpec | null {
  if (!v || typeof v !== 'object') return null;
  const { face, tint } = v as Record<string, unknown>;
  // (an avatar from before, made of eyes, mouth and brows, has no face: it is refused and a new one is drawn)
  if (!isFace(face)) return null;
  // (a variant out of range is not worth refusing the face for: it is just dropped)
  return Number.isInteger(tint) && (tint as number) > 0 && (tint as number) < TINT_COUNT ? { face, tint: tint as number } : { face };
}

/** A random face. `rng` returns [0, 1) (Math.random by default). */
export function randomAvatar(rng: () => number = Math.random): AvatarSpec {
  return { face: FACES[Math.min(FACES.length - 1, Math.floor(rng() * FACES.length))] };
}

/** Well formed as given, or a fresh random one. */
export const avatarOrRandom = (v: unknown, rng?: () => number): AvatarSpec => sanitizeAvatar(v) ?? randomAvatar(rng);

export const tintOf = (a: AvatarSpec) => a.tint ?? 0;

/** What must not repeat at a table: the face and its colour. */
export const avatarKey = (a: AvatarSpec) => `${a.face}#${tintOf(a)}`;

export const sameAvatar = (a: AvatarSpec, b: AvatarSpec) => avatarKey(a) === avatarKey(b);

/** The first colour variant of `face` nobody in `taken` wears (0 if it is free as designed); null if all are worn. */
export function freeTint(face: FaceId, taken: readonly AvatarSpec[]): number | null {
  for (let t = 0; t < TINT_COUNT; t++) if (!taken.some((a) => a.face === face && tintOf(a) === t)) return t;
  return null;
}

/** A random face nobody in `taken` wears (for the bots); with every face worn, a free variant of one. */
export function freeAvatar(taken: readonly AvatarSpec[], rng: () => number = Math.random): AvatarSpec {
  const free = FACES.filter((f) => !taken.some((a) => a.face === f));
  if (free.length) return { face: free[Math.min(free.length - 1, Math.floor(rng() * free.length))] };
  for (const face of FACES) {
    const t = freeTint(face, taken);
    if (t !== null) return t ? { face, tint: t } : { face };
  }
  return randomAvatar(rng); // (more players than faces × variants: cannot happen at a table of eight)
}

/**
 * The avatars of a table with no two alike: in order (the first to sit keeps theirs), whoever repeats a face
 * someone before them wears gets the first free colour variant of it.
 */
export function untangleAvatars(avatars: readonly AvatarSpec[]): AvatarSpec[] {
  const out: AvatarSpec[] = [];
  for (const a of avatars) {
    if (!out.some((b) => sameAvatar(a, b))) {
      out.push(a);
      continue;
    }
    // (counting the ones still to come too, so a variant handed out here never clashes with a later player's)
    const t = freeTint(a.face, [...out, ...avatars.slice(out.length + 1)]);
    out.push(t === null ? freeAvatar([...out, ...avatars]) : t ? { face: a.face, tint: t } : { face: a.face });
  }
  return out;
}

/** Which kind of face it is, and its name within the kind. */
export function faceKind(id: FaceId): { kind: 'led'; name: LedFace } | { kind: 'cabeza'; name: HeadFace } {
  const [kind, name] = id.split(':') as ['led' | 'cabeza', string];
  return kind === 'led' ? { kind, name: name as LedFace } : { kind, name: name as HeadFace };
}
