// Where the score is inside the song of the current mood. A mood is a list of 8-bar sections; entering it starts a
// section on an even bar, and leaving it remembers where it was, so coming back goes on with the NEXT section of that
// mood instead of playing its first verse again.

import type { Mood } from './moods'

export const SECTION_STEPS = 128

export interface Position {
  section: number
  /** Step inside the section (0–127). */
  p: number
}

export function makeFormCursor(lengths: Record<Mood, number>, initial: Mood = 'menu') {
  let mood = initial
  let first = 0 // the section the mood started on
  let since = 0 // the step the mood started on
  const resume: Partial<Record<Mood, number>> = {}

  const position = (step: number): Position => {
    const n = step - since
    return { section: (first + Math.floor(n / SECTION_STEPS)) % lengths[mood], p: n % SECTION_STEPS }
  }

  return {
    position,
    /** Moves to another mood from `step` on; `section` forces the one to start with. */
    switchTo(next: Mood, step: number, section?: number) {
      if (next === mood && section === undefined) return
      resume[mood] = (position(step).section + 1) % lengths[mood]
      mood = next
      first = section !== undefined ? section % lengths[next] : (resume[next] ?? 0)
      since = step
    },
    /** Starts the current mood over from its first section at `step` (after a closing phrase). */
    restart(step: number) {
      first = 0
      since = step
    },
  }
}

export type FormCursor = ReturnType<typeof makeFormCursor>
