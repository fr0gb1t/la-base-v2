// The music of the basement: an old milonga on a valve radio in the corner, never quite the same twice. It is made
// here, note by note (no recordings): a bandoneón that breathes, a pizzicato double bass on the milonga's 3-3-2, a
// line of melody now and then in D minor, and silences — the room is tense, the radio only keeps it company. Everything
// goes through the radio: band-limited, a little saturated, the record crackling, the pitch wavering like worn tape.

type Ctx = BaseAudioContext

const BPM = 72
const EIGHTH = 60 / BPM / 2
const BAR = EIGHTH * 8

// D minor and its friends (MIDI). The chords as the bandoneón voices them (middle register) and the bass's root.
type Chord = { root: number; notes: number[] }
const C: Record<string, Chord> = {
  Dm: { root: 38, notes: [62, 65, 69] },
  Gm: { root: 43, notes: [62, 67, 70] },
  Gm6: { root: 43, notes: [62, 64, 67, 70] },
  A7: { root: 45, notes: [61, 64, 67, 69] },
  Bb: { root: 46, notes: [62, 65, 70] },
  C: { root: 36, notes: [60, 64, 67] },
  F: { root: 41, notes: [60, 65, 69] },
  E7: { root: 40, notes: [62, 64, 68, 71] },
}
// eight-bar phrases, chosen at random (the first one opens)
const PHRASES = [
  ['Dm', 'Dm', 'Gm', 'A7', 'Dm', 'Bb', 'Gm6', 'A7'],
  ['Dm', 'C', 'Bb', 'A7', 'Dm', 'Gm', 'A7', 'Dm'],
  ['F', 'C', 'Dm', 'A7', 'Bb', 'Gm', 'A7', 'Dm'],
  ['Dm', 'E7', 'A7', 'Dm', 'Gm', 'Dm', 'A7', 'Dm'],
]
// D harmonic minor, for the melody's passing notes
const SCALE = [2, 4, 5, 7, 9, 10, 13].map((d) => d % 12)

const hz = (m: number) => 440 * Math.pow(2, (m - 69) / 12)
const pick = <T,>(a: readonly T[], rnd: () => number) => a[Math.floor(rnd() * a.length)]

interface Rig {
  ctx: Ctx
  in: GainNode // the music, before the radio
  wow: AudioNode // the tape's wavering, to plug into every oscillator's detune
}

/** The radio: the music goes in, the room hears it out of `out`. Returns the input and the pitch wobble. */
function buildRadio(ctx: Ctx, out: AudioNode): Rig {
  const input = ctx.createGain()
  const drive = ctx.createWaveShaper()
  const curve = new Float32Array(1024)
  for (let i = 0; i < curve.length; i++) {
    const x = (i / (curve.length - 1)) * 2 - 1
    curve[i] = Math.tanh(x * 1.8) / Math.tanh(1.8) // valves, softly pushed
  }
  drive.curve = curve
  const hp = ctx.createBiquadFilter()
  hp.type = 'highpass'
  hp.frequency.value = 170
  const lp = ctx.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = 3600
  lp.Q.value = 0.9
  const body = ctx.createBiquadFilter() // the small cabinet's honk
  body.type = 'peaking'
  body.frequency.value = 1100
  body.Q.value = 0.8
  body.gain.value = 4
  input.connect(drive).connect(hp).connect(body).connect(lp).connect(out)

  // the record: soft hiss and sparse pops, looped (4 s, so the pattern never shows)
  const len = Math.floor(ctx.sampleRate * 4)
  const crackle = ctx.createBuffer(1, len, ctx.sampleRate)
  const d = crackle.getChannelData(0)
  let lpN = 0
  for (let i = 0; i < len; i++) {
    lpN = lpN * 0.7 + (Math.random() * 2 - 1) * 0.3
    d[i] = lpN * 0.012
    if (Math.random() < 0.00035) {
      const amp = 0.15 + Math.random() * 0.5
      for (let k = 0; k < 40 && i + k < len; k++) d[i + k] += amp * Math.exp(-k / 6) * (k % 2 ? -1 : 1)
    }
  }
  const rec = ctx.createBufferSource()
  rec.buffer = crackle
  rec.loop = true
  const recGain = ctx.createGain()
  recGain.gain.value = 0.35
  rec.connect(recGain).connect(hp)
  rec.start()

  // worn tape: the pitch drifts a few cents, slowly
  const wowOsc = ctx.createOscillator()
  wowOsc.frequency.value = 0.27
  const wow = ctx.createGain()
  wow.gain.value = 7 // cents
  wowOsc.connect(wow)
  wowOsc.start()
  return { ctx, in: input, wow }
}

/** A bandoneón chord (or one note): two reeds per note, an octave apart and a little out of tune with each other. */
function bandoneon(r: Rig, notes: number[], t: number, dur: number, gain: number, attack: number) {
  const { ctx } = r
  const env = ctx.createGain()
  const lp = ctx.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = 1900
  lp.Q.value = 0.6
  env.gain.setValueAtTime(0.0001, t)
  env.gain.linearRampToValueAtTime(gain, t + attack)
  env.gain.setTargetAtTime(gain * 0.75, t + attack, dur * 0.5) // the bellows ease off
  env.gain.setTargetAtTime(0.0001, t + dur, 0.09)
  lp.connect(env).connect(r.in)
  const stop = t + dur + 0.6
  for (const m of notes) {
    for (const [mult, det, type, g] of [
      [1, -6, 'sawtooth', 1],
      [1, 6, 'sawtooth', 0.8],
      [2, 3, 'square', 0.18],
    ] as const) {
      const o = ctx.createOscillator()
      o.type = type
      o.frequency.value = hz(m) * mult
      o.detune.value = det
      r.wow.connect(o.detune)
      const og = ctx.createGain()
      og.gain.value = (g / notes.length) * 0.5
      o.connect(og).connect(lp)
      o.start(t)
      o.stop(stop)
    }
  }
}

/** A pizzicato double bass note: a thump and a quick decay. */
function bass(r: Rig, m: number, t: number, gain: number) {
  const { ctx } = r
  const o = ctx.createOscillator()
  o.type = 'triangle'
  o.frequency.value = hz(m)
  r.wow.connect(o.detune)
  const o2 = ctx.createOscillator()
  o2.type = 'sine'
  o2.frequency.value = hz(m) * 2
  const g2 = ctx.createGain()
  g2.gain.value = 0.25
  const env = ctx.createGain()
  env.gain.setValueAtTime(0.0001, t)
  env.gain.exponentialRampToValueAtTime(gain, t + 0.012)
  env.gain.exponentialRampToValueAtTime(0.0001, t + 0.9)
  const lp = ctx.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.setValueAtTime(900, t)
  lp.frequency.exponentialRampToValueAtTime(250, t + 0.4)
  o.connect(lp)
  o2.connect(g2).connect(lp)
  lp.connect(env).connect(r.in)
  for (const x of [o, o2]) {
    x.start(t)
    x.stop(t + 1)
  }
}

/** The composer: lays down bar after bar, choosing phrases, textures and melody as it goes. */
function composer(r: Rig, rnd: () => number = Math.random) {
  let phrase = PHRASES[0]
  let bar = 0
  let texture: 'marcato' | 'legato' | 'bass' = 'marcato'
  let melody = false
  let lastMel = 74
  return function scheduleBar(t0: number) {
    const i = bar % 8
    if (i === 0 && bar > 0) phrase = rnd() < 0.55 ? pick(PHRASES, rnd) : phrase
    if (i % 4 === 0) {
      // every four bars: how the bandoneón plays, and whether it sings
      // (the bass alone, now and then, for a breath of silence — never twice running)
      const roll = rnd()
      texture = roll < 0.48 ? 'marcato' : roll < 0.9 || texture === 'bass' ? 'legato' : 'bass'
      melody = bar > 4 && rnd() < 0.55
    }
    const ch = C[phrase[i]]
    const next = C[phrase[(i + 1) % 8]]
    // the bass on the 3-3-2: root, fifth, and the root again or a step into the next chord
    const approach = next.root === ch.root ? ch.root : next.root + (next.root > ch.root ? -1 : 1)
    bass(r, ch.root, t0, 0.5)
    bass(r, ch.root + 7, t0 + EIGHTH * 3, 0.38)
    bass(r, rnd() < 0.5 ? approach : ch.root, t0 + EIGHTH * 6, 0.34)
    // the bandoneón
    if (texture === 'marcato') {
      for (const e of [0, 3, 6]) bandoneon(r, ch.notes, t0 + e * EIGHTH, EIGHTH * 0.75, e === 0 ? 0.2 : 0.14, 0.02)
    } else if (texture === 'legato') {
      bandoneon(r, ch.notes, t0, BAR * 0.96, 0.13, 0.35)
    }
    // a line of melody: mostly chord notes, stepping down through the scale, landing on the chord at the end
    if (melody) {
      const rhythm = pick(
        [
          [3, 3, 2],
          [2, 1, 1, 2, 2],
          [1, 1, 1, 1, 4],
          [4, 2, 2],
          [6, 2],
        ],
        rnd,
      )
      let e = 0
      rhythm.forEach((len, k) => {
        const tones = ch.notes.map((n) => n + 12)
        let m: number
        if (k === rhythm.length - 1) m = tones.reduce((a, b) => (Math.abs(b - lastMel) < Math.abs(a - lastMel) ? b : a))
        else {
          const step = rnd() < 0.7 ? -1 : 1
          m = lastMel + step
          for (let s = 0; s < 3 && !SCALE.includes(((m % 12) + 12) % 12); s++) m += step
          if (m < 69) m += 12
          if (m > 84) m -= 12
        }
        lastMel = m
        bandoneon(r, [m], t0 + e * EIGHTH, len * EIGHTH * 0.92, 0.16, 0.05)
        e += len
      })
    }
    bar++
  }
}

/**
 * The radio, playing: call `start` when the music is wanted and `stop` when it is not. It schedules a second ahead
 * of the clock, bar by bar.
 */
export function makeMusic(ctx: AudioContext, out: AudioNode) {
  let rig: Rig | null = null
  let next = 0
  let timer: ReturnType<typeof setInterval> | null = null
  let schedule: ((t: number) => void) | null = null
  return {
    start() {
      if (timer) return
      if (!rig) rig = buildRadio(ctx, out)
      schedule = composer(rig)
      next = ctx.currentTime + 0.3
      timer = setInterval(() => {
        // (a suspended context does not move: nothing piles up while the page waits for a click)
        while (next < ctx.currentTime + 1.2) {
          schedule!(next)
          next += BAR
        }
      }, 250)
    },
    stop() {
      if (timer) clearInterval(timer)
      timer = null
    },
  }
}

/** The same music rendered offline (to listen to it outside the game): `seconds` of it, in stereo. */
export async function renderMusic(seconds: number, sampleRate = 44100) {
  const ctx = new OfflineAudioContext(2, Math.ceil(seconds * sampleRate), sampleRate)
  const out = ctx.createGain()
  out.gain.value = 0.9
  out.connect(ctx.destination)
  const rig = buildRadio(ctx, out)
  const schedule = composer(rig)
  for (let t = 0.2; t < seconds; t += BAR) schedule(t)
  return ctx.startRendering()
}
