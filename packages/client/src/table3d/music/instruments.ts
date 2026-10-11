// The instrument bank: which samples exist, which of them hold a note (and so loop) and where each sits in the room.

/** The engine's names for the General MIDI instruments in public/music. */
export type Instrument =
  | 'piano' | 'harpsi' | 'harp' | 'celesta' | 'vibes' | 'nylon' | 'guitar' | 'violin' | 'cello' | 'strings' | 'trem' | 'pizz'
  | 'flute' | 'oboe' | 'horn' | 'organ' | 'choir' | 'oohs' | 'bass' | 'timp' | 'bells'

/** Groups of instruments that share a volume (and a send to the room's reverb). */
export type Bus = 'lead' | 'comp' | 'pad' | 'bass' | 'drums'

/** Instruments whose sample is a steady tone: held notes repeat the steady part instead of ending with the sample. */
export const SUSTAINED: ReadonlySet<Instrument> = new Set<Instrument>([
  'cello', 'strings', 'violin', 'flute', 'oboe', 'organ', 'choir', 'oohs', 'horn', 'trem', 'guitar', 'bass',
])

export const PAN: Partial<Record<Instrument, number>> = {
  piano: -0.15, harpsi: 0.2, celesta: 0.25, vibes: 0.15, harp: -0.2, flute: 0.25, oboe: -0.1, violin: 0.2, cello: -0.2, guitar: -0.1, horn: 0.15, bells: 0.1, nylon: 0.1,
}

/** How much of each bus goes to the reverb, and how loud the bus sits. */
export const BUS_LEVELS: Record<Bus, { reverb: number; level: number }> = {
  lead: { reverb: 0.4, level: 0.85 },
  comp: { reverb: 0.3, level: 0.8 },
  pad: { reverb: 0.55, level: 0.8 },
  bass: { reverb: 0.1, level: 0.8 },
  drums: { reverb: 0.18, level: 0.34 }, // (the synthetic drums are louder than the samples)
}

/** The steady part of a held sample, in seconds of the sample: the loop that keeps a long note going. */
export const LOOP = { start: 0.6, end: 2.4 } as const
