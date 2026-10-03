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

/** What the tube shows: the icon in phosphor, scanlines and a vignette; with its name when `hot`. */
function screenTexture(item: HudItem, hot: boolean) {
  const cv = document.createElement('canvas')
  cv.width = SCREEN_W
  cv.height = SCREEN_H
  const g = cv.getContext('2d')!
  const color = item.danger ? RED : GREEN
  const bg = g.createRadialGradient(SCREEN_W / 2, SCREEN_H / 2, 10, SCREEN_W / 2, SCREEN_H / 2, SCREEN_W * 0.62)
  bg.addColorStop(0, item.danger ? '#241008' : '#0b2412')
  bg.addColorStop(1, '#020805')
  g.fillStyle = bg
  g.fillRect(0, 0, SCREEN_W, SCREEN_H)
  const { paths, box } = iconPaths(item.svg)
  const size = hot ? 118 : 146
  const s = size / box
  g.save()
  g.translate((SCREEN_W - size) / 2, (SCREEN_H - size) / 2 - (hot ? 18 : 2))
  g.scale(s, s)
  g.shadowColor = color
  g.shadowBlur = hot ? 38 : 24
  g.fillStyle = color
  g.globalAlpha = hot ? 1 : 0.85
  for (const d of paths) g.fill(new Path2D(d))
  g.restore()
  if (hot) {
    g.fillStyle = color
    g.shadowColor = color
    g.shadowBlur = 12
    g.font = '34px VT323, "Courier New", monospace'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillText(item.label.toUpperCase(), SCREEN_W / 2, SCREEN_H - 30)
    g.shadowBlur = 0
  }
  // scanlines
  g.fillStyle = 'rgba(0,0,0,0.3)'
  for (let y = 0; y < SCREEN_H; y += 3) g.fillRect(0, y, SCREEN_W, 1)
  // vignette
  const v = g.createRadialGradient(SCREEN_W / 2, SCREEN_H / 2, SCREEN_H * 0.3, SCREEN_W / 2, SCREEN_H / 2, SCREEN_W * 0.72)
  v.addColorStop(0, 'rgba(0,0,0,0)')
  v.addColorStop(1, 'rgba(0,0,0,0.7)')
  g.fillStyle = v
  g.fillRect(0, 0, SCREEN_W, SCREEN_H)
  const tex = new THREE.CanvasTexture(cv)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  return tex
}

/** A glass front that bulges toward you (a tube, not a flat panel). */
function tubeGeometry(w: number, h: number, bulge: number) {
  const geo = new THREE.PlaneGeometry(w, h, 14, 12)
  const pos = geo.getAttribute('position')
  for (let i = 0; i < pos.count; i++) {
    const nx = pos.getX(i) / (w / 2)
    const ny = pos.getY(i) / (h / 2)
    pos.setZ(i, bulge * (1 - nx * nx * 0.9) * (1 - ny * ny * 0.9))
  }
  geo.computeVertexNormals()
  return geo
}

const TV_W = 0.4
const TV_H = 0.34
const SCR_W = 0.29
const SCR_H = SCR_W * (SCREEN_H / SCREEN_W)

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
      const lamp = new THREE.PointLight(hex(PALETTE.amber), 2.4, 3, 1.6)
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
    const pivot = new THREE.Group() // its origin is where the cables meet the ceiling's end: it swings from here
    pivot.position.set(x, TV_H / 2 + 0.03, 0)
    const set = new THREE.Group()
    set.position.y = -(TV_H / 2 + 0.03)
    pivot.add(set)
    const plastic = new THREE.MeshStandardMaterial({ color: item.danger ? 0x4a2a24 : 0x3a342c, roughness: 0.5 })
    // the cabinet: a front box and a narrower tube housing behind it
    const front = new THREE.Mesh(new THREE.BoxGeometry(TV_W, TV_H, 0.1), plastic)
    const back = new THREE.Mesh(new THREE.BoxGeometry(TV_W * 0.72, TV_H * 0.74, 0.14), plastic)
    back.position.z = -0.12
    front.castShadow = back.castShadow = true
    // the bezel round the screen, and two knobs
    const bezel = new THREE.Mesh(new THREE.BoxGeometry(SCR_W + 0.03, SCR_H + 0.03, 0.01), new THREE.MeshStandardMaterial({ color: 0x0a0907, roughness: 0.4 }))
    bezel.position.z = 0.052
    const knobMat = new THREE.MeshStandardMaterial({ color: 0x8a8378, roughness: 0.4, metalness: 0.6 })
    const knobs = [0.05, -0.02].map((y) => {
      const k = new THREE.Mesh(new THREE.CylinderGeometry(0.0085, 0.0085, 0.012, 12), knobMat)
      k.rotation.x = Math.PI / 2
      k.position.set(TV_W / 2 - 0.026, y * 1.3, 0.056)
      return k
    })
    // the glass: bulging, showing the picture
    const idle = screenTexture(item, false)
    const hot = screenTexture(item, true)
    const glassGeo = tubeGeometry(SCR_W, SCR_H, 0.012)
    const glass = new THREE.Mesh(glassGeo, new THREE.MeshBasicMaterial({ map: idle, color: new THREE.Color(1.15, 1.15, 1.15), toneMapped: false, fog: false }))
    glass.position.z = 0.056
    // the cables: two to the ceiling, from the top of the set
    const cableMat = new THREE.MeshStandardMaterial({ color: 0x14110f, roughness: 0.7 })
    for (const dx of [-TV_W * 0.34, TV_W * 0.34]) {
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 2.2, 6), cableMat)
      c.position.set(dx, TV_H / 2 + 1.1, 0)
      set.add(c)
    }
    set.add(front, back, bezel, glass, ...knobs)
    const hit = new THREE.Mesh(new THREE.BoxGeometry((TV_W + 0.06) * HUD_HIT_SCALE, (TV_H + 0.04) * HUD_HIT_SCALE, 0.12), new THREE.MeshBasicMaterial({ visible: false }))
    hit.userData.hudId = item.id
    set.add(hit)
    this.group.add(pivot)
    this.disposables.push(plastic, front.geometry, back.geometry, bezel.geometry, bezel.material as THREE.Material, knobMat, glassGeo, cableMat, hit.geometry)
    this.disposables.push(...knobs.map((k) => k.geometry))
    return { item, key, pivot: set.parent as THREE.Group, glass, idle, hot, hit, x, phase: i * 1.7, glow: 0 }
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
      const mat = l.glass.material as THREE.MeshBasicMaterial
      const hotMap = l.glow > 0.5 ? l.hot : l.idle
      if (mat.map !== hotMap) {
        mat.map = hotMap
        mat.needsUpdate = true
      }
      const flicker = 1 + Math.sin(t * 47 + l.phase) * 0.03 + Math.sin(t * 13 + l.phase * 2) * 0.03
      mat.color.setScalar((1.1 + l.glow * 0.5) * flicker)
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
