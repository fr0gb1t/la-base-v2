// The score: one tune at one tempo, in eight-bar sections. Each mood is an arrangement of the same song (the longest
// lasting ones, a song of several sections), so the score can move from one to the next at any even bar. Before a change that raises the energy there is a snare roll and a sweep;
// on it, a cymbal.

import { makeKit } from './drums'
import { BUS_LEVELS, type Bus } from './instruments'
import { makeFormCursor } from './form'
import { energyOf, FORMS, type Mood, type Section } from './moods'
import { makeSampler, type Sampler } from './samples'
import { CHORDS, STEPS_PER_BAR, type Chord, type Note } from './theory'

const BPM = 108
const LOOKAHEAD = 0.8 // seconds scheduled ahead of the clock
const TICK_MS = 150
const STEP = 60 / BPM / 4 // a sixteenth note
const CHANGE_EVERY = 32 // steps: the mood changes on even bars
const SYNC = [0, 3, 6, 8, 11, 14] // a 3-3-2 | 3-3-2 bar
const ARP8 = [0, 1, 2, 3, 2, 1, 2, 1]
const ARP16 = [0, 1, 2, 3, 2, 3, 1, 2]
const STINGER_SECONDS = 8

/** The small human imperfections: a few milliseconds of timing and a little velocity. */
const jitter = (amount: number) => (Math.random() - 0.5) * amount
const humanize = (vel: number) => vel * (0.92 + Math.random() * 0.16)

interface Beat {
  arr: Section
  chord: Chord
  /** Step in the 8-bar loop, bar in the loop, step in the bar. */
  p: number
  bar: number
  s: number
  at: number
}

export function makeMusic(ctx: AudioContext, out: AudioNode) {
  const master = ctx.createGain()
  master.gain.value = 1.2
  const squash = ctx.createDynamicsCompressor()
  squash.threshold.value = -14
  squash.ratio.value = 3
  squash.attack.value = 0.01
  squash.release.value = 0.25
  master.connect(squash).connect(out)

  // the room: one reverb, fed by each bus
  const reverb = ctx.createConvolver()
  reverb.buffer = makeImpulse(ctx, 2.6, 2.4)
  const wetSend = ctx.createGain()
  wetSend.gain.value = 0.35
  wetSend.connect(reverb).connect(master)
  const buses = {} as Record<Bus, GainNode>
  for (const bus of Object.keys(BUS_LEVELS) as Bus[]) {
    const node = ctx.createGain()
    node.gain.value = BUS_LEVELS[bus].level
    const send = ctx.createGain()
    send.gain.value = BUS_LEVELS[bus].reverb
    node.connect(master)
    node.connect(send).connect(wetSend)
    buses[bus] = node
  }
  // the pad dips with every kick in the mood that asks for it
  const padDuck = ctx.createGain()
  padDuck.connect(buses.pad)

  const kit = makeKit(ctx, buses.drums)
  const sampler: Sampler = makeSampler(ctx, (bus) => (bus === 'pad' ? padDuck : buses[bus]))

  const cursor = makeFormCursor(Object.fromEntries(Object.entries(FORMS).map(([m, f]) => [m, f.length])) as Record<Mood, number>)
  let current: Mood = 'menu'
  let pending: Mood = 'menu'
  let pendingSection: number | undefined
  let heard = { section: 0, bar: 0 } // where the score is, for the lab's display
  let step = 0
  let nextTime = 0
  let holdUntil = 0
  let timer: ReturnType<typeof setInterval> | null = null

  const rising = () => pending !== current && energyOf(pending) > energyOf(current)

  function duck(at: number) {
    padDuck.gain.setValueAtTime(0.4, at)
    padDuck.gain.linearRampToValueAtTime(1, at + 0.22)
  }

  function melody(b: Beat, notes: ReadonlyMap<number, Note>) {
    const note = notes.get(b.p)
    if (!note || (b.arr.melodyBars && !b.arr.melodyBars.includes(b.bar))) return
    for (const layer of b.arr.lead) {
      sampler.play(layer.inst, note[1] + layer.off, b.at + jitter(0.01), {
        bus: 'lead', vel: humanize(layer.vel), dur: note[2] * STEP * 0.97, rel: 0.25, cut: layer.cut, atk: 0.04,
      })
    }
  }

  function accompaniment({ arr, chord, s, at }: Beat) {
    const arp = arr.arp
    if (arp?.kind === '8' && s % 2 === 0) {
      const vel = humanize(arp.vel * (s % 8 === 0 ? 1.25 : 0.9))
      sampler.play(arp.inst, chord.t[ARP8[s / 2] % chord.t.length], at + jitter(0.008), { bus: 'comp', vel, dur: 1.8 * STEP, rel: 0.3, cut: arp.cut })
    } else if (arp?.kind === '16') {
      const vel = humanize(arp.vel * (s % 4 === 0 ? 1.2 : 0.85))
      sampler.play(arp.inst, chord.t[ARP16[s % 8] % chord.t.length] + 12, at, { bus: 'comp', vel, dur: 0.9 * STEP, rel: 0.1 })
    }
    if (arr.pulse && s % 2 === 0) { // the cello hammers the bass note in eighths
      const vel = humanize(arr.pulse * (s % 4 === 0 ? 1 : 0.65))
      sampler.play('cello', chord.r + 12, at, { bus: 'comp', vel, dur: 1.5 * STEP, rel: 0.08, atk: 0.012 })
    }
  }

  function bass({ arr, chord, s, at }: Beat) {
    if (!arr.bass) return
    const { kind, vel } = arr.bass
    const accent = SYNC.includes(s)
    const hit = kind === 'half' ? s === 0 || s === 8 : kind === 'sync' ? accent : true // 'drive': every step, ghosts between the accents
    if (!hit) return
    const octave = kind !== 'half' && (s === 6 || s === 14) ? 12 : 0
    const len = kind === 'half' ? 7.5 : accent ? (kind === 'sync' ? 2.6 : 2.4) : 0.9
    sampler.play('bass', chord.r + octave, at + jitter(0.006), {
      bus: 'bass', vel: humanize(vel * (accent || kind === 'half' ? 1 : 0.5)), dur: len * STEP, rel: 0.08, atk: 0.012,
    })
  }

  function pads({ arr, chord, s, at }: Beat) {
    if (s === 0) {
      for (const layer of arr.pad) {
        const notes = layer.cluster ? [chord.r + 24, chord.r + 25] : layer.root ? [chord.r + 12] : chord.t.slice(0, layer.n)
        notes.forEach((note, j) => sampler.play(layer.inst, note, at + j * 0.02, { bus: 'pad', vel: layer.vel, dur: STEPS_PER_BAR * STEP * 0.985, atk: 0.4, rel: 0.4 }))
      }
      if (arr.toll) sampler.play('bells', chord.r + 24, at, { bus: 'comp', vel: arr.toll, dur: 2, rel: 2 })
    }
  }

  function drums({ arr, s, bar, at }: Beat) {
    const timp = (vel: number, rel = 0.6) => sampler.play('timp', 36, at, { bus: 'drums', vel, dur: 0.15, rel })
    switch (arr.drums) {
      case 'timp':
        if (bar % 2 === 0 && s === 0) timp(0.4, 0.8)
        if (arr.bell && s === 0 && bar % 4 === 0) sampler.play('bells', 74, at, { bus: 'comp', vel: arr.bell, dur: 2, rel: 1.5 })
        break
      case 'heart':
        if (s === 0 || s === 8) timp(0.6, 0.8)
        if (s === 3 || s === 11) timp(0.38, 0.5)
        break
      case 'soft':
        if (s === 0 || s === 8) kit.kick(at, 0.55)
        if (s === 4 || s === 12) kit.snare(at, 0.3)
        if (s % 2 === 0) kit.hat(at, 0.1)
        break
      case 'drive':
        if (s % 4 === 0) { kit.kick(at, 0.85); if (arr.duck) duck(at) }
        if (s === 4 || s === 12) kit.snare(at, 0.6)
        if (s === 15) kit.snare(at, 0.25)
        if (s === 0 || s === 6 || s === 8 || s === 14) timp(0.45)
        kit.hat(at, s % 2 ? 0.1 : 0.17, s === 6 || s === 14)
        break
    }
  }

  /** The roll and the sweep that announce a change that raises the energy. */
  function lead(i: number, s: number, at: number) {
    if (!rising()) return
    if (i % CHANGE_EVERY === STEPS_PER_BAR) kit.riser(at, STEPS_PER_BAR * STEP, 0.12)
    if ((i >> 4) % 2 === 1 && s >= 10) kit.snare(at, 0.2 + 0.07 * (s - 10))
  }

  function scheduleStep(i: number, at: number) {
    if (i % CHANGE_EVERY === 0 && (pending !== current || pendingSection !== undefined)) {
      if (rising()) kit.crash(at, 0.55)
      cursor.switchTo(pending, i, pendingSection)
      current = pending
      pendingSection = undefined
    }
    const pos = cursor.position(i)
    const p = pos.p
    const bar = p >> 4
    const s = p & 15
    heard = { section: pos.section, bar }
    lead(i, s, at)
    if (at < holdUntil) return
    const arr = FORMS[current][pos.section]
    const beat: Beat = { arr, chord: CHORDS[arr.theme.chords[bar]], p, bar, s, at }
    melody(beat, notesOf(arr))
    accompaniment(beat)
    bass(beat)
    pads(beat)
    drums(beat)
  }

  function tick() {
    while (nextTime < ctx.currentTime + LOOKAHEAD) {
      scheduleStep(step, nextTime)
      nextTime += STEP
      step++
    }
  }

  return {
    start() {
      if (timer) return
      void sampler.load()
      nextTime = ctx.currentTime + 0.3
      timer = setInterval(tick, TICK_MS)
    },
    stop() {
      if (timer) clearInterval(timer)
      timer = null
    },
    /** The mood changes at the next even bar (`section` starts it on a given section, to audition one). */
    setMood(mood: Mood, section?: number) {
      pending = mood
      pendingSection = section
    },
    /** Where the score is now. */
    status: () => ({ mood: current, pending, ...heard }),
    /** A closing phrase in place of the music for a few seconds. */
    stinger(kind: 'victory' | 'defeat') {
      const at = Math.max(nextTime, ctx.currentTime + 0.05)
      holdUntil = at + STINGER_SECONDS
      step = 0
      cursor.restart(0)
      nextTime = holdUntil
      playStinger(kind, at, sampler, kit)
    },
  }
}

const notesCache = new WeakMap<Section, Map<number, Note>>()
function notesOf(arr: Section): Map<number, Note> {
  let notes = notesCache.get(arr)
  if (!notes) {
    notes = new Map(arr.theme.melody.map((n) => [n[0], n] as const))
    notesCache.set(arr, notes)
  }
  return notes
}

function playStinger(kind: 'victory' | 'defeat', at: number, sampler: Sampler, kit: ReturnType<typeof makeKit>) {
  if (kind === 'victory') { // D major: the Picardy third that opens the tune
    ;[50, 57, 62, 66, 69, 74].forEach((m, i) => sampler.play('piano', m, at + i * 0.09, { bus: 'comp', vel: 0.6, dur: 2.5, rel: 1.5, cut: 5000 }))
    ;[50, 57, 66].forEach((m) => sampler.play('strings', m, at, { bus: 'pad', vel: 0.4, dur: 4.5, atk: 0.4, rel: 1.2 }))
    ;[57, 62, 66].forEach((m) => sampler.play('horn', m, at, { bus: 'pad', vel: 0.3, dur: 4, atk: 0.2, rel: 1 }))
    sampler.play('bass', 38, at, { bus: 'bass', vel: 0.8, dur: 3, rel: 0.8 })
    sampler.play('bells', 74, at + 0.5, { bus: 'comp', vel: 0.35, dur: 3, rel: 2 })
    kit.crash(at, 0.5)
    kit.kick(at, 0.7)
  } else { // low bells, and D minor fading out
    ;[0, 1.8, 3.6].forEach((dt) => sampler.play('bells', 62, at + dt, { bus: 'comp', vel: 0.7, dur: 3, rel: 2.5 }))
    ;[38, 50, 53].forEach((m) => sampler.play('cello', m, at, { bus: 'pad', vel: 0.5, dur: 6, atk: 0.5, rel: 1.5 }))
    ;[50, 57, 65].forEach((m) => sampler.play('choir', m, at + 0.3, { bus: 'pad', vel: 0.3, dur: 5.5, atk: 0.6, rel: 1.5 }))
    sampler.play('bass', 26, at, { bus: 'bass', vel: 0.8, dur: 6, atk: 0.2, rel: 1.2 })
    sampler.play('timp', 36, at, { bus: 'drums', vel: 0.9, dur: 0.2, rel: 1 })
  }
}

/** A room's tail: noise that darkens as it fades. */
function makeImpulse(ctx: BaseAudioContext, seconds: number, decay: number): AudioBuffer {
  const length = Math.floor(ctx.sampleRate * seconds)
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate)
  for (let c = 0; c < 2; c++) {
    const d = buffer.getChannelData(c)
    let low = 0
    for (let i = 0; i < length; i++) {
      const k = i / length
      low += (Math.random() * 2 - 1 - low) * (0.9 - 0.8 * k)
      d[i] = low * Math.pow(1 - k, decay)
    }
  }
  return buffer
}

export type Score = ReturnType<typeof makeMusic>
