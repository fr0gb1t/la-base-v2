// A study of the multiplayer characters of Buckshot Roulette (development only: open /buckshot-lab.html on the
// dev server). Nothing of the game is in it. Built from the official Steam store clips (the multiplayer one:
// a player looks at a phone held in one hand and points at it with the other). What the reference shows, and
// what this reproduces, nothing more:
//   · the mask: a clay/bone skull with a wide rounded cranium, two big sunken black eye sockets (real holes, not
//     paint), a nose bridge, and a respirator over the lower face — a round valve in the middle and two filter
//     canisters at the sides, with concentric rings — held by a strap across the cheeks. Smooth and sculpted,
//     grimy, not faceted.
//   · the hands: big, chunky "sausage" fingers, the same clay as the mask, ending at the wrist (rounded, no arm,
//     no sleeve), floating near the mask.
//   · no body: only the dark around the mask and the hands.
//   · the image: very dark, a sepia / red-brown grade, heavy grain, low resolution, dithering.
//
// Rendering: three's WebGPURenderer (WebGL2 fallback) and the official PS1 chain from the three.js example
// `webgpu_postprocessing_retro` (retroPass → bayerDither → posterize → vignette), plus a sepia grade and film grain.
import * as THREE from 'three/webgpu'
import { Fn, float, vec3, uniform, mix, dot, smoothstep, positionLocal, vertexColor, mx_fractal_noise_float, renderOutput, posterize } from 'three/tsl'
import { retroPass } from 'three/addons/tsl/display/RetroPassNode.js'
import { bayerDither } from 'three/addons/tsl/math/Bayer.js'
import { vignette } from 'three/addons/tsl/display/CRT.js'
import { film } from 'three/addons/tsl/display/FilmNode.js'

const info = document.getElementById('info')!
const canvas = document.getElementById('c') as HTMLCanvasElement
const params = new URLSearchParams(location.search)

// ------------------------------------------------------------------------------------------------ material
// One clay for the mask, the respirator and the hands. The colour is a warm bone; the grade does the rest.
// Grime: a fractal noise on the object's own coordinates darkens it in blotches (like the reference's texture).
function clay(shade = 1) {
  const m = new THREE.MeshStandardNodeMaterial({ roughness: 0.92, metalness: 0, vertexColors: true })
  const base = vec3(0.78, 0.66, 0.56).mul(shade)
  const grime = mx_fractal_noise_float(positionLocal.mul(38), 3, 2.0, 0.5).mul(0.5).add(0.5) // 0..1
  const blotch = mx_fractal_noise_float(positionLocal.mul(9), 2, 2.0, 0.5).mul(0.5).add(0.5)
  m.colorNode = base.mul(vertexColor().rgb).mul(mix(float(0.72), float(1.04), grime)).mul(mix(float(0.8), float(1.0), blotch))
  return m
}
const black = new THREE.MeshBasicMaterial({ color: 0x050303 })

/** Paint a geometry white (vertex colours), so clay() shows its own colour. */
const white = (g: THREE.BufferGeometry) => {
  const n = g.attributes.position.count
  g.setAttribute('color', new THREE.Float32BufferAttribute(new Array(n * 3).fill(1), 3))
  return g
}

// ------------------------------------------------------------------------------------------------ the mask
// Faces −z. Built on a sphere whose vertices are moved: a wide cranium, a narrower lower face, two sockets pushed
// deep inward and painted black inside (vertex colours), and a nose bridge between them.
function skullGeometry() {
  const g = new THREE.SphereGeometry(1, 128, 96)
  const p = g.attributes.position
  const colors: number[] = []
  const SOCKETS = [-1, 1].map((sx) => ({ x: sx * 0.37, y: 0.17 }))
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i)
    let y = p.getY(i)
    let z = p.getZ(i)
    let shade = 1
    // the lower half narrows toward the jaw; the face is a little flatter than the back of the head
    if (y < 0) x *= 1 - 0.3 * Math.pow(-y, 1.4)
    if (z < 0) z *= 0.9
    // sockets: on the front, an ellipse each; inside it the surface sinks (deeper toward the centre) and goes black
    if (z < -0.2) {
      for (const s of SOCKETS) {
        const dx = (x - s.x) / 0.25
        const dy = (y - s.y) / 0.29
        const d = Math.sqrt(dx * dx + dy * dy)
        if (d < 1.15) {
          // a round-bottomed hollow, straight into the face (only depth changes: the outline stays a clean oval),
          // with a soft lip around it
          // a deep bowl with soft walls (a vertical wall would alias into a jagged edge)
          z *= 1 - 0.52 * (1 - THREE.MathUtils.smoothstep(d, 0.3, 1.1))
          shade = Math.min(shade, THREE.MathUtils.smoothstep(d, 0.78, 1.02))
        }
      }
      // the nose bridge: a soft ridge between the sockets
      const nx = x / 0.11
      const ny = (y - 0.02) / 0.2
      const nd = nx * nx + ny * ny
      if (nd < 1) z *= 1 + 0.06 * (1 - nd)
    }
    // the strap: a raised band on a tilted plane, low at the front (the respirator) and high at the back (the ears)
    const ux = p.getX(i)
    const uy = p.getY(i)
    const uz = p.getZ(i)
    const off = Math.abs(uy - (-0.13 + 0.24 * uz))
    if (off < 0.055 && uz > -0.75) {
      const w = 1 - off / 0.055
      const lift = 1 + 0.026 * THREE.MathUtils.smoothstep(w, 0, 0.6)
      x *= lift
      y *= lift
      z *= lift
      shade = Math.min(shade, 1 - 0.16 * THREE.MathUtils.smoothstep(w, 0, 0.6))
    }
    // the cheek panel under the eye, the "D" in the clip: an embossed outline on each side
    for (const sx of [-1, 1]) {
      const cx = sx * 0.7
      const cy = -0.36
      const cz = -0.62
      const chord = Math.hypot(ux - cx, uy - cy, uz - cz)
      if (chord > 0.17 && chord < 0.215) {
        const lift = 1 + 0.018 * Math.sin(((chord - 0.17) / 0.045) * Math.PI)
        x *= lift
        y *= lift
        z *= lift
        shade = Math.min(shade, 0.9)
      }
    }
    p.setXYZ(i, x * 0.145, y * 0.165, z * 0.15)
    colors.push(shade, shade, shade)
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  g.computeVertexNormals()
  return g
}

function respirator(mat: THREE.Material, dark: THREE.Material) {
  const r = new THREE.Group()
  // the body of the respirator, over the mouth and chin
  const body = new THREE.Mesh(white(new THREE.SphereGeometry(1, 32, 20)), mat)
  body.scale.set(0.075, 0.048, 0.045)
  body.position.set(0, -0.1, -0.108)
  r.add(body)
  // the round valve in the middle: a short cylinder, a raised ring on its face and a dark centre
  const valve = new THREE.Group()
  const can = new THREE.Mesh(white(new THREE.CylinderGeometry(0.022, 0.025, 0.03, 28)), mat)
  can.rotation.x = Math.PI / 2
  valve.add(can)
  const ring = new THREE.Mesh(white(new THREE.TorusGeometry(0.016, 0.004, 8, 28)), mat)
  ring.position.z = -0.016
  valve.add(ring)
  const hole = new THREE.Mesh(new THREE.CircleGeometry(0.009, 20), dark)
  hole.position.z = -0.0155
  hole.rotation.y = Math.PI
  valve.add(hole)
  valve.position.set(0, -0.122, -0.146)
  r.add(valve)
  // the two filter canisters, at the sides, pointing out, forward and a little down; concentric rings on the caps
  for (const sx of [-1, 1]) {
    const f = new THREE.Group()
    const c = new THREE.Mesh(white(new THREE.CylinderGeometry(0.04, 0.04, 0.05, 28)), mat)
    c.rotation.x = Math.PI / 2
    f.add(c)
    for (const rr of [0.032, 0.019]) {
      const t = new THREE.Mesh(white(new THREE.TorusGeometry(rr, 0.0035, 8, 28)), mat)
      t.position.z = -0.026
      f.add(t)
    }
    const cap = new THREE.Mesh(new THREE.CircleGeometry(0.008, 16), dark)
    cap.position.z = -0.0262
    cap.rotation.y = Math.PI
    f.add(cap)
    f.position.set(sx * 0.074, -0.108, -0.116)
    f.rotation.set(0.28, -sx * 0.62, 0) // the caps face out and forward, a little down
    r.add(f)
  }
  return r
}

function mask() {
  const g = new THREE.Group()
  const m = clay()
  g.add(new THREE.Mesh(skullGeometry(), m))
  g.add(respirator(clay(0.9), black))
  return g
}

// ------------------------------------------------------------------------------------------------ the hands
// Chunky, smooth, floating. The palm faces −y, the fingers point −z. Each finger is three capsules on joints
// that flex about their own axis; the thumb sits on its own plane near the wrist. `side` +1 = right hand.
interface Hand { group: THREE.Group; pose: (p: HandPose) => void }
interface HandPose { fingers: Array<[number, number, number]>; thumb: [number, number, number]; spread?: number }

const FINGERS = [
  // index, middle, ring, pinky: x of the knuckle (for a right hand: index on the thumb side, +x), z of the knuckle
  // (the knuckle line is an arc: middle furthest out), and the three phalanx lengths
  { x: 0.03, z: -0.05, len: [0.032, 0.024, 0.02] },
  { x: 0.01, z: -0.053, len: [0.035, 0.026, 0.021] },
  { x: -0.01, z: -0.05, len: [0.033, 0.024, 0.02] },
  { x: -0.029, z: -0.044, len: [0.026, 0.019, 0.017] },
]
const R = 0.0115 // finger thickness: chunky

function hand(side: 1 | -1, mat: THREE.Material): Hand {
  const group = new THREE.Group()
  // the palm: a rounded slab, a little bowed; the heel of the hand toward the wrist
  const palm = new THREE.Mesh(white(new THREE.SphereGeometry(1, 32, 20)), mat)
  palm.scale.set(0.05, 0.02, 0.054)
  palm.position.set(0, 0, -0.016)
  group.add(palm)
  // the wrist: it just ends, rounded (no arm, no sleeve)
  const wrist = new THREE.Mesh(white(new THREE.CapsuleGeometry(0.025, 0.012, 6, 16)), mat)
  wrist.rotation.x = Math.PI / 2
  wrist.scale.set(1.25, 1, 0.75)
  wrist.position.set(0, 0, 0.03)
  group.add(wrist)
  const chains = FINGERS.map((f) => {
    const base = new THREE.Group()
    base.position.set(side * f.x, 0, f.z)
    group.add(base)
    let parent: THREE.Object3D = base
    return f.len.map((L, j) => {
      const joint = new THREE.Group()
      if (j > 0) joint.position.z = -f.len[j - 1]
      const seg = new THREE.Mesh(white(new THREE.CapsuleGeometry(R * (1 - j * 0.08), L, 6, 12)), mat)
      seg.rotation.x = Math.PI / 2
      seg.position.z = -L / 2
      joint.add(seg)
      parent.add(joint)
      parent = joint
      return joint
    })
  })
  // the thumb: from the heel of the palm on the index side, turned out to its own plane
  const tBase = new THREE.Group()
  tBase.position.set(side * 0.038, -0.004, -0.004)
  tBase.rotation.set(0, side * 0.75, side * 0.9) // roughly sideways, its nail facing away from the other nails
  group.add(tBase)
  let tp: THREE.Object3D = tBase
  const thumb = [0.026, 0.022, 0.019].map((L, j, all) => {
    const joint = new THREE.Group()
    if (j > 0) joint.position.z = -all[j - 1]
    const seg = new THREE.Mesh(white(new THREE.CapsuleGeometry(R * 1.12, L, 6, 12)), mat)
    seg.rotation.x = Math.PI / 2
    seg.position.z = -L / 2
    joint.add(seg)
    tp.add(joint)
    tp = joint
    return joint
  })
  // flexion is about the joint's x axis: negative = toward the palm (the palm faces −y)
  const pose = (p: HandPose) => {
    chains.forEach((c, i) => {
      const [m, pi, d] = p.fingers[i]
      c[0].rotation.set(-m, side * ((i - 1.2) * (p.spread ?? 0.04)), 0)
      c[1].rotation.x = -pi
      c[2].rotation.x = -d
    })
    thumb[0].rotation.x = -p.thumb[0]
    thumb[1].rotation.x = -p.thumb[1]
    thumb[2].rotation.x = -p.thumb[2]
  }
  return { group, pose }
}

// reference poses (radians: MCP, PIP, DIP), from the hand table of the modeling skill
const POINT: HandPose = { fingers: [[0.05, 0.05, 0.05], [1.35, 1.6, 0.9], [1.45, 1.6, 0.9], [1.5, 1.55, 0.9]], thumb: [0.4, 0.7, 0.5] }
const HOLD: HandPose = { fingers: [[1.05, 1.15, 0.6], [1.15, 1.2, 0.65], [1.25, 1.2, 0.65], [1.3, 1.15, 0.6]], thumb: [0.25, 0.35, 0.25], spread: 0.02 }
const REST: HandPose = { fingers: [[0.24, 0.45, 0.3], [0.32, 0.5, 0.33], [0.4, 0.55, 0.36], [0.48, 0.6, 0.4]], thumb: [0.15, 0.25, 0.2], spread: 0.05 }

// ------------------------------------------------------------------------------------------------ the scene
const scene = new THREE.Scene()
scene.background = new THREE.Color(0x070404)
const camera = new THREE.PerspectiveCamera(38, 1, 0.02, 20)

// lighting: a warm key from above and to one side, a weak fill, almost no ambient (the dark is the point)
scene.add(new THREE.AmbientLight(0xffe2cc, 0.06))
const key = new THREE.SpotLight(0xffd9b0, 9, 6, 0.55, 0.75, 1.6)
key.position.set(-0.7, 1.3, -1.1) // above, from the camera's right: the shadow side of the mask falls to the left
scene.add(key, key.target)
const fill = new THREE.PointLight(0xc89c88, 0.35, 4, 1.6)
fill.position.set(-1, 0.4, -0.8)
scene.add(fill)

// a dim wall behind, so the dark has a little depth (the reference room is never pure black)
const wall = new THREE.Mesh(new THREE.PlaneGeometry(8, 5), new THREE.MeshStandardMaterial({ color: 0x241614, roughness: 1 }))
wall.position.set(0, 0.5, 1.4)
wall.rotation.y = Math.PI
scene.add(wall)

/** A player: the mask, and the two hands floating in front of it. */
function player() {
  const root = new THREE.Group()
  const m = mask()
  root.add(m)
  const mat = clay()
  const right = hand(1, mat)
  const left = hand(-1, mat)
  root.add(right.group, left.group)
  return { root, mask: m, right, left }
}

// close-up, as in the reference: the mask turned to a phone held in the right hand, the left hand pointing at it
const A = player()
scene.add(A.root)
// the phone, in the right hand's own frame: after the hand is turned palm-to-the-side (below), its local x is up, so the
// phone's long side is along local x; it lies under the palm (−y) where the fingers can close over it
const phone = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.013, 0.052), new THREE.MeshStandardMaterial({ color: 0x1a1414, roughness: 0.6 }))
A.right.group.add(phone)
phone.position.set(0.045, -0.032, -0.035) // its top half shows above the fingers

// ------------------------------------------------------------------------------------------------ the renderer
const renderer = new THREE.WebGPURenderer({ canvas, antialias: false, forceWebGL: params.has('webgl') })
renderer.setPixelRatio(1)
await renderer.init()
const isWebGPU = (renderer.backend as { isWebGPUBackend?: boolean }).isWebGPUBackend === true
renderer.toneMapping = THREE.AgXToneMapping
Object.assign(window, { __renderer: renderer })

// the official PS1 chain, then the reference's grade and grain (on display-referred colour, as the skill says)
const retro = retroPass(scene, camera)
const steps = uniform(28)
const sepia = uniform(0.82)
// (TSL's typings are stricter than its runtime: the chain is typed loosely; what matters is that it renders)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const grade = Fn(([c]: any[]) => {
  const col = vec3(c)
  const l = dot(col, vec3(0.299, 0.587, 0.114))
  // a two-colour ramp, dark red-brown to a dusty pink-cream, mixed with what is there
  const ramp = mix(vec3(0.05, 0.02, 0.02), vec3(0.86, 0.72, 0.64), smoothstep(0.0, 0.85, l))
  return mix(col, ramp, sepia)
})
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let chain: any = renderOutput(retro)
chain = grade(chain)
chain = bayerDither(chain, steps)
chain = posterize(chain, steps)
chain = vignette(chain, float(0.45), float(0.55))
chain = film(chain, float(0.35))
const pipeline = new THREE.RenderPipeline(renderer)
pipeline.outputColorTransform = false
pipeline.outputNode = chain
let retroOn = true

function resize() {
  renderer.setSize(innerWidth, innerHeight, false)
  camera.aspect = innerWidth / innerHeight
  camera.updateProjectionMatrix()
}
addEventListener('resize', resize)
resize()

let paused = false
let orbit = 0
const debugViews = params.has('debug')
const dbgCam = new THREE.PerspectiveCamera(30, 1, 0.02, 20)
/** Four views of the character (front, three-quarters, side, top), to check the shapes without the filter. */
function renderDebug() {
  const W = innerWidth
  const H = innerHeight
  renderer.setScissorTest(true)
  const views: Array<[number, number, number]> = [[0, 0, -1], [-0.7, 0.1, -0.7], [-1, 0, 0], [0, 1, -0.05]]
  views.forEach(([x, y, z], i) => {
    const vx = (i % 2) * (W / 2)
    const vy = (i < 2 ? 1 : 0) * (H / 2)
    renderer.setViewport(vx, vy, W / 2, H / 2)
    renderer.setScissor(vx, vy, W / 2, H / 2)
    dbgCam.aspect = W / H
    dbgCam.updateProjectionMatrix()
    dbgCam.position.set(x * 1.0, y * 1.0 - 0.06, z * 1.0)
    dbgCam.lookAt(-0.05, -0.08, -0.05)
    renderer.render(scene, dbgCam)
  })
  renderer.setScissorTest(false)
}
addEventListener('keydown', (e) => {
  if (e.key === 'r' || e.key === 'R') retroOn = !retroOn
  if (e.key === ' ') paused = !paused
})
let drag = false
let lastX = 0
addEventListener('pointerdown', (e) => { drag = true; lastX = e.clientX })
addEventListener('pointerup', () => (drag = false))
addEventListener('pointermove', (e) => { if (drag) { orbit += (e.clientX - lastX) * 0.006; lastX = e.clientX } })

const timer = new THREE.Timer()
let tFrozen = 0
const FPS = 15 // stop-motion
renderer.setAnimationLoop((now) => {
  timer.update(now)
  const t = paused ? tFrozen : timer.getElapsed()
  tFrozen = t
  const ts = Math.floor(t * FPS) / FPS
  // the close-up, as in the clip: the mask bowed and turned toward the phone (screen right), the right hand holding the
  // phone upright at chest height, the left hand pointing at it
  A.mask.position.set(0.02, 0.05 + Math.sin(ts * 1.2) * 0.004, 0)
  A.mask.rotation.set(-0.38 + Math.sin(ts * 0.7) * 0.02, 0.62 + Math.sin(ts * 0.4) * 0.04, -0.08, 'YXZ')
  A.right.group.position.set(-0.17, -0.2 + Math.sin(ts * 1.1 + 1) * 0.004, -0.17)
  A.right.group.rotation.set(-0.35, 0.25, Math.PI / 2, 'YXZ') // palm toward the phone (+x), thumb up, fingers toward you
  A.right.pose(HOLD)
  A.left.group.position.set(-0.01 + Math.sin(ts * 1.6) * 0.004, -0.2, -0.22)
  A.left.group.rotation.set(0.35, Math.PI / 2 + 0.2, 0, 'YXZ') // fingers toward −x (the phone), a little up
  A.left.pose(ts % 5 < 4 ? POINT : REST) // it points, rests a moment, points again
  const r = 0.86
  const a = -0.12 + orbit
  camera.position.set(Math.sin(a) * r, 0.0, -Math.cos(a) * r)
  camera.lookAt(-0.05, -0.08, 0)
  if (debugViews) {
    renderDebug()
    return
  }
  if (retroOn) pipeline.render()
  else renderer.render(scene, camera)
})

info.textContent = `${isWebGPU ? 'WebGPU' : 'WebGL2 (respaldo)'} · cadena PS1 oficial de three.js (retroPass, bayerDither, posterize, viñeta) + gradación sepia y grano · three ${THREE.REVISION}`
Object.assign(window, { __lab: { pause: (v: boolean) => (paused = v), retro: (v: boolean) => (retroOn = v), orbit: (v: number) => (orbit = v), backend: isWebGPU ? 'WebGPU' : 'WebGL2' } })
