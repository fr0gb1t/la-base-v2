import type { Sena } from '@la-base/shared'

// How a seña plays on a mask: shared by the table and the avatar preview in the settings, so they move the same way.
export const NOD_HZ = 2.2 // nods / shakes per second for sí and no
export const SENA_HOLD = 1.6 // s a seña stays on the face
/** The frames per second the bodies move at (stop-motion, like a puppet). */
export const PUPPET_FPS = 15

/** How far into a seña the face is (0 rest … 1 full) at `t` seconds since it started. */
export function senaAmount(s: Sena, t: number) {
  if (t < 0) return 0
  if (s === 'nada') return t < 0.2 ? t / 0.2 : t < 0.75 ? 1 : Math.max(0, 1 - (t - 0.75) / 0.2) // close, hold, reopen
  if (t >= SENA_HOLD) return 0
  return Math.min(1, t / 0.15, (SENA_HOLD - t) / 0.3)
}
