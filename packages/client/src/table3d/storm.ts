// A storm outside the basement: it rains all the time, and now and then lightning strikes. The flash comes in
// through the little window (see table.ts, buildWindow) at once; the thunder arrives later, the farther the strike
// the later and the softer (audio.ts). One storm for the whole page (the menu's room and the table share it), on its
// own clock; nothing about it travels over the network — each player has their own storm.

export interface Strike {
  at: number // seconds (performance clock) of the first flash
  near: number // 0 (far away) … 1 (right overhead)
  flickers: Array<[number, number, number]> // [start offset s, length s, brightness 0..1]
}

const now = () => performance.now() / 1000
let next = now() + 12 + Math.random() * 15 // the first one soon after you come in
let strike: Strike | null = null
const listeners = new Set<(s: Strike) => void>()

/** Called when a strike begins (the sound side schedules the thunder from it). */
export function onStrike(fn: (s: Strike) => void) {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

function newStrike(at: number): Strike {
  const near = Math.random() ** 1.6 // mostly far off, now and then right on top of the house
  const flickers: Strike['flickers'] = []
  let t = 0
  const n = 1 + Math.floor(Math.random() * 3) + (near > 0.6 ? 1 : 0)
  for (let i = 0; i < n; i++) {
    const len = 0.04 + Math.random() * 0.09
    flickers.push([t, len, (i === 0 ? 1 : 0.45 + Math.random() * 0.55) * (0.45 + 0.55 * near)])
    t += len + 0.04 + Math.random() * 0.16
  }
  return { at, near, flickers }
}

let held: number | null = null
/** Tests: hold the flash at `level` (null: the storm again). */
export function holdLightning(level: number | null) {
  held = level
}

/** How bright the lightning is right now (0: dark night). Call every frame; it also starts the strikes. */
export function lightning(t = now()): number {
  if (held !== null) return held
  if (t >= next) {
    strike = newStrike(t)
    next = t + 22 + Math.random() * 45
    listeners.forEach((f) => f(strike!))
  }
  if (!strike) return 0
  const u = t - strike.at
  let level = 0
  for (const [s, len, b] of strike.flickers) {
    if (u >= s && u < s + len + 0.25) {
      // on at once, then the afterglow fades in a quarter of a second
      level = Math.max(level, u < s + len ? b : b * Math.exp(-(u - s - len) * 14))
    }
  }
  if (u > 2) strike = null
  return level
}

/** Lab and tests: a strike right now (near: 0 … 1). */
export function strikeNow(near = 0.7) {
  next = now()
  lightning()
  if (strike) strike.near = near
}
