import * as THREE from 'three'
import { PALETTE, SUIT_INK, hex } from './look'
import { TABLE_Y } from './seats'

// The anotador as an object on the table: a small spiral notepad with a pencil lying across it,
// diagonal to the little heap of beans. Click it (or press H) and the real scoresheet opens, floating
// in the middle of the screen (components/Anotador.tsx).

const W = 0.12 // pad size (m)
const D = 0.165
const T = 0.012
// opposite corner of the centre from the bean heap (which lies at +x, -z)
export const NOTEPAD_AT = new THREE.Vector3(-0.2, 0, 0.17)
const YAW = 0.5 // turned toward you a little

/** Ruled paper with a few pencil scribbles (no text: it must read as a notepad, not as a sheet). */
function paperTexture() {
  const cv = document.createElement('canvas')
  cv.width = 240
  cv.height = 330
  const g = cv.getContext('2d')!
  g.fillStyle = PALETTE.bone
  g.fillRect(0, 0, cv.width, cv.height)
  let seed = 5
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  // ruled lines and the margin
  g.strokeStyle = 'rgba(70, 90, 120, 0.45)'
  g.lineWidth = 2
  for (let y = 60; y < cv.height - 10; y += 26) {
    g.beginPath()
    g.moveTo(10, y)
    g.lineTo(cv.width - 10, y)
    g.stroke()
  }
  g.strokeStyle = 'rgba(160, 60, 50, 0.55)'
  g.beginPath()
  g.moveTo(44, 12)
  g.lineTo(44, cv.height - 8)
  g.stroke()
  // pencil: tally marks (four and a slash) and a couple of figures
  g.strokeStyle = 'rgba(30, 24, 20, 0.85)'
  g.lineWidth = 4
  g.lineCap = 'round'
  const stroke = (x1: number, y1: number, x2: number, y2: number) => {
    g.beginPath()
    g.moveTo(x1 + rnd() * 3, y1 + rnd() * 3)
    g.quadraticCurveTo((x1 + x2) / 2 + rnd() * 5, (y1 + y2) / 2 + rnd() * 5, x2 + rnd() * 3, y2 + rnd() * 3)
    g.stroke()
  }
  for (const row of [0, 1]) {
    const y = 82 + row * 52
    for (let k = 0; k < 4; k++) stroke(62 + k * 15, y, 62 + k * 15 + rnd() * 3, y + 20)
    stroke(58, y + 16, 124, y + 2)
    for (let k = 0; k < 2 - row; k++) stroke(146 + k * 15, y, 146 + k * 15, y + 20)
  }
  g.lineWidth = 3
  g.beginPath()
  g.moveTo(60, 214)
  g.bezierCurveTo(90, 200, 120, 236, 170, 212)
  g.stroke()
  const tex = new THREE.CanvasTexture(cv)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  return tex
}

/** What the notepad shows when a round is over: the same figures as the old «Ronda N terminada» window. */
export interface RoundReport {
  kind?: 'round' | 'base' // a finished round (default) or just a base
  title: string // «Ronda 3 terminada» / «Base 2 de 3»
  lastBase: string // «Última base: Ana (rivales) con 3 de espadas» / «La gana Ana (rivales) con 3 de espadas»
  /** a base report: how each team stands («Tu equipo lleva 1 (pidió 1)») */
  standings?: Array<{ text: string; mine: boolean }>
  rows: Array<{ label: string; asked: string; won: number; met: boolean; pts: string; total: number; mine: boolean }>
  players: Array<{ name: string; ready: boolean; mine: boolean }>
  ready: boolean // you already pressed the tick
}

const PW = 768
const PH = 1056
// the tick button, in page pixels
const TICK = { x: 560, y: 840, w: 170, h: 130 }
const INKC = '#2a2622'
const HAND = '"Caveat", "IM Fell English", cursive'

function ruledPage(g: CanvasRenderingContext2D) {
  g.fillStyle = PALETTE.bone
  g.fillRect(0, 0, PW, PH)
  g.strokeStyle = 'rgba(70, 90, 120, 0.4)'
  g.lineWidth = 3
  for (let y = 190; y < PH - 20; y += 62) {
    g.beginPath()
    g.moveTo(24, y)
    g.lineTo(PW - 24, y)
    g.stroke()
  }
  g.strokeStyle = 'rgba(160, 60, 50, 0.6)'
  g.lineWidth = 3
  g.beginPath()
  g.moveTo(92, 28)
  g.lineTo(92, PH - 20)
  g.stroke()
}

function wrapText(g: CanvasRenderingContext2D, text: string, width: number) {
  const lines: string[] = []
  let cur = ''
  for (const w of text.split(' ')) {
    const t = cur ? `${cur} ${w}` : w
    if (g.measureText(t).width > width && cur) {
      lines.push(cur)
      cur = w
    } else cur = t
  }
  if (cur) lines.push(cur)
  return lines
}

/** A wobbly, hand-made line from a to b: little offsets along the way, never the same twice per seed. */
function wobble(a: [number, number], b: [number, number], seed: number, n = 9): Array<[number, number]> {
  let t = seed * 9301 + 49297
  const rnd = () => ((t = (t * 9301 + 49297) % 233280) / 233280 - 0.5)
  const nx = -(b[1] - a[1])
  const ny = b[0] - a[0]
  const len = Math.hypot(nx, ny) || 1
  return Array.from({ length: n + 1 }, (_, k) => {
    const f = k / n
    const off = k === 0 || k === n ? 0 : rnd() * 9
    return [a[0] + (b[0] - a[0]) * f + (nx / len) * off, a[1] + (b[1] - a[1]) * f + (ny / len) * off] as [number, number]
  })
}

/** The tick as a hand stroke: two uneven strokes (down, then up and past), a little off each time you press it. */
function tickPath(cx: number, cy: number): Array<[number, number]> {
  const down = wobble([cx - 56, cy - 2], [cx - 18, cy + 44], 3, 5)
  const up = wobble([cx - 18, cy + 44], [cx + 66, cy - 58], 7, 8)
  return [...down, ...up.slice(1)]
}

function strokeUpTo(g: CanvasRenderingContext2D, pts: Array<[number, number]>, frac: number, color: string, width: number) {
  const lens = pts.slice(1).map((p, i) => Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]))
  const total = lens.reduce((a, b) => a + b, 0)
  let left = frac * total
  g.strokeStyle = color
  g.lineCap = 'round'
  g.lineJoin = 'round'
  for (let pass = 0; pass < 2; pass++) {
    g.lineWidth = pass ? width * 0.45 : width
    g.globalAlpha = pass ? 0.55 : 0.92
    g.beginPath()
    g.moveTo(pts[0][0] + pass * 2, pts[0][1] + pass * 1.5)
    for (let k = 1, rem = left; k < pts.length; k++) {
      const l = lens[k - 1]
      if (rem >= l) {
        g.lineTo(pts[k][0] + pass * 2, pts[k][1] + pass * 1.5)
        rem -= l
      } else {
        const f = rem / l
        g.lineTo(pts[k - 1][0] + (pts[k][0] - pts[k - 1][0]) * f + pass * 2, pts[k - 1][1] + (pts[k][1] - pts[k - 1][1]) * f + pass * 1.5)
        break
      }
    }
    g.stroke()
  }
  g.globalAlpha = 1
}

/** The report written by hand on the page; `tick` 0–1 is how much of the tick the pencil has drawn. */
function drawReport(cv: HTMLCanvasElement, r: RoundReport, tick: number, hot: boolean) {
  const g = cv.getContext('2d')!
  ruledPage(g)
  g.textBaseline = 'alphabetic'
  g.fillStyle = INKC
  const base = r.kind === 'base'
  g.font = `700 ${base ? 132 : 78}px ${HAND}`
  g.fillText(r.title, 112, base ? 160 : 120)
  g.font = `600 ${base ? 70 : 38}px ${HAND}`
  const last = wrapText(g, r.lastBase, PW - 160)
  const step = base ? 74 : 40
  last.slice(0, 3).forEach((l, i) => g.fillText(l, 112, (base ? 260 : 168) + i * step))
  if (base) {
    // how each team stands, big
    let by = 480
    for (const st of r.standings ?? []) {
      g.fillStyle = st.mine ? '#2f5f6b' : '#8e2a22'
      g.font = `700 66px ${HAND}`
      const lines = wrapText(g, st.text, PW - 120)
      lines.slice(0, 2).forEach((l, i) => g.fillText(l, 112, by + i * 68))
      g.strokeStyle = g.fillStyle
      g.lineWidth = 4
      g.beginPath()
      g.moveTo(112, by + 14 + (lines.length - 1) * 68)
      g.quadraticCurveTo(300, by + 22 + (lines.length - 1) * 68, 640, by + 12 + (lines.length - 1) * 68)
      g.stroke()
      by += 110 + (lines.length - 1) * 68
    }
  }
  let y = 270
  for (const row of base ? [] : r.rows) {
    g.fillStyle = row.mine ? '#2f5f6b' : '#8e2a22'
    g.font = `700 62px ${HAND}`
    g.fillText(row.label, 112, y)
    g.strokeStyle = g.fillStyle
    g.lineWidth = 4
    g.beginPath()
    g.moveTo(112, y + 10)
    g.quadraticCurveTo(300, y + 16, 540, y + 8)
    g.stroke()
    g.fillStyle = INKC
    g.font = `600 50px ${HAND}`
    g.fillText(`pidió ${row.asked}   ganó ${row.won}`, 112, y + 66)
    g.fillStyle = row.met ? '#3d6b3a' : '#8e2a22'
    g.font = `700 54px ${HAND}`
    g.fillText(row.met ? 'cumplió' : 'falló', 112, y + 126)
    g.fillStyle = INKC
    g.fillText(`${row.pts} puntos`, 330, y + 126)
    g.font = `600 46px ${HAND}`
    g.fillText(`total ${row.total}`, 112, y + 184)
    y += 250
  }
  // who is ready
  g.font = `600 ${base ? 54 : 36}px ${HAND}`
  const colW = base ? 290 : 300
  r.players.forEach((p, i) => {
    const px = 112 + (i % 2) * colW
    const py = (base ? 790 : 790) + Math.floor(i / 2) * (base ? 58 : 42)
    if (py > PH - 30) return
    g.fillStyle = p.ready ? '#3d6b3a' : 'rgba(42,38,34,0.55)'
    g.fillText(`${p.ready ? '✓' : '…'} ${p.name}`, px, py)
  })
  // the tick button: a faint grey hand-made tick, as if switched off; the pencil goes over it in green
  const cx = TICK.x + TICK.w / 2
  const cy = TICK.y + TICK.h / 2
  const pts = tickPath(cx, cy)
  strokeUpTo(g, pts, 1, hot && !r.ready ? 'rgb(90,86,80)' : 'rgb(168,164,156)', 13)
  if (tick > 0) strokeUpTo(g, pts, tick, '#2e7d32', 14)
  return [pts[0], pts[5], pts[pts.length - 1]] as Array<[number, number]>
}

export class Notepad {
  readonly group = new THREE.Group()
  readonly hit: THREE.Mesh
  hovered = false
  private lift = 0
  private report: RoundReport | null = null
  private reportCv = document.createElement('canvas')
  private reportTex: THREE.CanvasTexture
  private paperMat!: THREE.MeshStandardMaterial
  private paperTex!: THREE.CanvasTexture
  private showingReport = false
  private tickT = 0 // 0–1: how much of the tick has been written
  private tilt = 0.75 // how far the pad stands up toward the camera
  private writing = false
  private tickPts: Array<[number, number]> = []
  private pencil = new THREE.Group()
  private pencilRest = new THREE.Vector3()
  private pencilRestQuat = new THREE.Quaternion()
  private pencilReport = new THREE.Vector3() // where it lies while a report is on the page: below the writing
  private dirty = false
  readonly tickHit: THREE.Mesh // the tick on the page, for the pointer
  tickHovered = false
  private disposables: Array<{ dispose(): void }> = []

  constructor() {
    this.reportCv.width = PW
    this.reportCv.height = PH
    this.reportTex = new THREE.CanvasTexture(this.reportCv)
    this.reportTex.colorSpace = THREE.SRGBColorSpace
    this.reportTex.anisotropy = 8
    const paperTex = paperTexture()
    const paper = new THREE.MeshStandardMaterial({ map: paperTex, roughness: 0.9, emissive: 0xffffff, emissiveMap: paperTex, emissiveIntensity: 0.12 })
    this.paperMat = paper
    this.paperTex = paperTex
    const edge = new THREE.MeshStandardMaterial({ color: hex(PALETTE.bone), roughness: 0.95 })
    const card = new THREE.MeshStandardMaterial({ color: hex(PALETTE.oxblood), roughness: 0.8 })
    // the cardboard back, a little bigger, and the sheets on it (the top face carries the picture)
    const back = new THREE.Mesh(new THREE.BoxGeometry(W + 0.01, 0.004, D + 0.01), card)
    back.position.y = 0.002
    const sheets = new THREE.Mesh(new THREE.BoxGeometry(W, T, D), [edge, edge, paper, edge, edge, edge])
    sheets.position.y = 0.004 + T / 2
    for (const m of [back, sheets]) m.castShadow = m.receiveShadow = true
    this.group.add(back, sheets)
    // the spiral: little rings along the top edge
    const wire = new THREE.MeshStandardMaterial({ color: 0x8a8378, roughness: 0.4, metalness: 0.7 })
    const ringGeo = new THREE.TorusGeometry(0.0055, 0.0011, 6, 12)
    for (let i = 0; i < 9; i++) {
      const r = new THREE.Mesh(ringGeo, wire)
      r.position.set(-W / 2 + 0.01 + (i * (W - 0.02)) / 8, 0.012, -D / 2 - 0.001)
      r.rotation.y = Math.PI / 2
      this.group.add(r)
    }
    // the pencil, across the sheets
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.0034, 0.0034, 0.12, 6), new THREE.MeshStandardMaterial({ color: hex(SUIT_INK.oros), roughness: 0.5 }))
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.0034, 0.012, 6), new THREE.MeshStandardMaterial({ color: hex(PALETTE.bone), roughness: 0.9 }))
    const lead = new THREE.Mesh(new THREE.ConeGeometry(0.0013, 0.004, 6), new THREE.MeshStandardMaterial({ color: 0x1a1613 }))
    const eraser = new THREE.Mesh(new THREE.CylinderGeometry(0.0036, 0.0036, 0.009, 6), new THREE.MeshStandardMaterial({ color: hex(PALETTE.rose), roughness: 0.9 }))
    tip.position.y = -0.066
    tip.rotation.z = Math.PI
    lead.position.y = -0.0745
    lead.rotation.z = Math.PI
    eraser.position.y = 0.0645
    const pencil = this.pencil
    pencil.add(body, tip, lead, eraser)
    pencil.position.set(0.028, 0.004 + T + 0.0036, 0.016)
    pencil.rotation.set(0, 0, Math.PI / 2) // lying along x…
    pencil.rotateOnWorldAxis(new THREE.Vector3(0, 1, 0), -0.55) // …slanted across the pad
    pencil.traverse((o) => (o.castShadow = true))
    this.group.add(pencil)
    this.pencilRest.copy(pencil.position)
    this.pencilRestQuat.copy(pencil.quaternion)
    this.pencilReport.set(-0.105, 0.004, 0.06) // on the table, left of the pad
    // the tick's spot on the page (a flat, invisible target)
    this.tickHit = new THREE.Mesh(new THREE.PlaneGeometry((TICK.w / PW) * W * 1.15, (TICK.h / PH) * D * 1.15), new THREE.MeshBasicMaterial({ visible: false }))
    this.tickHit.rotation.x = -Math.PI / 2
    this.tickHit.position.set(((TICK.x + TICK.w / 2) / PW - 0.5) * W, 0.004 + T + 0.002, ((TICK.y + TICK.h / 2) / PH - 0.5) * D)
    this.group.add(this.tickHit)
    this.disposables.push(this.reportTex, this.tickHit.geometry)
    this.hit = new THREE.Mesh(new THREE.BoxGeometry(W + 0.03, 0.04, D + 0.03), new THREE.MeshBasicMaterial({ visible: false }))
    this.hit.position.y = 0.02
    this.group.add(this.hit)
    this.group.position.set(NOTEPAD_AT.x, TABLE_Y, NOTEPAD_AT.z)
    this.group.rotation.y = YAW
    this.disposables.push(paperTex, paper, edge, card, wire, ringGeo, back.geometry, sheets.geometry, this.hit.geometry)
  }

  /** A round's report on the page (null: back to the scribbles). */
  setReport(r: RoundReport | null) {
    const wasReady = this.report?.ready ?? false
    this.report = r
    if (r) {
      if (!this.showingReport) {
        this.showingReport = true
        this.paperMat.map = this.reportTex
        this.paperMat.emissiveMap = this.reportTex
        this.paperMat.color.set(0xa6a193) // the page is read from close up: dimmed so the lamp doesn't burn it
        this.paperMat.emissiveIntensity = 0.04
        this.paperMat.needsUpdate = true
        this.tickT = r.ready ? 1 : 0
        this.writing = false
      } else if (r.ready && !wasReady) {
        this.writing = true // the pencil writes the tick
        this.tickT = 0
      }
      this.dirty = true
    }
  }

  /** Has the tick already been pressed? */
  ready() {
    return this.report?.ready ?? false
  }

  /** The tick's world position (tests). */
  tickWorld() {
    return this.tickHit.getWorldPosition(new THREE.Vector3())
  }

  /** Per frame. `focus` 0–1: how far the camera has come to read the page (the pad stands up toward it). */
  update(dt: number, focus = 0) {
    this.lift += ((this.hovered ? 1 : 0) - this.lift) * Math.min(1, dt * 12)
    const e = focus * focus * (3 - 2 * focus)

    const tilt = this.report?.kind === 'base' ? 0.9 : 0.75
    this.tilt += (tilt - this.tilt) * Math.min(1, dt * 8)
    this.group.rotation.set(e * this.tilt, YAW * (1 - e) - this.lift * 0.06 * (1 - e), 0)
    const scale = 1 + e * (this.report?.kind === 'base' ? 0.85 : 0.4)
    this.group.scale.setScalar(scale)
    // it stands up on its near edge: raised by half its depth times the sine of the tilt, or it would sink into the table
    const lift = e * ((D / 2) * scale * Math.sin(e * this.tilt) + 0.012)
    this.group.position.set(NOTEPAD_AT.x, TABLE_Y + this.lift * 0.012 + lift, NOTEPAD_AT.z)
    if (this.showingReport && !this.report && focus < 0.02) {
      this.showingReport = false
      this.paperMat.map = this.paperTex
      this.paperMat.emissiveMap = this.paperTex
      this.paperMat.color.set(0xffffff)
      this.paperMat.emissiveIntensity = 0.12
      this.paperMat.needsUpdate = true
    }
    if (!this.showingReport || !this.report) {
      this.pencil.position.lerp(this.pencilRest, Math.min(1, dt * 6))
      return
    }
    // the pencil writing the tick
    if (this.writing) {
      this.tickT = Math.min(1, this.tickT + dt / 0.16)
      this.dirty = true
      if (this.tickT >= 1) this.writing = false
    }
    if (this.dirty || this.tickHovered !== this.lastHot) {
      this.lastHot = this.tickHovered
      this.tickPts = drawReport(this.reportCv, this.report, this.tickT, this.tickHovered) ?? []
      this.reportTex.needsUpdate = true
      this.dirty = false
    }
    // the pencil goes to the tick while it is written, and back to rest after
    const target = new THREE.Vector3()
    let toward = 0
    if (this.writing && this.tickPts.length) {
      const d = this.tickT
      const [a, b, c] = this.tickPts
      const l1 = Math.hypot(b[0] - a[0], b[1] - a[1])
      const l2 = Math.hypot(c[0] - b[0], c[1] - b[1])
      const dist = d * (l1 + l2)
      const p: [number, number] = dist <= l1 ? [a[0] + (b[0] - a[0]) * (dist / l1), a[1] + (b[1] - a[1]) * (dist / l1)] : [b[0] + (c[0] - b[0]) * ((dist - l1) / l2), b[1] + (c[1] - b[1]) * ((dist - l1) / l2)]
      target.set((p[0] / PW - 0.5) * W, 0.004 + T + 0.002, (p[1] / PH - 0.5) * D)
      toward = 1
    }
    const tip = new THREE.Vector3(0, -0.0745, 0).applyQuaternion(this.pencil.quaternion)
    const goal = toward ? target.sub(tip) : this.pencilReport
    this.pencil.position.lerp(goal, Math.min(1, dt * (toward ? 60 : 8)))
  }

  private lastHot = false

  dispose() {
    this.group.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose()
        const m = o.material
        ;(Array.isArray(m) ? m : [m]).forEach((x) => x.dispose())
      }
    })
    this.disposables.forEach((d) => d.dispose())
  }
}
