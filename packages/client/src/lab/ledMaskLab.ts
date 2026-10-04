// LED masks for La Base (development only: open /mascaras-led-lab.html on the dev server). Copied from the shape of
// the real LED face masks: a shallow shield curved like a visor, broad flat brow, straight sides down to the cheeks,
// a chin that narrows to a rounded point, a thick black plastic rim, two tabs at eye height where the strap would
// go, and behind the glass a dense matrix of LEDs (unlit ones still show as faint grey dots). The mask floats on its
// own, nobody behind it. Thirty dark faces drawn on the matrix (the later ones after the presets of the masks' own app), each making the eleven señas of the game.
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
/** Hue (turns, wraps), saturation and value to a colour. */
function hsv(h: number, s: number, v: number): RGB {
  h = ((h % 1) + 1) % 1
  const f = (n: number) => {
    const k = (n + h * 6) % 6
    return v - v * s * Math.max(0, Math.min(k, 4 - k, 1))
  }
  return [f(5) * 255, f(3) * 255, f(1) * 255]
}

type EyeStyle = 'ring' | 'socket' | 'doll' | 'x' | 'slit' | 'hollow' | 'slant' | 'long' | 'hole' | 'glitch' | 'cat' | 'tri' | 'arc'
interface MouthStyle { cy: number; hw: number; smile: number; open: number; lip: RGB; lipT: number; teeth?: RGB; gap?: number; stitch?: RGB; fangs?: RGB; hidden?: boolean }

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
  } else if (style === 'slant') {
    // an almond tilted up at the outer corner, a fox's or a wolf's
    const inner = cx - 3 * side
    const outer = cx + 4 * side
    if (shut) return p.line(inner, cy + 1, outer, cy - 1, c2)
    const r = 1.4 * open
    for (let o = -r; o <= r; o += 0.5) p.line(inner, cy + 1 + o * 0.6, outer, cy - 2 + o, c)
    p.line(inner, cy + 1 - r - 0.5, outer, cy - 2 - r - 0.5, c2)
  } else if (style === 'long') {
    // a long drooping hollow, dark inside
    if (shut) return p.line(cx - 3, cy + 2, cx + 3, cy + 2, c)
    p.ellipse(cx, cy + 1, 2.8, 5.2 * open, null, true)
    p.ellipse(cx, cy + 1, 2.8, 5.2 * open, c, false, 1)
  } else if (style === 'hole') {
    if (shut) return p.line(cx - 4, cy, cx + 4, cy, c2)
    p.ellipse(cx, cy, 4, 3 * open, null, true)
    if (open > 0.5) p.set(cx + side * 0.5, cy, c)
  } else if (style === 'glitch') {
    if (shut) return p.line(cx - 3, cy, cx + 3, cy, c)
    const h = Math.max(1, Math.round(4 * open))
    for (let y = 0; y < h; y++) {
      for (let x = -3; x <= 2; x++) {
        p.set(cx + x - 1, cy - h / 2 + y, [255, 0, 80], 0.8)
        p.set(cx + x + 1, cy - h / 2 + y, [0, 220, 255], 0.8)
        p.set(cx + x, cy - h / 2 + y, c)
      }
    }
  } else if (style === 'tri') {
    // a triangle cut into a pumpkin, lit from inside; closing lowers its top
    if (shut) return p.line(cx - 4, cy + 2, cx + 4, cy + 2, c)
    const h = Math.max(1, Math.round(5 * open))
    for (let i = 0; i <= h; i++) {
      const w = (i / h) * 4
      p.line(cx - w, cy + 2 - h + i, cx + w, cy + 2 - h + i, c)
    }
  } else if (style === 'arc') {
    // a happy squint, an upside-down U; shut it flattens to a line
    if (shut) return p.line(cx - 4, cy, cx + 4, cy, c)
    for (let x = -4; x <= 4; x += 0.5) {
      const y = cy - (1 - (x / 4) ** 2) * 3 * open
      p.set(cx + x, y, c)
      p.set(cx + x, y + 1, c)
    }
  } else if (style === 'cat') {
    if (shut) {
      p.line(cx - 4, cy, cx, cy + 1, c)
      p.line(cx, cy + 1, cx + 4, cy, c)
      return
    }
    p.ellipse(cx, cy, 4.2, 3 * open, c, true)
    if (open > 0.4) for (let y = -2; y <= 2; y++) p.off(cx, cy + y * open)
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
  if (m.fangs && st.kiss < 0.4) {
    // two fangs hanging from the corners
    for (const s of [-1, 1]) {
      const x = cx + s * Math.max(2, hw - 2)
      const yc = m.cy - smile * ((s * Math.max(2, hw - 2)) / hw) ** 2 - tilt * s
      for (let y = 0; y < 3; y++) p.set(x, yc + 1 + y, m.fangs)
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
  {
    name: 'Kitsune',
    idea: 'máscara de zorro japonesa: blanca, orejas y marcas rojas, ojos rasgados hacia arriba',
    draw(p, st) {
      const white: RGB = [74, 72, 80]
      const red: RGB = [255, 30, 50]
      for (let y = 5; y < ROWS; y++) for (let x = 0; x < COLS; x++) p.set(x, y, white)
      // the ears: red outlines rising from the brow
      for (const s of [-1, 1]) {
        const bx = 15.5 + s * 9
        p.line(bx - 4, 7, bx + s * 1, 0, red)
        p.line(bx + 4, 7, bx + s * 1, 0, red)
        p.line(bx - 2, 6, bx + s * 1, 2, [255, 120, 150])
      }
      // flames on the brow, marks from the corners of the eyes
      for (let i = 0; i < 3; i++) p.set(15.5, 9 + i * 2, red)
      p.line(14.5, 11, 13.5, 13, red)
      p.line(16.5, 11, 17.5, 13, red)
      drawBrows(p, st, red, true, true)
      EYES_X.forEach((cx, i) => {
        const side = i === 0 ? -1 : 1
        drawEye(p, cx, EYE_Y, i === 0 ? st.openL : st.openR, 'slant', [6, 6, 8], red, side)
        p.line(cx + side * 5, EYE_Y - 2, cx + side * 8, EYE_Y - 5, red)
        p.line(cx + side * 3, EYE_Y + 4, cx + side * 6, EYE_Y + 7, red)
      })
      p.off(14.5, 24)
      p.off(16.5, 24)
      drawMouth(p, st, { cy: 29, hw: 4.5, smile: 1.5, open: 0, lip: red, lipT: 1 })
    },
  },
  {
    name: 'Oni',
    idea: 'demonio japonés: cuernos dorados, cejas furiosas, ojos de oro y una boca con colmillos que cuelgan',
    draw(p, st) {
      const gold: RGB = [255, 190, 40]
      const red: RGB = [255, 35, 30]
      for (const s of [-1, 1]) {
        p.line(15.5 + s * 7, 8, 15.5 + s * 10, 3, gold)
        p.line(15.5 + s * 10, 3, 15.5 + s * 9, 0, gold)
        p.line(15.5 + s * 9, 8, 15.5 + s * 11, 4, gold)
      }
      // brows: thick and angry, the inner ends down
      EYES_X.forEach((cx, i) => {
        const side = i === 0 ? -1 : 1
        const up = 3 * st.brow - (side > 0 ? 1.5 * st.wink : 0)
        for (const dy of [0, 1]) p.line(cx - side * 5, EYE_Y - 7 - up + dy, cx + side * 4, EYE_Y - 4 - up + dy + (side > 0 ? st.wink : 0), red)
        drawEye(p, cx, EYE_Y, i === 0 ? st.openL : st.openR, 'socket', gold, [255, 255, 220], side)
      })
      p.line(13.5, 21, 15.5, 24, red)
      p.line(17.5, 21, 15.5, 24, red)
      drawMouth(p, st, { cy: 30, hw: 10, smile: -1.5, open: 2.4, lip: red, lipT: 1, teeth: gold, gap: 2, fangs: [255, 240, 200] })
    },
  },
  {
    name: 'El grito',
    idea: 'la cara que grita, estirada: ojos caídos y una boca larga y abierta, todo ondulando',
    draw(p, st) {
      const pale: RGB = [215, 205, 170]
      // the swirling sky behind, faint waves of orange and blue
      for (let y = 0; y < ROWS; y += 3) for (let x = 0; x < COLS; x++) p.set(x, y + Math.round(Math.sin(x * 0.45 + y * 0.3 + st.t * 1.5) * 1.2), y < 20 ? [90, 40, 10] : [10, 30, 80])
      drawBrows(p, st, pale, false)
      EYES_X.forEach((cx, i) => drawEye(p, cx + (i === 0 ? 1 : -1), EYE_Y + 1, i === 0 ? st.openL : st.openR, 'long', pale, pale, i === 0 ? -1 : 1))
      p.line(15.5, 20, 15.5, 24, dim(pale, 0.7))
      drawMouth(p, st, { cy: 31, hw: 3.2, smile: 0, open: 4.2, lip: pale, lipT: 1 })
    },
  },
  {
    name: 'Arquero',
    idea: 'máscara de arquero de hockey: placa marfil agujereada, rayas rojas, y la boca solo para las señas',
    draw(p, st) {
      const plate: RGB = [96, 92, 84]
      const red: RGB = [230, 20, 20]
      for (let y = 1; y < ROWS; y++) for (let x = 0; x < COLS; x++) p.set(x, y, plate)
      for (let y = 4; y < ROWS - 1; y += 3) for (let x = 3; x < COLS - 2; x += 3) if (Math.abs(y - EYE_Y) > 4) p.off(x, y)
      for (let i = 0; i < 3; i++) {
        p.line(13.5 + i * 2, 3, 13.5 + i * 2, 8, red)
        p.line(6 + i * 2, 21, 6 + i * 2, 25, red)
        p.line(21 + i * 2, 21, 21 + i * 2, 25, red)
      }
      drawBrows(p, st, red, false)
      EYES_X.forEach((cx, i) => drawEye(p, cx, EYE_Y, i === 0 ? st.openL : st.openR, 'hole', [20, 0, 0], red, i === 0 ? -1 : 1))
      drawMouth(p, st, { cy: 30, hw: 7, smile: 0, open: 0, lip: red, lipT: 1, hidden: true })
    },
  },
  {
    name: 'Purga',
    idea: 'cables de neón cosidos: mitad azul, mitad roja, una sonrisa cosida de oreja a oreja',
    draw(p, st) {
      const blue: RGB = [40, 110, 255]
      const red: RGB = [255, 30, 40]
      const col = (x: number): RGB => (x < 15.5 ? blue : red)
      // the outline of a face in wire
      for (let y = 4; y < 37; y++) {
        const w = 12.5 - Math.max(0, y - 24) * 0.6
        p.set(15.5 - w, y, blue)
        p.set(15.5 + w, y, red)
      }
      for (let x = 4; x < 28; x++) p.set(x, 4, col(x))
      drawBrows(p, st, [220, 220, 255], false)
      EYES_X.forEach((cx, i) => {
        drawEye(p, cx, EYE_Y, i === 0 ? st.openL : st.openR, 'hollow', col(cx), col(cx), i === 0 ? -1 : 1)
        p.line(cx - 2, EYE_Y + 7, cx + 2, EYE_Y + 9, col(cx))
        p.line(cx - 2, EYE_Y + 9, cx + 2, EYE_Y + 7, col(cx))
      })
      drawMouth(p, st, { cy: 29, hw: 10.5, smile: 3, open: 0, lip: [235, 235, 245], lipT: 1, stitch: [255, 60, 180] })
    },
  },
  {
    name: 'Glitch',
    idea: 'una cara que se rompe todo el tiempo: colores corridos, bloques que saltan, líneas que se cortan',
    draw(p, st) {
      const white: RGB = [235, 240, 255]
      drawBrows(p, st, white, false)
      EYES_X.forEach((cx, i) => drawEye(p, cx, EYE_Y, i === 0 ? st.openL : st.openR, 'glitch', white, white, i === 0 ? -1 : 1))
      drawMouth(p, st, { cy: 29, hw: 8, smile: 1, open: 1.4, lip: white, lipT: 1, teeth: [120, 255, 160], gap: 2 })
      // corrupted blocks: a new handful eight times a second
      const f = Math.floor(st.t * 8)
      for (let i = 0; i < 5; i++) {
        const r = Math.sin(f * 12.9898 + i * 78.233) * 43758.5453
        const x = Math.floor((r - Math.floor(r)) * 28)
        const y = Math.floor((Math.abs(Math.sin(r)) * 36) % 36)
        const c: RGB = i % 3 === 0 ? [255, 0, 90] : i % 3 === 1 ? [0, 255, 200] : [90, 60, 255]
        for (let dx = 0; dx < 3 + (i % 3); dx++) p.set(x + dx, y, c)
      }
      // and every other line, now and then, goes dark
      if (f % 7 === 0) for (let y = 0; y < ROWS; y += 2) for (let x = 0; x < COLS; x++) p.set(x, y, [0, 0, 0], 0.7)
    },
  },
  {
    name: 'Cíclope',
    idea: 'un solo ojo enorme, inyectado en sangre, que no deja de mirar la mesa',
    draw(p, st) {
      const white: RGB = [200, 196, 190]
      const red: RGB = [220, 20, 20]
      const cx = 15.5
      const cy = EYE_Y + 1
      const open = st.openL
      // one brow over the one eye, lifting for the as de espadas, tipping for the wink
      for (const dy of [0, 1]) p.line(cx - 8, cy - 9 - 3 * st.brow + dy, cx + 8, cy - 9 - 3 * st.brow + dy + 3 * st.wink, red)
      if (open < 0.15) p.line(cx - 8, cy, cx + 8, cy, white)
      else {
        p.ellipse(cx, cy, 8, 5.4 * open, white, true)
        for (const [x0, y0, x1, y1] of [[-8, 0, -4, -1], [8, 0, 5, 2], [-7, 2, -4, 3], [6, -2, 4, -1]]) p.line(cx + x0, cy + y0 * open, cx + x1, cy + y1 * open, red)
        const ix = cx + Math.sin(st.t * 0.7) * 2.5
        p.ellipse(ix, cy, 3, Math.min(3, 5.4 * open), [200, 0, 30], true)
        p.ellipse(ix, cy, 1.4, Math.min(1.4, 5.4 * open), [0, 0, 0], true)
        // the wink: a lid coming down slanted from the right
        if (st.wink > 0.05) {
          for (let x = -8; x <= 8; x++) {
            const edge = -6 + st.wink * (x + 8) * 0.75 // nothing on the left, shut on the right
            for (let y = -6; y < edge; y++) p.off(cx + x, cy + y)
            p.set(cx + x, edge, white) // the rim of the lid, slanting down to the right
          }
        }
      }
      drawMouth(p, st, { cy: 31, hw: 6, smile: -0.6, open: 0, lip: dim(white, 0.7), lipT: 1 })
    },
  },
  {
    name: 'Llorona',
    idea: 'la Llorona: pelo largo y negro, ojos hundidos y lágrimas que no paran de caer',
    draw(p, st) {
      const pale: RGB = [190, 200, 215]
      const hair: RGB = [70, 30, 110]
      for (let x = 0; x < COLS; x++) {
        const side = x < 7 || x > 24
        const top = x >= 7 && x <= 24 ? 7 - Math.round(Math.abs(x - 15.5) * 0.2) : ROWS
        for (let y = 0; y < (side ? ROWS : top); y++) if ((x + y) % 3 !== 0) p.set(x, y, hair)
      }
      // sad brows: the inner ends lifted
      if (st.brow < 0.05 && st.wink < 0.05) EYES_X.forEach((cx, i) => p.line(cx - 3, EYE_Y - 5 + (i === 0 ? 1 : -1), cx + 3, EYE_Y - 5 + (i === 0 ? -1 : 1), dim(pale, 0.8)))
      drawBrows(p, st, pale, false)
      EYES_X.forEach((cx, i) => {
        drawEye(p, cx, EYE_Y, i === 0 ? st.openL : st.openR, 'long', pale, pale, i === 0 ? -1 : 1)
        // tears falling, one after another
        for (let k = 0; k < 3; k++) {
          const y = EYE_Y + 6 + ((st.t * 6 + k * 5 + i * 2) % 15)
          p.set(cx, y, [120, 170, 255])
        }
      })
      drawMouth(p, st, { cy: 30, hw: 4, smile: -1.8, open: 1.2, lip: pale, lipT: 1 })
    },
  },
  {
    name: 'Gato negro',
    idea: 'gato negro: orejas en punta, ojos verdes de pupila rasgada, bigotes y dos colmillitos',
    draw(p, st) {
      const green: RGB = [80, 255, 60]
      const vio: RGB = [140, 70, 220]
      for (const s of [-1, 1]) {
        p.line(15.5 + s * 5, 6, 15.5 + s * 10, 0, vio)
        p.line(15.5 + s * 10, 0, 15.5 + s * 12, 8, vio)
      }
      drawBrows(p, st, vio, false)
      EYES_X.forEach((cx, i) => drawEye(p, cx, EYE_Y, i === 0 ? st.openL : st.openR, 'cat', green, [0, 0, 0], i === 0 ? -1 : 1))
      p.line(14.5, 23, 16.5, 23, [255, 120, 170])
      p.set(15.5, 24, [255, 120, 170])
      for (const s of [-1, 1]) for (let i = 0; i < 3; i++) p.line(15.5 + s * 5, 25 + i, 15.5 + s * 12, 23 + i * 2, [180, 180, 200])
      drawMouth(p, st, { cy: 27, hw: 4, smile: -1.2, open: 0, lip: [210, 210, 230], lipT: 1, fangs: [255, 255, 255] })
    },
  },
  {
    name: 'Lobo',
    idea: 'lobo: orejas grises, ojos ámbar rasgados, el hocico marcado y los colmillos afuera',
    draw(p, st) {
      const grey: RGB = [150, 155, 170]
      const amber: RGB = [255, 170, 20]
      for (const s of [-1, 1]) {
        p.line(15.5 + s * 6, 7, 15.5 + s * 11, 0, grey)
        p.line(15.5 + s * 11, 0, 15.5 + s * 13, 10, grey)
      }
      drawBrows(p, st, grey, true)
      EYES_X.forEach((cx, i) => drawEye(p, cx, EYE_Y, i === 0 ? st.openL : st.openR, 'slant', amber, [255, 80, 0], i === 0 ? -1 : 1))
      // the muzzle: two lines down from between the eyes to the nose
      p.line(13.5, 18, 12.5, 24, dim(grey, 0.7))
      p.line(17.5, 18, 18.5, 24, dim(grey, 0.7))
      p.ellipse(15.5, 24, 2.5, 1.6, null, true)
      p.ellipse(15.5, 24, 2.5, 1.6, grey, false, 1)
      drawMouth(p, st, { cy: 30, hw: 7, smile: -1, open: 1.6, lip: grey, lipT: 1, teeth: [235, 235, 235], gap: 2, fangs: [255, 255, 255] })
    },
  },
  {
    name: 'Rey de espadas',
    idea: 'la cara del rey de la baraja española: corona, barba, y una espada en la frente',
    draw(p, st) {
      const yellow: RGB = [255, 200, 40]
      const red: RGB = [230, 30, 30]
      const blue: RGB = [50, 110, 255]
      // the crown: a zigzag band with jewels
      for (let x = 5; x < 27; x++) {
        p.set(x, 7, yellow)
        p.set(x, 1 + Math.abs(((x - 5) % 6) - 3) * 1.6, yellow)
      }
      for (let x = 5; x < 27; x += 6) for (let y = Math.round(1 + 4.8); y < 7; y++) p.set(x + 3, y - 4, yellow)
      ;[8, 15.5, 23].forEach((x, i) => p.set(x, 5, i === 1 ? blue : red))
      // the sword on the brow
      p.line(15.5, 8, 15.5, 12, blue)
      p.line(14.5, 9, 16.5, 9, yellow)
      drawBrows(p, st, yellow, true)
      EYES_X.forEach((cx, i) => drawEye(p, cx, EYE_Y, i === 0 ? st.openL : st.openR, 'ring', blue, blue, i === 0 ? -1 : 1))
      p.line(15.5, 19, 14.5, 24, red)
      p.line(14.5, 24, 16.5, 24, red)
      // moustache and beard
      for (const s of [-1, 1]) p.line(15.5 + s * 1, 26, 15.5 + s * 6, 28, yellow)
      for (let y = 32; y < 39; y++) for (let x = 0; x < COLS; x++) if (Math.abs(x - 15.5) < 10 - (y - 32) * 1.2 && (x + y) % 2 === 0) p.set(x, y, dim(yellow, 0.8))
      drawMouth(p, st, { cy: 29.5, hw: 4, smile: 0.5, open: 0, lip: red, lipT: 1 })
    },
  },
  {
    name: 'Polilla',
    idea: 'polilla: antenas plumosas, ojos de ala con anillos concéntricos, una boquita de insecto',
    draw(p, st) {
      const orange: RGB = [255, 130, 20]
      const yellow: RGB = [255, 220, 90]
      const brown: RGB = [120, 60, 20]
      for (const s of [-1, 1]) {
        p.line(15.5 + s * 1, 9, 15.5 + s * 6, 1, brown)
        for (let i = 0; i < 4; i++) p.set(15.5 + s * (2 + i * 1.2) + s, 7 - i * 2, orange)
      }
      // the eyespots of a wing round each eye
      EYES_X.forEach((cx, i) => {
        p.ellipse(cx, EYE_Y, 7, 7, brown, false, 1)
        p.ellipse(cx, EYE_Y, 5.5, 5.5, orange, false, 1)
        drawEye(p, cx, EYE_Y, i === 0 ? st.openL : st.openR, 'ring', yellow, yellow, i === 0 ? -1 : 1)
      })
      drawBrows(p, st, yellow, false)
      for (let y = 24; y < 38; y += 2) p.line(12.5, y, 18.5, y, dim(brown, 0.8))
      drawMouth(p, st, { cy: 29, hw: 3, smile: -0.5, open: 0, lip: orange, lipT: 1 })
    },
  },
  // ---- from the faces that come with the masks' own app (Shining Mask) and the sellers' photos of its presets
  {
    name: 'Ópera china',
    idea: 'cara pintada de la ópera de Pekín: rojo, blanco alrededor de los ojos, cejas negras que suben, marca dorada en la frente',
    draw(p, st) {
      const red: RGB = [200, 22, 28]
      const white: RGB = [230, 225, 215]
      const gold: RGB = [255, 200, 40]
      for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) p.set(x, y, red)
      EYES_X.forEach((cx) => p.ellipse(cx, EYE_Y, 6.5, 5, white, true))
      for (let y = 8; y < 25; y++) for (let x = 14; x < 18; x++) p.set(x, y, white)
      // the swooping black brows, the lift of the as de espadas, the drop of the wink
      EYES_X.forEach((cx, i) => {
        const side = i === 0 ? -1 : 1
        const up = 3 * st.brow - (side > 0 ? 2 * st.wink : 0)
        for (const dy of [0, 1]) p.line(cx - side * 2, EYE_Y - 5 - up + dy, cx + side * 7, EYE_Y - 10 - up + dy, [0, 0, 0])
        drawEye(p, cx, EYE_Y, i === 0 ? st.openL : st.openR, 'hole', white, [0, 0, 0], side)
        // a black swirl on each cheek
        p.line(cx + side * 2, EYE_Y + 7, cx + side * 5, EYE_Y + 10, [0, 0, 0])
        p.line(cx + side * 5, EYE_Y + 10, cx + side * 3, EYE_Y + 12, [0, 0, 0])
      })
      for (let i = 0; i < 4; i++) p.line(15.5 - i * 0.5, 2 + i, 15.5 + i * 0.5, 2 + i, gold)
      for (let i = 0; i < 4; i++) p.line(15.5 - (3 - i) * 0.5, 6 + i, 15.5 + (3 - i) * 0.5, 6 + i, gold)
      drawMouth(p, st, { cy: 30, hw: 6, smile: -1.5, open: 0, lip: [0, 0, 0], lipT: 2 })
    },
  },
  {
    name: 'Calabaza',
    idea: 'calabaza tallada: ojos y nariz triangulares, sonrisa dentada, todo encendido desde adentro',
    draw(p, st) {
      const skin: RGB = [150, 60, 0]
      const glow: RGB = [255, 210, 70]
      for (let y = 3; y < ROWS; y++) for (let x = 0; x < COLS; x++) p.set(x, y, x % 6 === 2 ? dim(skin, 0.6) : skin)
      for (let y = 0; y < 3; y++) for (let x = 14; x < 18; x++) p.set(x, y, [40, 140, 30])
      drawBrows(p, st, glow, false)
      EYES_X.forEach((cx, i) => drawEye(p, cx, EYE_Y, i === 0 ? st.openL : st.openR, 'tri', glow, glow, i === 0 ? -1 : 1))
      for (let i = 0; i < 3; i++) p.line(15.5 - i, 21 + i, 15.5 + i, 21 + i, glow)
      drawMouth(p, st, { cy: 29, hw: 11, smile: 3.5, open: 2.6, lip: glow, lipT: 1, teeth: dim(skin, 0.8), gap: 3 })
    },
  },
  {
    name: 'Sonrisa roja',
    idea: 'ojos rojos entrecerrados de placer y una sonrisa enorme de dientes encendidos',
    draw(p, st) {
      const red: RGB = [255, 20, 20]
      drawBrows(p, st, red, false)
      EYES_X.forEach((cx, i) => drawEye(p, cx, EYE_Y + 1, i === 0 ? st.openL : st.openR, 'arc', red, red, i === 0 ? -1 : 1))
      drawMouth(p, st, { cy: 28, hw: 13, smile: 7, open: 3.2, lip: [255, 110, 0], lipT: 2, teeth: [255, 235, 170], gap: 2 })
    },
  },
  {
    name: 'Zombi',
    idea: 'piel gris verdosa con manchas y grietas, cuencas hundidas con un brillo amarillo, dientes podridos',
    draw(p, st) {
      for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
          const h = ((x * 73856093) ^ (y * 19349663)) >>> 0
          p.set(x, y, h % 9 === 0 ? [40, 50, 35] : h % 13 === 0 ? [95, 70, 60] : [70, 85, 68])
        }
      }
      ;[[6, 2], [7, 3], [7, 4], [8, 5], [9, 7], [22, 22], [23, 23], [23, 24], [24, 26], [26, 27]].forEach(([x, y]) => p.off(x, y))
      drawBrows(p, st, [20, 25, 18], true)
      EYES_X.forEach((cx, i) => {
        drawEye(p, cx, EYE_Y, i === 0 ? st.openL : st.openR, 'hole', [255, 220, 40], [20, 25, 18], i === 0 ? -1 : 1)
        if ((i === 0 ? st.openL : st.openR) > 0.5) p.set(cx - (i === 0 ? 1 : -1) * 0.5, EYE_Y, [255, 220, 40])
      })
      p.off(14.5, 23)
      p.off(16.5, 23)
      drawMouth(p, st, { cy: 30, hw: 7, smile: -1, open: 1.6, lip: [120, 115, 100], lipT: 1, teeth: [150, 135, 80], gap: 2 })
    },
  },
  {
    name: 'Arlequín',
    idea: 'cara blanca de maquillaje, una estrella negra sobre un ojo, una lágrima negra bajo el otro, labios negros',
    draw(p, st) {
      for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) p.set(x, y, [150, 148, 155])
      // the star over the signer's right eye
      const [sx, sy] = [EYES_X[1], EYE_Y]
      for (const [dx, dy] of [[0, -8], [0, 8], [-7, 0], [7, 0], [-4, -4], [4, -4], [-4, 4], [4, 4]]) p.line(sx, sy, sx + dx, sy + dy, [0, 0, 0])
      p.ellipse(sx, sy, 4.5, 4.5, [0, 0, 0], true)
      // the tear under the left
      p.line(EYES_X[0], EYE_Y + 5, EYES_X[0], EYE_Y + 8, [0, 0, 0])
      p.ellipse(EYES_X[0], EYE_Y + 9, 1, 1.4, [0, 0, 0], true)
      drawBrows(p, st, [0, 0, 0], true, true)
      EYES_X.forEach((cx, i) => drawEye(p, cx, EYE_Y, i === 0 ? st.openL : st.openR, i === 0 ? 'hole' : 'ring', i === 0 ? [255, 255, 255] : [150, 148, 155], [0, 0, 0], i === 0 ? -1 : 1))
      drawMouth(p, st, { cy: 30, hw: 5.5, smile: 1, open: 0, lip: [0, 0, 0], lipT: 2 })
    },
  },
  {
    name: 'Llamas',
    idea: 'llamas azules que suben por toda la cara, y en medio del fuego dos ojos y una boca negros',
    draw(p, st) {
      for (let x = 0; x < COLS; x++) {
        const h = 26 + 9 * Math.sin(x * 0.7 + st.t * 4) * Math.sin(x * 0.31 - st.t * 2.3) + 4 * Math.sin(x * 1.9 + st.t * 7)
        for (let y = ROWS - 1; y > ROWS - h; y--) {
          const u = (ROWS - y) / h // 0 at the bottom, 1 at the tip
          p.set(x, y, u < 0.25 ? [200, 230, 255] : u < 0.6 ? [40, 110, 255] : [10, 30, 140])
        }
      }
      drawBrows(p, st, [0, 0, 0], false)
      EYES_X.forEach((cx, i) => drawEye(p, cx, EYE_Y, i === 0 ? st.openL : st.openR, 'hole', [255, 255, 255], [0, 0, 0], i === 0 ? -1 : 1))
      drawMouth(p, st, { cy: 30, hw: 8, smile: -1, open: 0, lip: [0, 0, 0], lipT: 2 })
    },
  },
  {
    name: 'Calavera rosa',
    idea: 'calavera rellena, rosa como en la app: cuencas hondas, nariz hueca, dientes blancos',
    draw(p, st) {
      const bone: RGB = [190, 60, 140]
      p.ellipse(15.5, 15, 14.5, 14.5, bone, true)
      for (let y = 22; y < 36; y++) for (let x = 7; x < 25; x++) p.set(x, y, bone)
      for (const s of [-1, 1]) for (let y = 22; y < 28; y++) p.set(15.5 + s * 11, y, dim(bone, 0.55)) // the hollow of the cheek
      drawBrows(p, st, [255, 150, 220], false)
      EYES_X.forEach((cx, i) => drawEye(p, cx, EYE_Y, i === 0 ? st.openL : st.openR, 'hole', [255, 80, 160], [60, 10, 40], i === 0 ? -1 : 1))
      p.line(14, 21, 15.5, 24, [0, 0, 0])
      p.line(17, 21, 15.5, 24, [0, 0, 0])
      p.line(14.5, 21, 16.5, 21, [0, 0, 0])
      drawMouth(p, st, { cy: 30, hw: 8, smile: 0.5, open: 2.4, lip: dim(bone, 0.7), lipT: 1, teeth: [255, 225, 240], gap: 2 })
    },
  },
  {
    name: 'Espiral',
    idea: 'una espiral de colores que gira sin parar sobre toda la cara; los ojos y la boca son huecos negros',
    draw(p, st) {
      for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
          const a = Math.atan2(y - 19.5, x - 15.5) / (Math.PI * 2)
          const r = Math.hypot(x - 15.5, y - 19.5)
          p.set(x, y, hsv(a + r * 0.05 - st.t * 0.35, 0.95, 0.75))
        }
      }
      drawBrows(p, st, [0, 0, 0], false)
      EYES_X.forEach((cx, i) => drawEye(p, cx, EYE_Y, i === 0 ? st.openL : st.openR, 'hole', [255, 255, 255], [0, 0, 0], i === 0 ? -1 : 1))
      drawMouth(p, st, { cy: 30, hw: 6, smile: 0, open: 1, lip: [0, 0, 0], lipT: 1 })
    },
  },
  {
    name: 'Goteo',
    idea: 'ojos en cruz y una sonrisa de neón verde que chorrea, como la cara más vista en estas máscaras',
    draw(p, st) {
      const green: RGB = [60, 255, 150]
      drawBrows(p, st, green, false)
      EYES_X.forEach((cx, i) => drawEye(p, cx, EYE_Y, i === 0 ? st.openL : st.openR, 'x', green, green, i === 0 ? -1 : 1))
      drawMouth(p, st, { cy: 28, hw: 10, smile: 3, open: 0, lip: green, lipT: 2 })
      // drips running down from the smile, each at its own pace
      const mouthBusy = Math.max(Math.abs(st.shift), st.wide, st.kiss, st.fishOn, st.bite)
      if (mouthBusy < 0.3) [-6, -2, 3, 7].forEach((dx, i) => {
        const len = 1 + ((st.t * (1.5 + i * 0.4) + i) % 5)
        const t = dx / 10
        for (let y = 0; y < len; y++) p.set(15.5 + dx, 28 - 3 * t * t + 2 + y, green)
      })
    },
  },
  {
    name: 'Payaso triste',
    idea: 'payaso azulado: blanco alrededor de los ojos, rombos azules, nariz roja y una boca roja caída',
    draw(p, st) {
      for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) p.set(x, y, [70, 90, 150])
      EYES_X.forEach((cx) => p.ellipse(cx, EYE_Y, 5.5, 6, [215, 220, 235], true))
      EYES_X.forEach((cx, i) => {
        const side = i === 0 ? -1 : 1
        // the diamonds through each eye: a sad clown's
        p.line(cx, EYE_Y - 9, cx - 2, EYE_Y - 6, [30, 70, 255])
        p.line(cx, EYE_Y - 9, cx + 2, EYE_Y - 6, [30, 70, 255])
        p.line(cx, EYE_Y + 9, cx - 2, EYE_Y + 6, [30, 70, 255])
        p.line(cx, EYE_Y + 9, cx + 2, EYE_Y + 6, [30, 70, 255])
        drawEye(p, cx, EYE_Y, i === 0 ? st.openL : st.openR, 'hole', [255, 255, 255], [0, 0, 0], side)
      })
      drawBrows(p, st, [0, 0, 0], false)
      p.ellipse(15.5, 23, 2.8, 2.5, [255, 30, 30], true)
      drawMouth(p, st, { cy: 30, hw: 9, smile: -3, open: 0, lip: [230, 20, 30], lipT: 2 })
    },
  },
  {
    name: 'Zorro neón',
    idea: 'contorno de zorro en neón, de las máscaras de pocos LEDs: orejas en punta, ojos rojos rasgados',
    draw(p, st) {
      const blue: RGB = [40, 120, 255]
      const red: RGB = [255, 30, 40]
      for (const s of [-1, 1]) {
        p.line(15.5 + s * 12, 10, 15.5 + s * 9, 0, blue)
        p.line(15.5 + s * 9, 0, 15.5 + s * 4, 8, blue)
        p.line(15.5 + s * 12, 10, 15.5 + s * 1, 35, blue)
        p.line(15.5 + s * 9, 3, 15.5 + s * 6, 8, red)
        p.line(15.5 + s * 4, 8, 15.5 + s * 1, 10, blue)
      }
      drawBrows(p, st, blue, false)
      EYES_X.forEach((cx, i) => drawEye(p, cx, EYE_Y + 1, i === 0 ? st.openL : st.openR, 'slant', red, red, i === 0 ? -1 : 1))
      p.ellipse(15.5, 32, 1.6, 1.2, blue, true)
      drawMouth(p, st, { cy: 27, hw: 5, smile: 0, open: 0, lip: red, lipT: 1, hidden: true })
    },
  },
  {
    name: 'Calavera en llamas',
    idea: 'calavera de hueso con el fuego saliéndole de la cabeza y un brillo rojo en el fondo de las cuencas',
    draw(p, st) {
      for (let x = 0; x < COLS; x++) {
        const h = 10 + 5 * Math.sin(x * 0.8 + st.t * 5) * Math.sin(x * 0.37 - st.t * 3)
        for (let y = 0; y < h; y++) p.set(x, 13 - y, y < h * 0.4 ? [255, 220, 60] : y < h * 0.75 ? [255, 110, 0] : [180, 20, 0])
      }
      const bone: RGB = [150, 140, 125]
      p.ellipse(15.5, 18, 12.5, 11, bone, true)
      for (let y = 24; y < 35; y++) for (let x = 9; x < 23; x++) p.set(x, y, bone)
      drawBrows(p, st, [255, 110, 0], false)
      EYES_X.forEach((cx, i) => drawEye(p, cx + (i === 0 ? 1 : -1), EYE_Y + 2, i === 0 ? st.openL : st.openR, 'hole', [255, 40, 0], [60, 20, 0], i === 0 ? -1 : 1))
      p.line(14, 23, 15.5, 26, [0, 0, 0])
      p.line(17, 23, 15.5, 26, [0, 0, 0])
      drawMouth(p, st, { cy: 30, hw: 6.5, smile: 0.5, open: 2, lip: dim(bone, 0.6), lipT: 1, teeth: [235, 225, 205], gap: 2 })
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
interface Mask { group: THREE.Group; glow: THREE.Color; draw(s: Sena | null, k: number, t: number): void }

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
  const glow = new THREE.Color() // the average colour of the face, for the light it throws
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
    glow.setRGB(r / n, gg / n, b / n).multiplyScalar(4)
  }
  return { group, glow, draw }
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
masks.forEach((m) => scene.add(m.group))
/** Where mask i sits in the grid of all of them: six across on a wide screen, three on a phone. */
function gridOf(aspect: number) {
  const cols = aspect < 1 ? 3 : 6
  const rows = Math.ceil(masks.length / cols)
  const home = (i: number) => new THREE.Vector3(((cols - 1) / 2 - (i % cols)) * SX, ((rows - 1) / 2 - Math.floor(i / cols)) * SY, 0)
  return { cols, rows, home }
}
// the light of the face up close falls on what is in front of it
const faceLight = new THREE.PointLight(0xffffff, 0, 0.9, 2)
faceLight.position.set(0, -0.02, -0.12)
scene.add(faceLight)
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
let focus = Number(params.get('m') ?? -1) // −1: all of them; otherwise one mask, close
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
  camera.aspect = W / H
  const grid = gridOf(camera.aspect)
  masks.forEach((m, i) => {
    const show = focus < 0 || focus === i
    m.group.visible = show
    if (!show) return
    const home = focus < 0 ? grid.home(i) : new THREE.Vector3()
    m.group.position.set(home.x, home.y + Math.sin(ts * 1.2 + i) * 0.006, home.z)
    m.group.rotation.set(headSena === 'si' ? 0.24 * wave : Math.sin(ts * 0.8 + i) * 0.04, headSena === 'no' ? 0.4 * wave : Math.sin(ts * 0.55 + i * 1.3) * 0.12, Math.sin(ts * 0.5 + i) * 0.03)
    m.draw(s && !isHeadSena(s) ? s : null, k, ts)
  })
  faceLight.intensity = focus >= 0 ? 0.35 : 0
  if (focus >= 0) faceLight.color.copy(masks[focus].glow)
  const tanH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))
  const halfW = focus < 0 ? ((grid.cols - 1) / 2) * SX + HW + 0.03 : HW + 0.05
  const halfH = focus < 0 ? ((grid.rows - 1) / 2) * SY + HH + 0.05 : HH + 0.07
  // on a tall, narrow screen (a phone) the buttons take the bottom: step back and frame the masks higher
  const narrow = camera.aspect < 1
  const d = Math.max(halfH / tanH, halfW / (tanH * camera.aspect)) * (narrow ? (focus < 0 ? 1.45 : 1.25) : 1)
  const lookY = narrow ? -halfH * (focus < 0 ? 0.3 : 0.55) : 0
  felt.visible = focus >= 0 // with all of them in a grid, the lower rows would sink into the table
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
