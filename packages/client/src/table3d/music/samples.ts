// The samples: fetched from public/music when the score starts, decoded once, and played by re-pitching the nearest note.

import { LOOP, PAN, SUSTAINED, type Bus, type Instrument } from './instruments'

type Manifest = Record<string, number[]>

interface Loaded {
  keys: number[] // sorted midi notes we have
  buffers: Map<number, AudioBuffer>
}

export interface PlayOptions {
  bus: Bus
  vel: number
  /** Seconds the note is held before it is released. */
  dur: number
  atk?: number
  rel?: number
  /** Low-pass in Hz. */
  cut?: number
}

// Instruments the menu needs go first, so the score has something to play as soon as possible
const PRIORITY: Instrument[] = ['celesta', 'oohs', 'organ', 'timp', 'bells', 'piano', 'cello', 'strings', 'bass']
const FETCH_AT_ONCE = 6
const OVER_RANGE = 7 // semitones a sample may be stretched beyond its nearest note before the note moves an octave
const url = (path: string) => `${import.meta.env.BASE_URL}music/${path}`

export function makeSampler(ctx: BaseAudioContext, busNode: (bus: Bus) => AudioNode) {
  const bank = new Map<Instrument, Loaded>()
  let loading: Promise<void> | null = null

  async function fetchNote(inst: Instrument, note: number): Promise<void> {
    const res = await fetch(url(`${inst}/${note}.mp3`))
    if (!res.ok) throw new Error(`${inst}/${note}.mp3: ${res.status}`)
    const buffer = await ctx.decodeAudioData(await res.arrayBuffer())
    const entry = bank.get(inst)!
    entry.buffers.set(note, buffer)
    entry.keys = [...entry.keys, note].sort((a, b) => a - b)
  }

  async function loadAll(): Promise<void> {
    const manifest = (await (await fetch(url('manifest.json'))).json()) as Manifest
    const order = [...PRIORITY, ...(Object.keys(manifest) as Instrument[]).filter((i) => !PRIORITY.includes(i))]
    const queue = order.flatMap((inst) => {
      bank.set(inst, { keys: [], buffers: new Map() })
      return (manifest[inst] ?? []).map((note) => [inst, note] as const)
    })
    const worker = async () => {
      for (let next = queue.shift(); next; next = queue.shift()) {
        try {
          await fetchNote(next[0], next[1])
        } catch (err) {
          console.warn('music: a sample did not load', err) // the score plays on without it
        }
      }
    }
    await Promise.all(Array.from({ length: FETCH_AT_ONCE }, worker))
  }

  /** Starts fetching (once). The score does not wait: notes of instruments that have not arrived are skipped. */
  function load(): Promise<void> {
    loading ??= loadAll().catch((err) => console.warn('music: the samples could not be loaded', err))
    return loading
  }

  /** One note: the nearest sample re-pitched; held notes of steady instruments loop their steady part. */
  function play(inst: Instrument, note: number, at: number, o: PlayOptions): void {
    const loaded = bank.get(inst)
    if (!loaded || loaded.keys.length === 0) return
    const lo = loaded.keys[0]
    const hi = loaded.keys[loaded.keys.length - 1]
    let midi = note
    while (midi > hi + OVER_RANGE) midi -= 12 // an instrument that does not reach the note plays it an octave away
    while (midi < lo - OVER_RANGE) midi += 12
    const key = loaded.keys.reduce((best, k) => (Math.abs(k - midi) < Math.abs(best - midi) ? k : best), lo)

    const src = ctx.createBufferSource()
    src.buffer = loaded.buffers.get(key)!
    src.playbackRate.value = Math.pow(2, (midi - key) / 12)
    if (SUSTAINED.has(inst)) {
      src.loop = true
      src.loopStart = LOOP.start
      src.loopEnd = LOOP.end
    }
    const atk = o.atk ?? 0.008
    const rel = o.rel ?? 0.2
    const dur = Math.max(o.dur, atk + 0.02)
    const env = ctx.createGain()
    env.gain.setValueAtTime(0.0001, at)
    env.gain.linearRampToValueAtTime(o.vel, at + atk)
    env.gain.setValueAtTime(o.vel, at + dur)
    env.gain.linearRampToValueAtTime(0.0001, at + dur + rel)

    let node: AudioNode = src
    if (o.cut) {
      const lp = ctx.createBiquadFilter()
      lp.type = 'lowpass'
      lp.frequency.value = o.cut
      lp.Q.value = 0.4
      node.connect(lp)
      node = lp
    }
    node.connect(env)
    let tail: AudioNode = env
    const pan = PAN[inst]
    if (pan) {
      const panner = ctx.createStereoPanner()
      panner.pan.value = pan
      env.connect(panner)
      tail = panner
    }
    tail.connect(busNode(o.bus))
    src.start(at)
    src.stop(at + dur + rel + 0.05)
  }

  return { load, play }
}

export type Sampler = ReturnType<typeof makeSampler>
