// The faces of the people at a table: never two alike, even for someone whose face did not arrive.
import { FACES, type AvatarSpec } from '@la-base/shared'

/** What a face looks like when nobody has chosen one: derived from the seat, so it is always the same one. */
export function fallbackAvatar(seed: number): AvatarSpec {
  return { face: FACES[(seed * 11 + 3) % FACES.length] } // (11 and 36 share no factor: every seat a different face)
}

/**
 * The faces of a table, seat by seat: each player's own, and for anyone whose face did not arrive, one nobody else
 * there wears (from their seat, so every screen picks the same) — never two alike.
 */
export function tableFaces(given: Array<AvatarSpec | undefined>): AvatarSpec[] {
  const out: Array<AvatarSpec | undefined> = [...given]
  given.forEach((a, i) => {
    if (a) return
    const used = (f: string) => out.some((b) => b?.face === f)
    for (let k = 0; k < FACES.length; k++) {
      const face = FACES[(i * 11 + 3 + k) % FACES.length]
      if (!used(face)) {
        out[i] = { face }
        break
      }
    }
  })
  return out.map((a, i) => a ?? fallbackAvatar(i))
}
