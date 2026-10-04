// LED masks for La Base (development only: open /mascaras-led-lab.html on the dev server). Copied from the shape of
// the real LED face masks: a shallow shield curved like a visor, broad flat brow, straight sides down to the cheeks,
// a chin that narrows to a rounded point, a thick black plastic rim, two tabs at eye height where the strap would
// go, and behind the glass a dense matrix of LEDs (unlit ones still show as faint grey dots). The mask floats on its
// own, nobody behind it. Six dark faces drawn on the matrix, each making the eleven señas of the game.
// "Right" is the signer's own right: +x, which is the right-hand side of the face drawing (the mask looks down −z).
import * as THREE from 'three/webgpu'
import { Fn, float, vec2, vec3, uniform, mix, dot, length, fract, floor, smoothstep, uv, texture, renderOutput, posterize } from 'three/tsl'
import { retroPass } from 'three/addons/tsl/display/RetroPassNode.js'
import { bayerDither } from 'three/addons/tsl/math/Bayer.js'
import { vignette } from 'three/addons/tsl/display/CRT.js'
import { film } from 'three/addons/tsl/display/FilmNode.js'
import { SENAS, isHeadSena, type Sena } from '@la-base/shared'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type N = any
type RGB = [number, number, number]

const canvas = document.getElementById('c') as HTMLCanvasElement
const label = document.getElementById('label')!
const params = new URLSearchParams(location.search)
const lerp = THREE.MathUtils.lerp
const clamp01 = (v: number) => Math.min(1, Math.max(0, v))

// ------------------------------------------------------------------------------------------------ the mask's shape
const HW = 0.086 // half width (m)
const HH = 0.113 // half height
// half of the outline, from the top of the brow round to the chin (x ≥ 0), in units of HW / HH
const HALF: [number, number][] = [
  [0, 1.0], [0.5, 0.985], [0.8, 0.92], [0.95, 0.76], [1.0, 0.46], [0.98, 0.15], [0.9, -0.18],
  [0.78, -0.48], [0.58, -0.74], [0.36, -0.92], [0.15, -1.0], [0, -1.02],
]
/** The face is curved like a visor: the sides sweep back more than the brow and the chin do. */
const surfZ = (x: number, y: number) => -0.03 + 4.0 * x * x + 0.9 * y * y
const outline: THREE.Vector2[] = (() => {
  const pts = [...HALF.map(([x, y]) => new THREE.Vector3(x * HW, y * HH, 0)), ...HALF.slice(1, -1).reverse().map(([x, y]) => new THREE.Vector3(-x * HW, y * HH, 0))]
  const c = new THREE.CatmullRomCurve3(pts, true, 'centripetal')
  return c.getSpacedPoints(180).map((p) => new THREE.Vector2(p.x, p.y))
})()
function inside(x: number, y: number) {
  let r = false
  for (let i = 0, j = outline.length - 1; i < outline.length; j = i++) {
    const a = outline[i]
    const b = outline[j]
    if (a.y > y !== b.y > y && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) r = !r
  }
  return r
}

const COLS = 32
const ROWS = 40

function maskGeometry() {
  // the glass: a grid laid on the curve, keeping the cells inside the outline (the rim hides the ragged edge)
  const NX = 70
  const NY = 92
  const x0 = -HW - 0.004
  const y0 = -HH * 1.02 - 0.004
  const w = 2 * HW + 0.008
  const h = HH * 2.02 + 0.008
  const pos: number[] = []
  const uvs: number[] = []
  for (let j = 0; j <= NY; j++) {
    for (let i = 0; i <= NX; i++) {
      const x = x0 + (i / NX) * w
      const y = y0 + (j / NY) * h
      pos.push(x, y, surfZ(x, y))
      uvs.push((x + HW) / (2 * HW), (y + HH * 1.02) / (HH * 2.02))
    }
  }
  const idx: number[] = []
  const at = (i: number, j: number) => j * (NX + 1) + i
  for (let j = 0; j < NY; j++) {
    for (let i = 0; i < NX; i++) {
      const cx = x0 + ((i + 0.5) / NX) * w
      const cy = y0 + ((j + 0.5) / NY) * h
      if (!inside(cx, cy)) continue
      idx.push(at(i, j), at(i + 1, j), at(i + 1, j + 1), at(i, j), at(i + 1, j + 1), at(i, j + 1))
    }
  }
  const glass = new THREE.BufferGeometry()
  glass.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  glass.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  glass.setIndex(idx)
  glass.computeVertexNormals()
  // the shell behind it: the same sheet pushed back 1.3 cm
  const back = glass.clone()
  back.translate(0, 0, 0.013)
  // the rim: a thick tube of black plastic round the outline, on the curve
  const rimCurve = new THREE.CatmullRomCurve3(outline.map((p) => new THREE.Vector3(p.x, p.y, surfZ(p.x, p.y) + 0.005)), true)
  const rim = new THREE.TubeGeometry(rimCurve, 200, 0.0085, 10, true)
  return { glass, back, rim }
}

// ------------------------------------------------------------------------------------------------ drawing on the matrix
// A face is drawn into a 32 × 40 pixel buffer every frame, from a small state the seña sets.
interface FaceState {
  openL: number // 1 open, 0 shut
  openR: number
  brow: number // both brows raised (as de espadas)
  wink: number // the right brow comes down with the wink (ancho de bastos)
  shift: number // the mouth to the right (+1) or to the left (−1)
  wide: number // stretched to both sides (figuras)
  bite: number // biting the lower lip (tres)
  kiss: number // a kiss (dos)
  fish: number // the fish mouth's opening right now (porno)
  fishOn: number
  t: number
}

class Px {
  data = new Uint8ClampedArray(COLS * ROWS * 4)
  clear() {
    this.data.fill(0)
  }
  set(x: number, y: number, c: RGB, a = 1) {
    const xi = Math.round(x)
    const yi = Math.round(y)
    if (xi < 0 || yi < 0 || xi >= COLS || yi >= ROWS) return
    const o = (yi * COLS + xi) * 4
    this.data[o] = this.data[o] * (1 - a) + c[0] * a
    this.data[o + 1] = this.data[o + 1] * (1 - a) + c[1] * a
    this.data[o + 2] = this.data[o + 2] * (1 - a) + c[2] * a
    this.data[o + 3] = 255
  }
  off(x: number, y: number) {
    this.set(x, y, [0, 0, 0])
  }
  line(x0: number, y0: number, x1: number, y1: number, c: RGB) {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1)
    for (let i = 0; i <= n; i++) this.set(lerp(x0, x1, i / n), lerp(y0, y1, i / n), c)
  }
  /** An ellipse, filled or as an outline `thick` pixels wide. */
  ellipse(cx: number, cy: number, rx: number, ry: number, c: RGB | null, fill: boolean, thick = 1) {
    if (rx <= 0 || ry <= 0) return
    for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++) {
      for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) {
        const d = Math.hypot((x - cx) / rx, (y - cy) / ry)
        const inR = d <= 1
        const edge = d > 1 - thick / Math.min(rx, ry)
        if (fill ? inR : inR && edge) {
          if (c) this.set(x, y, c)
          else this.off(x, y)
        }
      }
    }
  }
}

const dim = (c: RGB, k: number): RGB => [c[0] * k, c[1] * k, c[2] * k]

type EyeStyle = 'ring' | 'socket' | 'doll' | 'x' | 'slit' | 'hollow'
interface MouthStyle { cy: number; hw: number; smile: number; open: number; lip: RGB; lipT: number; teeth?: RGB; gap?: number; stitch?: RGB; hidden?: boolean }

const EYE_Y = 16
const EYES_X = [10, 21] // the signer's left eye (drawing's left), then the right

function drawEye(p: Px, cx: number, cy: number, open: number, style: EyeStyle, c: RGB, c2: RGB, side: number) {
  const shut = open < 0.18
  if (style === 'ring') {
    if (shut) return p.line(cx - 3, cy + 1, cx + 3, cy + 1, c)
    p.ellipse(cx, cy, 3.6, 3.6 * open, c, false, 1.2)
    p.ellipse(cx, cy, 1.2, 1.2 * open, c, true)
  } else if (style === 'socket') {
    if (shut) return p.line(cx - 4, cy + 1, cx + 4, cy + 1, c)
    p.ellipse(cx, cy, 4.2, 3.8 * open, c, false, 1)
    if (open > 0.5) p.set(cx + side * 0.5, cy + 0.5, c2) // a single glint deep in the socket
  } else if (style === 'doll') {
    if (shut) {
      // the lid down, paler than the porcelain, its lashes hanging below
      p.line(cx - 4, cy, cx + 4, cy, [150, 120, 125])
      for (const dx of [-3, 0, 3]) p.set(cx + dx, cy + 1, c2)
      return
    }
    p.ellipse(cx, cy, 4.4, 2.8 * open, [150, 150, 158], true)
    p.ellipse(cx, cy, 2.2, Math.min(2.2, 2.8 * open), c, true)
    p.set(cx, cy, [8, 8, 12])
    p.set(cx + 1, cy - 1, [230, 230, 240])
    p.line(cx - 5, cy - 3 * open - 0.5, cx + 5, cy - 3 * open - 0.5, c2) // the upper lashes
    p.set(cx - 5, cy - 3 * open - 1.5, c2)
    p.set(cx + 5, cy - 3 * open - 1.5, c2)
  } else if (style === 'x') {
    if (shut) return p.line(cx - 3, cy, cx + 3, cy, c)
    const r = 3 * open
    p.line(cx - 3, cy - r, cx + 3, cy + r, c)
    p.line(cx - 3, cy + r, cx + 3, cy - r, c)
  } else if (style === 'slit') {
    // a thin slanted slash, the inner end low: an angry look; opening it widens the slash
    if (shut) return p.line(cx - 4, cy + 1, cx + 4, cy + 1, c)
    const r = 1.6 * open
    p.line(cx - 4 * side, cy - 2.5 - r, cx + 3 * side, cy + 1.5 - r, c)
    p.line(cx - 4 * side, cy - 2.5 + r, cx + 3 * side, cy + 1.5 + r, c)
    p.line(cx - 4 * side, cy - 2.5 - r, cx - 4 * side, cy - 2.5 + r, c)
  } else {
    if (shut) return p.line(cx - 3, cy + 1, cx + 3, cy + 1, c)
    p.ellipse(cx, cy, 3.2, 4.6 * open, c, false, 1)
  }
}

function drawBrows(p: Px, st: FaceState, c: RGB, atRest: boolean, arched = false) {
  if (!atRest && st.brow < 0.05 && st.wink < 0.05) return
  EYES_X.forEach((cx, i) => {
    const side = i === 0 ? -1 : 1
    const y = EYE_Y - 6 - 3 * st.brow + (side > 0 ? 1.5 * st.wink : 0)
    const tilt = side > 0 ? 1.5 * st.wink : 0
    if (arched) {
      p.line(cx - 4, y + 1 + tilt * (side > 0 ? -1 : 0), cx, y, c)
      p.line(cx, y, cx + 4, y + 1 + tilt, c)
      return
    }
    p.line(cx - 4, y - tilt, cx + 4, y + tilt, c)
  })
}


function drawMouth(p: Px, st: FaceState, m: MouthStyle) {
  const mouthy = Math.max(Math.abs(st.shift), st.wide, st.bite, st.kiss, st.fishOn)
  if (m.hidden && mouthy < 0.05) return
  let hw = m.hw * (m.hidden ? mouthy : 1)
  let smile = m.smile
  let open = m.open
  // each seña bends the same mouth
  hw = lerp(hw, 3, st.kiss)
  smile = lerp(smile, 0, st.kiss)
  open = lerp(open, 1.7, st.kiss)
  hw *= 1 + 0.45 * st.wide
  smile = lerp(smile, 0.5, st.wide)
  open = lerp(open, 0.6, st.wide)
  hw = lerp(hw, 4.2, st.fishOn)
  smile = lerp(smile, 0, st.fishOn)
  open = lerp(open, 0.6 + 3.6 * st.fish, st.fishOn)
  open = lerp(open, 0.4, st.bite)
  hw *= 1 - 0.25 * Math.abs(st.shift)
  const cx = 15.5 + st.shift * 5
  const tilt = st.shift * 3
  const lipT = st.kiss > 0.5 ? m.lipT + 1 : m.lipT
  for (let x = -hw; x <= hw; x += 0.5) {
    const t = x / hw
    const yc = m.cy - smile * t * t - tilt * t
    const h = open * Math.sqrt(Math.max(0, 1 - t * t))
    const X = cx + x
    if (h < 0.5) {
      for (let k = 0; k < lipT; k++) p.set(X, yc + k, m.lip)
      if (m.stitch && Math.round(X) % 2 === 0) {
        p.set(X, yc - 1, m.stitch)
        p.set(X, yc + lipT, m.stitch)
      }
      continue
    }
    for (let k = 0; k < lipT; k++) {
      p.set(X, yc - h - 1 - k, m.lip)
      p.set(X, yc + h + 1 + k, m.lip)
    }
    for (let y = Math.ceil(yc - h); y <= Math.floor(yc + h); y++) {
      if (m.teeth && st.kiss < 0.4 && st.fishOn < 0.4 && Math.round(X) % (m.gap ?? 3) !== 0) p.set(X, y, m.teeth)
      else p.off(X, y)
    }
  }
  if (st.bite > 0.2) {
    // two front teeth pressed down over the lower lip
    for (const dx of [-1.5, 1.5]) for (let y = 0; y < 3; y++) p.set(cx + dx, m.cy + y, m.teeth ?? [235, 235, 235])
    p.line(cx - 2.5, m.cy, cx + 2.5, m.cy, m.teeth ?? [235, 235, 235])
  }
}

interface Design { name: string; idea: string; draw(p: Px, st: FaceState): void }

const DESIGNS: Design[] = [
  {
    name: 'Payaso',
    idea: 'pelo a rayas, sombras verdes, ojos violetas, nariz roja y una sonrisa enorme llena de dientes',
    draw(p, st) {
      const white: RGB = [205, 225, 255]
      const blue: RGB = [90, 140, 255]
      const green: RGB = [80, 220, 70]
      const yellow: RGB = [230, 210, 60]
      const purple: RGB = [190, 90, 255]
      const red: RGB = [255, 40, 40]
      const magenta: RGB = [255, 40, 150]
      // hair: wavy stripes over the brow
      for (let x = 1; x < COLS; x += 2) for (let y = 0; y < 9; y++) p.set(x + Math.round(Math.sin(y * 0.8 + x * 0.5)), y, (x >> 1) % 2 ? white : blue)
      for (let x = 5; x < 27; x++) p.set(x, 9, white)
      // the green paint round each eye: its top is the brow
      EYES_X.forEach((cx, i) => {
        const side = i === 0 ? -1 : 1
        const up = 3 * st.brow - (side > 0 ? 1.5 * st.wink : 0)
        p.line(cx - 6, EYE_Y - 1, cx, EYE_Y - 6 - up, green)
        p.line(cx, EYE_Y - 6 - up, cx + 6, EYE_Y - 1, green)
        p.line(cx - 5, EYE_Y + 4, cx - 1, EYE_Y + 6, green)
        p.line(cx + 1, EYE_Y + 6, cx + 5, EYE_Y + 4, yellow)
        drawEye(p, cx, EYE_Y, i === 0 ? st.openL : st.openR, 'ring', purple, purple, side)
      })
      p.ellipse(15.5, 23, 3.6, 3.2, red, true)
      p.off(12, 20)
      p.off(19, 20)
      p.off(12, 26)
      p.off(19, 26)
      p.set(14.5, 22, [255, 220, 220])
      p.set(15.5, 22, [255, 220, 220])
      drawMouth(p, st, { cy: 30, hw: 12, smile: 4, open: 2.6, lip: magenta, lipT: 1, teeth: [150, 200, 255], gap: 3 })
    },
  },
  {
    name: 'Calavera',
    idea: 'calavera en rojo: cuencas vacías con un brillo al fondo, nariz hueca, mandíbula de dientes',
    draw(p, st) {
      const red: RGB = [255, 30, 40]
      const bone: RGB = [210, 200, 190]
      drawBrows(p, st, dim(red, 0.9), true)
      EYES_X.forEach((cx, i) => drawEye(p, cx, EYE_Y, i === 0 ? st.openL : st.openR, 'socket', red, [255, 230, 120], i === 0 ? -1 : 1))
      // the nose: an upside-down heart, hollow
      p.line(13.5, 21, 15.5, 25, red)
      p.line(17.5, 21, 15.5, 25, red)
      p.line(13.5, 21, 17.5, 21, red)
      // cheekbones and the line of the jaw
      p.line(4, 21, 8, 23, dim(red, 0.7))
      p.line(27, 21, 23, 23, dim(red, 0.7))
      p.line(5, 26, 9, 35, dim(red, 0.6))
      p.line(26, 26, 22, 35, dim(red, 0.6))
      p.line(9, 35, 22, 35, dim(red, 0.6))
      drawMouth(p, st, { cy: 30, hw: 8.5, smile: 1, open: 2.2, lip: red, lipT: 1, teeth: bone, gap: 2 })
    },
  },
  {
    name: 'Muñeca',
    idea: 'muñeca de porcelana: cara pálida, ojos de vidrio azules, boquita roja, y una grieta que la cruza',
    draw(p, st) {
      // the whole face lit faintly, like porcelain in the dark
      for (let y = 6; y < ROWS; y++) for (let x = 0; x < COLS; x++) p.set(x, y, [62, 54, 58])
      for (let x = 0; x < COLS; x++) for (let y = 0; y < 6 + Math.round(Math.abs(x - 15.5) * 0.35); y++) p.off(x, y) // the hair, unlit
      drawBrows(p, st, [120, 60, 40], true, true)
      EYES_X.forEach((cx, i) => drawEye(p, cx, EYE_Y, i === 0 ? st.openL : st.openR, 'doll', [70, 120, 255], [20, 14, 16], i === 0 ? -1 : 1))
      p.ellipse(7, 24, 2.6, 1.6, [170, 50, 80], true)
      p.ellipse(24, 24, 2.6, 1.6, [170, 50, 80], true)
      p.set(14.5, 23, [110, 80, 80])
      p.set(16.5, 23, [110, 80, 80])
      drawMouth(p, st, { cy: 29, hw: 3.2, smile: 0.4, open: 0, lip: [230, 25, 60], lipT: 2 })
      // the crack: dark pixels from the brow down across one eye to the cheek
      ;[[22, 6], [22, 7], [23, 8], [23, 9], [22, 10], [23, 11], [24, 12], [24, 13], [25, 19], [25, 20], [24, 21], [25, 22], [26, 23], [26, 24], [27, 25]].forEach(([x, y]) => p.off(x, y))
    },
  },
  {
    name: 'Cosido',
    idea: 'ojos en cruz y la boca cosida con puntadas, una costura que le baja por la frente',
    draw(p, st) {
      const mag: RGB = [255, 50, 210]
      const vio: RGB = [140, 90, 255]
      for (let y = 1; y < 12; y++) p.set(15.5, y, vio)
      for (let y = 2; y < 12; y += 2) p.line(14.5, y, 16.5, y, vio)
      drawBrows(p, st, vio, false)
      EYES_X.forEach((cx, i) => drawEye(p, cx, EYE_Y, i === 0 ? st.openL : st.openR, 'x', mag, mag, i === 0 ? -1 : 1))
      drawMouth(p, st, { cy: 29, hw: 8, smile: 0, open: 0, lip: mag, lipT: 1, stitch: vio, teeth: [255, 160, 230] })
    },
  },
  {
    name: 'Demonio',
    idea: 'dos tajos de ojos enojados y una sonrisa en media luna de lado a lado',
    draw(p, st) {
      const cyan: RGB = [40, 230, 255]
      drawBrows(p, st, cyan, false)
      EYES_X.forEach((cx, i) => drawEye(p, cx, EYE_Y, i === 0 ? st.openL : st.openR, 'slit', cyan, cyan, i === 0 ? -1 : 1))
      drawMouth(p, st, { cy: 29, hw: 12.5, smile: 6, open: 2, lip: cyan, lipT: 2, teeth: dim(cyan, 0.45), gap: 2 })
    },
  },
  {
    name: 'Vacío',
    idea: 'solo dos ojos huecos y lágrimas oscuras; la boca aparece únicamente para las señas',
    draw(p, st) {
      const white: RGB = [220, 225, 235]
      const blood: RGB = [140, 10, 20]
      drawBrows(p, st, white, false)
      EYES_X.forEach((cx, i) => {
        drawEye(p, cx, EYE_Y, i === 0 ? st.openL : st.openR, 'hollow', white, white, i === 0 ? -1 : 1)
        for (let y = EYE_Y + 6; y < EYE_Y + 13 + i * 3; y++) p.set(cx + (i === 0 ? -1 : 1), y, blood)
      })
      drawMouth(p, st, { cy: 30, hw: 7, smile: 0, open: 0, lip: white, lipT: 1, hidden: true })
    },
  },
]

/** What each seña does to a face, at amount k (0..1), at time t. */
function faceState(s: Sena | null, k: number, t: number, seed: number): FaceState {
  const blink = Math.sin(t * 1.6 + seed * 1.7) > 0.986 ? 0 : 1
  const st: FaceState = { openL: blink, openR: blink, brow: 0, wink: 0, shift: 0, wide: 0, bite: 0, kiss: 0, fish: 0, fishOn: 0, t }
  if (!s) return st
  if (s === 'ancho-espada') st.brow = k
  if (s === 'ancho-basto') {
    st.openR = 1 - k
    st.wink = k
  }
  if (s === 'ancho-copa') st.shift = k
  if (s === 'ancho-oro') st.shift = -k
  if (s === 'figuras') st.wide = k
  if (s === 'tres') st.bite = k
  if (s === 'dos') st.kiss = k
  if (s === 'porno') {
    st.fishOn = k
    st.fish = 0.5 + 0.5 * Math.sin(t * 9)
  }
  if (s === 'nada') st.openL = st.openR = 1 - k
  return st
}

// ------------------------------------------------------------------------------------------------ a mask in the scene
interface Mask { group: THREE.Group; draw(s: Sena | null, k: number, t: number): void }

const geo = maskGeometry()
const plastic = new THREE.MeshStandardMaterial({ color: 0x0b0b0e, roughness: 0.35, metalness: 0.1 })
const shellMat = new THREE.MeshStandardMaterial({ color: 0x08080a, roughness: 0.8, side: THREE.DoubleSide })

function makeMask(design: Design, seed: number): Mask {
  const group = new THREE.Group()
  const face = document.createElement('canvas')
  face.width = COLS
  face.height = ROWS
  const g = face.getContext('2d')!
  const img = g.createImageData(COLS, ROWS)
  const tex = new THREE.CanvasTexture(face)
  tex.magFilter = THREE.NearestFilter
  tex.minFilter = THREE.NearestFilter
  tex.colorSpace = THREE.SRGBColorSpace
  const mat = new THREE.MeshBasicNodeMaterial({ side: THREE.DoubleSide })
  const grid = vec2(COLS, ROWS)
  const cell: N = floor(uv().mul(grid))
  const f: N = fract(uv().mul(grid)).sub(0.5)
  const led = float(1).sub(smoothstep(0.2, 0.36, length(f)))
  const lit: N = texture(tex, cell.add(0.5).div(grid)).rgb
  // black glass; every LED a faint grey dot when off; lit ones bright, with a little halo between them
  mat.colorNode = vec3(0.006, 0.006, 0.008).add(vec3(0.022, 0.022, 0.026).mul(led)).add(lit.mul(led.mul(2.8).add(0.09)))
  group.add(new THREE.Mesh(geo.glass, mat), new THREE.Mesh(geo.back, shellMat), new THREE.Mesh(geo.rim, plastic))
  // the two tabs where the strap goes, at eye height, following the curve
  for (const s of [1, -1]) {
    const tab = new THREE.Mesh(new THREE.BoxGeometry(0.011, 0.034, 0.022), plastic)
    const x = s * (HW + 0.004)
    tab.position.set(x, 0.035, surfZ(x, 0.035) + 0.01)
    tab.rotation.y = -s * Math.atan(8 * HW)
    group.add(tab)
  }
  // the light of the face falls on the table in front of it
  const glow = new THREE.PointLight(0xffffff, 0.0, 0.9, 2)
  glow.position.set(0, -0.02, -0.12)
  group.add(glow)
  const px = new Px()
  const draw = (s: Sena | null, k: number, t: number) => {
    px.clear()
    design.draw(px, faceState(s, k, t, seed))
    // now and then the screen glitches: a band of rows slides sideways for a moment
    const gl = Math.sin(t * 0.7 + seed * 2.3)
    if (gl > 0.992) {
      const y0 = Math.floor(((t * 37 + seed * 11) % (ROWS - 6)) + 2)
      for (let y = y0; y < y0 + 4; y++) {
        const row = px.data.slice(y * COLS * 4, (y + 1) * COLS * 4)
        for (let x = 0; x < COLS; x++) {
          const sx = (x + 3) % COLS
          px.data.set(row.subarray(sx * 4, sx * 4 + 4), (y * COLS + x) * 4)
        }
      }
    }
    img.data.set(px.data)
    g.putImageData(img, 0, 0)
    tex.needsUpdate = true
    // the average colour of the face lights its surroundings
    let r = 0
    let gg = 0
    let b = 0
    for (let i = 0; i < px.data.length; i += 4) {
      r += px.data[i]
      gg += px.data[i + 1]
      b += px.data[i + 2]
    }
    const n = COLS * ROWS * 255
    glow.color.setRGB(r / n, gg / n, b / n).multiplyScalar(4)
    glow.intensity = 0.35
  }
  return { group, draw }
}

// ------------------------------------------------------------------------------------------------ the scene
const renderer = new THREE.WebGPURenderer({ canvas, antialias: false, forceWebGL: params.has('webgl') })
renderer.setPixelRatio(1)
await renderer.init()
renderer.toneMapping = THREE.AgXToneMapping
const isWebGPU = (renderer.backend as { isWebGPUBackend?: boolean }).isWebGPUBackend === true
const scene = new THREE.Scene()
scene.background = new THREE.Color(0x050404)
const camera = new THREE.PerspectiveCamera(30, 1, 0.02, 20)

const masks = DESIGNS.map((d, i) => makeMask(d, i))
const SX = 0.25
const SY = 0.31
masks.forEach((m, i) => {
  scene.add(m.group)
  m.group.userData.home = new THREE.Vector3((1 - (i % 3)) * SX, i < 3 ? SY / 2 : -SY / 2, 0)
})
const felt = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 0.04, 64), new THREE.MeshStandardMaterial({ color: 0x3a3a22, roughness: 1 }))
felt.position.set(0, -0.48, -1.0)
scene.add(felt)
scene.add(new THREE.AmbientLight(0xffe8d0, 0.05))
const lamp = new THREE.SpotLight(0xffc58a, 4, 6, 0.9, 0.7, 1.5)
lamp.position.set(0.1, 1.2, -0.9)
lamp.target.position.set(0, -0.2, 0)
scene.add(lamp, lamp.target)

const steps = uniform(32)
const grade = Fn(([c]: N[]) => {
  const colr: N = vec3(c)
  const l = dot(colr, vec3(0.299, 0.587, 0.114))
  return mix(colr, vec3(l), 0.12)
})
const pass = retroPass(scene, camera)
pass.setResolutionScale(0.5) // half resolution, not a quarter: at a quarter the matrix of LEDs would vanish
let chainN: N = renderOutput(pass)
chainN = grade(chainN)
chainN = bayerDither(chainN, steps)
chainN = posterize(chainN, steps)
chainN = vignette(chainN, float(0.35), float(0.6))
chainN = film(chainN, float(0.2))
const pipeline = new THREE.RenderPipeline(renderer)
pipeline.outputColorTransform = false
pipeline.outputNode = chainN

// ------------------------------------------------------------------------------------------------ the round of señas
const ORDER: Sena[] = SENAS.map((s) => s.id)
const IN = 0.25
const HOLD = 1.6
const OUT = 0.25
const GAP = 0.5
const PERIOD = IN + HOLD + OUT + GAP
const NOD_HZ = 2.2
let auto = !params.has('s')
let fixed: Sena | null = (params.get('s') as Sena | null) ?? null
if ((fixed as string) === 'rest') fixed = null
let retroOn = !params.has('raw')
let focus = Number(params.get('m') ?? -1) // −1: all six; otherwise one mask, close
let orbit = 0

function current(t: number): { s: Sena | null; k: number } {
  if (!auto) return { s: fixed, k: fixed ? 1 : 0 }
  const n = Math.floor(t / PERIOD)
  const u = t - n * PERIOD
  const s = ORDER[n % ORDER.length]
  const k = u < IN ? u / IN : u < IN + HOLD ? 1 : u < IN + HOLD + OUT ? 1 - (u - IN - HOLD) / OUT : 0
  return { s, k: clamp01(k) }
}
let shown = ''
function showLabel(s: Sena | null) {
  const key = `${s}|${auto}|${focus}`
  if (key === shown) return
  shown = key
  const d = SENAS.find((x) => x.id === s)
  const who = focus >= 0 ? `<small>${DESIGNS[focus].name}: ${DESIGNS[focus].idea}</small><br>` : ''
  label.innerHTML = (d ? `<b>${d.label}</b>${d.gesture}${auto ? ' · ronda automática' : ''}` : '<b>En reposo</b>elegí una seña') + (who ? `<br>${who}` : '')
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
  const headSena = s && isHeadSena(s) ? s : null
  const wave = Math.sin(t * Math.PI * 2 * NOD_HZ) * k
  masks.forEach((m, i) => {
    const show = focus < 0 || focus === i
    m.group.visible = show
    if (!show) return
    const home = focus < 0 ? (m.group.userData.home as THREE.Vector3) : new THREE.Vector3()
    m.group.position.set(home.x, home.y + Math.sin(ts * 1.2 + i) * 0.006, home.z)
    m.group.rotation.set(headSena === 'si' ? 0.24 * wave : Math.sin(ts * 0.8 + i) * 0.04, headSena === 'no' ? 0.4 * wave : Math.sin(ts * 0.55 + i * 1.3) * 0.12, Math.sin(ts * 0.5 + i) * 0.03)
    m.draw(s && !isHeadSena(s) ? s : null, k, ts)
  })
  camera.aspect = W / H
  const tanH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))
  const halfW = focus < 0 ? SX + HW + 0.03 : HW + 0.05
  const halfH = focus < 0 ? SY / 2 + HH + 0.05 : HH + 0.07
  // on a tall, narrow screen (a phone) the buttons take the bottom: step back and frame the masks higher
  const narrow = camera.aspect < 1
  const d = Math.max(halfH / tanH, halfW / (tanH * camera.aspect)) * (narrow ? 1.25 : 1)
  const lookY = narrow ? -halfH * 0.55 : 0
  camera.position.set(Math.sin(orbit) * d, lookY, -Math.cos(orbit) * d)
  camera.lookAt(0, lookY, 0)
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
    focus: (i: number) => (focus = i),
    orbit: (v: number) => (orbit = v),
    names: DESIGNS.map((d) => d.name),
    backend: isWebGPU ? 'WebGPU' : 'WebGL2',
  },
})
