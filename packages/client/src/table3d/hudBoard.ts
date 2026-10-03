import * as THREE from 'three'
import { PALETTE, hex } from './look'
import { CHAIR_R } from './seats'
import { isTouch } from '../lib/device'

// The game's controls, hung at the back of the room: a row of little CRT televisions on cables
// (historial, reglas, ajustes, salir: the picture is the button, green phosphor, its name appears on
// the glass under the pointer) and, beside them, a green seven-segment... fourteen-segment LED panel
// that spells out what to do next. Everything sways a little on its cables, like the lamp does. It all
// hangs above the heads of every seat, so nobody can stand in front of it.

export interface HudItem {
  id: string
  label: string // shown on the glass while the pointer is on it
  hint?: string // longer description, spelled on the LED panel while the pointer is on it
  svg: string // the icon, as an SVG string (only its path data is used)
  danger?: boolean // phosphor in amber-red instead of green
}

const GREEN = '#58ff7a'
const RED = '#ff6a3c'
const WALL_Z = -(CHAIR_R + 0.4) // behind the far chairs
const HANG_Y = 1.7 // the middle of the row (above the heads, inside the default view)
const TV_X0 = -1.2 // centre of the row of televisions
const TV_STEP = 0.5
const LED_X = 0.95
const LED_W = 1.56
const LED_H = 0.4

// ---------------------------------------------------------------------------------------------
// the LED panel: fourteen segments per character

const SEG_ORDER = 'ABCDEFGHJKLMNP' as const // A top, B/C right, D bottom, E/F left, G1/G2 middle (G, P), H/K upper diagonals, L/N lower, J/M centre
const GLYPHS: Record<string, string> = {
  A: 'ABCEFGP', B: 'ABCDPJM', C: 'ADEF', D: 'ABCDJM', E: 'ADEFGP', F: 'AEFGP', G: 'ACDEFP', H: 'BCEFGP',
  I: 'ADJM', J: 'BCDE', K: 'EFGKL', L: 'DEF', M: 'BCEFHK', N: 'BCEFHN', O: 'ABCDEF', P: 'ABEFGP',
  Q: 'ABCDEFN', R: 'ABEFGPN', S: 'ACDFGP', T: 'AJM', U: 'BCDEF', V: 'EFKL', W: 'BCEFLN', X: 'HKLN',
  Y: 'HKM', Z: 'ADKL',
  '0': 'ABCDEFKL', '1': 'BC', '2': 'ABDEGP', '3': 'ABCDP', '4': 'BCFGP', '5': 'ACDFGP', '6': 'ACDEFGP',
  '7': 'ABC', '8': 'ABCDEFGP', '9': 'ABCDFGP',
  '-': 'GP', '+': 'GPJM', '/': 'KL', ':': 'JM', '?': 'ABPM', '!': 'JM', '(': 'KN', ')': 'HL', '.': '', ',': 'L',
  '_': 'D', ' ': '',
}

/** What the panel can show: capitals without accents, digits and a little punctuation. */
function ledText(text: string) {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[¿¡]/g, '')
    .replace(/[…]/g, '...')
    .replace(/[—–·•]/g, '-')
    .toUpperCase()
    .replace(/[^A-Z0-9 :.,?!()+/_-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const COLS = 25
const ROWS = 3
const CELL_W = 40
const CELL_H = 76

function wrapLed(text: string): string[] {
  const lines: string[] = []
  let cur = ''
  for (const word of text.split(' ')) {
    const test = cur ? `${cur} ${word}` : word
    if (test.length > COLS && cur) {
      lines.push(cur)
      cur = word
    } else cur = test
  }
  if (cur) lines.push(cur)
  return lines.slice(0, ROWS)
}

function drawGlyph(g: CanvasRenderingContext2D, ch: string, x: number, y: number, w: number, h: number) {
  const t = w * 0.15
  const x0 = x + t
  const x1 = x + w - t
  const xm = x + w / 2
  const y0 = y + t
  const y1 = y + h - t
  const ym = y + h / 2
  const seg: Record<string, [number, number, number, number]> = {
    A: [x0 + t, y0, x1 - t, y0], D: [x0 + t, y1, x1 - t, y1],
    B: [x1, y0 + t, x1, ym - t / 2], C: [x1, ym + t / 2, x1, y1 - t],
    F: [x0, y0 + t, x0, ym - t / 2], E: [x0, ym + t / 2, x0, y1 - t],
    G: [x0 + t, ym, xm - t / 2, ym], P: [xm + t / 2, ym, x1 - t, ym],
    J: [xm, y0 + t, xm, ym - t], M: [xm, ym + t, xm, y1 - t],
    H: [x0 + t * 1.3, y0 + t * 1.3, xm - t, ym - t], K: [x1 - t * 1.3, y0 + t * 1.3, xm + t, ym - t],
    L: [x0 + t * 1.3, y1 - t * 1.3, xm - t, ym + t], N: [x1 - t * 1.3, y1 - t * 1.3, xm + t, ym + t],
  }
  const lit = GLYPHS[ch] ?? ''
  g.lineCap = 'round'
  g.lineWidth = t * 1.1
  // unlit segments first: the faint ghost of a real display
  g.shadowBlur = 0
  g.strokeStyle = 'rgba(88,255,122,0.07)'
  for (const k of SEG_ORDER) {
    const s = seg[k]
    if (!s || lit.includes(k)) continue
    g.beginPath()
    g.moveTo(s[0], s[1])
    g.lineTo(s[2], s[3])
    g.stroke()
  }
  g.strokeStyle = GREEN
  g.shadowColor = GREEN
  g.shadowBlur = 12
  for (const k of lit) {
    const s = seg[k]
    if (!s) continue
    g.beginPath()
    g.moveTo(s[0], s[1])
    g.lineTo(s[2], s[3])
    g.stroke()
  }
  if (ch === '.' || ch === ',') {
    g.fillStyle = GREEN
    g.beginPath()
    g.arc(x + w - t * 0.6, y + h - t * 0.6, t * 0.75, 0, Math.PI * 2)
    g.fill()
  }
  g.shadowBlur = 0
}

// ---------------------------------------------------------------------------------------------
// the televisions

/** The `d` of every path of an icon's SVG (the icons are plain filled paths on a 512 grid). */
function iconPaths(svg: string): { paths: string[]; box: number } {
  const paths = [...svg.matchAll(/<path[^>]*?\sd="([^"]+)"/g)].map((m) => m[1])
  const vb = /viewBox="0 0 (\d+(?:\.\d+)?) (\d+(?:\.\d+)?)"/.exec(svg)
  return { paths, box: vb ? Number(vb[1]) : 512 }
}

const SCREEN_W = 256
const SCREEN_H = 200

/** The picture on the tube, on a transparent layer: the icon in phosphor (and its name when `hot`). The static, scanlines and vignette are the glass shader's. */
function screenTexture(item: HudItem, hot: boolean) {
  const cv = document.createElement('canvas')
  cv.width = SCREEN_W
  cv.height = SCREEN_H
  const g = cv.getContext('2d')!
  const color = item.danger ? RED : GREEN
  const { paths, box } = iconPaths(item.svg)
  const size = hot ? 112 : 136
  const s = size / box
  g.save()
  g.translate((SCREEN_W - size) / 2, (SCREEN_H - size) / 2 - (hot ? 18 : 2))
  g.scale(s, s)
  g.shadowColor = color
  g.shadowBlur = hot ? 40 : 26
  g.fillStyle = color
  for (const d of paths) g.fill(new Path2D(d))
  g.restore()
  if (hot) {
    g.fillStyle = color
    g.shadowColor = color
    g.shadowBlur = 12
    g.font = '36px VT323, "Courier New", monospace'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillText(item.label.toUpperCase(), SCREEN_W / 2, SCREEN_H - 28)
  }
  const tex = new THREE.CanvasTexture(cv)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  return tex
}

/** The tube: static behind the icon, scanlines rolling, a vignette and a bright band that drifts down. */
function glassMaterial(map: THREE.Texture, tint: THREE.Color, seed: number, wear: THREE.Vector4) {
  return new THREE.ShaderMaterial({
    uniforms: { map: { value: map }, time: { value: 0 }, glow: { value: 0 }, tint: { value: tint }, seed: { value: seed }, wear: { value: wear } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `
      varying vec2 vUv; uniform sampler2D map; uniform float time; uniform float glow; uniform vec3 tint; uniform float seed; uniform vec4 wear; // x: static, y: smudge, z: roll speed, w: dead edge
      float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
      void main(){
        vec2 uv = vUv;
        // barrel: the picture bows out toward the middle of the glass, as on a real tube
        vec2 c0 = uv - 0.5;
        uv = 0.5 + c0 * (1.0 + 0.16 * dot(c0, c0) * 4.0);
        // the glass has rounded corners
        vec2 q = abs(vUv - 0.5) - vec2(0.5 - 0.11, 0.5 - 0.14);
        float edgeD = length(max(q, 0.0)) - 0.11;
        if (edgeD > 0.0) { gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); return; }
        // a slight horizontal tear that comes and goes
        float tear = step(0.992, hash(vec2(floor(time * 9.0), seed))) * (hash(vec2(floor(uv.y * 40.0), floor(time * 18.0))) - 0.5) * 0.05;
        uv.x += tear;
        float f = floor(time * 24.0);
        vec2 cell = floor(uv * vec2(150.0, 118.0));
        float n = hash(cell + f * 1.7 + seed);
        float grain = 0.55 + 0.9 * n;
        vec3 base = tint * (0.03 + 0.1 * grain * grain * wear.x) * (0.8 + glow * 0.6);
        vec4 ic = texture2D(map, uv);
        vec3 col = base + ic.rgb * ic.a * (1.5 + glow * 0.7);
        // scanlines and the rolling band
        col *= 0.78 + 0.22 * sin(uv.y * 520.0);
        col *= 0.9 + 0.35 * smoothstep(0.0, 0.5, 0.5 - abs(fract(uv.y - time * wear.z) - 0.5));
        // smudges and dust on the glass, different on every set
        float sm = hash(floor(uv * 9.0) + seed) * smoothstep(0.55, 0.0, length(fract(uv * 9.0) - 0.5));
        col += vec3(0.05, 0.06, 0.05) * sm * wear.y;
        col *= 1.0 - smoothstep(-0.03, 0.0, edgeD) * (0.5 + wear.w);
        // vignette (the tube's edge falls away)
        vec2 d = uv - 0.5;
        col *= 1.0 - 1.5 * dot(d, d);
        // a hint of reflection, top-left
        col += vec3(0.05) * smoothstep(0.55, 0.0, length(uv - vec2(0.2, 0.85)));
        gl_FragColor = vec4(col * (1.0 + 0.04 * sin(time * 60.0 + seed)), 1.0);
      }`,
    toneMapped: false,
    fog: false,
  } as THREE.ShaderMaterialParameters)
}

/** A glass front that bulges toward you like a tube's face: a dome, curved both ways. */
function tubeGeometry(w: number, h: number, bulge: number) {
  const geo = new THREE.PlaneGeometry(w, h, 22, 18)
  const pos = geo.getAttribute('position')
  for (let i = 0; i < pos.count; i++) {
    const nx = pos.getX(i) / (w / 2)
    const ny = pos.getY(i) / (h / 2)
    pos.setZ(i, bulge * Math.max(0, 1 - 0.5 * nx * nx - 0.5 * ny * ny))
  }
  geo.computeVertexNormals()
  return geo
}

/** A small seeded generator, so each set is its own but a set never changes between frames. */
function rng(seed: number) {
  let t = (seed * 2654435761) >>> 0
  return () => {
    t = (t + 0x6d2b79f5) >>> 0
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

/** Years of use on the front of one set: grime in the edges and corners, scratches, chips, dust and a thumbprint. Every set draws its own. */
function wearTexture(w: number, h: number, hole: { x: number; y: number; w: number; h: number }, rnd: () => number, amount: number) {
  const cv = document.createElement('canvas')
  cv.width = 512
  cv.height = Math.round((512 * h) / w)
  const g = cv.getContext('2d')!
  const W = cv.width
  const H = cv.height
  // grime gathering at the edges, heavier in a random corner
  const cx = rnd() < 0.5 ? 0 : W
  const cy = rnd() < 0.5 ? 0 : H
  const edge = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.62)
  edge.addColorStop(0, 'rgba(0,0,0,0)')
  edge.addColorStop(1, `rgba(0,0,0,${0.3 + 0.3 * amount})`)
  g.fillStyle = edge
  g.fillRect(0, 0, W, H)
  const corner = g.createRadialGradient(cx, cy, 0, cx, cy, W * (0.25 + 0.35 * rnd()))
  corner.addColorStop(0, `rgba(10,8,6,${0.25 + 0.4 * amount})`)
  corner.addColorStop(1, 'rgba(10,8,6,0)')
  g.fillStyle = corner
  g.fillRect(0, 0, W, H)
  // sun-faded / dusty patches
  for (let i = 0; i < 3 + Math.floor(rnd() * 5); i++) {
    const x = rnd() * W
    const y = rnd() * H
    const r = 30 + rnd() * 90
    const p = g.createRadialGradient(x, y, 0, x, y, r)
    p.addColorStop(0, `rgba(150,146,138,${0.05 + 0.12 * rnd() * amount})`)
    p.addColorStop(1, 'rgba(150,146,138,0)')
    g.fillStyle = p
    g.fillRect(x - r, y - r, r * 2, r * 2)
  }
  // scratches: thin pale lines, mostly short, a few long
  g.lineCap = 'round'
  const scratches = Math.floor(5 + rnd() * 20 * amount + rnd() * 6)
  for (let i = 0; i < scratches; i++) {
    const x = rnd() * W
    const y = rnd() * H
    const len = (rnd() < 0.2 ? 90 : 18) + rnd() * 50
    const a = rnd() * Math.PI
    g.strokeStyle = `rgba(190,186,176,${0.1 + 0.3 * rnd()})`
    g.lineWidth = 0.6 + rnd() * 1.4
    g.beginPath()
    g.moveTo(x, y)
    g.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len * 0.4)
    g.stroke()
  }
  // chips on the corners and edges: bare lighter plastic
  for (let i = 0; i < Math.floor(rnd() * 5 * amount + (rnd() < 0.5 ? 1 : 0)); i++) {
    const onX = rnd() < 0.5
    const x = onX ? (rnd() < 0.5 ? 6 : W - 6) : rnd() * W
    const y = onX ? rnd() * H : rnd() < 0.5 ? 6 : H - 6
    g.fillStyle = `rgba(120,116,108,${0.25 + 0.3 * rnd()})`
    g.beginPath()
    g.ellipse(x, y, 2 + rnd() * 6, 1.5 + rnd() * 4, rnd() * 3, 0, Math.PI * 2)
    g.fill()
  }
  // dust specks
  for (let i = 0; i < 80 + rnd() * 200; i++) {
    g.fillStyle = `rgba(${rnd() < 0.5 ? '170,166,158' : '0,0,0'},${0.05 + 0.2 * rnd()})`
    g.fillRect(rnd() * W, rnd() * H, 1 + rnd() * 1.5, 1 + rnd() * 1.5)
  }
  // a thumbprint, sometimes
  if (rnd() < 0.55) {
    const x = rnd() * W
    const y = H * (0.6 + 0.3 * rnd())
    g.strokeStyle = 'rgba(190,186,176,0.08)'
    for (let r = 3; r < 16; r += 2.2) {
      g.lineWidth = 1
      g.beginPath()
      g.ellipse(x, y, r, r * 1.3, 0.4, 0, Math.PI * 2)
      g.stroke()
    }
  }
  // the screen opening stays clear
  g.globalCompositeOperation = 'destination-out'
  g.fillStyle = '#000'
  g.fillRect((hole.x / w + 0.5) * W - (hole.w / w / 2) * W, (0.5 - hole.y / h) * H - (hole.h / h / 2) * H, (hole.w / w) * W, (hole.h / h) * H)
  const tex = new THREE.CanvasTexture(cv)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  return tex
}

const TV_W = 0.42
const TV_H = 0.37
const TV_D = 0.2 // depth of the cabinet
const SCR_W = 0.25
const SCR_H = SCR_W * (SCREEN_H / SCREEN_W)
const SCR_X = -0.045 // the screen sits left of centre: the controls take the right side

interface Live {
  item: HudItem
  key: string
  pivot: THREE.Group // swings from its cables
  glass: THREE.Mesh
  idle: THREE.CanvasTexture
  hot: THREE.CanvasTexture
  hit: THREE.Mesh
  x: number
  phase: number
  glow: number // 0–1 eased hover
}

export class HudBoard {
  readonly group = new THREE.Group()
  hovered: string | null = null
  private live = new Map<string, Live>()
  private disposables: Array<{ dispose(): void }> = []
  private time = 0
  // the LED panel
  private ledCv = document.createElement('canvas')
  private ledTex: THREE.CanvasTexture
  private ledPivot = new THREE.Group()
  private msg = ''
  private shown = 0 // characters spelled so far
  private ledDrawn = ''

  constructor() {
    const plastic = new THREE.MeshStandardMaterial({ color: 0x2c2823, roughness: 0.55 })
    const wood = new THREE.MeshStandardMaterial({ color: hex(PALETTE.walnut), roughness: 0.6 })
    const cable = new THREE.MeshStandardMaterial({ color: 0x14110f, roughness: 0.7 })
    this.disposables.push(plastic, wood, cable)

    // the LED panel: a black case with a smoked window
    this.ledCv.width = COLS * CELL_W + 40
    this.ledCv.height = ROWS * CELL_H + 30
    this.ledTex = new THREE.CanvasTexture(this.ledCv)
    this.ledTex.colorSpace = THREE.SRGBColorSpace
    this.ledTex.anisotropy = 4
    const body = new THREE.Mesh(new THREE.BoxGeometry(LED_W + 0.08, LED_H + 0.08, 0.08), plastic)
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(LED_W, LED_H), new THREE.MeshBasicMaterial({ map: this.ledTex, color: new THREE.Color(1.35, 1.35, 1.35), toneMapped: false, fog: false }))
    glass.position.z = 0.041
    this.ledPivot.add(body, glass)
    this.ledPivot.position.set(LED_X, 0, 0)
    this.group.add(this.ledPivot)
    for (const x of [-LED_W * 0.4, LED_W * 0.4]) this.addCable(cable, this.ledPivot, x, LED_H / 2 + 0.04)
    this.disposables.push(this.ledTex, body.geometry, glass.geometry, glass.material as THREE.Material)

    // a lamp for the case and the sets (the slate had its own: the warm light on the wood and plastic)
    for (const x of [-1.5, -0.6, 0.8]) {
      const lamp = new THREE.PointLight(0xe8e4dc, 1.5, 3, 1.6) // near-neutral: the sets must read grey and black, not brown
      lamp.position.set(x, 0.55, 0.9)
      this.group.add(lamp)
    }
    this.group.position.set(0, HANG_Y, WALL_Z)
    this.drawLed()
  }

  private addCable(mat: THREE.Material, parent: THREE.Object3D, x: number, y: number) {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 2.2, 6), mat)
    c.position.set(x, y + 1.1, 0)
    parent.add(c)
    this.disposables.push(c.geometry)
  }

  /** The next thing to do, spelled on the LED panel (a letter at a time when it changes). */
  setMessage(text: string) {
    const t = ledText(text)
    if (t === this.msg) return
    this.msg = t
    this.shown = 0
    this.drawLed()
  }

  private drawLed() {
    const lines = wrapLed(this.msg)
    let left = Math.floor(this.shown)
    const key = `${this.msg}|${left}|${Math.floor(this.time * 2) % 2}`
    if (key === this.ledDrawn) return
    this.ledDrawn = key
    const g = this.ledCv.getContext('2d')!
    g.fillStyle = '#020a05'
    g.fillRect(0, 0, this.ledCv.width, this.ledCv.height)
    const blink = Math.floor(this.time * 2) % 2 === 0
    for (let r = 0; r < ROWS; r++) {
      const line = lines[r] ?? ''
      for (let c = 0; c < COLS; c++) {
        const x = 20 + c * CELL_W + 3
        const y = 15 + r * CELL_H + 4
        const spelled = c < line.length && left-- > 0
        const ch = spelled ? line[c] : ' '
        drawGlyph(g, ch, x, y, CELL_W - 8, CELL_H - 12)
      }
    }
    // the cursor: an underline after the last letter spelled
    if (blink && lines.length) {
      let n = Math.floor(this.shown)
      for (let r = 0; r < lines.length; r++) {
        if (n <= lines[r].length) {
          drawGlyph(g, '_', 20 + Math.min(n, COLS - 1) * CELL_W + 3, 15 + r * CELL_H + 4, CELL_W - 8, CELL_H - 12)
          break
        }
        n -= lines[r].length
      }
    }
    this.ledTex.needsUpdate = true
  }

  /** The televisions (replaces the previous set; unchanged ones keep their pictures). */
  set(items: HudItem[]) {
    const n = items.length
    const seen = new Set<string>()
    items.forEach((item, i) => {
      seen.add(item.id)
      const key = `${item.label}|${item.danger}|${item.svg.length}`
      const x = TV_X0 + (i - (n - 1) / 2) * TV_STEP
      const cur = this.live.get(item.id)
      if (cur && cur.key === key) {
        cur.item = item
        cur.x = x
        return
      }
      if (cur) this.remove(cur)
      this.live.set(item.id, this.build(item, key, x, i))
    })
    for (const [id, l] of this.live) if (!seen.has(id)) this.remove(l)
  }

  private build(item: HudItem, key: string, x: number, i: number): Live {
    const pivot = new THREE.Group() // its origin is where the cables meet the cabinet: it swings from here
    pivot.position.set(x, TV_H / 2 + 0.03, 0)
    const set = new THREE.Group()
    set.position.y = -(TV_H / 2 + 0.03)
    pivot.add(set)
    const own: Array<{ dispose(): void }> = []
    const mat = (color: number, rough = 0.45, metal = 0) => {
      const m = new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal })
      own.push(m)
      return m
    }
        // each set has its own history: a different grey, more or less worn, a dirtier or cleaner glass
    const rnd = rng(Math.floor(Math.random() * 1e9) + i)
    const amount = 0.35 + rnd() * 0.65
    const grey = 0.12 + rnd() * 0.07
    const shell = mat(new THREE.Color(grey, grey * (0.98 + rnd() * 0.04), grey * (0.97 + rnd() * 0.05)).getHex(), 0.4 + rnd() * 0.25)
    const trim = mat(new THREE.Color().setScalar(0.35 + rnd() * 0.25).getHex(), 0.3 + rnd() * 0.3, 0.75) // the chrome line (more or less tarnished)
    const dark = mat(0x0a0a0a, 0.5)
    const rounded = (w: number, h: number, r: number) => {
      const sh = new THREE.Shape()
      sh.moveTo(-w / 2 + r, -h / 2)
      sh.lineTo(w / 2 - r, -h / 2)
      sh.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r)
      sh.lineTo(w / 2, h / 2 - r)
      sh.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2)
      sh.lineTo(-w / 2 + r, h / 2)
      sh.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r)
      sh.lineTo(-w / 2, -h / 2 + r)
      sh.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2)
      return sh
    }
    const extrude = (shape: THREE.Shape, depth: number, bevel: number) => {
      const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 3, curveSegments: 6 })
      own.push(g)
      return g
    }
    // the front: a rounded frame with an opening for the tube
    const frameShape = rounded(TV_W, TV_H, 0.035)
    const hole = rounded(SCR_W + 0.02, SCR_H + 0.02, 0.05)
    frameShape.holes.push(new THREE.Path(hole.getPoints(8).map((p) => new THREE.Vector2(p.x + SCR_X, p.y)).reverse()))
    const frame = new THREE.Mesh(extrude(frameShape, 0.07, 0.006), shell)
    frame.position.set(0, 0, -0.01)
    // the front's wear: a decal over the frame, different for every set
    const wearTex = wearTexture(TV_W, TV_H, { x: SCR_X, y: 0, w: SCR_W + 0.02, h: SCR_H + 0.02 }, rnd, amount)
    const wearMat = new THREE.MeshBasicMaterial({ map: wearTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, fog: false })
    const decal = new THREE.Mesh(new THREE.PlaneGeometry(TV_W, TV_H), wearMat)
    decal.position.z = 0.0675
    own.push(wearTex, wearMat, decal.geometry)
    // the body behind it, stepping in like a tube cabinet: two blocks, each narrower than the last
    const body1 = new THREE.Mesh(extrude(rounded(TV_W * 0.94, TV_H * 0.92, 0.04), TV_D * 0.5, 0.004), shell)
    body1.position.z = -0.01 - TV_D * 0.5
    const body2 = new THREE.Mesh(extrude(rounded(TV_W * 0.74, TV_H * 0.72, 0.04), TV_D * 0.5, 0.004), shell)
    body2.position.z = -0.01 - TV_D
    for (const m of [frame, body1, body2]) m.castShadow = true
    // the tube's well: a dark tapering funnel behind the glass
    const well = new THREE.Mesh(extrude(rounded(SCR_W + 0.04, SCR_H + 0.04, 0.05), 0.05, 0.003), dark)
    well.position.set(SCR_X, 0, -0.04)
    // a chrome ring round the opening, and a recessed lip
    const ringShape = rounded(SCR_W + 0.05, SCR_H + 0.05, 0.055)
    ringShape.holes.push(new THREE.Path(rounded(SCR_W + 0.03, SCR_H + 0.03, 0.05).getPoints(8).reverse()))
    const ring = new THREE.Mesh(extrude(ringShape, 0.004, 0.002), trim)
    ring.position.set(SCR_X, 0, 0.066)
    // the glass, bulging out of the well
    const glassGeo = tubeGeometry(SCR_W + 0.016, SCR_H + 0.016, 0.04)
    const idle = screenTexture(item, false)
    const hot = screenTexture(item, true)
    const wear = new THREE.Vector4(0.7 + rnd() * 0.6, 0.4 + rnd() * 1.4 * amount, 0.06 + rnd() * 0.12, rnd() * 0.5)
    const glass = new THREE.Mesh(glassGeo, glassMaterial(idle, new THREE.Color(item.danger ? '#ff7a3c' : '#4dff7a'), rnd() * 50, wear))
    glass.position.set(SCR_X, 0, 0.012)
    // the control strip on the right: a dark panel with a big knob, a small one, buttons and a speaker grille
    const stripX = SCR_X + SCR_W / 2 + (TV_W / 2 - (SCR_X + SCR_W / 2)) / 2
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.07, TV_H * 0.8, 0.012), dark)
    strip.position.set(stripX, 0, 0.066)
    const knobMat = mat(0x6e695f, 0.35, 0.7)
    const knob = (y: number, r: number) => {
      const k = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.08, 0.016, 16), knobMat)
      k.rotation.x = Math.PI / 2
      k.position.set(stripX, y, 0.078)
      const cap = new THREE.Mesh(new THREE.BoxGeometry(r * 0.2, r * 1.5, 0.004), dark)
      cap.position.set(stripX, y, 0.087)
      cap.rotation.z = (rnd() - 0.5) * 3 // each knob stopped somewhere else
      return [k, cap]
    }
    const knobs = [...knob(TV_H * 0.3, 0.016), ...knob(TV_H * 0.1, 0.011)]
    const buttons = [-0.04, -0.075].map((dy) => {
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.012, 0.01), knobMat)
      b.position.set(stripX, dy, 0.076)
      return b
    })
    const slots = Array.from({ length: 6 }, (_, k) => {
      const sl = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.004, 0.004), shell)
      sl.position.set(stripX, -0.1 - k * 0.011, 0.074)
      return sl
    })
    // the grille under the screen
    const grille = Array.from({ length: 5 }, (_, k) => {
      const sl = new THREE.Mesh(new THREE.BoxGeometry(SCR_W * 0.85, 0.003, 0.004), dark)
      sl.position.set(SCR_X, -SCR_H / 2 - 0.032 - k * 0.007, 0.066)
      return sl
    })
    // vent slots on top of the body
    const vents = Array.from({ length: 7 }, (_, k) => {
      const v = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.003, 0.09), dark)
      v.position.set(-TV_W * 0.3 + k * 0.018, TV_H * 0.46 + 0.003, -0.1)
      return v
    })
    own.push(...vents.map((v) => v.geometry))
    set.add(...vents)
    const cableMat = mat(0x14110f, 0.7)
    for (const dx of [-TV_W * 0.32, TV_W * 0.32]) {
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 2.2, 6), cableMat)
      c.position.set(dx, TV_H / 2 + 1.1, -0.03)
      set.add(c)
    }
    const geos = [strip, ...knobs, ...buttons, ...slots, ...grille].map((m) => m.geometry)
    own.push(...geos, glassGeo)
    set.add(frame, decal, body1, body2, well, ring, glass, strip, ...knobs, ...buttons, ...slots, ...grille)
    set.traverse((o) => {
      if (o instanceof THREE.Mesh && o !== glass) o.receiveShadow = true
    })
    const hit = new THREE.Mesh(new THREE.BoxGeometry((TV_W + 0.04) * HUD_HIT_SCALE, (TV_H + 0.04) * HUD_HIT_SCALE, 0.14), new THREE.MeshBasicMaterial({ visible: false }))
    hit.position.z = -0.02
    hit.userData.hudId = item.id
    set.add(hit)
    own.push(hit.geometry)
    set.rotation.z = (rnd() - 0.5) * 0.03 // none hangs perfectly straight
    this.group.add(pivot)
    this.disposables.push(...own)
    return { item, key, pivot, glass, idle, hot, hit, x, phase: i * 1.7, glow: 0 }
  }

  private remove(l: Live) {
    this.group.remove(l.pivot)
    l.idle.dispose()
    l.hot.dispose()
    ;(l.glass.material as THREE.Material).dispose()
    l.hit.geometry.dispose()
    ;(l.hit.material as THREE.Material).dispose()
    this.live.delete(l.item.id)
  }

  /** Per frame: sway, flicker, spell the message; returns the set under the ray (null when `enabled` is off). */
  update(dt: number, raycaster: THREE.Raycaster, enabled: boolean): string | null {
    this.time += dt
    const t = this.time
    // everything sways a little on its cables, the way the lamp does
    this.ledPivot.rotation.z = Math.sin(t * 0.5 + 1.3) * 0.006
    this.ledPivot.rotation.x = Math.sin(t * 0.37) * 0.004
    for (const l of this.live.values()) {
      l.pivot.position.x = l.x
      l.pivot.rotation.z = Math.sin(t * 0.62 + l.phase) * 0.02
      l.pivot.rotation.x = Math.sin(t * 0.43 + l.phase * 1.3) * 0.012
    }
    this.group.updateMatrixWorld(true)
    const hit = enabled ? raycaster.intersectObjects([...this.live.values()].map((l) => l.hit), false)[0] : undefined
    this.hovered = hit ? (hit.object.userData.hudId as string) : null
    for (const l of this.live.values()) {
      const on = this.hovered === l.item.id
      l.glow += ((on ? 1 : 0) - l.glow) * Math.min(1, dt * 14)
      const mat = l.glass.material as THREE.ShaderMaterial
      mat.uniforms.map.value = l.glow > 0.5 ? l.hot : l.idle
      mat.uniforms.time.value = t
      mat.uniforms.glow.value = l.glow
    }
    // the message is spelled out, about thirty letters a second
    if (this.shown < this.msg.length) this.shown = Math.min(this.msg.length, this.shown + dt * 30)
    this.drawLed()
    return this.hovered
  }

  hint(id: string | null) {
    return id ? this.live.get(id)?.item.hint ?? null : null
  }

  /** Screen point of a set (tests). */
  screenOf(id: string, camera: THREE.Camera, rect: DOMRect) {
    const l = this.live.get(id)
    if (!l) return null
    this.group.updateMatrixWorld(true)
    const p = l.hit.getWorldPosition(new THREE.Vector3()).project(camera)
    return { x: rect.left + ((p.x + 1) / 2) * rect.width, y: rect.top + ((1 - p.y) / 2) * rect.height }
  }

  dispose() {
    for (const l of [...this.live.values()]) this.remove(l)
    this.disposables.forEach((d) => d.dispose())
  }
}

// kept for touch screens: the sets are bigger targets there
export const HUD_HIT_SCALE = isTouch ? 1.25 : 1
