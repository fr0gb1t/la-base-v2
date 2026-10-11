// The score's vocabulary: notes by name, the chords of the tune and the shape of a melody.

const SEMITONE: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }

/** 'D5' → 74, 'Bb4' → 70, 'Cs5' → 73 (s: sharp, b: flat). Middle C is C4 = 60. */
export function midi(name: string): number {
  const m = /^([A-G])([bs]?)(\d)$/.exec(name)
  if (!m) throw new Error(`Not a note: ${name}`)
  return SEMITONE[m[1]] + (m[2] === 'b' ? -1 : m[2] === 's' ? 1 : 0) + 12 * (Number(m[3]) + 1)
}

/** r: the bass note. t: the chord in the middle register (arpeggios and pads). */
export interface Chord {
  r: number
  t: number[]
}

export const CHORDS = {
  Dm: { r: 38, t: [57, 62, 65, 69] },
  DmC: { r: 36, t: [57, 62, 65, 69] }, // D minor with C in the bass
  Bb: { r: 34, t: [58, 62, 65, 70] },
  Gm: { r: 43, t: [55, 58, 62, 67] },
  A: { r: 45, t: [57, 61, 64, 67] }, // A7 (with C#): leads back to D minor
  Bdim: { r: 35, t: [59, 62, 65, 71] },
  Edim: { r: 40, t: [52, 55, 58, 64] },
  Eb: { r: 39, t: [58, 63, 67, 70] }, // E♭ major over D minor: the Phrygian chord that unsettles most
  A7b9: { r: 45, t: [57, 61, 67, 70] }, // A with a flat ninth: the darkest dominant
  F: { r: 41, t: [57, 60, 65, 69] },
  C: { r: 36, t: [55, 60, 64, 67] },
} satisfies Record<string, Chord>

export type ChordName = keyof typeof CHORDS

/** One bar is 16 steps (sixteenth notes); a theme is 8 bars = 128 steps. */
export const STEPS_PER_BAR = 16
export const BARS_PER_THEME = 8
export const STEPS_PER_THEME = STEPS_PER_BAR * BARS_PER_THEME

/** A melody note: [step in the theme, midi note, length in steps]. */
export type Note = readonly [step: number, note: number, length: number]

export interface Theme {
  /** One chord per bar. */
  chords: readonly ChordName[]
  melody: readonly Note[]
}

/** [bar, step in the bar, 'D5', length] → a melody in absolute steps. */
export function melody(notes: ReadonlyArray<readonly [number, number, string, number]>): Note[] {
  return notes.map(([bar, step, name, length]) => [bar * STEPS_PER_BAR + step, midi(name), length] as const)
}
