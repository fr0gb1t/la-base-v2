// An LED mask, as the real ones are made: a shallow shield curved like a visor, a broad flat brow, straight sides
// down to the cheeks and a chin that narrows to a rounded point, a thick black plastic rim, two tabs at eye height
// where the strap would go; behind the glass a matrix of 32 × 40 LEDs (the unlit ones still show as faint dots).
// Nobody wears it: it floats over the table. Its face is one of the designs in ledFaces.ts, redrawn every frame of
// the stop-motion from the seña in progress.
import * as THREE from 'three'
import type { LedFace, Sena } from '@la-base/shared'
import { LED_FACES } from '@la-base/shared'
import { COLS, ROWS, Px, faceState, ledDesign } from './ledFaces'

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
  return new THREE.CatmullRomCurve3(pts, true, 'centripetal').getSpacedPoints(180).map((p) => new THREE.Vector2(p.x, p.y))
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

let shared: { glass: THREE.BufferGeometry; back: THREE.BufferGeometry; rim: THREE.BufferGeometry; tab: THREE.BufferGeometry } | null = null
/** The mask's shape, the same for every mask: built once. */
function geometry() {
  if (shared) return shared
  const NX = 60
  const NY = 80
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
      // the glass is the cells inside the outline; the rim hides the ragged edge
      if (!inside(x0 + ((i + 0.5) / NX) * w, y0 + ((j + 0.5) / NY) * h)) continue
      idx.push(at(i, j), at(i + 1, j + 1), at(i + 1, j), at(i, j), at(i, j + 1), at(i + 1, j + 1))
    }
  }
  const glass = new THREE.BufferGeometry()
  glass.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  glass.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  glass.setIndex(idx)
  glass.computeVertexNormals()
  const back = glass.clone()
  back.translate(0, 0, 0.013) // the shell behind it
  const rimCurve = new THREE.CatmullRomCurve3(outline.map((p) => new THREE.Vector3(p.x, p.y, surfZ(p.x, p.y) + 0.005)), true)
  const rim = new THREE.TubeGeometry(rimCurve, 160, 0.0085, 8, true)
  const tab = new THREE.BoxGeometry(0.011, 0.034, 0.022)
  shared = { glass, back, rim, tab }
  return shared
}

// The matrix: the face comes in as a tiny texture (one texel per LED); the shader lays a round dot on each cell and
// lights it with its texel. Far away (a cell narrower than a few pixels) the dots melt into their average colour,
// so the grid never shimmers.
const LED_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`
const LED_FRAG = /* glsl */ `
uniform sampler2D map;
uniform vec2 grid;
uniform float glow;
varying vec2 vUv;
void main() {
  vec2 g = vUv * grid;
  vec2 cell = floor(g);
  float r = length(fract(g) - 0.5);
  float px = max(fwidth(g.x), 1e-4); // cells per pixel
  float dotMask = 1.0 - smoothstep(0.2, 0.36 + px, r);
  float far = clamp((px - 0.3) / 0.5, 0.0, 1.0);
  vec3 lit = texture2D(map, (cell + 0.5) / grid).rgb;
  // a lit LED is far brighter than anything the lamp lights (so it blooms), with a hot core and a halo that
  // spreads through the diffuser behind the glass
  float halo = exp(-r * r * 9.0);
  vec3 near = vec3(0.006) + vec3(0.022, 0.022, 0.026) * dotMask + lit * (dotMask * glow + halo * glow * 0.35 + 0.12);
  vec3 blur = vec3(0.012) + lit * glow * 0.55;
  gl_FragColor = vec4(mix(near, blur, far), 1.0);
  #include <colorspace_fragment>
}`

/** How bright a lit LED is, in the scene's linear light (the lamp lights the felt to about 1): well over the bloom's threshold. */
const LED_GLOW = 11.0
/** How strongly a full face lights what is before it. */
const SPILL = 2.5

export interface FaceRig {
  head: THREE.Group // what to place, turn and nod; the face looks down −z
  sena(s: Sena | null, amount: number): void
  tick(t: number): void // seconds; redraws the face (stop-motion)
  dispose(): void
}

const plastic = new THREE.MeshStandardMaterial({ color: 0x0b0b0e, roughness: 0.35, metalness: 0.1 })
const shellMat = new THREE.MeshStandardMaterial({ color: 0x08080a, roughness: 0.8, side: THREE.DoubleSide })

/** `glow`: how bright a lit LED is (LED_GLOW at the table, where the bloom gathers it; less where nothing does). */
export function makeLedMask(name: LedFace, seed: number, glow = LED_GLOW): FaceRig {
  const geo = geometry()
  const design = ledDesign(name, LED_FACES)
  const data = new Uint8Array(COLS * ROWS * 4)
  const tex = new THREE.DataTexture(data, COLS, ROWS, THREE.RGBAFormat)
  tex.magFilter = THREE.NearestFilter
  tex.minFilter = THREE.NearestFilter
  tex.colorSpace = THREE.SRGBColorSpace
  tex.needsUpdate = true
  const mat = new THREE.ShaderMaterial({
    uniforms: { map: { value: tex }, grid: { value: new THREE.Vector2(COLS, ROWS) }, glow: { value: glow } },
    vertexShader: LED_VERT,
    fragmentShader: LED_FRAG,
    side: THREE.DoubleSide,
  })
  const head = new THREE.Group()
  const glass = new THREE.Mesh(geo.glass, mat)
  head.add(glass, new THREE.Mesh(geo.back, shellMat), new THREE.Mesh(geo.rim, plastic))
  for (const s of [1, -1]) {
    const tab = new THREE.Mesh(geo.tab, plastic)
    const x = s * (HW + 0.004)
    tab.position.set(x, 0.035, surfZ(x, 0.035) + 0.01)
    tab.rotation.y = -s * Math.atan(8 * HW)
    head.add(tab)
  }
  head.traverse((o) => (o.castShadow = true))
  // the face lights what is in front of it (its own hands, the edge of the felt) in its colours
  const spill = new THREE.PointLight(0xffffff, 0, 0.9, 2)
  spill.position.set(0, -0.02, -0.12)
  head.add(spill)

  const px = new Px()
  let s: Sena | null = null
  let k = 0
  let lastKey = ''
  function sena(next: Sena | null, amount: number) {
    s = next
    k = next ? amount : 0
  }
  function tick(t: number) {
    const ts = Math.floor(t * 15) / 15 // stop-motion, like the rest of the table
    const key = `${ts}|${s}|${k.toFixed(2)}`
    if (key === lastKey) return
    lastKey = key
    px.clear()
    design.draw(px, faceState(s, k, ts, seed))
    // now and then the screen glitches: a band of rows slides sideways for a moment
    if (Math.sin(ts * 0.7 + seed * 2.3) > 0.992) {
      const y0 = Math.floor(((ts * 37 + seed * 11) % (ROWS - 6)) + 2)
      for (let y = y0; y < y0 + 4; y++) {
        const row = px.data.slice(y * COLS * 4, (y + 1) * COLS * 4)
        for (let x = 0; x < COLS; x++) px.data.set(row.subarray(((x + 3) % COLS) * 4, ((x + 3) % COLS) * 4 + 4), (y * COLS + x) * 4)
      }
    }
    // the drawing's row 0 is the top; the texture's is the bottom
    let r = 0, g = 0, b = 0
    for (let i = 0; i < px.data.length; i += 4) {
      r += px.data[i]
      g += px.data[i + 1]
      b += px.data[i + 2]
    }
    const sum = r + g + b
    if (sum > 0) spill.color.setRGB(r / sum, g / sum, b / sum, THREE.SRGBColorSpace)
    spill.intensity = Math.min(1, sum / (COLS * ROWS * 255 * 0.25)) * SPILL
    for (let y = 0; y < ROWS; y++) data.set(px.data.subarray(y * COLS * 4, (y + 1) * COLS * 4), (ROWS - 1 - y) * COLS * 4)
    tex.needsUpdate = true
  }
  tick(0)
  return {
    head,
    sena,
    tick,
    dispose() {
      tex.dispose()
      mat.dispose()
    },
  }
}
