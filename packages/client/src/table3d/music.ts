// The music of the basement: an old milonga on a valve radio in the corner, never quite the same twice. It is made
// here, note by note (no recordings): a tune you can hum (fixed, A A B A, in D minor) on a bandoneón, a pizzicato
// double bass with its own riff on the milonga's 3-3-2, the bandoneón's short chords under them — the room is tense, the radio only keeps it company. Everything
// goes through the radio: band-limited, a little saturated, the record crackling, the pitch wavering like worn tape.

type Ctx = BaseAudioContext

const BPM = 104 // a milonga is a lively dance: this is its walking pace, not a lament's
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

const hz = (m: number) => 440 * Math.pow(2, (m - 69) / 12)

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
  hp.frequency.value = 120
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

/** A pizzicato double bass note: a thump and a quick decay, bright enough to carry a tune through the radio. */
function bass(r: Rig, m: number, t: number, gain: number, len = 0.5) {
  const { ctx } = r
  const o = ctx.createOscillator()
  o.type = 'sawtooth'
  o.frequency.value = hz(m)
  r.wow.connect(o.detune)
  const o2 = ctx.createOscillator()
  o2.type = 'sine'
  o2.frequency.value = hz(m) * 2
  const g2 = ctx.createGain()
  g2.gain.value = 0.25
  const env = ctx.createGain()
  env.gain.setValueAtTime(0.0001, t)
  env.gain.exponentialRampToValueAtTime(gain, t + 0.01)
  env.gain.exponentialRampToValueAtTime(0.0001, t + len)
  const lp = ctx.createBiquadFilter()
  lp.type = 'lowpass'
  lp.Q.value = 2
  lp.frequency.setValueAtTime(1400, t)
  lp.frequency.exponentialRampToValueAtTime(350, t + len * 0.6)
  o.connect(lp)
  o2.connect(g2).connect(lp)
  lp.connect(env).connect(r.in)
  for (const x of [o, o2]) {
    x.start(t)
    x.stop(t + len + 0.05)
  }
}

/** The composer: lays down bar after bar, choosing phrases, textures and melody as it goes. */
// ---- the tune. A melody you can hum, like the old handheld games' themes: a short hook with its own rhythm (the
// milonga's 3-3-2), said twice, answered, a brighter middle part, and back to the hook. Fixed, so it sticks: the
// only things that change from one time round to the next are small (an octave up, a grace note).
// Each bar: its chord, and the melody as [midi, start eighth, length in eighths].
type Note = [number, number, number]
const A_PART: Array<[string, Note[]]> = [
  ['Dm', [[74, 0, 3], [69, 3, 3], [74, 6, 1], [76, 7, 1]]], // the hook: D – A – D E
  ['Dm', [[77, 0, 3], [76, 3, 1], [74, 4, 1], [73, 5, 1], [74, 6, 2]]], //          F – E D C# D
  ['Gm', [[79, 0, 3], [77, 3, 3], [76, 6, 1], [74, 7, 1]]], //                       G – F – E D
  ['A7', [[73, 0, 2], [76, 2, 1], [69, 3, 3], [69, 6, 1], [69, 7, 1]]], //            C# E A — A A
  ['Dm', [[74, 0, 3], [69, 3, 3], [74, 6, 1], [76, 7, 1]]], // the hook again
  ['Bb', [[77, 0, 3], [79, 3, 1], [77, 4, 1], [76, 5, 1], [74, 6, 2]]],
  ['A7', [[76, 0, 1], [77, 1, 1], [76, 2, 1], [74, 3, 3], [73, 6, 2]]],
  ['Dm', [[74, 0, 3], [69, 3, 1], [74, 4, 2]]], // home
]
const B_PART: Array<[string, Note[]]> = [
  ['F', [[72, 0, 1], [77, 1, 2], [81, 3, 3], [79, 6, 1], [77, 7, 1]]], // up into F major
  ['C', [[76, 0, 3], [79, 3, 3], [76, 6, 2]]],
  ['Bb', [[74, 0, 1], [77, 1, 2], [82, 3, 3], [81, 6, 1], [79, 7, 1]]], // the same, a step lower and higher
  ['A7', [[81, 0, 3], [79, 3, 1], [77, 4, 1], [76, 5, 1], [73, 6, 2]]],
  ['Dm', [[74, 0, 1], [77, 1, 2], [81, 3, 3], [81, 6, 1], [82, 7, 1]]],
  ['Gm', [[82, 0, 3], [81, 3, 1], [79, 4, 1], [77, 5, 1], [76, 6, 2]]],
  ['E7', [[77, 0, 2], [76, 2, 1], [74, 3, 3], [76, 6, 2]]],
  ['A7', [[73, 0, 3], [69, 3, 3], [69, 6, 1], [76, 7, 1]]], // and the pick-up back to the hook
]
// A A B A: 32 bars, a little over a minute, then round again
const FORM = [...A_PART, ...A_PART, ...B_PART, ...A_PART]

/** The composer: plays the tune bar by bar — the bass's riff, the bandoneón's chords and the melody on top. */
function composer(r: Rig, rnd: () => number = Math.random) {
  let bar = -2 // two bars of bass and chords before the tune comes in
  let round = 0
  return function scheduleBar(t0: number) {
    const k = ((bar % FORM.length) + FORM.length) % FORM.length
    const [name, melody] = FORM[k]
    const ch = C[name]
    const next = C[FORM[(k + 1) % FORM.length][0]]
    if (k === 0 && bar > 0) round++

    // the bass's riff on the 3-3-2: root, fifth, and two quick notes walking into the next chord's root
    const low = (m: number) => (m < 41 ? m + 12 : m) // (the radio would swallow anything lower)
    const root = low(ch.root)
    const goal = low(next.root)
    const walk1 = goal + (goal > root ? -2 : goal < root ? 2 : 7)
    const walk2 = goal + (goal > root ? -1 : goal < root ? 1 : 4)
    bass(r, root, t0, 0.36, EIGHTH * 2.6)
    bass(r, root + 7, t0 + EIGHTH * 3, 0.3, EIGHTH * 2.6)
    bass(r, walk1, t0 + EIGHTH * 6, 0.26, EIGHTH * 0.9)
    bass(r, walk2, t0 + EIGHTH * 7, 0.26, EIGHTH * 0.9)

    // the bandoneón's chords, short and soft under the tune (marcato on the 3-3-2)
    for (const e of [0, 3, 6]) bandoneon(r, ch.notes, t0 + e * EIGHTH, EIGHTH * 0.5, e === 0 ? 0.11 : 0.08, 0.012)

    // the tune (from the third bar on); the second time round the hook sings an octave up, now and then a grace note
    if (bar >= 0) {
      const up = round % 2 === 1 && k < 16 ? 12 : 0
      for (const [m, e, len] of melody) {
        const at = t0 + e * EIGHTH
        if (len >= 3 && rnd() < 0.2) bandoneon(r, [m + up + 1], at - EIGHTH * 0.25, EIGHTH * 0.22, 0.1, 0.008) // a grace note
        bandoneon(r, [m + up], at, len * EIGHTH * 0.82, 0.2, 0.02)
      }
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
