import * as THREE from 'three'
import { PALETTE, SUIT_INK, hex } from './look'
import { TABLE_Y } from './seats'
import { SEG_U, SEG_V, shapeLeaf, type LeafShape, type LeafFrame } from '../components/rulebook/leafShape'

// The anotador as an object on the table: a small spiral notepad with a pencil lying across it,
// diagonal to the little heap of beans. Click it (or press H) and the real scoresheet opens, floating
// in the middle of the screen (components/Anotador.tsx).

const W = 0.12 // pad size (m)
const D = 0.165
const T = 0.012
// opposite corner of the centre from the bean heap (which lies at +x, -z)
export const NOTEPAD_AT = new THREE.Vector3(-0.2, 0, 0.17)
const YAW = 0.5 // (the old resting turn)
const REST_YAW = 0.12 // turned toward you a little
const REST_SCALE = 1.6 // a little bigger than a real pad, so its scoreboard reads from your seat
const REST_TILT = 0 // lying flat on the table
const FOCUS_SCALE = 1.85
const FOCUS_TILT = 0.9

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
  /** the score so far */
  totals?: { mine: number; rival: number }
  rows: Array<{ label: string; asked: string; won: number; met: boolean; pts: string; total: number; mine: boolean }>
  players: Array<{ name: string; ready: boolean; mine: boolean }>
  ready: boolean // you already pressed the tick
}

const PW = 768
const PH = 1056
// the tick button, in page pixels
const TICK = { x: 600, y: 935, w: 130, h: 96 } // low in the corner, small: clear of the players' names
const INKC = '#120e0b' // dark and strong: the lamp over the paper must not wash it out
const HAND = '"Caveat", "IM Fell English", cursive'

function ruledPage(g: CanvasRenderingContext2D) {
  g.fillStyle = '#d9cfae' // a shade under the card bone: under the lamp it still reads as paper, not as light
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

/** The tick: a short stroke down and a long one up. */
function tickPath(cx: number, cy: number): Array<[number, number]> {
  const k = 0.68
  return [[cx - 52 * k, cy + 2 * k], [cx - 14 * k, cy + 40 * k], [cx + 56 * k, cy - 44 * k]]
}

/** The first `frac` of a polyline, stroked in `color`. */
function strokeUpTo(g: CanvasRenderingContext2D, pts: Array<[number, number]>, frac: number, color: string, width: number) {
  const lens = pts.slice(1).map((p, i) => Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]))
  let rem = frac * lens.reduce((a, b) => a + b, 0)
  g.strokeStyle = color
  g.lineWidth = width
  g.lineCap = 'round'
  g.lineJoin = 'round'
  g.beginPath()
  g.moveTo(pts[0][0], pts[0][1])
  for (let k = 1; k < pts.length; k++) {
    const l = lens[k - 1]
    if (rem >= l) {
      g.lineTo(pts[k][0], pts[k][1])
      rem -= l
    } else {
      const f = rem / l
      g.lineTo(pts[k - 1][0] + (pts[k][0] - pts[k - 1][0]) * f, pts[k - 1][1] + (pts[k][1] - pts[k - 1][1]) * f)
      break
    }
  }
  g.stroke()
}

/** The report written by hand on the page; `tick` 0–1 is how much of the tick the pencil has drawn. */
function drawReport(cv: HTMLCanvasElement, r: RoundReport, tick: number, hot: boolean) {
  const g = cv.getContext('2d')!
  bolden(g)
  ruledPage(g)
  g.textBaseline = 'alphabetic'
  g.fillStyle = INKC
  const base = r.kind === 'base'
  g.font = `500 ${base ? 132 : 100}px ${HAND}`
  g.fillText(r.title, 112, base ? 160 : 130)
  g.font = `600 ${base ? 70 : 52}px ${HAND}`
  const last = wrapText(g, r.lastBase, PW - 160)
  const step = base ? 74 : 54
  last.slice(0, 3).forEach((l, i) => g.fillText(l, 112, (base ? 260 : 196) + i * step))
  if (base) {
    // how each team stands, big
    let by = 480
    for (const st of r.standings ?? []) {
      g.fillStyle = st.mine ? '#2f5f6b' : '#8e2a22'
      g.font = `500 66px ${HAND}`
      const lines = wrapText(g, st.text, PW - 120)
      lines.slice(0, 2).forEach((l, i) => g.fillText(l, 112, by + i * 68))
      g.strokeStyle = g.fillStyle
      g.lineWidth = 3
      g.beginPath()
      g.moveTo(112, by + 14 + (lines.length - 1) * 68)
      g.quadraticCurveTo(300, by + 22 + (lines.length - 1) * 68, 640, by + 12 + (lines.length - 1) * 68)
      g.stroke()
      by += 110 + (lines.length - 1) * 68
    }
  }
  let y = 375
  for (const row of base ? [] : r.rows) {
    g.fillStyle = row.mine ? '#2f5f6b' : '#8e2a22'
    g.font = `500 68px ${HAND}`
    g.fillText(row.label, 112, y)
    g.strokeStyle = g.fillStyle
    g.lineWidth = 3
    g.beginPath()
    g.moveTo(112, y + 10)
    g.quadraticCurveTo(300, y + 16, 600, y + 8)
    g.stroke()
    g.fillStyle = INKC
    g.font = `600 56px ${HAND}`
    g.fillText(`pidió ${row.asked}   ganó ${row.won}`, 112, y + 66)
    g.fillStyle = row.met ? '#3d6b3a' : '#8e2a22'
    g.font = `500 58px ${HAND}`
    g.fillText(row.met ? 'cumplió' : 'falló', 112, y + 124)
    g.fillStyle = INKC
    g.fillText(`${row.pts} puntos`, 360, y + 124)
    g.font = `600 52px ${HAND}`
    g.fillText(`total ${row.total}`, 112, y + 176)
    y += 232
  }
  if (base && r.totals) {
    // the score so far
    g.font = `500 54px ${HAND}`
    g.fillStyle = INKC
    g.fillText('Puntos:', 112, 722)
    const x0 = 112 + g.measureText('Puntos:  ').width
    g.fillStyle = '#2a5560'
    const mine = `tu equipo ${r.totals.mine}`
    g.fillText(mine, x0, 722)
    g.fillStyle = '#8e2a22'
    g.fillText(`rivales ${r.totals.rival}`, x0 + g.measureText(mine + '   ').width, 722)
  }
  // who is ready
  g.font = `600 ${base ? 54 : 46}px ${HAND}`
  const colW = base ? 290 : 300
  r.players.forEach((p, i) => {
    const px = 112 + (i % 2) * colW
    const py = (base ? 810 : 850) + Math.floor(i / 2) * (base ? 58 : 50)
    if (py > PH - 30) return
    g.fillStyle = p.ready ? '#3d6b3a' : 'rgba(42,38,34,0.55)'
    g.fillText(`${p.ready ? '✓' : '…'} ${p.name}`, px, py)
  })
  // the tick button: a faint grey tick, as if switched off; the pencil goes over it in green
  const cx = TICK.x + TICK.w / 2
  const cy = TICK.y + TICK.h / 2
  const pts = tickPath(cx, cy)
  strokeUpTo(g, pts, 1, hot && !r.ready ? 'rgb(100,96,90)' : 'rgb(172,168,160)', 5)
  if (tick > 0) strokeUpTo(g, pts, tick, '#2e7d32', 5)
  return pts
}

/** The reduced scoresheet, live on the page of the notepad (readable from your seat). */
export interface LiveSheet {
  round: number
  rounds: number
  tiebreak: boolean
  base: number
  bases: number
  clockwise: boolean
  teams: Array<{ label: string; score: number; asked: string; kamikaze: boolean; won: number; bid: number | null; mine: boolean; acting: boolean }>
}

function pageStar(g: CanvasRenderingContext2D, cx: number, cy: number, r: number, kind: 'owed' | 'on' | 'over') {
  const color = kind === 'over' ? '#8e2a22' : INKC
  g.beginPath()
  for (let i = 0; i < 10; i++) {
    const rr = i % 2 ? r * 0.42 : r
    const a = -Math.PI / 2 + (i * Math.PI) / 5
    const x = cx + Math.cos(a) * rr
    const y = cy + Math.sin(a) * rr
    if (i === 0) g.moveTo(x, y)
    else g.lineTo(x, y)
  }
  g.closePath()
  g.lineJoin = 'round'
  g.lineWidth = 3.4
  g.strokeStyle = color
  g.stroke()
  if (kind !== 'owed') {
    g.fillStyle = color
    g.fill()
  }
}

/** Ink: the text is filled and then stroked in the same colour, so the strokes are heavier. */
function bolden(g: CanvasRenderingContext2D) {
  const fill = g.fillText.bind(g)
  g.fillText = (text: string, x: number, y: number, max?: number) => {
    fill(text, x, y, max)
    g.save()
    g.strokeStyle = g.fillStyle as string
    g.lineWidth = 0.7
    g.lineJoin = 'round'
    g.strokeText(text, x, y, max)
    g.restore()
  }
}

/** The big, simple scoreboard: round, base and direction on top, then both teams (points, asked, won, stars). */
function drawLive(cv: HTMLCanvasElement, d: LiveSheet) {
  const g = cv.getContext('2d')!
  bolden(g)
  ruledPage(g)
  g.textBaseline = 'alphabetic'
  g.fillStyle = INKC
  g.font = `500 104px ${HAND}`
  g.fillText(`Ronda ${d.round}/${d.rounds}`, 110, 112)
  g.font = `500 92px ${HAND}`
  g.fillText(`Base ${d.base}/${d.bases}`, 110, 214)
  g.font = `500 150px ${HAND}`
  g.fillText(d.clockwise ? '↻' : '↺', 590, 190)
  const top = [262, 640]
  d.teams.slice(0, 2).forEach((t, i) => {
    const y = top[i]
    const color = t.mine ? '#2a5560' : '#8e2a22'
    g.fillStyle = color
    g.font = `500 88px ${HAND}`
    g.fillText(t.label + (t.acting ? ' ✎' : ''), 110, y + 62)
    g.strokeStyle = color
    g.lineWidth = 4
    g.beginPath()
    g.moveTo(110, y + 80)
    g.quadraticCurveTo(330, y + 90, 690, y + 78)
    g.stroke()
    g.fillStyle = INKC
    g.font = `500 230px ${HAND}`
    g.fillText(String(t.score), 100, y + 280)
    g.font = `500 78px ${HAND}`
    g.fillText(`pidió ${t.asked}`, 400, y + 190)
    g.fillText(`lleva ${t.won}`, 400, y + 276)
    if (t.kamikaze) {
      g.fillStyle = '#8e2a22'
      g.font = `500 52px ${HAND}`
      g.fillText('kamikaze', 520, y + 130)
    }
    if (t.bid === 0 && t.won === 0) {
      // asked nothing: a plain dash
      g.strokeStyle = INKC
      g.lineWidth = 7
      g.lineCap = 'round'
      g.beginPath()
      g.moveTo(414, y + 322)
      g.lineTo(470, y + 320)
      g.stroke()
    }
    if (t.bid !== null && (t.bid > 0 || t.won > 0)) {
      const n = t.bid + Math.max(0, t.won - t.bid)
      for (let k = 0; k < Math.min(n, 12); k++) {
        pageStar(g, 410 + (k % 6) * 48, y + 322 + Math.floor(k / 6) * 44, 20, k >= (t.bid ?? 0) ? 'over' : k < t.won ? 'on' : 'owed')
      }
    }
  })
  return []
}

interface Flip {
  dir: 'up' | 'down'
  from: number
  to: number
  shape: LeafShape
  mode: 'drag' | 'auto'
  t0: number
  dur: number
  a0: number
  v0: number
  target: number
}

export class Notepad {
  readonly group = new THREE.Group()
  readonly hit: THREE.Mesh
  /** Holds the pointer target: it follows the pad's resting pose, not its hover lift (or the pad would jump out from under the pointer at its edge and shake). */
  readonly hitRoot = new THREE.Group()
  hovered = false
  private lift = 0
  private report: RoundReport | null = null
  private live: LiveSheet | null = null
  private liveKey = ''
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
  private pencilReportQuat = new THREE.Quaternion() // the pencil mirrored (it lies on the right: its tip points toward the pad)
  private floatT = 0
  private pencilReport = new THREE.Vector3() // where it lies while a report is on the page: below the writing
  private dirty = false
  readonly tickHit: THREE.Mesh // the tick on the page, for the pointer
  tickHovered = false
  private disposables: Array<{ dispose(): void }> = []
  // ---- the pages: every base and round report is kept, the live scoreboard is always the top one
  private history: RoundReport[] = []
  private idx = 0 // the page you are looking at (history.length = the top one)
  private flip: Flip | null = null
  private leaf!: THREE.Mesh
  private leafFrontMat!: THREE.MeshStandardMaterial
  private leafCv = document.createElement('canvas')
  private leafTex!: THREE.CanvasTexture
  private pile!: THREE.Mesh

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
    const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.0034, 0.0013, 0.012, 6), new THREE.MeshStandardMaterial({ color: hex(PALETTE.bone), roughness: 0.9 })) // the sharpened wood: a hexagonal taper that ends exactly where the lead starts
    const lead = new THREE.Mesh(new THREE.ConeGeometry(0.0013, 0.004, 6), new THREE.MeshStandardMaterial({ color: 0x1a1613 }))
    const eraser = new THREE.Mesh(new THREE.CylinderGeometry(0.0036, 0.0036, 0.009, 6), new THREE.MeshStandardMaterial({ color: hex(PALETTE.rose), roughness: 0.9 }))
    tip.position.y = -0.066
    lead.position.y = -0.074 // its base sits on the wood's narrow end (y = -0.072)
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
    // lying beside the pad on the right, almost parallel to its long side, the tip toward you and a touch inward
    this.pencilReportQuat.setFromUnitVectors(new THREE.Vector3(0, -1, 0), new THREE.Vector3(-0.2, 0, 1).normalize())
    this.pencilReport.set(0.1, 0.07, 0.06) // lower along the pad: clear of the central deck // hovering beside the pad (the pad is tilted: lower than this and it would sink into the table) // on the table, right of the pad
    // the tick's spot on the page (a flat, invisible target)
    this.tickHit = new THREE.Mesh(new THREE.PlaneGeometry((TICK.w / PW) * W * 1.15, (TICK.h / PH) * D * 1.15), new THREE.MeshBasicMaterial({ visible: false }))
    this.tickHit.rotation.x = -Math.PI / 2
    this.tickHit.position.set(((TICK.x + TICK.w / 2) / PW - 0.5) * W, 0.004 + T + 0.002, ((TICK.y + TICK.h / 2) / PH - 0.5) * D)
    this.group.add(this.tickHit)
    this.disposables.push(this.reportTex, this.tickHit.geometry)
    this.hit = new THREE.Mesh(new THREE.BoxGeometry(W + 0.03, 0.04, D + 0.03), new THREE.MeshBasicMaterial({ visible: false }))
    this.hit.position.y = 0.02
    this.hitRoot.add(this.hit)
    this.buildPages(paperTex)
    this.group.position.set(NOTEPAD_AT.x, TABLE_Y, NOTEPAD_AT.z)
    this.group.rotation.y = YAW
    this.disposables.push(paperTex, paper, edge, card, wire, ringGeo, back.geometry, sheets.geometry, this.hit.geometry)
  }

  /** The leaf that turns over the rings, and the pile of leaves already turned (behind the pad). */
  private buildPages(paperTex: THREE.Texture) {
    this.leafCv.width = PW
    this.leafCv.height = PH
    this.leafTex = new THREE.CanvasTexture(this.leafCv)
    this.leafTex.colorSpace = THREE.SRGBColorSpace
    this.leafTex.anisotropy = 8
    // the leaf's u runs from the rings toward you and its v along the rings; the page is drawn upright
    this.leafTex.matrixAutoUpdate = false
    this.leafTex.matrix.set(0, 1, 0, -1, 0, 1, 0, 0, 1)
    this.leafFrontMat = new THREE.MeshStandardMaterial({ map: this.leafTex, roughness: 0.9, emissive: 0xffffff, emissiveMap: this.leafTex, emissiveIntensity: 0.4, color: 0x9a9588, side: THREE.FrontSide, shadowSide: THREE.DoubleSide })
    const backMat = new THREE.MeshStandardMaterial({ color: 0xcfc6a8, roughness: 0.95, emissive: 0xcfc6a8, emissiveIntensity: 0.32, side: THREE.BackSide, shadowSide: THREE.DoubleSide }) // a bit self-lit: standing up it faces away from the lamp
    const row = SEG_U + 1
    const n = row * (SEG_V + 1)
    const uv = new Float32Array(n * 2)
    const idxs: number[] = []
    for (let j = 0; j <= SEG_V; j++) {
      for (let i = 0; i <= SEG_U; i++) {
        const k = j * row + i
        uv[k * 2] = i / SEG_U
        uv[k * 2 + 1] = 1 - j / SEG_V
        if (i < SEG_U && j < SEG_V) idxs.push(k, k + row, k + 1, k + 1, k + row, k + row + 1)
      }
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3))
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
    geo.setIndex(idxs)
    geo.addGroup(0, idxs.length, 0)
    geo.addGroup(0, idxs.length, 1)
    this.leaf = new THREE.Mesh(geo, [this.leafFrontMat, backMat])
    this.leaf.castShadow = this.leaf.receiveShadow = true
    this.leaf.frustumCulled = false
    this.leaf.visible = false
    this.leaf.scale.setScalar(D)
    this.leaf.rotation.y = -Math.PI / 2 // local +x (the leaf's length) lies along the pad toward you
    this.leaf.position.set(0, 0, -D / 2)
    this.group.add(this.leaf)
    // the pile of turned leaves: their blank backs, behind the rings
    this.pile = new THREE.Mesh(new THREE.BoxGeometry(W * 0.98, 1, D * 0.98), new THREE.MeshStandardMaterial({ color: 0xcfc6a8, roughness: 0.95 }))
    this.pile.castShadow = this.pile.receiveShadow = true
    this.pile.visible = false
    this.group.add(this.pile)
    this.disposables.push(this.leafTex, geo, backMat, this.leafFrontMat, this.pile.geometry, this.pile.material as THREE.Material)
    void paperTex
  }

  private pageCount() {
    return this.history.length + 1 // + the top one (the live scoreboard, or the report being read)
  }

  /** Can a leaf be turned that way? (up: toward older pages over the rings; down: back to newer ones) */
  canFlip(dir: 'up' | 'down') {
    if (this.flip) return false
    if (this.report) return false // reading a report: nothing to leaf through
    return dir === 'up' ? this.idx > 0 : this.idx < this.pageCount() - 1
  }

  /** What the pointer can grab: the pad, the leaves already turned (anywhere on them) and a leaf in the air. */
  grabTargets(): THREE.Object3D[] {
    const t: THREE.Object3D[] = [this.hit]
    if (this.pile.visible) t.push(this.pile)
    if (this.leaf.visible) t.push(this.leaf)
    return t
  }

  get flipping() {
    return this.flip !== null
  }

  /** The page now on top (0 = the oldest) and how many there are (tests). */
  pageInfo() {
    return { page: this.idx, pages: this.pageCount() }
  }

  /** Starts turning a leaf (held at its near edge: it follows `dragFlip`). */
  beginFlip(dir: 'up' | 'down') {
    if (!this.canFlip(dir)) return false
    const from = this.idx
    const to = dir === 'up' ? from - 1 : from + 1
    const startA = dir === 'up' ? 0 : Math.PI
    this.flip = {
      dir,
      from,
      to,
      shape: { angle: startA, omega: 0, grabU: 0.92, grabV: 0.5, rigid: false },
      mode: 'drag',
      t0: 0,
      dur: 0,
      a0: startA,
      v0: 0,
      target: startA,
    }
    this.leaf.visible = true
    this.dirty = true
    return true
  }

  /** The leaf follows the hand: `progress` 0–1 of the way over. */
  dragFlip(progress: number) {
    const f = this.flip
    if (!f || f.mode !== 'drag') return
    const p = Math.min(1, Math.max(0, progress))
    const goal = f.dir === 'up' ? p * Math.PI : (1 - p) * Math.PI
    f.shape.omega = (goal - f.shape.angle) * 14
    f.shape.angle += (goal - f.shape.angle) * 0.6
  }

  /** The hand lets go: the leaf finishes the turn (or falls back) from where it is. */
  releaseFlip() {
    const f = this.flip
    if (!f || f.mode !== 'drag') return
    const over = f.dir === 'up' ? Math.PI : 0
    const fling = f.shape.omega * (f.dir === 'up' ? 1 : -1)
    const half = Math.abs(f.shape.angle - (f.dir === 'up' ? 0 : Math.PI)) > Math.PI / 2
    const done = fling > 3 ? true : fling < -3 ? false : half
    f.mode = 'auto'
    f.a0 = f.shape.angle
    f.v0 = f.shape.omega
    f.target = done ? over : Math.PI - over
    f.t0 = performance.now()
    f.dur = 0.28 + (0.5 * Math.abs(f.target - f.a0)) / Math.PI
  }

  /** The pile's height for `count` turned leaves (m). */
  private pileHeight(count: number) {
    return 0.0012 + Math.min(count, 80) * 0.00035
  }

  /** Per frame: the turning leaf (physics of the rulebook's leaves, hinged on the rings) and the pile. */
  private stepFlip(dt: number) {
    const top = this.pageCount() - 1
    const f = this.flip
    // what lies behind the rings: the leaves already turned (not the moving one)
    const moving = f ? 1 : 0
    const turned = top - this.idx - (f && f.dir === 'down' ? 1 : 0)
    const count = Math.max(0, turned)
    const h = this.pileHeight(count)
    this.pile.visible = count > 0
    this.pile.scale.y = h
    this.pile.position.set(0, h / 2, -D / 2 - D * 0.49 - 0.003)
    if (!f) {
      this.leaf.visible = false
      return
    }
    void moving
    const s = f.shape
    if (f.mode === 'auto') {
      const t = Math.min(1, (performance.now() - f.t0) / 1000 / f.dur)
      const e = t * t
      const t2 = t * t
      const t3 = t2 * t
      const a = (2 * t3 - 3 * t2 + 1) * f.a0 + (t3 - 2 * t2 + t) * f.v0 * f.dur + (-2 * t3 + 3 * t2) * f.target
      void e
      s.omega += ((a - s.angle) / Math.max(dt, 1e-3) - s.omega) * Math.min(1, dt * 12)
      s.angle = Math.max(0, Math.min(Math.PI, a))
      if (t >= 1) {
        const done = f.target === (f.dir === 'up' ? Math.PI : 0)
        if (done) this.idx = f.to
        this.flip = null
        this.leaf.visible = false
        this.dirty = true
        return
      }
    }
    // the leaf rests a hair above whatever lies under it
    const frame: LeafFrame = { w: 1, h: W / D, rightTop: (0.004 + T + 0.0004) / D, leftTop: (h + 0.0006) / D }
    const pos = this.leaf.geometry.getAttribute('position') as THREE.BufferAttribute
    shapeLeaf(s, frame, pos.array as Float32Array)
    pos.needsUpdate = true
    this.leaf.geometry.computeVertexNormals()
    this.leaf.geometry.computeBoundingSphere()
  }

  /** The live scoreboard on the page, always (null: the page has only scribbles). */
  setLive(d: LiveSheet | null) {
    const key = d ? JSON.stringify(d) : ''
    if (key === this.liveKey) return
    this.liveKey = key
    this.live = d
    this.dirty = true
  }

  /** A round's report on the page (null: back to the scribbles). */
  setReport(r: RoundReport | null) {
    const wasReady = this.report?.ready ?? false
    const before = this.report
    this.report = r
    this.dirty = true
    if (r && !before) {
      // a report starts: the pad shows its top page again (the report), whatever you were leafing through
      this.flip = null
      this.leaf.visible = false
      this.idx = this.history.length
    }
    if (!r && before) {
      // the report is over: it stays in the pad, as a page, for good
      this.history.push({ ...before, ready: true, players: before.players.map((p) => ({ ...p, ready: true })) })
      this.idx = this.history.length
    }
    if (r) {
      if (!this.showingReport) {
        this.showingReport = true
        this.paperMat.map = this.reportTex
        this.paperMat.emissiveMap = this.reportTex
        this.paperMat.color.set(0x9a9588) // the page is read from close up: dimmed so the lamp doesn't burn it
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

  /** Is the report (not an older page) the one under the pointer? */
  onTop() {
    return this.idx >= this.history.length && !this.flip
  }

  /** The tick's world position (tests). */
  tickWorld() {
    return this.tickHit.getWorldPosition(new THREE.Vector3())
  }

  /** Per frame. `focus` 0–1: how far the camera has come to read the page (the pad stands up toward it). */
  update(dt: number, focus = 0) {
    this.lift += ((this.hovered ? 1 : 0) - this.lift) * Math.min(1, dt * 12)
    const e = focus * focus * (3 - 2 * focus)

    // at rest it leans toward you and is big enough to read the scoreboard from your seat; reading it
    // (a report) it stands up a little more
    const scale = REST_SCALE + (FOCUS_SCALE - REST_SCALE) * e
    this.tilt = REST_TILT + (FOCUS_TILT - REST_TILT) * e
    this.group.rotation.set(this.tilt, REST_YAW * (1 - e), 0) // the pad itself never moves on hover
    this.group.scale.setScalar(scale)
    // it stands up on its near edge: raised by half its depth times the sine of the tilt, or it would sink into the table
    const lift = (D / 2) * scale * Math.sin(this.tilt) + 0.012 * e
    this.group.position.set(NOTEPAD_AT.x, TABLE_Y + lift, NOTEPAD_AT.z)
    this.hitRoot.position.set(NOTEPAD_AT.x, TABLE_Y + lift, NOTEPAD_AT.z)
    this.hitRoot.rotation.set(this.tilt, REST_YAW * (1 - e), 0)
    this.hitRoot.scale.setScalar(scale)
    const wantPage = this.report !== null || this.live !== null
    // the paper under the lamp: dimmed while you read a report up close, brighter and a little self-lit for the live scoreboard seen from afar
    if (this.showingReport) this.paperMat.emissiveIntensity = 0.05 + 0.04 * (1 - e)
    if (wantPage && !this.showingReport) {
      this.showingReport = true
      this.paperMat.map = this.reportTex
      this.paperMat.emissiveMap = this.reportTex
      this.paperMat.color.set(0x9a9588)
      this.paperMat.emissiveIntensity = 0.04
      this.paperMat.needsUpdate = true
      this.dirty = true
    }
    if (this.showingReport && !wantPage && focus < 0.02) {
      this.showingReport = false
      this.paperMat.map = this.paperTex
      this.paperMat.emissiveMap = this.paperTex
      this.paperMat.color.set(0xffffff)
      this.paperMat.emissiveIntensity = 0.12
      this.paperMat.needsUpdate = true
    }
    if (!this.showingReport) {
      this.pencil.position.lerp(this.pencilRest, Math.min(1, dt * 6))
      this.pencil.quaternion.slerp(this.pencilRestQuat, Math.min(1, dt * 6))
      return
    }
    // the pencil writing the tick
    if (this.writing && this.report) {
      this.tickT = Math.min(1, this.tickT + dt / 0.16)
      this.dirty = true
      if (this.tickT >= 1) this.writing = false
    }
    this.stepFlip(dt)
    if (this.dirty || (this.report && this.tickHovered !== this.lastHot)) {
      this.lastHot = this.tickHovered
      // the pad's page is the one under the leaf while one turns; the leaf carries the other
      const f = this.flip
      const under = f ? (f.dir === 'up' ? f.to : f.from) : this.idx
      this.tickPts = this.paintPage(this.reportCv, under) ?? []
      if (f) this.paintPage(this.leafCv, f.dir === 'up' ? f.from : f.to)
      this.reportTex.needsUpdate = true
      this.leafTex.needsUpdate = true
      this.dirty = false
    }
    // the pencil goes to the tick while it is written, and back to rest after
    const target = new THREE.Vector3()
    let toward = 0
    if (this.writing && this.report && this.tickPts.length) {
      const d = this.tickT
      const [a, b, c] = this.tickPts
      const l1 = Math.hypot(b[0] - a[0], b[1] - a[1])
      const l2 = Math.hypot(c[0] - b[0], c[1] - b[1])
      const dist = d * (l1 + l2)
      const p: [number, number] = dist <= l1 ? [a[0] + (b[0] - a[0]) * (dist / l1), a[1] + (b[1] - a[1]) * (dist / l1)] : [b[0] + (c[0] - b[0]) * ((dist - l1) / l2), b[1] + (c[1] - b[1]) * ((dist - l1) / l2)]
      target.set((p[0] / PW - 0.5) * W, 0.004 + T + 0.002, (p[1] / PH - 0.5) * D)
      toward = 1
    }
    const tip = new THREE.Vector3(0, -0.076, 0).applyQuaternion(this.pencil.quaternion)
    this.floatT += dt
    const hover = this.pencilReport.clone()
    hover.y = 0.0045 + (this.pencilReport.y - 0.0045) * e + Math.sin(this.floatT * 2.2) * 0.006 * e + this.lift * 0.02 * (1 - e) // hovering the pad: the pencil rises a little, the pad stays
    const goal = toward ? target.sub(tip) : hover
    this.pencil.position.lerp(goal, Math.min(1, dt * (toward ? 60 : 8)))
    this.pencil.quaternion.slerp(this.pencilReportQuat, Math.min(1, dt * 8))
  }

  private lastHot = false

  /** Draws page `i` (0 = oldest; the last is the top one) on a canvas. */
  private paintPage(cv: HTMLCanvasElement, i: number): Array<[number, number]> | undefined {
    const top = this.history.length
    if (i < top) return drawReport(cv, this.history[i], 1, false)
    if (this.report) return drawReport(cv, this.report, this.tickT, this.tickHovered)
    if (this.live) return drawLive(cv, this.live)
    return undefined
  }

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
