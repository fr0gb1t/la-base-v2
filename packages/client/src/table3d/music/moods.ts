// What each mood plays: the tune it uses and, layer by layer, who plays what. Everything runs at the same tempo and key
// so the score can slide from one mood to the next; the mood changes the arrangement, not the song. The moods that last
// longest are songs of several sections (verse, chorus, second verse, bridge, chorus again); the others are one loop.

import type { Instrument } from './instruments'
import { SECTIONS, THEMES } from './themes'
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

/** A section is the same shape as any arrangement: its own tune and its own players. */
export type Section = Arrangement

const withLayers = (base: Arrangement, patch: Partial<Arrangement>): Section => ({ ...base, ...patch })

const MENU: Section = {
  energy: 0, theme: THEMES.minor, melodyBars: [0, 1, 2, 3],
  lead: [{ inst: 'celesta', off: 0, vel: 0.42 }],
  pad: [{ inst: 'oohs', vel: 0.3, n: 3 }, { inst: 'organ', vel: 0.14, root: true }],
  drums: 'timp', bell: 0.22,
}

const CALM_VERSE: Section = {
  energy: 1, theme: THEMES.minor,
  lead: [{ inst: 'cello', off: -12, vel: 0.6 }],
  arp: { kind: '8', inst: 'vibes', vel: 0.3, cut: 3600 }, bass: { kind: 'half', vel: 0.45 },
  pad: [{ inst: 'strings', vel: 0.2, n: 3 }],
}
const CALM_CHORUS = withLayers(CALM_VERSE, {
  theme: SECTIONS.calmChorus,
  lead: [{ inst: 'violin', off: 0, vel: 0.5 }, { inst: 'piano', off: 0, vel: 0.3, cut: 4500 }],
  bass: { kind: 'half', vel: 0.5 },
  pad: [{ inst: 'strings', vel: 0.24, n: 3 }, { inst: 'oohs', vel: 0.16, n: 3 }],
})
const CALM_ANSWER = withLayers(CALM_VERSE, {
  theme: SECTIONS.calmAnswer,
  lead: [{ inst: 'flute', off: 0, vel: 0.5 }, { inst: 'cello', off: -12, vel: 0.35 }],
  arp: { kind: '8', inst: 'harp', vel: 0.3 },
})
const CALM_BRIDGE = withLayers(CALM_VERSE, {
  theme: SECTIONS.calmBridge,
  lead: [{ inst: 'celesta', off: 0, vel: 0.4 }, { inst: 'oboe', off: 0, vel: 0.3 }],
  arp: { kind: '8', inst: 'harp', vel: 0.22 }, bass: { kind: 'half', vel: 0.35 },
  pad: [{ inst: 'oohs', vel: 0.28, n: 3 }, { inst: 'strings', vel: 0.16, n: 3 }],
})
const CALM_CHORUS_AGAIN = withLayers(CALM_CHORUS, {
  lead: [{ inst: 'flute', off: 0, vel: 0.5 }, { inst: 'piano', off: 0, vel: 0.3, cut: 4500 }, { inst: 'cello', off: -12, vel: 0.3 }],
})

const PROMISING_VERSE: Section = {
  energy: 2, theme: THEMES.bright,
  lead: [{ inst: 'violin', off: 0, vel: 0.6 }, { inst: 'piano', off: 0, vel: 0.3, cut: 5000 }],
  arp: { kind: '8', inst: 'nylon', vel: 0.3, cut: 3600 }, bass: { kind: 'sync', vel: 0.5 },
  pad: [{ inst: 'strings', vel: 0.24, n: 3 }], drums: 'soft',
}
const PROMISING_CHORUS = withLayers(PROMISING_VERSE, {
  theme: SECTIONS.brightChorus,
  lead: [{ inst: 'violin', off: 0, vel: 0.6 }, { inst: 'piano', off: 0, vel: 0.3, cut: 5000 }, { inst: 'flute', off: 0, vel: 0.25 }],
  bass: { kind: 'sync', vel: 0.55 },
  pad: [{ inst: 'strings', vel: 0.26, n: 3 }, { inst: 'choir', vel: 0.12, n: 3 }],
})
const PROMISING_ANSWER = withLayers(PROMISING_VERSE, {
  theme: SECTIONS.brightAnswer,
  lead: [{ inst: 'flute', off: 0, vel: 0.55 }, { inst: 'piano', off: 0, vel: 0.3, cut: 5000 }],
  arp: { kind: '8', inst: 'harp', vel: 0.3 },
})
const PROMISING_BRIDGE = withLayers(PROMISING_VERSE, {
  theme: SECTIONS.brightBridge,
  lead: [{ inst: 'piano', off: 0, vel: 0.5, cut: 4200 }, { inst: 'celesta', off: 12, vel: 0.25 }],
  arp: { kind: '8', inst: 'vibes', vel: 0.24 }, bass: { kind: 'half', vel: 0.4 },
  pad: [{ inst: 'oohs', vel: 0.26, n: 3 }, { inst: 'strings', vel: 0.2, n: 3 }], drums: undefined,
})
const PROMISING_CHORUS_AGAIN = withLayers(PROMISING_CHORUS, {
  lead: [{ inst: 'violin', off: 0, vel: 0.6 }, { inst: 'horn', off: -12, vel: 0.25 }, { inst: 'piano', off: 0, vel: 0.3, cut: 5000 }],
})

const WINNING: Section = {
  energy: 3, theme: THEMES.winning,
  lead: [{ inst: 'violin', off: 0, vel: 0.58 }, { inst: 'piano', off: 0, vel: 0.32, cut: 4500 }, { inst: 'horn', off: -12, vel: 0.28 }],
  arp: { kind: '8', inst: 'piano', vel: 0.3, cut: 3600 }, bass: { kind: 'sync', vel: 0.52 },
  pad: [{ inst: 'choir', vel: 0.26, n: 3 }], drums: 'soft',
}

const TENSION_VERSE: Section = {
  energy: 3, theme: THEMES.tension,
  lead: [{ inst: 'violin', off: 0, vel: 0.4, cut: 3200 }, { inst: 'cello', off: -12, vel: 0.55 }],
  pulse: 0.5, bass: { kind: 'half', vel: 0.6 },
  pad: [{ inst: 'trem', vel: 0.3, n: 3 }, { inst: 'organ', vel: 0.16, root: true }], drums: 'heart',
}
const TENSION_CHORUS = withLayers(TENSION_VERSE, {
  theme: SECTIONS.tensionChorus,
  lead: [{ inst: 'violin', off: 0, vel: 0.45, cut: 3400 }, { inst: 'cello', off: -12, vel: 0.6 }],
  bass: { kind: 'half', vel: 0.65 },
})
const TENSION_ANSWER = withLayers(TENSION_VERSE, {
  theme: SECTIONS.tensionAnswer,
  lead: [{ inst: 'oboe', off: 0, vel: 0.4 }, { inst: 'cello', off: -12, vel: 0.55 }],
})
const TENSION_BRIDGE = withLayers(TENSION_VERSE, {
  theme: SECTIONS.tensionBridge,
  lead: [{ inst: 'violin', off: 0, vel: 0.35, cut: 3000 }, { inst: 'organ', off: 0, vel: 0.2 }],
  pulse: undefined, bass: { kind: 'half', vel: 0.5 },
  pad: [{ inst: 'trem', vel: 0.26, n: 3 }, { inst: 'choir', vel: 0.2, n: 3 }],
})
const TENSION_CHORUS_AGAIN = withLayers(TENSION_CHORUS, {
  lead: [{ inst: 'violin', off: 0, vel: 0.5, cut: 3400 }, { inst: 'cello', off: -12, vel: 0.6 }, { inst: 'piano', off: -12, vel: 0.25, cut: 2800 }],
  pulse: 0.55, bass: { kind: 'half', vel: 0.7 },
})

const DANGER: Section = {
  energy: 4, theme: THEMES.danger, duck: true, toll: 0.32,
  lead: [
    { inst: 'pizz', off: 0, vel: 0.7 }, { inst: 'organ', off: 0, vel: 0.28 },
    { inst: 'violin', off: 12, vel: 0.3 }, { inst: 'piano', off: -12, vel: 0.3, cut: 3000 },
  ],
  arp: { kind: '16', inst: 'harpsi', vel: 0.34 }, bass: { kind: 'drive', vel: 0.8 },
  pad: [{ inst: 'trem', vel: 0.34, n: 3 }, { inst: 'trem', vel: 0.2, cluster: true }, { inst: 'choir', vel: 0.2, n: 3 }],
  drums: 'drive',
}

/** The sections of each mood, in the order they play (and then round again). */
export const FORMS: Record<Mood, readonly Section[]> = {
  menu: [MENU],
  calm: [CALM_VERSE, CALM_CHORUS, CALM_ANSWER, CALM_BRIDGE, CALM_CHORUS_AGAIN],
  promising: [PROMISING_VERSE, PROMISING_CHORUS, PROMISING_ANSWER, PROMISING_BRIDGE, PROMISING_CHORUS_AGAIN],
  winning: [WINNING],
  tension: [TENSION_VERSE, TENSION_CHORUS, TENSION_ANSWER, TENSION_BRIDGE, TENSION_CHORUS_AGAIN],
  danger: [DANGER],
}

/** How loud a mood feels (every section of a mood shares it). */
export const energyOf = (mood: Mood) => FORMS[mood][0].energy
