// Floating masks and hands, in the style of Buckshot Roulette (development only: open /buckshot-lab.html on the
// dev server). Nothing of the game is in it. Built with three's WebGPURenderer (it falls back to a WebGL2 backend
// where there is no WebGPU) and the PS1 look three ships in `RetroPassNode`: vertices snapped to the pixel grid,
// affine textures, quarter resolution, nearest filtering. On top of it, a posterise + dither written in TSL.
import * as THREE from 'three/webgpu'
import { Fn, float, vec2, vec3, vec4, floor, fract, dot, screenCoordinate, smoothstep, uv, length, uniform } from 'three/tsl'
import { retroPass } from 'three/addons/tsl/display/RetroPassNode.js'

const info = document.getElementById('info')!
const canvas = document.getElementById('c') as HTMLCanvasElement

const PALE = 0xcfc7b4 // the pale of the hands and the masks
const BONE = 0xd6cbb0
const BLACK = 0x0b0908
const TEAL = 0x3b7a78

const phong = (color: number, shininess = 6) => new THREE.MeshPhongMaterial({ color, flatShading: true, shininess })
const basic = (color: number) => new THREE.MeshBasicMaterial({ color })

// ------------------------------------------------------------------------------------------------ the masks
// A mask is a handful of faceted shapes: nothing smooth, nothing detailed. The face is what reads.
function maskOf(kind: 'sonriente' | 'lisa' | 'rejilla') {
  const g = new THREE.Group()
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.17, 9, 7), phong(kind === 'rejilla' ? 0x8c8576 : BONE))
  skull.scale.set(0.86, 1.14, 0.8)
  g.add(skull)
  const dark = basic(BLACK)
  const teeth = basic(0xe6dcc0)
  const front = -0.134 // the face is on −z
  const disc = (r: number, sx: number, sy: number, x: number, y: number, mat: THREE.Material, seg = 7) => {
    const m = new THREE.Mesh(new THREE.CircleGeometry(r, seg), mat)
    m.scale.set(sx, sy, 1)
    m.position.set(x, y, front)
    m.rotation.y = Math.PI
    g.add(m)
    return m
  }
  if (kind === 'sonriente') {
    // big black sockets and a wide toothy grin, the way the Dealer smiles
    disc(0.05, 1, 1.1, -0.065, 0.045, dark)
    disc(0.05, 1, 1.1, 0.065, 0.045, dark)
    const grin = new THREE.Mesh(new THREE.PlaneGeometry(0.17, 0.05), dark)
    grin.position.set(0, -0.075, front - 0.001)
    grin.rotation.y = Math.PI
    g.add(grin)
    for (let i = 0; i < 6; i++) {
      const t = new THREE.Mesh(new THREE.PlaneGeometry(0.02, 0.026), teeth)
      t.position.set(-0.07 + i * 0.028, -0.066, front - 0.002)
      t.rotation.y = Math.PI
      g.add(t)
    }
  }
  if (kind === 'lisa') {
    // the sketch: two big black ovals, short thick brows, a small round mouth
    disc(0.034, 0.8, 1.3, -0.058, 0.03, dark, 8)
    disc(0.034, 0.8, 1.3, 0.058, 0.03, dark, 8)
    for (const sx of [-1, 1]) {
      const b = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.01), dark)
      b.position.set(sx * 0.058, 0.098, front - 0.001)
      b.rotation.set(0, Math.PI, sx * 0.12)
      g.add(b)
    }
    disc(0.016, 1, 0.7, -0.004, -0.09, dark, 8)
  }
  if (kind === 'rejilla') {
    // small eyes and a plate over the mouth with slits, like a respirator
    disc(0.016, 1, 1.2, -0.06, 0.05, dark, 6)
    disc(0.016, 1, 1.2, 0.06, 0.05, dark, 6)
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.1, 0.05), phong(0x2c2a27, 3))
    plate.position.set(0, -0.085, -0.115)
    g.add(plate)
    for (let i = 0; i < 4; i++) {
      const s = new THREE.Mesh(new THREE.PlaneGeometry(0.01, 0.07), dark)
      s.position.set(-0.045 + i * 0.03, -0.085, -0.1405)
      s.rotation.y = Math.PI
      g.add(s)
    }
  }
  return g
}

// ------------------------------------------------------------------------------------------------ the hands
// A floating hand: a block for the palm, three boxes per finger and two for the thumb, a cuff and nothing behind it.
function handOf(side: 1 | -1) {
  const g = new THREE.Group()
  const skin = phong(PALE, 4)
  const cuff = phong(0x1b1815, 2)
  const palm = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.02, 0.085), skin)
  g.add(palm)
  const wrist = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.04, 0.05, 6), cuff)
  wrist.rotation.x = Math.PI / 2
  wrist.position.z = 0.062
  g.add(wrist)
  const fingers: THREE.Group[][] = []
  const LEN = [0.034, 0.03, 0.024]
  for (let f = 0; f < 4; f++) {
    const base = new THREE.Group()
    base.position.set(-0.03 + f * 0.02, 0, -0.04)
    const joints: THREE.Group[] = []
    let parent: THREE.Object3D = base
    for (let j = 0; j < 3; j++) {
      const joint = new THREE.Group()
      const seg = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.014, LEN[j]), skin)
      seg.position.z = -LEN[j] / 2
      joint.add(seg)
      joint.position.z = j === 0 ? 0 : -LEN[j - 1]
      parent.add(joint)
      joints.push(joint)
      parent = joint
    }
    g.add(base)
    fingers.push(joints)
  }
  const thumb: THREE.Group[] = []
  const tBase = new THREE.Group()
  tBase.position.set(side * 0.046, 0, 0.0)
  tBase.rotation.y = side * 0.7
  let tp: THREE.Object3D = tBase
  for (let j = 0; j < 2; j++) {
    const joint = new THREE.Group()
    const seg = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.016, 0.03), skin)
    seg.position.z = -0.015
    joint.add(seg)
    joint.position.z = j === 0 ? 0 : -0.03
    tp.add(joint)
    thumb.push(joint)
    tp = joint
  }
  g.add(tBase)
  /** curl: 0 = open, 1 = a fist */
  const curl = (k: number, spread = 0) => {
    fingers.forEach((js, f) => {
      js.forEach((j, i) => (j.rotation.x = k * (0.7 + i * 0.35)))
      js[0].rotation.y = (f - 1.5) * spread
    })
    thumb.forEach((j, i) => (j.rotation.x = k * (0.3 + i * 0.4)))
  }
  curl(0.3)
  return { group: g, curl }
}

// ------------------------------------------------------------------------------------------------ the scene
const scene = new THREE.Scene()
scene.background = new THREE.Color(0x060504)
scene.fog = new THREE.Fog(0x060504, 3.4, 7.5)
const camera = new THREE.PerspectiveCamera(52, 1, 0.05, 20)
camera.position.set(0, 1.2, 1.35)

// the round table, the felt under the lamp
const table = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.0, 0.08, 14), phong(0x2d3a25, 2))
table.position.y = 0.76
scene.add(table)
const rim = new THREE.Mesh(new THREE.TorusGeometry(0.97, 0.04, 5, 14), phong(0x2a1a10, 2))
rim.rotation.x = Math.PI / 2
rim.position.y = 0.8
scene.add(rim)

// a low lamp, warm; and a cold green fill from behind: the club
scene.add(new THREE.AmbientLight(0x1a1512, 1.0))
const lamp = new THREE.PointLight(0xffc58a, 24, 6, 1.6)
lamp.position.set(0, 1.9, 0.2)
scene.add(lamp)
const fill = new THREE.PointLight(TEAL, 6, 7, 1.8)
fill.position.set(0, 1.6, -2.4)
scene.add(fill)

interface Player {
  mask: THREE.Group
  hands: ReturnType<typeof handOf>[]
  seat: number
  phase: number
}
const KINDS: Array<'sonriente' | 'lisa' | 'rejilla'> = ['lisa', 'sonriente', 'rejilla']
const players: Player[] = KINDS.map((kind, i) => {
  const a = -Math.PI / 2 + (i - 1) * 1.0 // three seats across the table from you
  const root = new THREE.Group()
  root.position.set(Math.cos(a) * 1.25, 0, Math.sin(a) * 1.25)
  root.rotation.y = -a - Math.PI / 2 + Math.PI // facing the middle of the table
  const mask = maskOf(kind)
  mask.position.set(0, 1.22, 0)
  mask.scale.setScalar(1.45)
  root.add(mask)
  const hands = [handOf(-1), handOf(1)]
  hands.forEach((h, k) => {
    h.group.scale.setScalar(1.9)
    h.group.position.set((k ? 1 : -1) * 0.36, 0.95, -0.3)
    root.add(h.group)
  })
  scene.add(root)
  // a few cards in one hand
  const card = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.003, 0.09), phong(0xd9cfb4, 2))
  card.position.set(0, -0.012, -0.05)
  hands[1].group.add(card)
  return { mask, hands, seat: i, phase: i * 1.7 }
})

// ------------------------------------------------------------------------------------------------ the renderer
const renderer = new THREE.WebGPURenderer({ canvas, antialias: false })
renderer.setPixelRatio(1)
await renderer.init()
const backendName = (renderer.backend as { isWebGPUBackend?: boolean }).isWebGPUBackend ? 'WebGPU' : 'WebGL2 (sin WebGPU en este navegador)'

const retro = retroPass(scene, camera, { filterTextures: false })
const levels = uniform(18)
const ditherOn = uniform(1)
const look = Fn(() => {
  const c = retro.rgb
  // an ordered-ish dither on the pass's own (quarter-resolution) pixel grid, then a posterise: few colours, as in the game
  const px = floor(screenCoordinate.xy.div(4))
  const noise = fract(float(52.9829189).mul(fract(dot(px, vec2(0.06711056, 0.00583715)))))
  const lum = dot(c, vec3(0.3, 0.59, 0.11))
  const lit = smoothstep(0.03, 0.18, lum) // no dither speckle in the black
  const shifted = c.add(noise.sub(0.5).mul(ditherOn).mul(lit).div(levels))
  const q = floor(shifted.mul(levels).add(0.5)).div(levels)
  // a soft vignette: the room is dark and the lamp is the only thing
  const d = length(uv().sub(0.5))
  const vig = float(1).sub(smoothstep(0.35, 0.85, d).mul(0.75))
  return vec4(q.mul(vig), 1)
})
const pipeline = new THREE.RenderPipeline(renderer, look())
let retroOn = true
let ditherFlag = true
let paused = false

function resize() {
  const w = innerWidth
  const h = innerHeight
  renderer.setSize(w, h, false)
  camera.aspect = w / h
  camera.updateProjectionMatrix()
}
addEventListener('resize', resize)
resize()

const mouse = { x: 0, y: 0 }
addEventListener('pointermove', (e) => {
  mouse.x = (e.clientX / innerWidth) * 2 - 1
  mouse.y = (e.clientY / innerHeight) * 2 - 1
})
addEventListener('keydown', (e) => {
  if (e.key === 'r' || e.key === 'R') retroOn = !retroOn
  if (e.key === 'd' || e.key === 'D') {
    ditherFlag = !ditherFlag
    ditherOn.value = ditherFlag ? 1 : 0
  }
  if (e.key === ' ') paused = !paused
})

const clock = new THREE.Clock()
let tPaused = 0
const FPS = 12 // stop-motion, like a puppet
function frame() {
  const t = paused ? tPaused : clock.getElapsedTime()
  tPaused = t
  const ts = Math.floor(t * FPS) / FPS
  for (const p of players) {
    // the mask hangs in the air: a slow bob, a little turn, a lean toward whoever speaks
    p.mask.position.y = 1.22 + Math.sin(ts * 1.4 + p.phase) * 0.018
    p.mask.rotation.y = Math.sin(ts * 0.55 + p.phase) * 0.35
    p.mask.rotation.x = Math.sin(ts * 0.8 + p.phase * 2) * 0.06
    p.mask.rotation.z = Math.sin(ts * 0.45 + p.phase) * 0.05
    p.hands.forEach((h, k) => {
      const ph = p.phase + k * 2.3
      h.group.position.y = 0.95 + Math.sin(ts * 1.1 + ph) * 0.012
      h.group.position.x = (k ? 1 : -1) * 0.36 + Math.sin(ts * 0.6 + ph) * 0.02
      h.group.rotation.y = (k ? -1 : 1) * 0.25 + Math.sin(ts * 0.7 + ph) * 0.1
      // the fingers tap, now and then they close
      const tap = 0.25 + 0.2 * Math.max(0, Math.sin(ts * 2.4 + ph)) + 0.5 * Math.max(0, Math.sin(ts * 0.3 + ph * 3) - 0.6) * 2
      h.curl(Math.min(1, tap), 0.05)
    })
  }
  lamp.intensity = 24 + Math.sin(ts * 31) * 0.6 + (Math.sin(ts * 0.9) > 0.985 ? -8 : 0) // a tired lamp
  camera.position.x = mouse.x * 0.25
  camera.position.y = 1.28 - mouse.y * 0.1
  camera.lookAt(0, 1.0, -0.5)
  if (retroOn) pipeline.render()
  else renderer.render(scene, camera)
}
renderer.setAnimationLoop(frame)
info.textContent = `motor: ${backendName} · filtro PSX de three.js (RetroPassNode) + tramado y paleta reducida en TSL · three ${THREE.REVISION}`
Object.assign(window, { __lab: { pause: (v: boolean) => (paused = v), retro: (v: boolean) => (retroOn = v), dither: (v: boolean) => { ditherFlag = v; ditherOn.value = v ? 1 : 0 }, backend: backendName } })
