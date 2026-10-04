// The señas on the new characters (development only: open /senas-lab.html on the dev server). Three heads floating
// over the table, each making the eleven señas of the game through the same call the game uses, sena(s, amount):
//  · a robot whose face is a matrix of LEDs — the seña is drawn in light, so it reads from anywhere at the table;
//  · the carnival devil — eyelids and brows are loose pieces on hinges, the mouth gestures are sculpted blend shapes;
//  · the rooster — lids, brow feathers and the two halves of the beak are pieces, the beak twists, opens, purses.
// "Right" is the signer's own right: +x, since every head looks down −z (as in the game's avatar).
import * as THREE from 'three/webgpu'
import { Fn, float, vec2, vec3, uniform, mix, dot, length, fract, floor, smoothstep, uv, texture, renderOutput, posterize } from 'three/tsl'
import { retroPass } from 'three/addons/tsl/display/RetroPassNode.js'
import { bayerDither } from 'three/addons/tsl/math/Bayer.js'
import { vignette } from 'three/addons/tsl/display/CRT.js'
import { film } from 'three/addons/tsl/display/FilmNode.js'
import { SENAS, isHeadSena, type Sena } from '@la-base/shared'
import { sculpt, withGestures, ball, ell, cone, chain, box, ring, both, col, mixc, noise3, type Model, type V3 } from './sculpt'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type N = any

const canvas = document.getElementById('c') as HTMLCanvasElement
const label = document.getElementById('label')!
const params = new URLSearchParams(location.search)

interface Rig {
  name: string
  head: THREE.Group
  sena(s: Sena | null, k: number, t: number): void
}

const clay = (rough = 0.6) => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: rough })
const lerp = THREE.MathUtils.lerp

/** A piece sculpted in head space but turning about its own pivot: its geometry is moved so the pivot is the origin. */
function piece(m: Model, lo: V3, hi: V3, pivot: V3, cell = 0.0025, rough = 0.6) {
  const g = sculpt(m, lo, hi, cell)
  g.translate(-pivot[0], -pivot[1], -pivot[2])
  const mesh = new THREE.Mesh(g, clay(rough))
  mesh.position.set(...pivot)
  return mesh
}

/** An eyelid: a cap of a sphere round the eyeball, open (tucked up and back) at 0 and shut at 1. */
function lid(r: number, color: number) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color, roughness: 0.55 }))
  const set = (k: number) => (m.rotation.x = lerp(1.05, -1.57, k))
  set(0)
  return { m, set }
}

// ------------------------------------------------------------------------------------------------ 1 · the LED robot
// A helmet of dark metal with a chrome rim round an oval visor. Behind the glass, a matrix of 22 × 26 LEDs: a tiny
// canvas is redrawn every frame (eyes, brows, mouth) and each LED lights with the colour of its pixel.
const COLS = 22
const ROWS = 26

function robot(): Rig {
  const C: V3 = [0, 0.01, 0.01]
  const R: V3 = [0.088, 0.112, 0.1]
  const surfZ = (x: number, y: number) => C[2] - R[2] * Math.sqrt(Math.max(0, 1 - (x / R[0]) ** 2 - ((y - C[1]) / R[1]) ** 2))
  const VX = 0.066
  const VY = 0.082
  const VC = -0.008 // visor centre height
  const metal = col(0x1b1d24)
  const chrome = col(0x9da2ab)
  const rim: V3[] = Array.from({ length: 49 }, (_, i) => {
    const a = (i / 48) * Math.PI * 2
    const x = (VX + 0.004) * Math.cos(a)
    const y = VC + (VY + 0.004) * Math.sin(a)
    return [x, y, surfZ(x, y) - 0.001]
  })
  const crest: V3[] = Array.from({ length: 9 }, (_, i) => {
    const t = -0.45 + i * 0.3
    return [0, C[1] + (R[1] + 0.002) * Math.cos(t), C[2] + (R[2] + 0.002) * Math.sin(t)]
  })
  const helmet: Model = {
    parts: [
      ell(C, R, metal),
      ell([0, -0.07, 0.015], [0.07, 0.05, 0.07], metal, 0.03),
      ...both((s) => cone([s * 0.078, 0.0, 0.012], [s * 0.098, 0.0, 0.012], 0.032, 0.029, metal, 0.01)),
      ...both((s) => ring([s * 0.099, 0.0, 0.012], 0.024, 0.024, 0.0035, chrome, 0.003, false, [0, Math.PI / 2, 0])),
      ...chain(rim, Array(49).fill(0.0048), chrome, 0.004),
      ...chain(crest, Array(9).fill(0.004), chrome, 0.006),
    ],
    disp: (x, y, z) => noise3(x * 90, y * 90, z * 90) * 0.0003,
    ao: 0.8,
  }
  const head = new THREE.Group()
  head.add(new THREE.Mesh(sculpt(helmet, [-0.12, -0.14, -0.12], [0.12, 0.14, 0.13], 0.003), clay(0.28)))

  // the visor: an oval patch laid on the helmet's curve, a polar grid so the edge is clean
  const RINGS = 18
  const SEGS = 64
  const vpos: number[] = []
  const vuv: number[] = []
  const vidx: number[] = []
  for (let i = 0; i <= RINGS; i++) {
    const r = i / RINGS
    for (let j = 0; j < SEGS; j++) {
      const a = (j / SEGS) * Math.PI * 2
      const x = VX * r * Math.cos(a)
      const y = VC + VY * r * Math.sin(a)
      vpos.push(x, y, surfZ(x, y) - 0.0015)
      vuv.push(0.5 + 0.5 * r * Math.cos(a), 0.5 + 0.5 * r * Math.sin(a))
    }
  }
  for (let i = 0; i < RINGS; i++) {
    for (let j = 0; j < SEGS; j++) {
      const a = i * SEGS + j
      const b = i * SEGS + ((j + 1) % SEGS)
      vidx.push(a, a + SEGS, b, b, a + SEGS, b + SEGS)
    }
  }
  const vg = new THREE.BufferGeometry()
  vg.setAttribute('position', new THREE.Float32BufferAttribute(vpos, 3))
  vg.setAttribute('uv', new THREE.Float32BufferAttribute(vuv, 2))
  vg.setIndex(vidx)
  vg.computeVertexNormals()
  // the face, one pixel per LED
  const face = document.createElement('canvas')
  face.width = COLS
  face.height = ROWS
  const g = face.getContext('2d')!
  const ftex = new THREE.CanvasTexture(face)
  ftex.magFilter = THREE.NearestFilter
  ftex.minFilter = THREE.NearestFilter
  ftex.colorSpace = THREE.SRGBColorSpace
  const ledMat = new THREE.MeshBasicNodeMaterial({ side: THREE.DoubleSide })
  const grid = vec2(COLS, ROWS)
  const cell: N = floor(uv().mul(grid))
  const f: N = fract(uv().mul(grid)).sub(0.5)
  const led = float(1).sub(smoothstep(0.26, 0.42, length(f)))
  const lit: N = texture(ftex, cell.add(0.5).div(grid)).rgb
  // dark glass, each LED a faint dot when off, its colour (and a little bleed round it) when on
  ledMat.colorNode = vec3(0.012, 0.013, 0.018).add(vec3(0.03, 0.032, 0.04).mul(led)).add(lit.mul(led.mul(2.4).add(0.18)))
  const visor = new THREE.Mesh(vg, ledMat)
  head.add(visor)
  const glow = new THREE.PointLight(0x62f0ff, 0.25, 0.6, 2)
  glow.position.set(0, -0.01, -0.14)
  head.add(glow)

  // ---- drawing on the matrix: x grows to the signer's right (canvas right is +x), y down
  const EYE = '#62f0ff'
  const BROW = '#d8fbff'
  const MOUTH = '#ff5a8a'
  const TOOTH = '#ffffff'
  const px = (x: number, y: number, c: string) => {
    g.fillStyle = c
    g.fillRect(Math.round(x), Math.round(y), 1, 1)
  }
  const rect = (x: number, y: number, w: number, h: number, c: string) => {
    g.fillStyle = c
    g.fillRect(Math.round(x), Math.round(y), Math.max(1, Math.round(w)), Math.max(1, Math.round(h)))
  }
  const line = (x0: number, y0: number, x1: number, y1: number, c: string) => {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1)
    for (let i = 0; i <= n; i++) px(lerp(x0, x1, i / n), lerp(y0, y1, i / n), c)
  }
  const eye = (cx: number, cy: number, open: number) => {
    // a rounded block; shut it is a line (with the corners down, like a closed eye)
    const h = Math.round(lerp(1, 5, open))
    if (h <= 1) {
      line(cx - 2, cy + 1, cx + 2, cy + 1, EYE)
      px(cx - 3, cy + 2, EYE)
      px(cx + 3, cy + 2, EYE)
      return
    }
    rect(cx - 2, cy + 3 - h, 5, h, EYE)
    if (h >= 4) {
      g.clearRect(Math.round(cx - 2), Math.round(cy + 3 - h), 1, 1)
      g.clearRect(Math.round(cx + 2), Math.round(cy + 3 - h), 1, 1)
      g.clearRect(Math.round(cx - 2), Math.round(cy + 2), 1, 1)
      g.clearRect(Math.round(cx + 2), Math.round(cy + 2), 1, 1)
    }
  }
  const L = { x: 6, y: 9 } // the signer's left eye (canvas left)
  const Rr = { x: 15, y: 9 }

  function sena(s: Sena | null, amount: number, t: number) {
    const k = s ? amount : 0
    g.clearRect(0, 0, COLS, ROWS)
    const blink = Math.sin(t * 1.7) > 0.985 ? 0 : 1 // now and then, an idle blink
    // eyes and brows
    let openL = blink
    let openR = blink
    let browL = 0
    let browR = 0
    let tiltR = 0
    if (s === 'nada') openL = openR = 1 - k
    if (s === 'ancho-basto') {
      openR = 1 - k
      browR = -1.5 * k
      tiltR = k
    }
    if (s === 'ancho-espada') browL = browR = 3 * k
    eye(L.x, L.y, openL)
    eye(Rr.x, Rr.y, openR)
    for (const dy of [0, 1]) {
      line(L.x - 3, L.y - 4 - browL + dy, L.x + 2, L.y - 4 - browL + dy, BROW)
      line(Rr.x - 2, Rr.y - 4 - browR + tiltR + dy, Rr.x + 3, Rr.y - 4 - browR - tiltR + dy, BROW)
    }
    // the mouth, from a slight smile at rest to each seña
    const my = 18
    if (s === 'ancho-copa' || s === 'ancho-oro') {
      const side = s === 'ancho-copa' ? 1 : -1
      const dx = side * 4 * k
      const x0 = 8 + dx
      const x1 = 13 + dx
      // a crooked smirk: the line slides to that side and that end lifts
      line(x0, my + (side < 0 ? -2 * k : 0), x1, my + (side > 0 ? -2 * k : 0), MOUTH)
      px(side > 0 ? x1 + 1 : x0 - 1, my - 1 - 2 * k, MOUTH)
    } else if (s === 'figuras') {
      const half = lerp(4, 8, k)
      line(11 - half, my, 10 + half, my, MOUTH)
      px(11 - half - 1, my - 1, MOUTH)
      px(10 + half + 1, my - 1, MOUTH)
    } else if (s === 'tres') {
      // the lower lip pulled in under two front teeth
      line(7, my + 1, 14, my + 1, MOUTH)
      line(8, my + 2, 13, my + 2, MOUTH)
      if (k > 0.2) {
        rect(9, my - 1, 1, 1 + Math.round(2 * k), TOOTH)
        rect(12, my - 1, 1, 1 + Math.round(2 * k), TOOTH)
        line(9, my - 1, 12, my - 1, TOOTH)
      }
    } else if (s === 'dos') {
      // a kiss: the mouth gathers into a small round pucker, and a heart floats up from it
      const w = Math.round(lerp(6, 3, k))
      if (k < 0.5) line(11 - w, my, 10 + w, my, MOUTH)
      else {
        rect(9, my - 1, 4, 1, MOUTH)
        rect(9, my + 2, 4, 1, MOUTH)
        rect(8, my, 1, 2, MOUTH)
        rect(13, my, 1, 2, MOUTH)
        const hy = my - 4 - ((t * 6) % 5)
        ;[[0, 0], [2, 0], [-1, 1], [0, 1], [1, 1], [2, 1], [3, 1], [0, 2], [1, 2], [2, 2], [1, 3]].forEach(([a, b]) => px(15 + a, hy + b, MOUTH))
      }
    } else if (s === 'porno') {
      // a fish: a round mouth opening and closing
      const o = k * (0.55 + 0.45 * Math.sin(t * 9))
      const h = Math.round(lerp(1, 5, o))
      const w = Math.round(lerp(6, 4, o))
      rect(11 - w / 2 - 1, my - h / 2, w + 2, 1, MOUTH)
      rect(11 - w / 2 - 1, my + h / 2, w + 2, 1, MOUTH)
      rect(11 - w / 2 - 1, my - h / 2, 1, h, MOUTH)
      rect(10 + w / 2 + 1, my - h / 2, 1, h + 1, MOUTH)
    } else {
      line(8, my, 13, my, MOUTH)
      px(7, my - 1, MOUTH)
      px(14, my - 1, MOUTH)
    }
    ftex.needsUpdate = true
    glow.intensity = 0.25
  }
  return { name: 'Robot de LEDs', head, sena }
}

// ------------------------------------------------------------------------------------------------ 2 · the devil
function devil(): Rig {
  const red = col(0xa3241a)
  const black = col(0x14100e)
  const gold = col(0xb38b2c)
  const white = col(0xe8e0cc)
  const mouthC = col(0x2a0806)
  const lip = col(0x7e1812)
  interface MouthPose { c: V3; r: V3; rz: number; bite: number }
  const REST: MouthPose = { c: [0, -0.058, -0.075], r: [0.056, 0.022, 0.035], rz: 0, bite: 0 }
  const model = (mp: MouthPose): Model => {
    return {
      parts: [
        ell([0, 0.025, 0.0], [0.078, 0.105, 0.075], red),
        ell([0, 0.075, 0.03], [0.074, 0.065, 0.068], black, 0.02),
        ...both((s) => cone([s * 0.074, 0.03, 0.0], [s * 0.115, 0.075, 0.02], 0.016, 0.003, red, 0.012)),
        ...both((s) => ball([s * 0.034, 0.028, -0.072], 0.022, white, 0.008)),
        cone([0, 0.04, -0.08], [0, -0.008, -0.108], 0.011, 0.017, red, 0.012),
        ...both((s) => ball([s * 0.014, -0.012, -0.1], 0.011, red, 0.008)),
        ...both((s) => ell([s * 0.048, -0.022, -0.055], [0.03, 0.026, 0.026], red, 0.02)),
        ell(mp.c, mp.r, mouthC, 0.006, true, [0, 0, mp.rz]),
        ...(mp.bite ? [ell([mp.c[0], mp.c[1] - 0.012, -0.078], [0.042, 0.009, 0.014], lip, 0.006)] : []),
        ...both((s) => chain([[s * 0.045, 0.1, -0.03], [s * 0.07, 0.15, -0.035], [s * 0.078, 0.2, -0.015], [s * 0.07, 0.23, 0.01]], [0.018, 0.012, 0.007, 0.002], gold, 0.008)),
        ball([0, 0.092, -0.068], 0.012, gold, 0.006),
      ],
      paint: (x, y, _z, c) => {
        const sw = Math.abs(Math.sin(Math.hypot(Math.abs(x) - 0.05, y + 0.02) * 260))
        return Math.abs(x) > 0.03 && y < 0.0 && y > -0.045 && sw < 0.18 && c[0] > c[1] * 3 ? mixc(c, gold, 0.85) : c
      },
    }
  }
  // the gestures, in the order the morph influences use them
  const POSES: MouthPose[] = [
    { ...REST, c: [0.022, -0.055, -0.075], r: [0.042, 0.018, 0.035], rz: 0.25 }, // lips to the right
    { ...REST, c: [-0.022, -0.055, -0.075], r: [0.042, 0.018, 0.035], rz: -0.25 }, // lips to the left
    { ...REST, r: [0.074, 0.011, 0.035] }, // stretched to both sides
    { ...REST, c: [0, -0.058, -0.075], r: [0.05, 0.007, 0.03], bite: 1 }, // biting the lower lip
    { ...REST, r: [0.012, 0.011, 0.03] }, // a kiss
    { ...REST, c: [0, -0.064, -0.075], r: [0.028, 0.03, 0.035] }, // a fish
  ]
  const lo: V3 = [-0.13, -0.12, -0.15]
  const hi: V3 = [0.13, 0.24, 0.12]
  const geo = withGestures(sculpt(model(REST), lo, hi, 0.003), POSES.map(model))
  const face = new THREE.Mesh(geo, clay(0.6))
  face.morphTargetInfluences = POSES.map(() => 0)
  const head = new THREE.Group()
  head.add(face)
  // brows: black bars that lift and tilt, lids of red over the bulging eyes, the pupils on the eyes
  const brows = [1, -1].map((s) => {
    const c: V3 = [s * 0.038, 0.061, -0.066]
    const b = piece({ parts: [cone([s * 0.065, 0.07, -0.045], [s * 0.012, 0.052, -0.083], 0.017, 0.012, black, 0)] }, [s > 0 ? 0.0 : -0.09, 0.03, -0.1], [s > 0 ? 0.09 : 0.0, 0.095, -0.025], c, 0.0022, 0.5)
    head.add(b)
    return { b, c, s }
  })
  // the teeth: one rigid piece that follows the mouth (a sculpted gesture would tear them)
  const MC: V3 = [0, -0.058, -0.075]
  const teeth = piece(
    {
      parts: [
        ...Array.from({ length: 9 }, (_, i) => {
          const u = i - 4
          return box([u * 0.0105, MC[1] + 0.012, -0.086 + u * u * 0.0011], [0.0044, 0.0065, 0.004], 0.0015, white, 0.002, false, [0, u * 0.12, 0])
        }),
        ...both((s) => cone([s * 0.034, MC[1] + 0.008, -0.084], [s * 0.032, MC[1] - 0.01, -0.085], 0.0052, 0.0015, white, 0.002)),
      ],
    },
    [-0.06, -0.085, -0.1],
    [0.06, -0.035, -0.06],
    MC,
    0.0015,
    0.4,
  )
  head.add(teeth)
  // the kiss: puckered lips pushed out of the mouth
  const pucker = new THREE.Mesh(new THREE.TorusGeometry(0.013, 0.0085, 10, 20), new THREE.MeshStandardMaterial({ color: 0xb02a22, roughness: 0.45 }))
  pucker.position.set(0, -0.06, -0.094)
  pucker.scale.set(1, 0.85, 1)
  head.add(pucker)
  const lids = [1, -1].map((s) => {
    const e = new THREE.Group()
    e.position.set(s * 0.034, 0.028, -0.072)
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.0085, 12, 8), new THREE.MeshStandardMaterial({ color: 0x0a0806, roughness: 0.15 }))
    pupil.position.z = -0.019
    pupil.scale.z = 0.5
    const l = lid(0.0235, 0xa3241a)
    e.add(pupil, l.m)
    head.add(e)
    return { ...l, s }
  })
  const IDX: Partial<Record<Sena, number>> = { 'ancho-copa': 0, 'ancho-oro': 1, figuras: 2, tres: 3, dos: 4, porno: 5 }
  function sena(s: Sena | null, amount: number, t: number) {
    const k = s ? amount : 0
    face.morphTargetInfluences!.fill(0)
    const i = s ? IDX[s] : undefined
    const o = s === 'porno' ? k * (0.55 + 0.45 * Math.sin(t * 9)) : k
    if (i !== undefined) face.morphTargetInfluences![i] = o
    // the teeth go where the mouth goes: aside, wide, biting down over the lip, or back out of sight
    teeth.position.set(...MC)
    teeth.rotation.set(0, 0, 0)
    teeth.scale.set(1, 1, 1)
    if (s === 'ancho-copa' || s === 'ancho-oro') {
      const side = s === 'ancho-copa' ? 1 : -1
      teeth.position.x = side * 0.022 * k
      teeth.position.y = MC[1] + 0.003 * k
      teeth.rotation.z = side * 0.25 * k
      teeth.scale.x = 1 - 0.25 * k
    }
    if (s === 'figuras') teeth.scale.set(1 + 0.3 * k, 1 - 0.3 * k, 1)
    if (s === 'tres') teeth.position.set(0, MC[1] - 0.007 * k, MC[2] - 0.003 * k)
    if (s === 'dos' || s === 'porno') {
      teeth.position.z = MC[2] + 0.03 * o
      teeth.scale.x = 1 - 0.5 * o
    }
    teeth.visible = !(s === 'dos' && k > 0.4)
    pucker.visible = s === 'dos' && k > 0.05
    pucker.position.z = -0.084 - 0.012 * k
    pucker.scale.setScalar(Math.max(0.01, k))
    const blink = Math.sin(t * 1.7 + 1) > 0.985 ? 1 : 0
    lids.forEach((l) => l.set(s === 'nada' ? k : s === 'ancho-basto' && l.s > 0 ? k : blink))
    brows.forEach(({ b, c, s: side }) => {
      b.position.set(c[0], c[1], c[2])
      b.rotation.z = 0
      if (s === 'ancho-espada') b.position.y = c[1] + 0.02 * k
      if (s === 'ancho-basto' && side > 0) {
        b.position.y = c[1] - 0.006 * k
        b.rotation.z = 0.3 * k
      }
    })
  }
  return { name: 'Diablo', head, sena }
}

// ------------------------------------------------------------------------------------------------ 3 · the rooster
function rooster(): Rig {
  const red = col(0x8e231c)
  const feathers: (x: number, y: number, z: number) => V3 = (x, y, z) => mixc(col(0x6b3b1c), col(0x1d2a22), Math.max(0, Math.min(1, 0.5 + noise3(x * 25, y * 25, z * 25))))
  const beakC = col(0xc8ae74)
  const dark = col(0x120c0a)
  const head = new THREE.Group()
  const base: Model = {
    parts: [
      ell([0, 0.04, 0.03], [0.062, 0.074, 0.075], feathers),
      ell([0, 0.02, -0.025], [0.054, 0.058, 0.042], red, 0.03),
      ...[0, 1, 2, 3, 4, 5].map((i) => ball([0, 0.1 + [0.0, 0.03, 0.048, 0.055, 0.045, 0.022][i], -0.07 + i * 0.026], [0.017, 0.019, 0.021, 0.021, 0.019, 0.016][i], red, 0.024)),
      cone([0, 0.085, -0.075], [0, 0.12, 0.06], 0.016, 0.014, red, 0.02),
      ...both((s) => ell([s * 0.013, -0.058, -0.072], [0.012, 0.026, 0.012], red, 0.012)),
      ...both((s) => ell([s * 0.052, -0.002, -0.022], [0.006, 0.014, 0.012], col(0xe6dccb), 0.006)),
      ...both((s) => ell([s * 0.042, 0.042, -0.045], [0.015, 0.015, 0.013], dark, 0.006, true)),
      ell([0, 0.004, -0.058], [0.02, 0.016, 0.012], dark, 0.004, true), // where the beak sits
      ...Array.from({ length: 10 }, (_, i) => {
        const a = (i / 10) * Math.PI * 2
        return ell([Math.sin(a) * 0.055, -0.075, Math.cos(a) * 0.05 + 0.02], [0.022, 0.04, 0.018], feathers, 0.02, false, [0.3 * Math.cos(a), a, 0])
      }),
    ],
    disp: (x, y, z) => noise3(x * 70, y * 70, z * 70) * 0.001,
  }
  head.add(new THREE.Mesh(sculpt(base, [-0.1, -0.12, -0.12], [0.1, 0.23, 0.13], 0.003), clay(0.6)))
  // the beak: a group that twists and purses, its two halves hinged at the base
  const beak = new THREE.Group()
  beak.position.set(0, 0.004, -0.056)
  const B = (p: V3): V3 => [p[0], p[1] - 0.004, p[2] + 0.056] // head space to beak space
  const upper = piece({ parts: chain([B([0, 0.016, -0.06]), B([0, 0.006, -0.1]), B([0, -0.008, -0.128]), B([0, -0.022, -0.132])], [0.02, 0.012, 0.005, 0.002], beakC, 0.006) }, [-0.03, -0.04, -0.09], [0.03, 0.035, 0.0], [0, 0.008, -0.002], 0.0018, 0.45)
  const lower = piece({ parts: chain([B([0, -0.006, -0.058]), B([0, -0.014, -0.09]), B([0, -0.016, -0.11])], [0.015, 0.008, 0.003], beakC, 0.006) }, [-0.03, -0.04, -0.07], [0.03, 0.02, 0.01], [0, -0.008, -0.002], 0.0018, 0.45)
  beak.add(upper, lower)
  head.add(beak)
  // eyes looking sideways, each with a lid of red skin; tufts of feather for brows
  const lids = [1, -1].map((s) => {
    const e = new THREE.Group()
    e.position.set(s * 0.04, 0.042, -0.046)
    e.rotation.y = s * 0.75
    e.add(new THREE.Mesh(new THREE.SphereGeometry(0.0115, 20, 14), new THREE.MeshStandardMaterial({ color: 0xd0861a, roughness: 0.12 })))
    const p = new THREE.Mesh(new THREE.SphereGeometry(0.0045, 10, 8), new THREE.MeshStandardMaterial({ color: 0x050403, roughness: 0.1 }))
    p.position.z = -0.0105
    p.scale.z = 0.4
    const l = lid(0.0128, 0x8e231c)
    e.add(p, l.m)
    head.add(e)
    return { ...l, s }
  })
  const brows = [1, -1].map((s) => {
    const c: V3 = [s * 0.045, 0.064, -0.05]
    const b = piece({ parts: chain([[s * 0.026, 0.06, -0.06], [s * 0.044, 0.066, -0.052], [s * 0.06, 0.063, -0.038]], [0.006, 0.0075, 0.005], col(0x3a2414), 0.004) }, [s > 0 ? 0.01 : -0.075, 0.045, -0.075], [s > 0 ? 0.075 : -0.01, 0.085, -0.025], c, 0.002, 0.7)
    head.add(b)
    return { b, c, s }
  })
  function sena(s: Sena | null, amount: number, t: number) {
    const k = s ? amount : 0
    beak.rotation.set(0, 0, 0)
    beak.scale.set(1, 1, 1)
    beak.position.set(0, 0.004, -0.056)
    upper.rotation.set(0, 0, 0)
    lower.rotation.set(0, 0, 0)
    lower.position.set(0, -0.008, -0.002)
    if (s === 'ancho-copa' || s === 'ancho-oro') {
      const side = s === 'ancho-copa' ? 1 : -1
      beak.rotation.y = -side * 0.42 * k // the tip swings to that side
      beak.rotation.z = side * 0.18 * k
      beak.position.x = side * 0.006 * k
    }
    if (s === 'figuras') {
      beak.scale.x = 1 + 0.9 * k // a rubber beak stretched wide, a little open
      lower.rotation.x = -0.12 * k
    }
    if (s === 'tres') {
      upper.rotation.x = -0.32 * k // the hooked tip comes down hard over the lower half
      lower.position.z = -0.002 + 0.012 * k
      lower.rotation.x = 0.12 * k
    }
    if (s === 'dos') {
      beak.position.z = -0.056 - 0.026 * k // pushed right out and pursed, like lips for a kiss
      beak.scale.set(1 - 0.5 * k, 1 - 0.2 * k, 1 + 0.25 * k)
      beak.rotation.x = 0.12 * k
    }
    if (s === 'porno') lower.rotation.x = -0.5 * k * (0.55 + 0.45 * Math.sin(t * 9))
    const blink = Math.sin(t * 1.7 + 2) > 0.985 ? 1 : 0
    lids.forEach((l) => l.set(s === 'nada' ? k : s === 'ancho-basto' && l.s > 0 ? k : blink))
    brows.forEach(({ b, c, s: side }) => {
      b.position.set(...c)
      b.rotation.z = 0
      if (s === 'ancho-espada') b.position.y = c[1] + 0.016 * k
      if (s === 'ancho-basto' && side > 0) {
        b.position.y = c[1] - 0.005 * k
        b.rotation.z = 0.35 * k
      }
    })
  }
  return { name: 'Gallo', head, sena }
}

// ------------------------------------------------------------------------------------------------ the scene
const renderer = new THREE.WebGPURenderer({ canvas, antialias: false, forceWebGL: params.has('webgl') })
renderer.setPixelRatio(1)
await renderer.init()
renderer.toneMapping = THREE.AgXToneMapping
const isWebGPU = (renderer.backend as { isWebGPUBackend?: boolean }).isWebGPUBackend === true
const scene = new THREE.Scene()
scene.background = new THREE.Color(0x070504)
const camera = new THREE.PerspectiveCamera(32, 1, 0.02, 20)

const t0 = performance.now()
const rigs: Rig[] = [devil(), robot(), rooster()]
console.log(`sculpted in ${Math.round(performance.now() - t0)} ms`)
const SPACING = 0.3
const holders = rigs.map((r, i) => {
  const h = new THREE.Group()
  h.position.x = (1 - i) * SPACING // seen from the front (−z), the first one is on the viewer's left
  h.add(r.head)
  scene.add(h)
  return h
})
const felt = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 0.04, 64), new THREE.MeshStandardMaterial({ color: 0x4a4927, roughness: 1 }))
felt.position.set(0, -0.3, -1.2)
scene.add(felt)
scene.add(new THREE.AmbientLight(0xffe8d0, 0.14))
const lamp = new THREE.SpotLight(0xffc58a, 14, 6, 0.9, 0.6, 1.5)
lamp.position.set(0.1, 1.1, -0.9)
lamp.target.position.set(0, 0, 0)
scene.add(lamp, lamp.target)
const back = new THREE.PointLight(0x5ea2b0, 0.8, 3, 1.5)
back.position.set(-0.6, 0.45, 0.6)
scene.add(back)

const steps = uniform(30)
const grade = Fn(([c]: N[]) => {
  const colr: N = vec3(c)
  const l = dot(colr, vec3(0.299, 0.587, 0.114))
  return mix(colr, vec3(l).mul(vec3(1.08, 0.98, 0.86)), 0.22)
})
let chainN: N = renderOutput(retroPass(scene, camera))
chainN = grade(chainN)
chainN = bayerDither(chainN, steps)
chainN = posterize(chainN, steps)
chainN = vignette(chainN, float(0.35), float(0.6))
chainN = film(chainN, float(0.22))
const pipeline = new THREE.RenderPipeline(renderer)
pipeline.outputColorTransform = false
pipeline.outputNode = chainN

// ------------------------------------------------------------------------------------------------ the round of señas
// Automatic: each seña in turn, as the game shows it (comes in, holds, goes), on all three heads at once.
const ORDER: Sena[] = SENAS.map((s) => s.id)
const IN = 0.25
const HOLD = 1.6
const OUT = 0.25
const GAP = 0.5
const NOD_HZ = 2.2
let auto = !params.has('s')
let fixed: Sena | null = (params.get('s') as Sena | null) ?? null
let retroOn = !params.has('raw')
let orbit = 0
const PERIOD = IN + HOLD + OUT + GAP

function current(t: number): { s: Sena | null; k: number } {
  if (!auto) return { s: fixed, k: fixed ? 1 : 0 }
  const n = Math.floor(t / PERIOD)
  const u = t - n * PERIOD
  const s = ORDER[n % ORDER.length]
  const k = u < IN ? u / IN : u < IN + HOLD ? 1 : u < IN + HOLD + OUT ? 1 - (u - IN - HOLD) / OUT : 0
  return { s, k: Math.min(1, Math.max(0, k)) }
}
let shown: string | undefined
function showLabel(s: Sena | null) {
  const key = `${s}|${auto}`
  if (key === shown) return
  shown = key
  const d = SENAS.find((x) => x.id === s)
  label.innerHTML = d ? `<b>${d.label}</b>${d.gesture}${auto ? ' <small>· ronda automática</small>' : ''}` : '<b>En reposo</b>elegí una seña'
}

let drag = false
let lastX = 0
addEventListener('pointerdown', (e) => { drag = true; lastX = e.clientX })
addEventListener('pointerup', () => (drag = false))
addEventListener('pointermove', (e) => { if (drag) { orbit += (e.clientX - lastX) * 0.006; lastX = e.clientX } })

const timer = new THREE.Timer()
renderer.setAnimationLoop((now) => {
  timer.update(now)
  const t = timer.getElapsed()
  const ts = Math.floor(t * 15) / 15 // stop-motion
  const W = innerWidth
  const H = innerHeight
  renderer.setSize(W, H, false)
  const { s, k } = current(t)
  showLabel(s)
  rigs.forEach((r, i) => {
    const head = isHeadSena(s as Sena) && s ? s : null
    const wave = Math.sin(t * Math.PI * 2 * NOD_HZ) * k
    // the heads float and drift; sí and no are made with the whole head
    r.head.position.y = Math.sin(ts * 1.3 + i) * 0.005
    r.head.rotation.set(head === 'si' ? 0.22 * wave : Math.sin(ts * 0.9 + i) * 0.03, head === 'no' ? 0.35 * wave : Math.sin(ts * 0.6 + i) * 0.08, 0)
    r.sena(s && !isHeadSena(s) ? s : null, k, ts)
  })
  camera.aspect = W / H
  // far enough to fit the three heads across, however narrow the screen
  const tanH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))
  const d = Math.max(0.3 / tanH, 0.5 / (tanH * camera.aspect))
  camera.position.set(Math.sin(orbit) * d, 0.05, -Math.cos(orbit) * d)
  camera.lookAt(0, 0.0, 0)
  camera.updateProjectionMatrix()
  if (retroOn) pipeline.render()
  else renderer.render(scene, camera)
})

Object.assign(window, {
  __lab: {
    sena: (s: Sena | null) => {
      auto = false
      fixed = s
    },
    auto: (v: boolean) => (auto = v),
    retro: (v: boolean) => (retroOn = v),
    orbit: (v: number) => (orbit = v),
    names: rigs.map((r) => r.name),
    backend: isWebGPU ? 'WebGPU' : 'WebGL2',
  },
})
void holders
