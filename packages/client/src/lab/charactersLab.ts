// Characters for La Base, sculpted (development only: open /personajes-lab.html on the dev server). As in Buckshot
// Roulette's multiplayer, each player is a head floating over the table — no neck, no body — and two floating hands,
// everything looking like worked clay with deep, dark hollows. Six heads of our own: horse, rooster, ram, a carnival
// devil, a ventriloquist's dummy and a saint carved in wood.
import * as THREE from 'three/webgpu'
import { Fn, float, vec3, uniform, mix, dot, renderOutput, posterize } from 'three/tsl'
import { retroPass } from 'three/addons/tsl/display/RetroPassNode.js'
import { bayerDither } from 'three/addons/tsl/math/Bayer.js'
import { vignette } from 'three/addons/tsl/display/CRT.js'
import { film } from 'three/addons/tsl/display/FilmNode.js'
import { drawFace } from '../table3d/cardFace'
import { sculpt, ball, ell, cone, chain, box, ring, both, col, mixc, noise3, type Part, type Model, type V3 } from './sculpt'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type N = any

const canvas = document.getElementById('c') as HTMLCanvasElement
const label = document.getElementById('label')!
const params = new URLSearchParams(location.search)
const DEBUG = params.has('debug')

// ------------------------------------------------------------------------------------------------ layout
// player space: the middle of the head at the origin, the face looking down −z, the table top at y = −0.34.
// Where each floating hand starts (its wrist): s = 1 holds the cards up, s = −1 rests on the felt.
const WR = (s: number): V3 => (s > 0 ? [0.15, -0.255, -0.235] : [-0.15, -0.318, -0.25])

// ------------------------------------------------------------------------------------------------ hands
// hand space: the wrist at the origin, fingers along −z, palm down (−y); the thumb on the +x side for s = 1
interface HandStyle { skin: number; nails?: number; claws?: number; thin?: number }

function handModel(s: 1 | -1, curl: number[], thumb: number, st: HandStyle): Model {
  const skin = col(st.skin)
  const th = st.thin ?? 1
  const parts: Part[] = [
    cone([0, 0.001, 0.035], [0, 0.002, -0.012], 0.024 * th, 0.027 * th, skin, 0.012),
    box([0, 0.002, -0.046], [0.039 * th, 0.0135, 0.04], 0.012, skin, 0.012),
    ell([0, -0.006, -0.05], [0.035 * th, 0.008, 0.034], skin, 0.01),
  ]
  const F = [
    { x: 0.027, z: -0.083, L: [0.04, 0.024, 0.019], yaw: 0.07 },
    { x: 0.009, z: -0.087, L: [0.044, 0.027, 0.02], yaw: 0.0 },
    { x: -0.009, z: -0.084, L: [0.041, 0.025, 0.019], yaw: -0.06 },
    { x: -0.026, z: -0.077, L: [0.032, 0.019, 0.016], yaw: -0.13 },
  ]
  F.forEach((f, i) => {
    let p: V3 = [s * f.x * th, 0.002, f.z]
    parts.push(ball(p, 0.0108 * th, skin, 0.006)) // the knuckle
    let pitch = 0
    const pts: V3[] = [p]
    const rad = [0.0098, 0.0091, 0.0082, 0.0074].map((r) => r * th)
    f.L.forEach((L, j) => {
      pitch += curl[i] * [0.8, 1.1, 0.75][j]
      const yaw = s * f.yaw
      p = [p[0] + Math.sin(yaw) * Math.cos(pitch) * L, p[1] - Math.sin(pitch) * L, p[2] - Math.cos(yaw) * Math.cos(pitch) * L]
      pts.push(p)
    })
    parts.push(...chain(pts, rad, skin, 0.004))
    const a = pts[2]
    const b = pts[3]
    const d: V3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]
    const dl = Math.hypot(...d)
    if (st.nails) parts.push(ell([b[0] - (d[0] / dl) * 0.006, b[1] + 0.0045 * Math.cos(pitch), b[2] - (d[2] / dl) * 0.006], [0.0062 * th, 0.0028, 0.0075], col(st.nails), 0.002))
    if (st.claws) parts.push(cone(b, [b[0] + (d[0] / dl) * 0.016, b[1] + (d[1] / dl) * 0.016 - 0.004, b[2] + (d[2] / dl) * 0.016], 0.006, 0.0012, col(st.claws), 0.003))
  })
  // the thumb comes off the side of the palm and folds in towards it
  const t0: V3 = [s * 0.03 * th, -0.004, -0.022]
  const dir = (u: V3, L: number, from: V3): V3 => {
    const l = Math.hypot(...u)
    return [from[0] + (u[0] / l) * L, from[1] + (u[1] / l) * L, from[2] + (u[2] / l) * L]
  }
  const t1 = dir([s * 0.55, -0.32, -0.77], 0.03, t0)
  const t2 = dir([s * (0.5 - 0.75 * thumb), -0.35 - 0.35 * thumb, -0.78], 0.027, t1)
  const t3 = dir([s * (0.4 - 1.1 * thumb), -0.3 - 0.45 * thumb, -0.75], 0.022, t2)
  parts.push(...chain([t0, t1, t2, t3], [0.0125 * th, 0.0108 * th, 0.0095 * th, 0.0084 * th], skin, 0.006))
  if (st.claws) parts.push(cone(t3, dir([s * (0.4 - 1.1 * thumb), -0.4 - 0.45 * thumb, -0.75], 0.014, t3), 0.0062, 0.0012, col(st.claws), 0.003))
  return { parts, disp: (x, y, z) => noise3(x * 120, y * 120, z * 120) * 0.0006 }
}

// ------------------------------------------------------------------------------------------------ eyes
/** A glossy eyeball, with an iris and a pupil looking down −z (or a slit pupil, for goats and rams). */
function eyeball(r: number, white: number, iris: number, irisR: number, slit = false) {
  const g = new THREE.Group()
  g.add(new THREE.Mesh(new THREE.SphereGeometry(r, 20, 14), new THREE.MeshStandardMaterial({ color: white, roughness: 0.12 })))
  if (irisR > 0) {
    const ir = new THREE.Mesh(new THREE.SphereGeometry(r * 1.005, 20, 10, 0, Math.PI * 2, 0, irisR), new THREE.MeshStandardMaterial({ color: iris, roughness: 0.15 }))
    ir.rotation.x = -Math.PI / 2
    g.add(ir)
  }
  const pupil = new THREE.Mesh(slit ? new THREE.BoxGeometry(r * 0.9, r * 0.22, r * 0.1) : new THREE.SphereGeometry(r * 0.38, 12, 8), new THREE.MeshStandardMaterial({ color: 0x050403, roughness: 0.1 }))
  pupil.position.z = -r * 0.97
  if (!slit) pupil.scale.z = 0.3
  g.add(pupil)
  return g
}

// ------------------------------------------------------------------------------------------------ the six heads
interface Head {
  name: string
  idea: string
  hands: HandStyle
  model: () => Model
  bounds: [V3, V3]
  extra?: (g: THREE.Group) => void // eyes and other separate pieces
}

const BONE = 0xd8ccb2

const HEADS: Head[] = [
  {
    name: '1 · Caballo',
    idea: 'cabeza de caballo de papel maché, hueso sucio, crin oscura; guantes de cuero',
    hands: { skin: 0x3b2a1f, thin: 1.02 }, // leather gloves
    bounds: [[-0.11, -0.15, -0.25], [0.11, 0.24, 0.13]],
    model: () => {
      const bone = col(BONE)
      const dark = col(0x140f0c)
      const mane = col(0x2e2119)
      const muzzle = col(0x9c917e)
      return {
        parts: [
          ell([0, 0.04, 0.03], [0.066, 0.08, 0.085], bone),
          cone([0, 0.035, -0.025], [0, -0.045, -0.165], 0.058, 0.04, bone, 0.035),
          ...both((s) => ell([s * 0.036, -0.015, -0.02], [0.034, 0.05, 0.058], bone, 0.03)),
          ell([0, -0.07, -0.168], [0.047, 0.04, 0.046], muzzle, 0.03),
          ...both((s) => ell([s * 0.05, 0.05, -0.04], [0.022, 0.008, 0.015], bone, 0.012)),
          ...both((s) => cone([s * 0.034, 0.1, 0.03], [s * 0.06, 0.215, 0.04], 0.026, 0.007, bone, 0.012)),
          ...chain([[0, 0.12, -0.0], [0, 0.098, -0.045], [0.006, 0.075, -0.07], [-0.004, 0.06, -0.08]], [0.016, 0.016, 0.012, 0.008], mane, 0.012),
          ...chain([[0, 0.12, 0.0], [0, 0.11, 0.06], [0, 0.07, 0.105], [0, 0.02, 0.115], [0, -0.03, 0.1]], [0.016, 0.02, 0.022, 0.018, 0.012], mane, 0.014),
          ...both((s) => ell([s * 0.047, 0.04, -0.052], [0.02, 0.015, 0.018], dark, 0.008, true)),
          ...both((s) => ell([s * 0.05, 0.056, -0.05], [0.024, 0.009, 0.014], bone, 0.012)),
          ...both((s) => ell([s * 0.022, -0.062, -0.208], [0.009, 0.014, 0.01], dark, 0.005, true, [0, 0, s * 0.35])),
          box([0, -0.098, -0.16], [0.034, 0.0028, 0.04], 0.002, dark, 0.004, true, [-0.12, 0, 0]),
          ...both((s) => cone([s * 0.036, 0.105, 0.022], [s * 0.056, 0.2, 0.03], 0.014, 0.003, dark, 0.004, true)),
        ],
        disp: (x, y, z) => noise3(x * 60, y * 60, z * 60) * 0.0012,
        paint: (x, y, z, c) => mixc(c, col(0x5a4e3c), Math.max(0, Math.min(1, (-0.02 - y) * 4)) * 0.35 * (0.6 + 0.4 * noise3(x * 30, y * 30, z * 30))),
      }
    },
    extra: (g) => {
      for (const s of [1, -1]) {
        const e = eyeball(0.013, 0x0a0806, 0x0a0806, 0)
        e.position.set(s * 0.045, 0.04, -0.05)
        e.rotation.y = s * 0.7
        g.add(e)
      }
    },
  },
  {
    name: '2 · Gallo',
    idea: 'gallo de riña: cresta roja, pico de hueso, barbas, ojo naranja; manos con garras',
    hands: { skin: 0xb59a5a, claws: 0x2a2018, thin: 0.82 },
    bounds: [[-0.1, -0.17, -0.16], [0.1, 0.23, 0.12]],
    model: () => {
      const red = col(0x8e231c)
      const feathers: (x: number, y: number, z: number) => V3 = (x, y, z) => mixc(col(0x6b3b1c), col(0x1d2a22), Math.max(0, Math.min(1, 0.5 + noise3(x * 25, y * 25, z * 25))))
      const beak = col(0xc8ae74)
      const dark = col(0x120c0a)
      return {
        parts: [
          ell([0, 0.04, 0.03], [0.062, 0.074, 0.075], feathers),
          ell([0, 0.02, -0.025], [0.054, 0.058, 0.042], red, 0.03),
          ...chain([[0, 0.016, -0.06], [0, 0.006, -0.1], [0, -0.008, -0.128], [0, -0.022, -0.132]], [0.02, 0.012, 0.005, 0.002], beak, 0.006),
          ...chain([[0, -0.006, -0.058], [0, -0.014, -0.09], [0, -0.016, -0.11]], [0.015, 0.008, 0.003], beak, 0.006),
          ...chain([[-0.02, -0.004, -0.07], [0, -0.007, -0.1], [0.02, -0.004, -0.07]], [0.0016, 0.0016, 0.0016], dark, 0.002, true),
          ...[0, 1, 2, 3, 4, 5].map((i) => ball([0, 0.1 + [0.0, 0.03, 0.048, 0.055, 0.045, 0.022][i], -0.07 + i * 0.026], [0.017, 0.019, 0.021, 0.021, 0.019, 0.016][i], red, 0.024)),
          cone([0, 0.085, -0.075], [0, 0.12, 0.06], 0.016, 0.014, red, 0.02),
          ...both((s) => ell([s * 0.013, -0.058, -0.072], [0.012, 0.026, 0.012], red, 0.012)),
          ...both((s) => ell([s * 0.052, -0.002, -0.022], [0.006, 0.014, 0.012], col(0xe6dccb), 0.006)),
          ...both((s) => ell([s * 0.042, 0.042, -0.045], [0.015, 0.015, 0.013], dark, 0.006, true)),
          ...Array.from({ length: 10 }, (_, i) => {
            const a = (i / 10) * Math.PI * 2
            return ell([Math.sin(a) * 0.055, -0.075, Math.cos(a) * 0.05 + 0.02], [0.022, 0.04, 0.018], feathers, 0.02, false, [0.3 * Math.cos(a), a, 0])
          }),
        ],
        disp: (x, y, z) => noise3(x * 70, y * 70, z * 70) * 0.001,
      }
    },
    extra: (g) => {
      for (const s of [1, -1]) {
        const e = eyeball(0.0115, 0xd0861a, 0xd0861a, 0)
        e.position.set(s * 0.04, 0.042, -0.046)
        e.rotation.y = s * 0.75
        g.add(e)
      }
    },
  },
  {
    name: '3 · Carnero',
    idea: 'carnero de lana sucia con cuernos en espiral; ojos de pupila horizontal',
    hands: { skin: 0xc9b9a0, nails: 0x3a2e24 },
    bounds: [[-0.2, -0.13, -0.16], [0.2, 0.2, 0.15]],
    model: () => {
      const wool = col(0xcdc2a8)
      const face = col(0x7a6a58)
      const horn: (x: number, y: number, z: number) => V3 = (x, y, z) => {
        const band = 0.5 + 0.5 * Math.sin(Math.hypot(y - 0.04, z - 0.04) * 900 + Math.abs(x) * 300)
        return mixc(col(0x4e4436), col(0x8a7c64), band)
      }
      const dark = col(0x120d0a)
      const horns = (s: number) => {
        const pts: V3[] = []
        const rad: number[] = []
        for (let i = 0; i <= 18; i++) {
          const t = i / 18
          const th = -0.4 + t * 1.55 * Math.PI * 2
          const rho = 0.055 * (1 - 0.5 * t)
          pts.push([s * (0.05 + 0.1 * t), 0.045 + rho * Math.cos(th), 0.015 + rho * Math.sin(th)])
          rad.push(0.03 * (1 - 0.7 * t))
        }
        return chain(pts, rad, horn, 0.01)
      }
      return {
        parts: [
          ell([0, 0.045, 0.03], [0.064, 0.078, 0.08], wool),
          cone([0, 0.02, -0.04], [0, -0.05, -0.1], 0.042, 0.03, face, 0.03),
          ell([0, -0.01, -0.088], [0.022, 0.045, 0.016], face, 0.02),
          ...[-1, 0, 1].map((i) => ball([i * 0.022, 0.075 - Math.abs(i) * 0.008, -0.05], 0.022, wool, 0.02)),
          ...both(horns),
          ...both((s) => ell([s * 0.038, 0.032, -0.062], [0.017, 0.012, 0.014], dark, 0.006, true)),
          ...both((s) => ell([s * 0.042, 0.046, -0.06], [0.02, 0.007, 0.012], face, 0.01)),
          ...both((s) => ell([s * 0.012, -0.072, -0.12], [0.006, 0.009, 0.008], dark, 0.004, true, [0, 0, s * 0.4])),
          box([0, -0.092, -0.108], [0.02, 0.0022, 0.02], 0.001, dark, 0.003, true),
        ],
        // the wool is lumpy, the face is not
        disp: (x, y, z) => (Math.abs(x) < 0.075 && (z > -0.03 || y > 0.06) ? Math.abs(noise3(x * 140, y * 140, z * 140)) * 0.003 : 0),
      }
    },
    extra: (g) => {
      for (const s of [1, -1]) {
        const e = eyeball(0.012, 0xb7832a, 0xb7832a, 0, true)
        e.position.set(s * 0.036, 0.032, -0.06)
        e.rotation.y = s * 0.35
        g.add(e)
      }
    },
  },
  {
    name: '4 · Diablo',
    idea: 'máscara de diablo de carnaval del norte: roja, cejas negras, ojos saltones, sonrisa llena de dientes, cuernos dorados',
    hands: { skin: 0xe6ddcc, thin: 0.95 }, // white gloves
    bounds: [[-0.13, -0.12, -0.15], [0.13, 0.24, 0.11]],
    model: () => {
      const red = col(0xa3241a)
      const black = col(0x14100e)
      const gold = col(0xb38b2c)
      const white = col(0xe8e0cc)
      const mouth = col(0x2a0806)
      return {
        parts: [
          ell([0, 0.025, 0.0], [0.078, 0.105, 0.075], red),
          ell([0, 0.075, 0.03], [0.074, 0.065, 0.068], black, 0.02),
          ...both((s) => cone([s * 0.074, 0.03, 0.0], [s * 0.115, 0.075, 0.02], 0.016, 0.003, red, 0.012)),
          ...both((s) => cone([s * 0.065, 0.07, -0.045], [s * 0.012, 0.052, -0.083], 0.017, 0.012, black, 0.014)),
          ...both((s) => ball([s * 0.034, 0.028, -0.072], 0.022, white, 0.008)),
          cone([0, 0.04, -0.08], [0, -0.008, -0.108], 0.011, 0.017, red, 0.012),
          ...both((s) => ball([s * 0.014, -0.012, -0.1], 0.011, red, 0.008)),
          ...both((s) => ell([s * 0.048, -0.022, -0.055], [0.03, 0.026, 0.026], red, 0.02)),
          ell([0, -0.058, -0.075], [0.056, 0.022, 0.035], mouth, 0.006, true),
          ...Array.from({ length: 9 }, (_, i) => {
            const u = i - 4
            return box([u * 0.0105, -0.046, -0.086 + u * u * 0.0011], [0.0044, 0.0065, 0.004], 0.0015, white, 0.002, false, [0, u * 0.12, 0])
          }),
          ...both((s) => cone([s * 0.034, -0.05, -0.084], [s * 0.032, -0.068, -0.085], 0.0052, 0.0015, white, 0.002)),
          ...both((s) => chain([[s * 0.045, 0.1, -0.03], [s * 0.07, 0.15, -0.035], [s * 0.078, 0.2, -0.015], [s * 0.07, 0.23, 0.01]], [0.018, 0.012, 0.007, 0.002], gold, 0.008)),
          ball([0, 0.092, -0.068], 0.012, gold, 0.006),
          ...both((s) => ball([s * 0.034, 0.028, -0.094], 0.0085, black, 0.002)),
        ],
        paint: (x, y, _z, c) => {
          // gold painted swirls on the cheeks and a white line round the eyes
          const sw = Math.abs(Math.sin(Math.hypot(Math.abs(x) - 0.05, y + 0.02) * 260))
          return Math.abs(x) > 0.03 && y < 0.0 && y > -0.045 && sw < 0.18 && c[0] > c[1] * 3 ? mixc(c, gold, 0.85) : c
        },
      }
    },
  },
  {
    name: '5 · Ventrílocuo',
    idea: 'muñeco de ventrílocuo: madera pintada y brillante, pelo pintado, mejillas rosadas, ojos enormes, la mandíbula separada por dos ranuras',
    hands: { skin: 0xe2c6aa, thin: 0.92, nails: 0xd6b29a },
    bounds: [[-0.09, -0.12, -0.12], [0.09, 0.15, 0.12]],
    model: () => {
      const skin = col(0xe3c2a4)
      const pink = col(0xd98a7e)
      const lips = col(0x9a2b2a)
      const dark = col(0x100b0a)
      return {
        parts: [
          ell([0, 0.04, 0.02], [0.07, 0.083, 0.08], skin),
          ell([0, -0.005, -0.028], [0.064, 0.078, 0.058], skin, 0.035),
          ...both((s) => ell([s * 0.036, -0.018, -0.064], [0.025, 0.022, 0.018], pink, 0.02)),
          ball([0, 0.008, -0.088], 0.0105, skin, 0.01),
          ell([0, -0.073, -0.05], [0.032, 0.022, 0.028], skin, 0.02),
          ...both((s) => ell([s * 0.027, 0.03, -0.062], [0.019, 0.016, 0.012], dark, 0.004, true)),
          box([0, -0.04, -0.08], [0.024, 0.0022, 0.02], 0.001, dark, 0.002, true),
          ...both((s) => box([s * 0.025, -0.064, -0.07], [0.0015, 0.024, 0.02], 0.001, dark, 0.002, true, [0, 0, s * 0.05])),
          ...both((s) => cone([s * 0.012, 0.058, -0.07], [s * 0.046, 0.064, -0.058], 0.0035, 0.0022, dark, 0.002)),
          ...both((s) => ell([s * 0.009, -0.04, -0.081], [0.012, 0.005, 0.006], lips, 0.003)),
        ],
        paint: (x, y, z, c) => {
          // painted hair, glossy black, parted on one side
          const line = 0.062 - z * 0.55 + Math.abs(x + 0.015) * 0.3
          return y > line ? mixc(c, col(0x16110f), Math.min(1, (y - line) * 400)) : c
        },
      }
    },
    extra: (g) => {
      for (const s of [1, -1]) {
        const e = eyeball(0.0165, 0xece6da, 0x3f5d7a, 0.55)
        e.position.set(s * 0.027, 0.03, -0.06)
        g.add(e)
      }
    },
  },
  {
    name: '6 · Santo',
    idea: 'cara de santo de madera policromada, la pintura saltada, ojos de vidrio mirando arriba, una lágrima roja; rayos dorados sobre la frente',
    hands: { skin: 0xd5bc9c, nails: 0xc3a688, thin: 0.9 },
    bounds: [[-0.1, -0.13, -0.13], [0.1, 0.22, 0.12]],
    model: () => {
      const wood = col(0x6e4a2c)
      const paintSkin = col(0xd8c0a0)
      const skin: (x: number, y: number, z: number) => V3 = (x, y, z) => (noise3(x * 55, y * 55, z * 55) > 0.42 ? wood : paintSkin)
      const hair = col(0x2c1d14)
      const dark = col(0x0e0907)
      const gold = col(0xb8922e)
      const rays: Part[] = []
      for (let i = 0; i < 9; i++) {
        const a = -1.0 + (i / 8) * 2.0
        const L = i % 2 ? 0.02 : 0.034
        rays.push(cone([Math.sin(a) * 0.045, 0.08 + Math.cos(a) * 0.012, -0.068], [Math.sin(a) * (0.045 + L * 0.7), 0.08 + Math.cos(a) * (0.012 + L), -0.082], 0.005, 0.0015, gold, 0.004))
      }
      return {
        parts: [
          ell([0, 0.04, 0.02], [0.068, 0.082, 0.08], hair),
          ell([0, 0.0, -0.025], [0.06, 0.08, 0.06], skin, 0.03),
          ...both((s) => ell([s * 0.03, 0.04, -0.065], [0.024, 0.008, 0.012], skin, 0.012)),
          cone([0, 0.035, -0.072], [0, -0.012, -0.095], 0.008, 0.013, skin, 0.01),
          ...both((s) => ell([s * 0.038, -0.01, -0.058], [0.02, 0.016, 0.016], skin, 0.016)),
          ...both((s) => ell([s * 0.028, 0.022, -0.064], [0.016, 0.011, 0.012], dark, 0.006, true)),
          ell([0, -0.04, -0.077], [0.016, 0.0045, 0.008], col(0x7e3a30), 0.004),
          ell([0, -0.05, -0.075], [0.014, 0.005, 0.008], col(0x7e3a30), 0.004),
          ell([0, -0.075, -0.05], [0.026, 0.02, 0.025], skin, 0.02),
          ring([0, 0.082, -0.06], 0.05, 0.02, 0.0042, gold, 0.004, false, [-1.2, 0, 0]),
          ...rays,
        ],
        // carved hair in waves, and a tear of blood down one cheek
        disp: (x, y, z) => (y > 0.045 || z > 0.02 ? Math.sin((y + z) * 300 + Math.sin(x * 120) * 2) * 0.0012 : 0),
        paint: (x, y, z, c) => (x > 0.022 && x < 0.034 && y < 0.008 && y > -0.055 - Math.sin(x * 400) * 0.004 && z < -0.05 ? mixc(c, col(0x5c0a0a), 0.9) : c),
      }
    },
    extra: (g) => {
      for (const s of [1, -1]) {
        const e = eyeball(0.0122, 0xe8e0cf, 0x2a1a10, 0.6)
        e.position.set(s * 0.028, 0.023, -0.058)
        e.rotation.x = 0.35 // they look up
        g.add(e)
      }
    },
  },
]

// ------------------------------------------------------------------------------------------------ building a character
const clay = (rough = 0.85) => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: rough })

function fan() {
  const cv = document.createElement('canvas')
  cv.width = 64
  cv.height = 100
  const c = cv.getContext('2d')!
  c.fillStyle = '#d8c7a0'
  c.fillRect(0, 0, 64, 100)
  c.fillStyle = '#7a2a22'
  c.fillRect(5, 5, 54, 90)
  c.strokeStyle = '#d8c7a0'
  c.lineWidth = 2
  for (let i = -100; i < 164; i += 9) {
    c.beginPath()
    c.moveTo(i, 0)
    c.lineTo(i + 100, 100)
    c.stroke()
  }
  const t = new THREE.CanvasTexture(cv)
  t.colorSpace = THREE.SRGBColorSpace
  const g = new THREE.Group()
  const mat = new THREE.MeshStandardMaterial({ map: t, roughness: 0.8 })
  for (let i = 0; i < 3; i++) {
    const card = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 0.094), mat)
    card.position.set((i - 1) * 0.016, 0.03 - Math.abs(i - 1) * 0.004, i * 0.001)
    card.rotation.z = (i - 1) * -0.18
    g.add(card)
  }
  return g
}

interface Built { scene: THREE.Scene; player: THREE.Group; head: THREE.Group; hands: THREE.Object3D[] }

function build(h: Head): Built {
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x070504)
  const player = new THREE.Group()
  const head = new THREE.Group()
  head.add(new THREE.Mesh(sculpt(h.model(), h.bounds[0], h.bounds[1], 0.003), clay(0.6)))
  h.extra?.(head)
  player.add(head)
  // two floating hands, ending at the wrist. The left one stands up holding the cards: thumb up, palm towards the
  // player, fingers round the back of the fan (that is what the others see); the right one rests on the felt.
  const HB = [-0.08, -0.08, -0.19] as V3
  const HT = [0.08, 0.04, 0.075] as V3
  const holdG = new THREE.Group()
  holdG.add(new THREE.Mesh(sculpt(handModel(-1, [1.0, 1.1, 1.18, 1.25], 0.35, h.hands), HB, HT, 0.0022), clay(0.7)))
  holdG.position.set(...WR(1))
  holdG.scale.setScalar(1.15)
  holdG.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(0, -1, 0), new THREE.Vector3(0, 0, -1), new THREE.Vector3(1, 0, 0)))
  holdG.rotateY(-0.35) // fingers a little towards the table, as a wrist would
  const f = fan()
  f.position.set(WR(1)[0] - 0.07, WR(1)[1] + 0.035, WR(1)[2] - 0.012)
  f.rotation.set(-0.15, Math.PI, 0.25)
  const restG = new THREE.Group()
  restG.add(new THREE.Mesh(sculpt(handModel(1, [0.25, 0.3, 0.38, 0.45], 0.25, h.hands), HB, HT, 0.0022), clay(0.7)))
  restG.position.copy(new THREE.Vector3(...WR(-1))).add(new THREE.Vector3(0, -0.006, -0.015))
  restG.rotation.set(0, -0.4, 0, 'YXZ')
  restG.scale.setScalar(1.15)
  player.add(holdG, restG, f)
  scene.add(player)
  // the table: felt with a worn wooden rim, one card face up
  const felt = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 0.04, 64), new THREE.MeshStandardMaterial({ color: 0x4a4927, roughness: 1 }))
  felt.position.set(0, -0.36, -1.32)
  scene.add(felt)
  const cardTex = new THREE.CanvasTexture(drawFace('oros', 12))
  cardTex.colorSpace = THREE.SRGBColorSpace
  const card = new THREE.Mesh(new THREE.PlaneGeometry(0.075, 0.117), new THREE.MeshStandardMaterial({ map: cardTex, roughness: 0.8 }))
  card.rotation.set(-Math.PI / 2, 0, 0.3)
  card.position.set(0.0, -0.338, -0.42)
  scene.add(card)
  scene.add(new THREE.AmbientLight(0xffe8d0, 0.12))
  const lamp = new THREE.SpotLight(0xffc58a, 12, 6, 0.8, 0.6, 1.5)
  lamp.position.set(0.15, 1.0, -0.75)
  lamp.target.position.set(0, -0.1, 0)
  scene.add(lamp, lamp.target)
  const back = new THREE.PointLight(0x5ea2b0, 0.9, 3, 1.5)
  back.position.set(-0.5, 0.45, 0.6)
  scene.add(back)
  return { scene, player, head, hands: [holdG, f, restG] }
}

// ------------------------------------------------------------------------------------------------ renderer and PS1 chain
const renderer = new THREE.WebGPURenderer({ canvas, antialias: false, forceWebGL: params.has('webgl') })
renderer.setPixelRatio(1)
await renderer.init()
renderer.toneMapping = THREE.AgXToneMapping
const isWebGPU = (renderer.backend as { isWebGPUBackend?: boolean }).isWebGPUBackend === true
const camera = new THREE.PerspectiveCamera(36, 1, 0.02, 20)
const steps = uniform(30)

const built: (Built | undefined)[] = []
const pipelines: (THREE.RenderPipeline | undefined)[] = []
function get(i: number) {
  if (!built[i]) {
    const t0 = performance.now()
    built[i] = build(HEADS[i])
    console.log(`${HEADS[i].name}: ${Math.round(performance.now() - t0)} ms`)
    const grade = Fn(([c]: N[]) => {
      const colr: N = vec3(c)
      const l = dot(colr, vec3(0.299, 0.587, 0.114))
      return mix(colr, vec3(l).mul(vec3(1.08, 0.98, 0.86)), 0.25)
    })
    let chainN: N = renderOutput(retroPass(built[i]!.scene, camera))
    chainN = grade(chainN)
    chainN = bayerDither(chainN, steps)
    chainN = posterize(chainN, steps)
    chainN = vignette(chainN, float(0.4), float(0.55))
    chainN = film(chainN, float(0.25))
    const pl = new THREE.RenderPipeline(renderer)
    pl.outputColorTransform = false
    pl.outputNode = chainN
    pipelines[i] = pl
  }
  return built[i]!
}

let current = Number(params.get('c') ?? 0)
let retroOn = !DEBUG
let paused = false
let orbit = 0
function setCurrent(i: number) {
  current = i
  label.innerHTML = i < 0 ? '<b>Los seis</b> (sin filtro) · 1–6 para ver cada uno con el filtro PS1' : `<b>${HEADS[i].name}</b><br>${HEADS[i].idea}`
}
setCurrent(current)
addEventListener('keydown', (e) => {
  if (e.key >= '1' && e.key <= '6') setCurrent(Number(e.key) - 1)
  if (e.key === '0') setCurrent(-1)
  if (e.key === 'r' || e.key === 'R') retroOn = !retroOn
  if (e.key === ' ') paused = !paused
  if (e.key === 'ArrowLeft') setCurrent((current + 5) % 6)
  if (e.key === 'ArrowRight') setCurrent((current + 1) % 6)
})
let drag = false
let lastX = 0
addEventListener('pointerdown', (e) => { drag = true; lastX = e.clientX })
addEventListener('pointerup', () => (drag = false))
addEventListener('pointermove', (e) => { if (drag) { orbit += (e.clientX - lastX) * 0.006; lastX = e.clientX } })

function aim(a: number, dist = 1.35, y = 0.1, look = -0.08) {
  camera.position.set(Math.sin(a) * dist, y, -Math.cos(a) * dist)
  camera.lookAt(0, look, 0)
}

const timer = new THREE.Timer()
let tFrozen = 0
renderer.setAnimationLoop((now) => {
  timer.update(now)
  const t = paused ? tFrozen : timer.getElapsed()
  tFrozen = t
  const ts = Math.floor(t * 15) / 15 // stop-motion
  const W = innerWidth
  const H = innerHeight
  renderer.setSize(W, H, false)
  const tiles = (list: { i: number; a: number; dist?: number; y?: number; look?: number }[], cols: number) => {
    renderer.setScissorTest(true)
    const rows = Math.ceil(list.length / cols)
    list.forEach((v, k) => {
      const cw = W / cols
      const chh = H / rows
      const x = (k % cols) * cw
      const y = Math.floor(k / cols) * chh
      renderer.setViewport(x, y, cw, chh)
      renderer.setScissor(x, y, cw, chh)
      camera.aspect = cw / chh
      camera.updateProjectionMatrix()
      aim(v.a, v.dist, v.y, v.look)
      renderer.render(get(v.i).scene, camera)
    })
    renderer.setScissorTest(false)
  }
  for (const b of built) {
    if (!b) continue
    // the head hangs in the air and drifts; the hand with the cards breathes with it
    b.head.position.y = -0.05 + Math.sin(ts * 1.3) * 0.006
    b.head.rotation.set(Math.sin(ts * 0.9) * 0.04, Math.sin(ts * 0.6) * 0.1, Math.sin(ts * 0.7) * 0.03)
    b.hands[0].position.y = WR(1)[1] + Math.sin(ts * 1.1 + 1) * 0.004
    b.hands[1].position.y = WR(1)[1] + 0.035 + Math.sin(ts * 1.1 + 1) * 0.004
  }
  if (DEBUG && current >= 0) {
    // four views of one character: front, three quarters, side, close on the face
    tiles([{ i: current, a: 0 }, { i: current, a: 0.8 }, { i: current, a: Math.PI / 2 }, { i: current, a: 0.3, dist: 0.55, y: 0.05, look: 0.0 }], 2)
    return
  }
  if (current < 0) {
    tiles(HEADS.map((_, i) => ({ i, a: orbit })), 3)
    return
  }
  camera.aspect = W / H
  camera.updateProjectionMatrix()
  aim(orbit)
  const b = get(current)
  if (retroOn) pipelines[current]!.render()
  else renderer.render(b.scene, camera)
})
Object.assign(window, { __lab: { set: setCurrent, pause: (v: boolean) => (paused = v), retro: (v: boolean) => (retroOn = v), orbit: (v: number) => (orbit = v), backend: isWebGPU ? 'WebGPU' : 'WebGL2' } })
