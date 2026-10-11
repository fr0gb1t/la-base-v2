// What each mood plays: the tune it uses and, layer by layer, who plays what. Everything runs at the same tempo and key
// so the score can slide from one mood to the next; the mood changes the arrangement, not the song.

import type { Instrument } from './instruments'
import { THEMES } from './themes'
import type { Theme } from './theory'

export type Mood = 'menu' | 'calm' | 'promising' | 'winning' | 'tension' | 'danger'
export const MOODS: readonly Mood[] = ['menu', 'calm', 'promising', 'winning', 'tension', 'danger']

export type DrumKind = 'timp' | 'heart' | 'soft' | 'full' | 'drive'

export interface LeadLayer {
  inst: Instrument
  /** Semitones from the written melody. */
  off: number
  vel: number
  /** Low-pass in Hz, to take the edge off. */
  cut?: number
}

export interface PadLayer {
  inst: Instrument
  vel: number
  /** How many notes of the chord (from the bottom). */
  n?: number
  /** One low held note instead of the chord. */
  root?: boolean
  /** Two notes a semitone apart that beat against each other. */
  cluster?: boolean
}

export interface Arrangement {
  /** How loud the mood feels: a rise in energy brings a drum roll before the change and a cymbal on it. */
  energy: number
  theme: Theme
  /** Bars (0–7) where the melody plays; all of them when absent. */
  melodyBars?: readonly number[]
  lead: readonly LeadLayer[]
  arp?: { kind: '8' | '16'; inst: Instrument; vel: number; cut?: number }
  /** Cello hammering the bass note in eighths (tension). */
  pulse?: number
  bass?: { kind: 'half' | 'sync' | 'drive'; vel: number }
  pad: readonly PadLayer[]
  drums?: DrumKind
  /** The pad ducks with every kick (the pumping of a dance record). */
  duck?: boolean
  /** A low bell on the first beat of every bar. */
  toll?: number
  /** A bell every four bars. */
  bell?: number
}

export const ARRANGEMENTS: Record<Mood, Arrangement> = {
  menu: {
    energy: 0, theme: THEMES.minor, melodyBars: [0, 1, 2, 3],
    lead: [{ inst: 'celesta', off: 0, vel: 0.42 }],
    pad: [{ inst: 'oohs', vel: 0.3, n: 3 }, { inst: 'organ', vel: 0.14, root: true }],
    drums: 'timp', bell: 0.22,
  },
  calm: {
    energy: 1, theme: THEMES.minor,
    lead: [{ inst: 'cello', off: -12, vel: 0.6 }],
    arp: { kind: '8', inst: 'vibes', vel: 0.3, cut: 3600 }, bass: { kind: 'half', vel: 0.45 },
    pad: [{ inst: 'strings', vel: 0.2, n: 3 }],
  },
  promising: {
    energy: 2, theme: THEMES.bright,
    lead: [{ inst: 'violin', off: 0, vel: 0.6 }, { inst: 'piano', off: 0, vel: 0.3, cut: 5000 }],
    arp: { kind: '8', inst: 'nylon', vel: 0.3, cut: 3600 }, bass: { kind: 'sync', vel: 0.5 },
    pad: [{ inst: 'strings', vel: 0.24, n: 3 }], drums: 'soft',
  },
  winning: {
    energy: 3, theme: THEMES.winning,
    lead: [{ inst: 'violin', off: 0, vel: 0.58 }, { inst: 'piano', off: 0, vel: 0.32, cut: 4500 }, { inst: 'horn', off: -12, vel: 0.28 }],
    arp: { kind: '8', inst: 'piano', vel: 0.3, cut: 3600 }, bass: { kind: 'sync', vel: 0.52 },
    pad: [{ inst: 'choir', vel: 0.26, n: 3 }], drums: 'soft',
  },
  tension: {
    energy: 3, theme: THEMES.tension,
    lead: [{ inst: 'violin', off: 0, vel: 0.4, cut: 3200 }, { inst: 'cello', off: -12, vel: 0.55 }],
    pulse: 0.5, bass: { kind: 'half', vel: 0.6 },
    pad: [{ inst: 'trem', vel: 0.3, n: 3 }, { inst: 'organ', vel: 0.16, root: true }], drums: 'heart',
  },
  danger: {
    energy: 4, theme: THEMES.danger, duck: true, toll: 0.32,
    lead: [
      { inst: 'pizz', off: 0, vel: 0.7 }, { inst: 'organ', off: 0, vel: 0.28 },
      { inst: 'violin', off: 12, vel: 0.3 }, { inst: 'piano', off: -12, vel: 0.3, cut: 3000 },
    ],
    arp: { kind: '16', inst: 'harpsi', vel: 0.34 }, bass: { kind: 'drive', vel: 0.8 },
    pad: [{ inst: 'trem', vel: 0.34, n: 3 }, { inst: 'trem', vel: 0.2, cluster: true }, { inst: 'choir', vel: 0.2, n: 3 }],
    drums: 'drive',
  },
}
