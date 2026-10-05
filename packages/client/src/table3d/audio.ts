import * as THREE from 'three'
import { getAudioSettings, onAudioSettings, setAudioSettings, type AudioSettings } from '../settings/audioSettings'
import { makeMusic } from './music'
import { onStrike, type Strike } from './storm'

// Sound design: real card recordings (Kenney "Casino Audio", CC0) placed in 3D (HRTF) inside a small
// wooden room (short convolution reverb). No noise beds: an old milonga plays low on a radio in the corner
// (music.ts) and the lamp crackles when it flickers. Silence is part of the tension.
export type Sfx = 'pick' | 'slide' | 'place' | 'flip' | 'toss' | 'toHand' | 'shuffle' | 'knock'

const FILES: Record<Exclude<Sfx, 'knock'>, string[]> = {
  pick: ['card-slide-4'],
  slide: ['card-shove-1', 'card-shove-2', 'card-shove-3', 'card-shove-4'],
  place: ['card-place-1', 'card-place-2', 'card-place-3', 'card-place-4'],
  flip: ['card-slide-1', 'card-slide-2', 'card-slide-3'],
  toss: ['card-slide-5', 'card-slide-6', 'card-slide-7', 'card-slide-8'],
  toHand: ['card-fan-1'],
  shuffle: ['card-shuffle'],
}
// Per-event character: base gain and playback-rate range (pitch variation keeps repeats natural).
const VOICE: Record<Sfx, { gain: number; rate: [number, number] }> = {
  pick: { gain: 0.35, rate: [1.1, 1.25] },
  slide: { gain: 0.45, rate: [0.9, 1.05] },
  place: { gain: 0.9, rate: [0.9, 1.05] },
  flip: { gain: 0.55, rate: [1.25, 1.45] },
  toss: { gain: 0.5, rate: [1.0, 1.15] },
  toHand: { gain: 0.25, rate: [1.05, 1.2] },
  shuffle: { gain: 0.7, rate: [0.95, 1.05] },
  knock: { gain: 1.0, rate: [1, 1] },
}

let listener: THREE.AudioListener | null = null
let graphReady = false
let ctx: AudioContext
let master: GainNode
let wet: GainNode
let musicBus: GainNode // the radio
let music: ReturnType<typeof makeMusic> | null = null
let sfxBus: GainNode // cards, table, knocks (dry + reverb send)
let ambBus: GainNode // the lamp's crackle
const MASTER = 0.9
const MUSIC = 0.55 // the radio sits under the cards and the table, never over them
const buffers = new Map<string, AudioBuffer>()

// Small room with wood: 0.45 s decaying, darkened impulse (stereo, decorrelated).
function roomImpulse(c: AudioContext) {
  const len = Math.floor(c.sampleRate * 0.45)
  const ir = c.createBuffer(2, len, c.sampleRate)
  for (let ch = 0; ch < 2; ch++) {
    const d = ir.getChannelData(ch)
    let lp = 0
    for (let i = 0; i < len; i++) {
      const t = i / len
      lp = lp * 0.82 + (Math.random() * 2 - 1) * 0.18 // darker tail = wood, not tile
      d[i] = lp * Math.pow(1 - t, 3.2) * (i < c.sampleRate * 0.008 ? 0 : 1) // 8 ms pre-delay
    }
  }
  return ir
}

/**
 * Sound starts with the app, not with a click on the table. Browsers keep an AudioContext
 * suspended until the first interaction with the page (autoplay rules), so the context is created
 * at once and resumed by the first pointer or key event anywhere: by the time you sit at the table
 * (after typing your name and picking a menu card) it is already playing.
 */
export function startAudio() {
  if (listener) return
  listener = new THREE.AudioListener()
  ctx = listener.context
  const resume = () => unlock()
  // iOS only lets sound start from the END of a touch (or a click), not from touchstart/pointerdown
  for (const ev of ['pointerdown', 'pointerup', 'keydown', 'touchstart', 'touchend', 'click'] as const) window.addEventListener(ev, resume, { capture: true, passive: true })
  ctx.addEventListener('statechange', () => stateListeners.forEach((f) => f(ctx.state)))
  void buildGraph()
}

const stateListeners = new Set<(s: AudioContextState) => void>()
/** Whether sound is actually playing (it stays 'suspended' until the page gets a gesture). */
export const audioState = (): AudioContextState => (ctx ? ctx.state : 'suspended')
export function onAudioState(fn: (s: AudioContextState) => void) {
  stateListeners.add(fn)
  return () => {
    stateListeners.delete(fn)
  }
}
/** Ask the browser to play now (call from a click). */
export function resumeAudio() {
  unlock()
}

/**
 * On an iPhone, Web Audio is muted by the ringer's silent switch unless the page plays "media": ask
 * for the playback audio session, and loop a silent <audio> (the trick older iOS needs).
 */
let sessionDone = false
function playbackSession() {
  if (sessionDone) return
  sessionDone = true
  try {
    const nav = navigator as unknown as { audioSession?: { type: string } }
    if (nav.audioSession) nav.audioSession.type = 'playback'
  } catch {
    /* not supported */
  }
  try {
    const a = document.createElement('audio')
    a.setAttribute('playsinline', '')
    a.loop = true
    a.volume = 0.001
    // one second of silence (a tiny WAV)
    a.src = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA='
    void a.play().catch(() => undefined)
  } catch {
    /* nothing to do */
  }
}

/**
 * Starts sound from a user gesture. Besides resume() (a phone also leaves the context 'interrupted'
 * after a call or a lock screen, not only 'suspended'), a silent buffer is played: that is what
 * unlocks iOS Safari.
 */
function unlock() {
  playbackSession()
  if (!ctx || ctx.state === 'running') return
  try {
    const src = ctx.createBufferSource()
    src.buffer = ctx.createBuffer(1, 1, 22050)
    src.connect(ctx.destination)
    src.start(0)
  } catch {
    /* nothing to play: resume() below still tries */
  }
  void ctx.resume().catch(() => undefined)
}

/**
 * The ears go where the eyes are: the menu's camera, then the table's. Returns a function that
 * gives them back to the previous camera (leaving the table returns you to the menu's room).
 */
const ears: THREE.Camera[] = []
export function attachAudio(camera: THREE.Camera) {
  startAudio()
  ears.push(camera)
  const hearFrom = (c: THREE.Camera | undefined) => {
    if (!listener || !c || listener.parent === c) return
    listener.parent?.remove(listener)
    c.add(listener)
  }
  hearFrom(camera)
  return () => {
    const i = ears.lastIndexOf(camera)
    if (i >= 0) ears.splice(i, 1)
    hearFrom(ears[ears.length - 1])
  }
}

async function buildGraph() {
  if (!listener) return
  master = ctx.createGain()
  sfxBus = ctx.createGain()
  ambBus = ctx.createGain()
  sfxBus.connect(master)
  ambBus.connect(master)
  const comp = ctx.createDynamicsCompressor()
  comp.threshold.value = -14
  comp.ratio.value = 3
  master.connect(comp).connect(listener.getInput())
  const verb = ctx.createConvolver()
  verb.buffer = roomImpulse(ctx)
  wet = ctx.createGain()
  wet.gain.value = 0.22
  wet.connect(verb).connect(sfxBus)

  // the storm outside: rain all the time, a drip in a corner now and then, thunder after each lightning
  buildRain()
  onStrike((st) => thunder(st))
  scheduleDrip()

  // the music: an old milonga on the radio (no more lamp hum under it)
  musicBus = ctx.createGain()
  musicBus.gain.value = 0
  musicBus.connect(master)
  music = makeMusic(ctx, musicBus)
  applySettings(getAudioSettings())
  onAudioSettings(applySettings)
  graphReady = true // buffers keep loading; a sound whose buffer isn't there yet is skipped

  const names = [...new Set(Object.values(FILES).flat())]
  await Promise.all(
    names.map(async (n) => {
      // one sample that cannot be fetched or decoded (a browser without Ogg Vorbis, say) must not take
      // the others down with it: the synthesized sounds and the rest keep working
      try {
        const res = await fetch(`${import.meta.env.BASE_URL}sfx/${n}.ogg`)
        buffers.set(n, await ctx.decodeAudioData(await res.arrayBuffer()))
      } catch (err) {
        console.warn('[audio] could not load', n, err)
      }
    }),
  )
}

function spatial(at: THREE.Vector3) {
  const p = ctx.createPanner()
  p.panningModel = 'HRTF'
  p.distanceModel = 'inverse'
  p.refDistance = 0.7
  p.rolloffFactor = 1.2
  p.positionX.value = at.x
  p.positionY.value = at.y
  p.positionZ.value = at.z
  const send = ctx.createGain()
  send.gain.value = 1
  p.connect(sfxBus)
  p.connect(send).connect(wet)
  return p
}

// A fist on the table: pitched thump (sine drop) + the wood of a card-place at half speed.
function knock(at: THREE.Vector3, volume: number) {
  const out = spatial(at)
  const o = ctx.createOscillator()
  const g = ctx.createGain()
  const t = ctx.currentTime
  o.frequency.setValueAtTime(95, t)
  o.frequency.exponentialRampToValueAtTime(38, t + 0.25)
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(0.9 * volume, t + 0.008)
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4)
  o.connect(g).connect(out)
  o.start(t)
  o.stop(t + 0.45)
  const wood = buffers.get('card-place-3')
  if (wood) {
    const s = ctx.createBufferSource()
    s.buffer = wood
    s.playbackRate.value = 0.5
    const wg = ctx.createGain()
    wg.gain.value = 0.8 * volume
    s.connect(wg).connect(out)
    s.start(t)
  }
}

export function sfx(kind: Sfx, at: THREE.Vector3, volume = 1) {
  if (!listener || !graphReady || ctx.state !== 'running' || !getAudioSettings().effects) return
  if (kind === 'knock') return knock(at, volume)
  const list = FILES[kind]
  const buf = buffers.get(list[Math.floor(Math.random() * list.length)])
  if (!buf) return
  const v = VOICE[kind]
  const s = ctx.createBufferSource()
  s.buffer = buf
  s.playbackRate.value = v.rate[0] + Math.random() * (v.rate[1] - v.rate[0])
  const g = ctx.createGain()
  g.gain.value = v.gain * volume * (0.85 + Math.random() * 0.3)
  s.connect(g).connect(spatial(at))
  s.start()
}

// ------------------------------------------------------------------ the storm

/** Noise: white, or browner (each sample leaning on the last), `seconds` long, stereo. */
function noiseBuffer(seconds: number, brown: number) {
  const len = Math.floor(ctx.sampleRate * seconds)
  const b = ctx.createBuffer(2, len, ctx.sampleRate)
  for (let ch = 0; ch < 2; ch++) {
    const d = b.getChannelData(ch)
    let last = 0
    for (let i = 0; i < len; i++) {
      last = last * brown + (Math.random() * 2 - 1) * (1 - brown)
      d[i] = last
    }
    // (normalise: browner noise is quieter)
    let peak = 0
    for (let i = 0; i < len; i++) peak = Math.max(peak, Math.abs(d[i]))
    for (let i = 0; i < len; i++) d[i] /= peak || 1
  }
  return b
}

/**
 * The rain, heard from the basement: a muffled hiss on the ground and the window outside, swelling and easing slowly,
 * with the patter of the bigger drops on top. On the room's bus (Sonido ambiente).
 */
function buildRain() {
  const hiss = ctx.createBufferSource()
  hiss.buffer = noiseBuffer(5, 0.6)
  hiss.loop = true
  const band = ctx.createBiquadFilter()
  band.type = 'bandpass'
  band.frequency.value = 1100
  band.Q.value = 0.5
  const muffle = ctx.createBiquadFilter() // through the wall and the glass
  muffle.type = 'lowpass'
  muffle.frequency.value = 2600
  const g = ctx.createGain()
  g.gain.value = 0.05
  // it comes and goes: a slow swell
  const swell = ctx.createOscillator()
  swell.frequency.value = 0.045
  const swellG = ctx.createGain()
  swellG.gain.value = 0.018
  swell.connect(swellG).connect(g.gain)
  swell.start()
  hiss.connect(band).connect(muffle).connect(g).connect(ambBus)
  hiss.start()
  // the patter: sparse ticks of bigger drops (a buffer of them, looped at an odd length)
  const len = Math.floor(ctx.sampleRate * 3.7)
  const pat = ctx.createBuffer(2, len, ctx.sampleRate)
  for (let ch = 0; ch < 2; ch++) {
    const d = pat.getChannelData(ch)
    for (let i = 0; i < len; i++) {
      if (Math.random() < 0.0016) {
        const a = 0.2 + Math.random() * 0.8
        const k0 = 18 + Math.random() * 40
        for (let k = 0; k < 220 && i + k < len; k++) d[i + k] += a * Math.exp(-k / k0) * (Math.random() * 2 - 1)
      }
    }
  }
  const patter = ctx.createBufferSource()
  patter.buffer = pat
  patter.loop = true
  const pf = ctx.createBiquadFilter()
  pf.type = 'bandpass'
  pf.frequency.value = 2400
  pf.Q.value = 0.8
  const pg = ctx.createGain()
  pg.gain.value = 0.035
  patter.connect(pf).connect(pg).connect(ambBus)
  patter.start()
}

/** A drop of water falling into a puddle in some corner of the basement, now and then. */
function scheduleDrip() {
  window.setTimeout(() => {
    scheduleDrip()
    if (!graphReady || ctx.state !== 'running' || !getAudioSettings().ambient) return
    const t = ctx.currentTime + 0.05
    const o = ctx.createOscillator()
    o.type = 'sine'
    const f = 900 + Math.random() * 700
    o.frequency.setValueAtTime(f, t)
    o.frequency.exponentialRampToValueAtTime(f * 1.9, t + 0.06) // the bubble's pitch rises
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.05, t + 0.004)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.11)
    const pan = ctx.createStereoPanner()
    pan.pan.value = Math.random() * 1.6 - 0.8
    o.connect(g).connect(pan).connect(ambBus)
    g.connect(wet) // the basement's echo
    o.start(t)
    o.stop(t + 0.15)
  }, 4000 + Math.random() * 11000)
}

/**
 * Thunder after a strike: the farther off, the later (sound is slow) and the softer and duller. Near: a crack first,
 * then the long rumble that rolls and fades. Brown noise through a low-pass, its loudness rolling irregularly.
 */
function thunder(st: Strike) {
  if (!graphReady || ctx.state !== 'running' || !getAudioSettings().ambient) return
  const delay = 0.25 + (1 - st.near) * 3.6
  const t = ctx.currentTime + delay
  const dur = 4 + (1 - st.near) * 4 + Math.random() * 2
  const src = ctx.createBufferSource()
  src.buffer = noiseBuffer(dur + 1, 0.985)
  const lp = ctx.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.setValueAtTime(260 + st.near * 900, t)
  lp.frequency.exponentialRampToValueAtTime(90, t + dur)
  const g = ctx.createGain()
  const peak = 0.12 + st.near * 0.5
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(peak, t + (st.near > 0.6 ? 0.03 : 0.5))
  // the roll: it swells back two or three times as it dies away
  let at = t + 0.6
  while (at < t + dur) {
    const left = 1 - (at - t) / dur
    g.gain.setTargetAtTime(peak * left * (0.35 + Math.random() * 0.65), at, 0.25)
    at += 0.3 + Math.random() * 0.9
  }
  g.gain.setTargetAtTime(0.0001, t + dur, 0.6)
  src.connect(lp).connect(g).connect(ambBus)
  g.connect(wet)
  src.start(t)
  src.stop(t + dur + 3)
  // right on top of the house: the crack of the bolt itself
  if (st.near > 0.6) {
    const crack = ctx.createBufferSource()
    crack.buffer = noiseBuffer(0.6, 0.3)
    const hp = ctx.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.value = 700
    const cg = ctx.createGain()
    cg.gain.setValueAtTime(0.0001, t)
    cg.gain.exponentialRampToValueAtTime(0.25 * st.near, t + 0.01)
    cg.gain.exponentialRampToValueAtTime(0.0001, t + 0.5)
    crack.connect(hp).connect(cg).connect(ambBus)
    crack.start(t)
  }
}

// Filament crackle while the lamp flickers.
let lastBuzz = 0
export function lampBuzz(at: THREE.Vector3) {
  if (!listener || !graphReady || ctx.state !== 'running' || !getAudioSettings().ambient || ctx.currentTime - lastBuzz < 0.3) return
  lastBuzz = ctx.currentTime
  const o = ctx.createOscillator()
  o.type = 'sawtooth'
  o.frequency.value = 100
  const bp = ctx.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.value = 1800
  bp.Q.value = 2
  const g = ctx.createGain()
  const t = ctx.currentTime
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(0.03, t + 0.02)
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18)
  const out = ctx.createPanner() // positional, but on the ambient bus
  out.panningModel = 'HRTF'
  out.positionX.value = at.x
  out.positionY.value = at.y
  out.positionZ.value = at.z
  out.connect(ambBus)
  o.connect(bp).connect(g).connect(out)
  o.start(t)
  o.stop(t + 0.2)
}

function applySettings(st: AudioSettings) {
  if (!ctx) return
  const t = ctx.currentTime
  master.gain.setTargetAtTime(MASTER * st.volume * st.volume, t, 0.05) // perceptual (squared) curve
  sfxBus.gain.setTargetAtTime(st.effects ? 1 : 0, t, 0.05)
  ambBus.gain.setTargetAtTime(st.ambient ? 1 : 0, t, 0.05)
  // the radio fades in and out; it only plays (schedules notes) while it is wanted
  musicBus.gain.setTargetAtTime(st.music ? MUSIC : 0, t, st.music ? 0.8 : 0.25)
  if (st.music) music?.start()
  else window.setTimeout(() => !getAudioSettings().music && music?.stop(), 1500)
}

/** Mutes/unmutes everything (keyboard M); the settings menu controls each bus. */
export function toggleMute() {
  const st = getAudioSettings()
  const on = st.effects || st.ambient || st.music
  setAudioSettings({ effects: !on, ambient: !on, music: !on })
  return on
}

/** A short card-on-felt sound at the listener, to hear a volume change. */
export function previewSound() {
  if (!listener) return
  const at = listener.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0.2, -0.4, -0.3))
  sfx('place', at)
}

export const audioReady = () => Boolean(listener) && ctx?.state === 'running'

// ------------------------------------------------------------------ interface sounds
// The menus are part of the room too: paper, cards, chips and a pencil, quiet and dry-ish (a
// little of the wooden room's reverb). Not positional: they happen under your hands.

// menu sounds belong to the room, not to the cards: the lamp's pull chain for a button, a chair
// that creaks when someone sits down (scrapes when they leave); only the aces sound like cards
export type UiSound = 'announce' | 'hover' | 'chain' | 'stamp' | 'chip' | 'flip' | 'write' | 'page' | 'book' | 'paper' | 'sit' | 'leave' | 'clock'

let noiseBuf: AudioBuffer | null = null
function noise() {
  if (noiseBuf) return noiseBuf
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate)
  const d = noiseBuf.getChannelData(0)
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  return noiseBuf
}

/** A short burst of filtered noise: the raw material of paper, pencil and clicks. */
function burst(dur: number, filter: BiquadFilterType, freq: number, q: number, gain: number, sweepTo?: number, at = 0) {
  const t = ctx.currentTime + at
  const src = ctx.createBufferSource()
  src.buffer = noise()
  src.playbackRate.value = 0.8 + Math.random() * 0.4
  const f = ctx.createBiquadFilter()
  f.type = filter
  f.frequency.setValueAtTime(freq, t)
  if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur)
  f.Q.value = q
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(gain, t + Math.min(0.012, dur / 4))
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  src.connect(f).connect(g).connect(uiOut())
  src.start(t, Math.random() * 0.5)
  src.stop(t + dur + 0.02)
}

function sample(name: string, gain: number, rate: number) {
  const buf = buffers.get(name)
  if (!buf) return
  const s = ctx.createBufferSource()
  s.buffer = buf
  s.playbackRate.value = rate * (0.95 + Math.random() * 0.1)
  const g = ctx.createGain()
  g.gain.value = gain
  s.connect(g).connect(uiOut())
  s.start()
}

/** A short tone: frequency glide and a fast decay (bead clicks, switches, thumps). */
function tone(type: OscillatorType, f0: number, f1: number, dur: number, gain: number, at = 0) {
  const t = ctx.currentTime + at
  const o = ctx.createOscillator()
  const g = ctx.createGain()
  o.type = type
  o.frequency.setValueAtTime(f0, t)
  o.frequency.exponentialRampToValueAtTime(f1, t + dur)
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(gain, t + 0.004)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  o.connect(g).connect(uiOut())
  o.start(t)
  o.stop(t + dur + 0.02)
}

/** The lamp's pull chain: the beads rattle down, the switch inside clicks. */
function pullChain() {
  const beads = 3 + Math.floor(Math.random() * 2)
  for (let i = 0; i < beads; i++) burst(0.012, 'bandpass', 5200 + Math.random() * 1600, 7, 0.09, undefined, i * (0.011 + Math.random() * 0.006))
  const at = beads * 0.014 + 0.01
  burst(0.02, 'bandpass', 2100, 3, 0.2, undefined, at)
  tone('triangle', 1350, 900, 0.035, 0.08, at)
}

/** Wood under load: stick-slip pulses through the chair's resonance, the pitch wandering. */
function creak(dur: number, at: number) {
  const t = ctx.currentTime + at
  const o = ctx.createOscillator()
  o.type = 'sawtooth'
  const rate = 38 + Math.random() * 14
  o.frequency.setValueAtTime(rate, t)
  o.frequency.linearRampToValueAtTime(rate * (1.6 + Math.random() * 0.5), t + dur * 0.6)
  o.frequency.linearRampToValueAtTime(rate * 1.1, t + dur)
  const f = ctx.createBiquadFilter()
  f.type = 'bandpass'
  f.frequency.value = 520 + Math.random() * 260
  f.Q.value = 9
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(0.5, t + dur * 0.25)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  o.connect(f).connect(g).connect(uiOut())
  o.start(t)
  o.stop(t + dur + 0.02)
}

/** Weight settling on the seat. */
function thump(at: number, gain: number) {
  tone('sine', 120, 50, 0.16, gain, at)
}

let uiBus: GainNode | null = null
function uiOut() {
  if (uiBus) return uiBus
  uiBus = ctx.createGain()
  uiBus.gain.value = 1
  uiBus.connect(sfxBus)
  const send = ctx.createGain()
  send.gain.value = 0.25 // a touch of the room
  uiBus.connect(send).connect(wet)
  return uiBus
}

let lastHover = 0
export function uiSound(kind: UiSound) {
  if (!listener || !graphReady || ctx.state !== 'running' || !getAudioSettings().effects) return
  if (import.meta.env.DEV) {
    // dev only: count what played (tests can't listen)
    const w = window as unknown as { __uiSounds?: Record<string, number> }
    w.__uiSounds = { ...w.__uiSounds, [kind]: (w.__uiSounds?.[kind] ?? 0) + 1 }
  }
  switch (kind) {
    case 'hover': {
      if (ctx.currentTime - lastHover < 0.06) return // a sweep across buttons doesn't rattle
      lastHover = ctx.currentTime
      burst(0.03, 'bandpass', 3400, 4, 0.05)
      return
    }
    case 'chain':
      return pullChain()
    case 'announce': {
      // a title card slammed down: a deep hit, a bright struck bell on top (two inharmonic partials) and the slap of paper
      thump(0, 0.5)
      tone('sine', 196, 190, 0.9, 0.2, 0.01)
      tone('sine', 196 * 2.76, 196 * 2.74, 0.6, 0.1, 0.01)
      tone('sine', 196 * 5.4, 196 * 5.3, 0.35, 0.05, 0.01)
      burst(0.09, 'bandpass', 1500, 1.5, 0.3)
      return
    }
    case 'clock':
      // a chess clock pressed: the plunger's hard plastic clack and the lever inside
      burst(0.025, 'bandpass', 2300, 4, 0.4)
      tone('square', 380, 160, 0.05, 0.05)
      burst(0.015, 'bandpass', 4200, 6, 0.12, undefined, 0.03)
      return
    case 'sit':
      creak(0.42, 0)
      thump(0.36, 0.28)
      return
    case 'leave':
      burst(0.36, 'bandpass', 900, 2, 0.16, 280) // the legs scraping back over the floor
      creak(0.25, 0.05)
      return
    case 'flip':
      return sample(`card-slide-${1 + Math.floor(Math.random() * 3)}`, 0.5, 1.3)
    case 'stamp': {
      // an inked stamp pressed on paper: a soft thump and the paper's slap
      const t = ctx.currentTime
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.frequency.setValueAtTime(150, t)
      o.frequency.exponentialRampToValueAtTime(55, t + 0.12)
      g.gain.setValueAtTime(0.0001, t)
      g.gain.exponentialRampToValueAtTime(0.5, t + 0.006)
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18)
      o.connect(g).connect(uiOut())
      o.start(t)
      o.stop(t + 0.2)
      burst(0.08, 'highpass', 1800, 0.7, 0.12)
      return
    }
    case 'chip': {
      // two clay chips knocking: a bright resonant click, twice
      burst(0.05, 'bandpass', 2600, 9, 0.35)
      burst(0.04, 'bandpass', 3300, 10, 0.22, undefined, 0.045)
      return
    }
    case 'write':
      // pencil (or chalk) on card: a short grainy scratch
      return burst(0.07 + Math.random() * 0.04, 'bandpass', 2600 + Math.random() * 1400, 1.4, 0.07)
    case 'page':
      // a leaf turning: a rustle that rises, then the flap settling
      burst(0.42, 'bandpass', 700, 0.8, 0.16, 3200)
      burst(0.12, 'lowpass', 900, 0.7, 0.1, undefined, 0.38)
      return
    case 'book':
      // the booklet set down and opened: a dull thump, then the cover
      sample('card-shove-2', 0.35, 0.55)
      burst(0.3, 'bandpass', 600, 0.8, 0.12, 2200, 0.15)
      return
    case 'paper':
      return burst(0.18, 'bandpass', 1200, 0.9, 0.1, 2600)
  }
}
