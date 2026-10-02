import * as THREE from 'three'
import { getAudioSettings, onAudioSettings, setAudioSettings, type AudioSettings } from '../settings/audioSettings'

// Sound design: real card recordings (Kenney "Casino Audio", CC0) placed in 3D (HRTF) inside a small
// wooden room (short convolution reverb). No noise beds: the room is almost silent, only the lamp
// hums very low and crackles when it flickers. Silence is part of the tension.
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
let hum: GainNode
let sfxBus: GainNode // cards, table, knocks (dry + reverb send)
let ambBus: GainNode // lamp hum and crackle
const MASTER = 0.9
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
  const resume = () => {
    if (ctx.state === 'suspended') void ctx.resume()
  }
  for (const ev of ['pointerdown', 'keydown', 'touchstart'] as const) window.addEventListener(ev, resume, { capture: true, passive: true })
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
  if (ctx?.state === 'suspended') void ctx.resume()
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

  // Lamp hum: two low partials through a low-pass, barely audible, breathing slowly.
  hum = ctx.createGain()
  hum.gain.value = 0.012
  const lp = ctx.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = 220
  for (const [f, g] of [[100, 1], [200, 0.35]] as const) {
    const o = ctx.createOscillator()
    o.frequency.value = f
    const og = ctx.createGain()
    og.gain.value = g
    o.connect(og).connect(lp)
    o.start()
  }
  const lfo = ctx.createOscillator()
  lfo.frequency.value = 0.07
  const lfoGain = ctx.createGain()
  lfoGain.gain.value = 0.004
  lfo.connect(lfoGain).connect(hum.gain)
  lfo.start()
  lp.connect(hum).connect(ambBus)
  applySettings(getAudioSettings())
  onAudioSettings(applySettings)
  graphReady = true // buffers keep loading; a sound whose buffer isn't there yet is skipped

  const names = [...new Set(Object.values(FILES).flat())]
  await Promise.all(
    names.map(async (n) => {
      const res = await fetch(`${import.meta.env.BASE_URL}sfx/${n}.ogg`)
      buffers.set(n, await ctx.decodeAudioData(await res.arrayBuffer()))
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
}

/** Mutes/unmutes everything (keyboard M); the settings menu controls each bus. */
export function toggleMute() {
  const st = getAudioSettings()
  const on = st.effects || st.ambient
  setAudioSettings({ effects: !on, ambient: !on })
  return on
}

/** A short card-on-felt sound at the listener, to hear a volume change. */
export function previewSound() {
  if (!listener) return
  const at = listener.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0.2, -0.4, -0.3))
  sfx('place', at)
}

export const audioReady = () => Boolean(listener) && ctx?.state === 'running'
