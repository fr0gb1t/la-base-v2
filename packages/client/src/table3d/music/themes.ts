// The tunes. All of them are 8 bars long and share the same phrasing, so the score can move from one mood to the
// next at any even bar and the tune keeps its place. The hook has a 3-3-2 in every bar (long, long, short): it climbs
// the chord and comes back down the scale.

import { melody, STEPS_PER_BAR, type Theme } from './theory'

const HOOK = melody([
  [0, 0, 'D5', 3], [0, 3, 'F5', 3], [0, 6, 'A5', 2], [0, 8, 'G5', 4], [0, 12, 'F5', 2], [0, 14, 'E5', 2],
  [1, 0, 'D5', 3], [1, 3, 'F5', 3], [1, 6, 'Bb5', 2], [1, 8, 'A5', 4], [1, 12, 'G5', 2], [1, 14, 'F5', 2],
  [2, 0, 'Bb4', 3], [2, 3, 'D5', 3], [2, 6, 'G5', 2], [2, 8, 'F5', 2], [2, 10, 'Eb5', 2], [2, 12, 'D5', 4],
  [3, 0, 'Cs5', 3], [3, 3, 'E5', 3], [3, 6, 'A5', 2], [3, 8, 'G5', 2], [3, 10, 'F5', 2], [3, 12, 'E5', 2], [3, 14, 'Cs5', 2],
  [4, 0, 'D5', 3], [4, 3, 'F5', 3], [4, 6, 'A5', 2], [4, 8, 'G5', 4], [4, 12, 'F5', 2], [4, 14, 'E5', 2],
  [5, 0, 'D5', 3], [5, 3, 'F5', 3], [5, 6, 'Bb5', 2], [5, 8, 'C6', 4], [5, 12, 'A5', 4],
  [6, 0, 'G5', 3], [6, 3, 'Bb5', 3], [6, 6, 'D6', 2], [6, 8, 'C6', 4], [6, 12, 'Bb5', 2], [6, 14, 'A5', 2],
  [7, 0, 'A5', 6], [7, 6, 'G5', 2], [7, 8, 'F5', 2], [7, 10, 'E5', 2], [7, 12, 'Cs5', 4],
])

/** Tension: the same start, dragged along by semitones over a bass that walks down (D, C, B, A). */
const TENSION_TUNE = melody([
  [0, 0, 'A4', 6], [0, 6, 'Bb4', 2], [0, 8, 'A4', 4], [0, 12, 'F4', 4],
  [1, 0, 'C5', 6], [1, 6, 'B4', 2], [1, 8, 'C5', 4], [1, 12, 'A4', 4],
  [2, 0, 'D5', 6], [2, 6, 'Eb5', 2], [2, 8, 'D5', 4], [2, 12, 'B4', 4],
  [3, 0, 'Cs5', 8], [3, 8, 'Bb4', 4], [3, 12, 'A4', 4],
  [4, 0, 'D5', 6], [4, 6, 'Eb5', 2], [4, 8, 'D5', 4], [4, 12, 'Bb4', 4],
  [5, 0, 'Bb4', 6], [5, 6, 'B4', 2], [5, 8, 'Bb4', 4], [5, 12, 'G4', 4],
  [6, 0, 'E5', 6], [6, 6, 'F5', 2], [6, 8, 'E5', 4], [6, 12, 'Bb4', 4],
  [7, 0, 'Cs5', 4], [7, 4, 'E5', 4], [7, 8, 'A4', 8],
])

/** Promising: the hook opens up into F major (the relative) and breathes. */
const BRIGHT_TUNE = melody([
  [0, 0, 'F5', 3], [0, 3, 'A5', 3], [0, 6, 'C6', 2], [0, 8, 'Bb5', 4], [0, 12, 'A5', 2], [0, 14, 'G5', 2],
  [1, 0, 'E5', 3], [1, 3, 'G5', 3], [1, 6, 'C6', 2], [1, 8, 'D6', 4], [1, 12, 'C6', 2], [1, 14, 'G5', 2],
  [2, 0, 'D5', 3], [2, 3, 'F5', 3], [2, 6, 'Bb5', 2], [2, 8, 'A5', 4], [2, 12, 'G5', 2], [2, 14, 'F5', 2],
  [3, 0, 'E5', 3], [3, 3, 'G5', 3], [3, 6, 'C6', 2], [3, 8, 'C6', 8],
  [4, 0, 'F5', 3], [4, 3, 'A5', 3], [4, 6, 'C6', 2], [4, 8, 'Bb5', 4], [4, 12, 'A5', 2], [4, 14, 'G5', 2],
  [5, 0, 'A5', 3], [5, 3, 'F5', 3], [5, 6, 'D5', 2], [5, 8, 'E5', 4], [5, 12, 'F5', 4],
  [6, 0, 'D5', 3], [6, 3, 'F5', 3], [6, 6, 'Bb5', 2], [6, 8, 'C6', 4], [6, 12, 'A5', 4],
  [7, 0, 'G5', 3], [7, 3, 'E5', 3], [7, 6, 'C5', 2], [7, 8, 'C5', 8],
])

/** Almost won: the hook in D minor again. Only bars 3 and 7 open into F major: a light, not another tune. */
const WINNING_TUNE = [
  ...HOOK.filter(([step]) => ![2, 6].includes(Math.floor(step / STEPS_PER_BAR))),
  ...melody([
    [2, 0, 'A4', 3], [2, 3, 'C5', 3], [2, 6, 'F5', 2], [2, 8, 'E5', 2], [2, 10, 'D5', 2], [2, 12, 'C5', 4],
    [6, 0, 'F5', 3], [6, 3, 'A5', 3], [6, 6, 'C6', 2], [6, 8, 'Bb5', 4], [6, 12, 'A5', 2], [6, 14, 'G5', 2],
  ]),
].sort((a, b) => a[0] - b[0])

export const THEMES = {
  /** Menu, calm: the hook over i - VI - iv - V. */
  minor: { chords: ['Dm', 'Bb', 'Gm', 'A', 'Dm', 'Bb', 'Gm', 'A'], melody: HOOK },
  tension: { chords: ['Dm', 'DmC', 'Bdim', 'A', 'Bb', 'Gm', 'Edim', 'A'], melody: TENSION_TUNE },
  bright: { chords: ['F', 'C', 'Bb', 'C', 'F', 'Dm', 'Bb', 'C'], melody: BRIGHT_TUNE },
  winning: { chords: ['Dm', 'Bb', 'F', 'A', 'Dm', 'Bb', 'F', 'A'], melody: WINNING_TUNE },
  /** Danger: almost all minor and diminished, with E♭ (Phrygian) and A with a flat ninth. */
  danger: { chords: ['Dm', 'Eb', 'Gm', 'A7b9', 'Dm', 'Bdim', 'Gm', 'Edim'], melody: HOOK },
} satisfies Record<string, Theme>
