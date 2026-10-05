// The sculpted heads and the hands, as data: what each piece is made of (for the sculptor, which runs in a worker)
// and where the moving parts are (for the rig, on the page). No DOM and no scene here, so the worker can load it.
// Every head looks down −z; +x is its own right. Units are metres of a life-size head.
//
// The señas need moving parts, so every head is more than one sculpt:
//  · the base (everything that does not move);
//  · two brows, which lift (as de espadas) and the right one drops and tilts with the wink (ancho de bastos);
//  · the mouth: the devil's is sculpted gestures mixed into the base (blend shapes) with its teeth as a separate
//    piece; the rooster's is a beak in two hinged halves; the others have an upper and a lower lip, and teeth
//    that show when they bite;
//  · glossy eyeballs (made on the page, not sculpted) with a lid each.
import { ball, both, box, chain, col, cone, ell, mixc, noise3, ring, type Model, type Part, type V3 } from './sculpt'
import type { HeadFace } from '@la-base/shared'

export interface PieceSpec {
  key: string // 'base', 'browR', 'browL', 'upper', 'lower', 'teeth'
  model: () => Model
  lo: V3
  hi: V3
  cell: number
  pivot: V3 // the geometry is moved so this point is its origin; the piece is placed there
  gestures?: () => Model[] // blend shapes of the base (the devil's mouth)
  rough?: number
}

export interface EyeSpec {
  s: 1 | -1 // +1 the head's right eye
  pos: V3
  r: number
  rotY?: number
  rotX?: number
  white: number
  iris?: number
  irisR?: number // angular size of the iris cap (0: none)
  slit?: boolean
  pupilOnly?: boolean // the white is sculpted into the base: add only the pupil
  lid: number // the colour of the lid
}

export interface HandStyle {
  skin: number
  nails?: number
  claws?: number
  thin?: number
}

export type MouthKind = 'morph' | 'beak' | 'lips'

export interface HeadSpec {
  pieces: PieceSpec[]
  eyes: EyeSpec[]
  mouth: MouthKind
  mouthAt: V3 // the middle of the mouth (lips and teeth are placed there)
  mouthW: number // half width of the mouth
  brow: number // how far the brows lift for the as de espadas
  hands: HandStyle
}

const BONE = 0xd8ccb2
const sub = (p: Part): Part => ({ ...p, sub: true })

/** Two lips across a mouth: an upper and a lower one, each a tapered roll, a little forward in the middle. */
function lips(mc: V3, w: number, r: number, color: number, upper: boolean): Model {
  const c = col(color)
  const y = mc[1] + (upper ? r * 0.75 : -r * 0.75)
  const pts: V3[] = [
    [-w, y + (upper ? -0.001 : 0.001), mc[2] + w * 0.35],
    [-w * 0.5, y, mc[2] + w * 0.08],
    [0, y + (upper ? 0.0015 : -0.0005), mc[2]],
    [w * 0.5, y, mc[2] + w * 0.08],
    [w, y + (upper ? -0.001 : 0.001), mc[2] + w * 0.35],
  ]
  return { parts: chain(pts, [r * 0.55, r * 0.9, upper ? r : r * 1.1, r * 0.9, r * 0.55], c, r * 0.6) }
}

/** Two front teeth behind the upper lip: they come down over the lower lip for the tres. */
function teeth(mc: V3, r: number): Model {
  const white = col(0xeee6d4)
  return { parts: both((s) => box([s * r * 0.55, mc[1] - r * 0.2, mc[2] + r * 0.6], [r * 0.5, r * 0.75, r * 0.35], r * 0.15, white, 0)) }
}

const lipsPieces = (mc: V3, w: number, r: number, color: number): PieceSpec[] => {
  const pad = w + r * 2
  const lo: V3 = [mc[0] - pad, mc[1] - r * 3, mc[2] - r * 2.5]
  const hi: V3 = [mc[0] + pad, mc[1] + r * 3, mc[2] + w * 0.45 + r * 2]
  return [
    { key: 'upper', model: () => lips(mc, w, r, color, true), lo, hi, cell: 0.0016, pivot: mc, rough: 0.45 },
    { key: 'lower', model: () => lips(mc, w, r, color, false), lo, hi, cell: 0.0016, pivot: mc, rough: 0.45 },
    { key: 'teeth', model: () => teeth(mc, r), lo, hi, cell: 0.0012, pivot: mc, rough: 0.3 },
  ]
}

const browPieces = (make: (s: 1 | -1) => Part[], centre: (s: 1 | -1) => V3, half: V3): PieceSpec[] =>
  ([1, -1] as const).map((s) => {
    const c = centre(s)
    return { key: s > 0 ? 'browR' : 'browL', model: () => ({ parts: make(s) }), lo: [c[0] - half[0], c[1] - half[1], c[2] - half[2]], hi: [c[0] + half[0], c[1] + half[1], c[2] + half[2]], cell: 0.002, pivot: c, rough: 0.6 }
  })

// ------------------------------------------------------------------------------------------------ the six heads
const CABALLO: HeadSpec = (() => {
  const bone = col(BONE)
  const dark = col(0x140f0c)
  const mane = col(0x2e2119)
  const muzzle = col(0x9c917e)
  const MC: V3 = [0, -0.1, -0.198]
  return {
    mouth: 'lips',
    mouthAt: MC,
    mouthW: 0.03,
    brow: 0.014,
    hands: { skin: 0x3b2a1f, thin: 1.02 }, // leather gloves
    eyes: ([1, -1] as const).map((s) => ({ s, pos: [s * 0.045, 0.04, -0.05] as V3, r: 0.013, rotY: s * 0.7, white: 0x0a0806, lid: BONE })),
    pieces: [
      {
        key: 'base',
        lo: [-0.11, -0.15, -0.25],
        hi: [0.11, 0.24, 0.13],
        cell: 0.0034,
        pivot: [0, 0, 0],
        model: () => ({
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
            ...both((s) => ell([s * 0.022, -0.062, -0.208], [0.009, 0.014, 0.01], dark, 0.005, true, [0, 0, s * 0.35])),
            sub(ell(MC, [0.03, 0.006, 0.02], dark, 0.004)), // the dark of the mouth behind the lips
            ...both((s) => cone([s * 0.036, 0.105, 0.022], [s * 0.056, 0.2, 0.03], 0.014, 0.003, dark, 0.004, true)),
          ],
          disp: (x, y, z) => noise3(x * 60, y * 60, z * 60) * 0.0012,
          paint: (x, y, z, c) => mixc(c, col(0x5a4e3c), Math.max(0, Math.min(1, (-0.02 - y) * 4)) * 0.35 * (0.6 + 0.4 * noise3(x * 30, y * 30, z * 30))),
        }),
      },
      ...browPieces((s) => [ell([s * 0.05, 0.058, -0.05], [0.024, 0.009, 0.014], bone, 0)], (s) => [s * 0.05, 0.058, -0.05], [0.03, 0.015, 0.02]),
      ...lipsPieces(MC, 0.03, 0.009, 0x8a7f6c),
    ],
  }
})()

const GALLO: HeadSpec = (() => {
  const red = col(0x8e231c)
  const feathers = (x: number, y: number, z: number): V3 => mixc(col(0x6b3b1c), col(0x1d2a22), Math.max(0, Math.min(1, 0.5 + noise3(x * 25, y * 25, z * 25))))
  const beakC = col(0xc8ae74)
  const dark = col(0x120c0a)
  // the beak's two halves, in beak space (its hinge at the base of the beak)
  const B = (p: V3): V3 => [p[0], p[1] - 0.004, p[2] + 0.056]
  return {
    mouth: 'beak',
    mouthAt: [0, 0.004, -0.056],
    mouthW: 0.02,
    brow: 0.016,
    hands: { skin: 0xb59a5a, claws: 0x2a2018, thin: 0.82 },
    eyes: ([1, -1] as const).map((s) => ({ s, pos: [s * 0.04, 0.042, -0.046] as V3, r: 0.0115, rotY: s * 0.75, white: 0xd0861a, lid: 0x8e231c })),
    pieces: [
      {
        key: 'base',
        lo: [-0.1, -0.12, -0.12],
        hi: [0.1, 0.23, 0.13],
        cell: 0.0032,
        pivot: [0, 0, 0],
        model: () => ({
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
        }),
      },
      { key: 'upper', lo: [-0.03, -0.04, -0.09], hi: [0.03, 0.035, 0.0], cell: 0.0018, pivot: [0, 0.008, -0.002], rough: 0.45, model: () => ({ parts: chain([B([0, 0.016, -0.06]), B([0, 0.006, -0.1]), B([0, -0.008, -0.128]), B([0, -0.022, -0.132])], [0.02, 0.012, 0.005, 0.002], beakC, 0.006) }) },
      { key: 'lower', lo: [-0.03, -0.04, -0.07], hi: [0.03, 0.02, 0.01], cell: 0.0018, pivot: [0, -0.008, -0.002], rough: 0.45, model: () => ({ parts: chain([B([0, -0.006, -0.058]), B([0, -0.014, -0.09]), B([0, -0.016, -0.11])], [0.015, 0.008, 0.003], beakC, 0.006) }) },
      ...browPieces((s) => chain([[s * 0.026, 0.06, -0.06], [s * 0.044, 0.066, -0.052], [s * 0.06, 0.063, -0.038]], [0.006, 0.0075, 0.005], col(0x3a2414), 0.004), (s) => [s * 0.045, 0.064, -0.05], [0.032, 0.02, 0.025]),
    ],
  }
})()

const CARNERO: HeadSpec = (() => {
  const wool = col(0xcdc2a8)
  const face = col(0x7a6a58)
  const horn = (x: number, y: number, z: number): V3 => mixc(col(0x4e4436), col(0x8a7c64), 0.5 + 0.5 * Math.sin(Math.hypot(y - 0.04, z - 0.04) * 900 + Math.abs(x) * 300))
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
  const MC: V3 = [0, -0.07, -0.123]
  return {
    mouth: 'lips',
    mouthAt: MC,
    mouthW: 0.016,
    brow: 0.013,
    hands: { skin: 0xc9b9a0, nails: 0x3a2e24 },
    eyes: ([1, -1] as const).map((s) => ({ s, pos: [s * 0.036, 0.032, -0.06] as V3, r: 0.012, rotY: s * 0.35, white: 0xb7832a, slit: true, lid: 0x7a6a58 })),
    pieces: [
      {
        key: 'base',
        lo: [-0.2, -0.13, -0.16],
        hi: [0.2, 0.2, 0.15],
        cell: 0.0034,
        pivot: [0, 0, 0],
        model: () => ({
          parts: [
            ell([0, 0.045, 0.03], [0.064, 0.078, 0.08], wool),
            cone([0, 0.02, -0.04], [0, -0.05, -0.1], 0.042, 0.03, face, 0.03),
            ell([0, -0.01, -0.088], [0.022, 0.045, 0.016], face, 0.02),
            ...[-1, 0, 1].map((i) => ball([i * 0.022, 0.075 - Math.abs(i) * 0.008, -0.05], 0.022, wool, 0.02)),
            ...both(horns),
            ...both((s) => ell([s * 0.038, 0.032, -0.062], [0.017, 0.012, 0.014], dark, 0.006, true)),
            ...both((s) => ell([s * 0.011, -0.052, -0.128], [0.005, 0.007, 0.007], dark, 0.004, true, [0, 0, s * 0.4])), // nostrils
            sub(ell(MC, [0.016, 0.004, 0.012], dark, 0.003)),
          ],
          disp: (x, y, z) => (Math.abs(x) < 0.075 && (z > -0.03 || y > 0.06) ? Math.abs(noise3(x * 140, y * 140, z * 140)) * 0.003 : 0),
        }),
      },
      ...browPieces((s) => [ell([s * 0.042, 0.046, -0.06], [0.02, 0.007, 0.012], face, 0)], (s) => [s * 0.042, 0.046, -0.06], [0.026, 0.012, 0.016]),
      ...lipsPieces(MC, 0.016, 0.0055, 0x5d4f42),
    ],
  }
})()

const DIABLO: HeadSpec = (() => {
  const red = col(0xa3241a)
  const black = col(0x14100e)
  const gold = col(0xb38b2c)
  const white = col(0xe8e0cc)
  const mouthC = col(0x2a0806)
  const lip = col(0x7e1812)
  interface MouthPose { c: V3; r: V3; rz: number; bite: number }
  const REST: MouthPose = { c: [0, -0.058, -0.075], r: [0.056, 0.022, 0.035], rz: 0, bite: 0 }
  const model = (mp: MouthPose): Model => ({
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
      // gold swirls painted on the cheeks
      const sw = Math.abs(Math.sin(Math.hypot(Math.abs(x) - 0.05, y + 0.02) * 260))
      return Math.abs(x) > 0.03 && y < 0.0 && y > -0.045 && sw < 0.18 && c[0] > c[1] * 3 ? mixc(c, gold, 0.85) : c
    },
  })
  // the gestures, in the order of MORPH_SENAS
  const POSES: MouthPose[] = [
    { ...REST, c: [0.022, -0.055, -0.075], r: [0.042, 0.018, 0.035], rz: 0.25 },
    { ...REST, c: [-0.022, -0.055, -0.075], r: [0.042, 0.018, 0.035], rz: -0.25 },
    { ...REST, r: [0.074, 0.011, 0.035] },
    { ...REST, r: [0.05, 0.007, 0.03], bite: 1 },
    { ...REST, r: [0.012, 0.011, 0.03] },
    { ...REST, c: [0, -0.064, -0.075], r: [0.028, 0.03, 0.035] },
  ]
  const MC = REST.c
  return {
    mouth: 'morph',
    mouthAt: MC,
    mouthW: 0.056,
    brow: 0.02,
    hands: { skin: 0xe6ddcc, thin: 0.95 }, // white gloves
    eyes: ([1, -1] as const).map((s) => ({ s, pos: [s * 0.034, 0.028, -0.072] as V3, r: 0.022, white: 0xe8e0cc, pupilOnly: true, lid: 0xa3241a })),
    pieces: [
      { key: 'base', lo: [-0.13, -0.12, -0.15], hi: [0.13, 0.24, 0.12], cell: 0.0032, pivot: [0, 0, 0], model: () => model(REST), gestures: () => POSES.map(model) },
      ...browPieces((s) => [cone([s * 0.065, 0.07, -0.045], [s * 0.012, 0.052, -0.083], 0.017, 0.012, black, 0)], (s) => [s * 0.038, 0.061, -0.066], [0.048, 0.035, 0.04]),
      {
        key: 'teeth',
        lo: [-0.06, -0.085, -0.1],
        hi: [0.06, -0.035, -0.06],
        cell: 0.0015,
        pivot: MC,
        rough: 0.4,
        model: () => ({
          parts: [
            ...Array.from({ length: 9 }, (_, i) => {
              const u = i - 4
              return box([u * 0.0105, MC[1] + 0.012, -0.086 + u * u * 0.0011], [0.0044, 0.0065, 0.004], 0.0015, white, 0.002, false, [0, u * 0.12, 0])
            }),
            ...both((s) => cone([s * 0.034, MC[1] + 0.008, -0.084], [s * 0.032, MC[1] - 0.01, -0.085], 0.0052, 0.0015, white, 0.002)),
          ],
        }),
      },
    ],
  }
})()

const VENTRILOCUO: HeadSpec = (() => {
  const skin = col(0xe3c2a4)
  const pink = col(0xd98a7e)
  const dark = col(0x100b0a)
  const MC: V3 = [0, -0.04, -0.082]
  return {
    mouth: 'lips',
    mouthAt: MC,
    mouthW: 0.02,
    brow: 0.012,
    hands: { skin: 0xe2c6aa, thin: 0.92, nails: 0xd6b29a },
    eyes: ([1, -1] as const).map((s) => ({ s, pos: [s * 0.027, 0.03, -0.06] as V3, r: 0.0165, white: 0xece6da, iris: 0x3f5d7a, irisR: 0.55, lid: 0xe3c2a4 })),
    pieces: [
      {
        key: 'base',
        lo: [-0.09, -0.12, -0.12],
        hi: [0.09, 0.15, 0.12],
        cell: 0.003,
        pivot: [0, 0, 0],
        model: () => ({
          parts: [
            ell([0, 0.04, 0.02], [0.07, 0.083, 0.08], skin),
            ell([0, -0.005, -0.028], [0.064, 0.078, 0.058], skin, 0.035),
            ...both((s) => ell([s * 0.036, -0.018, -0.064], [0.025, 0.022, 0.018], pink, 0.02)),
            ball([0, 0.008, -0.088], 0.0105, skin, 0.01),
            ell([0, -0.073, -0.05], [0.032, 0.022, 0.028], skin, 0.02),
            ...both((s) => ell([s * 0.027, 0.03, -0.062], [0.019, 0.016, 0.012], dark, 0.004, true)),
            box([0, -0.04, -0.08], [0.024, 0.0022, 0.02], 0.001, dark, 0.002, true),
            ...both((s) => box([s * 0.025, -0.064, -0.07], [0.0015, 0.024, 0.02], 0.001, dark, 0.002, true, [0, 0, s * 0.05])),
          ],
          paint: (x, y, z, c) => {
            // painted hair, glossy black, parted on one side
            const line = 0.062 - z * 0.55 + Math.abs(x + 0.015) * 0.3
            return y > line ? mixc(c, col(0x16110f), Math.min(1, (y - line) * 400)) : c
          },
        }),
      },
      ...browPieces((s) => [cone([s * 0.012, 0.058, -0.07], [s * 0.046, 0.064, -0.058], 0.0035, 0.0022, dark, 0)], (s) => [s * 0.029, 0.061, -0.064], [0.024, 0.01, 0.016]),
      ...lipsPieces(MC, 0.02, 0.0048, 0x9a2b2a),
    ],
  }
})()

const SANTO: HeadSpec = (() => {
  const wood = col(0x6e4a2c)
  const paintSkin = col(0xd8c0a0)
  const skin = (x: number, y: number, z: number): V3 => (noise3(x * 55, y * 55, z * 55) > 0.42 ? wood : paintSkin)
  const hair = col(0x2c1d14)
  const dark = col(0x0e0907)
  const gold = col(0xb8922e)
  const rays: Part[] = []
  for (let i = 0; i < 9; i++) {
    const a = -1.0 + (i / 8) * 2.0
    const L = i % 2 ? 0.02 : 0.034
    rays.push(cone([Math.sin(a) * 0.045, 0.08 + Math.cos(a) * 0.012, -0.068], [Math.sin(a) * (0.045 + L * 0.7), 0.08 + Math.cos(a) * (0.012 + L), -0.082], 0.005, 0.0015, gold, 0.004))
  }
  const MC: V3 = [0, -0.045, -0.078]
  return {
    mouth: 'lips',
    mouthAt: MC,
    mouthW: 0.015,
    brow: 0.012,
    hands: { skin: 0xd5bc9c, nails: 0xc3a688, thin: 0.9 },
    eyes: ([1, -1] as const).map((s) => ({ s, pos: [s * 0.028, 0.023, -0.058] as V3, r: 0.0122, rotX: 0.35, white: 0xe8e0cf, iris: 0x2a1a10, irisR: 0.6, lid: 0xd8c0a0 })),
    pieces: [
      {
        key: 'base',
        lo: [-0.1, -0.13, -0.13],
        hi: [0.1, 0.22, 0.12],
        cell: 0.003,
        pivot: [0, 0, 0],
        model: () => ({
          parts: [
            ell([0, 0.04, 0.02], [0.068, 0.082, 0.08], hair),
            ell([0, 0.0, -0.025], [0.06, 0.08, 0.06], skin, 0.03),
            cone([0, 0.035, -0.072], [0, -0.012, -0.095], 0.008, 0.013, skin, 0.01),
            ...both((s) => ell([s * 0.038, -0.01, -0.058], [0.02, 0.016, 0.016], skin, 0.016)),
            ...both((s) => ell([s * 0.028, 0.022, -0.064], [0.016, 0.011, 0.012], dark, 0.006, true)),
            sub(ell(MC, [0.014, 0.004, 0.01], dark, 0.003)),
            ell([0, -0.075, -0.05], [0.026, 0.02, 0.025], skin, 0.02),
            ring([0, 0.082, -0.06], 0.05, 0.02, 0.0042, gold, 0.004, false, [-1.2, 0, 0]),
            ...rays,
          ],
          // carved hair in waves, and a tear of blood down one cheek
          disp: (x, y, z) => (y > 0.045 || z > 0.02 ? Math.sin((y + z) * 300 + Math.sin(x * 120) * 2) * 0.0012 : 0),
          paint: (x, y, z, c) => (x > 0.022 && x < 0.034 && y < 0.008 && y > -0.055 - Math.sin(x * 400) * 0.004 && z < -0.05 ? mixc(c, col(0x5c0a0a), 0.9) : c),
        }),
      },
      ...browPieces((s) => [ell([s * 0.03, 0.041, -0.066], [0.024, 0.007, 0.011], paintSkin, 0)], (s) => [s * 0.03, 0.041, -0.066], [0.03, 0.012, 0.016]),
      ...lipsPieces(MC, 0.015, 0.0046, 0x7e3a30),
    ],
  }
})()

export const HEADS: Record<HeadFace, HeadSpec> = {
  caballo: CABALLO,
  gallo: GALLO,
  carnero: CARNERO,
  diablo: DIABLO,
  ventrilocuo: VENTRILOCUO,
  santo: SANTO,
}

/** The señas the devil's sculpted gestures are for, in the order of its blend shapes. */
export const MORPH_SENAS = ['ancho-copa', 'ancho-oro', 'figuras', 'tres', 'dos', 'porno'] as const

// ------------------------------------------------------------------------------------------------ hands
/** The hands of the LED masks: grey rubber gloves, light enough to read in the gloom (their wrists still sink into it). */
export const LED_HANDS: HandStyle = { skin: 0x6c6a70, thin: 1.0 }

export type HandPose = 'hold' | 'rest'
export const HAND_CURL: Record<HandPose, { curl: number[]; thumb: number }> = {
  hold: { curl: [1.0, 1.1, 1.18, 1.25], thumb: 0.35 },
  rest: { curl: [0.25, 0.3, 0.38, 0.45], thumb: 0.25 },
}
export const HAND_BOX: [V3, V3] = [[-0.08, -0.08, -0.19], [0.08, 0.04, 0.075]]

/**
 * A hand: the wrist at the origin, fingers along −z, palm down (−y); the thumb on the +x side for s = 1. Fingers
 * are chains of tapered capsules through their joints, each joint bent by the curl (knuckle, middle, tip).
 */
export function handModel(s: 1 | -1, pose: HandPose, st: HandStyle): Model {
  const { curl, thumb } = HAND_CURL[pose]
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
