// 2D figure-drawing toolkit for the court cards (see the `drawing-2d-figures` skill).
// Everything is built from smooth curves through anatomical points; nothing is a primitive.
// Light comes from the upper left: contours get heavier and hatching appears on the right side.

export type V = { x: number; y: number }
export const v = (x: number, y: number): V => ({ x, y })

const INK = '#140e0c'

// ------------------------------------------------------------------ curves

/** Catmull-Rom spline through points (open), sampled. */
export function spline(pts: V[], samples = 10, closed = false): V[] {
  const out: V[] = []
  const n = pts.length
  const get = (i: number) => (closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))])
  const segs = closed ? n : n - 1
  for (let i = 0; i < segs; i++) {
    const p0 = get(i - 1)
    const p1 = get(i)
    const p2 = get(i + 1)
    const p3 = get(i + 2)
    for (let s = 0; s < samples; s++) {
      const t = s / samples
      const t2 = t * t
      const t3 = t2 * t
      out.push({
        x: 0.5 * (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
        y: 0.5 * (2 * p1.y + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
      })
    }
  }
  if (!closed) out.push(pts[n - 1])
  return out
}

function path(g: CanvasRenderingContext2D, pts: V[], closed = true) {
  g.beginPath()
  g.moveTo(pts[0].x, pts[0].y)
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y)
  if (closed) g.closePath()
}

function centroid(pts: V[]) {
  const c = pts.reduce((a, p) => ({ x: a.x + p.x, y: a.y + p.y }), { x: 0, y: 0 })
  return { x: c.x / pts.length, y: c.y / pts.length }
}

// ------------------------------------------------------------------ inked shapes

export interface InkOpts {
  line?: number // lit-side outline width
  shadow?: number // shadow-side outline width
  hatch?: number // hatch spacing (0 = none)
  hatchAngle?: number // radians; lines run along this direction
  hatchFrom?: number // 0..1 across the shape's width where shadow starts (0.55 = right 45%)
  cross?: boolean // add a second hatch layer for the deepest darks
}

/** Outline a filled contour: thin everywhere, heavier on the shadow (right) side. */
function inkOutline(g: CanvasRenderingContext2D, pts: V[], o: InkOpts, closed = true) {
  const c = centroid(pts)
  g.lineJoin = 'round'
  g.lineCap = 'round'
  g.strokeStyle = INK
  path(g, pts, closed)
  g.lineWidth = o.line ?? 1.1
  g.stroke()
  g.save()
  g.beginPath()
  g.rect(c.x - 2, -1000, 3000, 3000)
  g.clip()
  path(g, pts, closed)
  g.lineWidth = o.shadow ?? 2.2
  g.stroke()
  g.restore()
}

/** Parallel, slightly curved hatching inside a contour, only on the shadow side. */
export function hatchInside(g: CanvasRenderingContext2D, pts: V[], spacing: number, angle = 1.1, from = 0.55, alpha = 0.75) {
  const xs = pts.map((p) => p.x)
  const ys = pts.map((p) => p.y)
  const x0 = Math.min(...xs)
  const x1 = Math.max(...xs)
  const y0 = Math.min(...ys)
  const y1 = Math.max(...ys)
  const sx = x0 + (x1 - x0) * from
  g.save()
  path(g, pts)
  g.clip()
  g.beginPath()
  g.rect(sx, y0 - 2, x1 - sx + 4, y1 - y0 + 4)
  g.clip()
  g.strokeStyle = `rgba(20,14,12,${alpha})`
  g.lineWidth = 0.7
  const dx = Math.cos(angle)
  const dy = Math.sin(angle)
  const nx = -dy
  const ny = dx
  const reach = (x1 - x0) + (y1 - y0)
  const cx = (x0 + x1) / 2
  const cy = (y0 + y1) / 2
  for (let d = -reach; d <= reach; d += spacing) {
    const px = cx + nx * d
    const py = cy + ny * d
    g.beginPath()
    g.moveTo(px - dx * reach, py - dy * reach)
    // slight bow so the hatch wraps the form instead of lying flat
    g.quadraticCurveTo(px + nx * spacing * 0.6, py + ny * spacing * 0.6, px + dx * reach, py + dy * reach)
    g.stroke()
  }
  g.restore()
}

/** A closed shape through anatomical points, filled, shadow-weighted outline, optional hatching. */
export function shape(g: CanvasRenderingContext2D, pts: V[], fill: string, o: InkOpts = {}) {
  const c = spline(pts, 8, true)
  path(g, c)
  g.fillStyle = fill
  g.fill()
  if (o.hatch) {
    hatchInside(g, c, o.hatch, o.hatchAngle ?? 1.1, o.hatchFrom ?? 0.55)
    if (o.cross) hatchInside(g, c, o.hatch * 1.4, (o.hatchAngle ?? 1.1) - 1.3, (o.hatchFrom ?? 0.55) + 0.2, 0.5)
  }
  inkOutline(g, c, o)
  return c
}

/**
 * A limb: a smooth spine through the joints with a width at each joint. `bulge` adds muscle between
 * joints on the given side (+1 right, -1 left of the direction of travel) so the two contours are
 * not parallel. Returns the outline (for clipping cloth details).
 */
export function limb(
  g: CanvasRenderingContext2D,
  joints: V[],
  widths: number[],
  fill: string,
  o: InkOpts & { bulges?: Array<{ at: number; amount: number; side: 1 | -1 }>; closedRoot?: boolean; ramp?: number } = {},
) {
  const spine = spline(joints, 12)
  const n = spine.length
  const segs = joints.length - 1
  const left: V[] = []
  const right: V[] = []
  for (let i = 0; i < n; i++) {
    const t = (i / (n - 1)) * segs
    const k = Math.min(segs - 1, Math.floor(t))
    const f = t - k
    let w = widths[k] * (1 - f) + widths[k + 1] * f
    const a = spine[Math.max(0, i - 1)]
    const b = spine[Math.min(n - 1, i + 1)]
    let tx = b.x - a.x
    let ty = b.y - a.y
    const len = Math.hypot(tx, ty) || 1
    tx /= len
    ty /= len
    const nx = -ty
    const ny = tx
    let wl = w / 2
    let wr = w / 2
    for (const bu of o.bulges ?? []) {
      const d = Math.abs(t - bu.at)
      const bump = d < 0.5 ? Math.cos(d * Math.PI) * bu.amount : 0
      if (bu.side === 1) wr += bump
      else wl += bump
    }
    w = wl + wr
    left.push({ x: spine[i].x + nx * wl, y: spine[i].y + ny * wl })
    right.push({ x: spine[i].x - nx * wr, y: spine[i].y - ny * wr })
  }
  const outline = [...left, ...[...right].reverse()]
  path(g, outline)
  g.fillStyle = fill
  g.fill()
  if (o.hatch) hatchInside(g, outline, o.hatch, o.hatchAngle ?? 1.1, o.hatchFrom ?? 0.55)
  if (o.closedRoot) {
    inkOutline(g, outline, o)
    return outline
  }
  // Open root: the limb grows out of the body. No line closes its top, and the two side
  // contours emerge gradually (tapered from zero), so the limb reads as part of the body instead
  // of a cut-out laid on top. The heavier contour goes on the side that faces away from the light.
  const ramp = o.ramp ?? 0.28
  const rightHeavier = right.reduce((a, p) => a + p.x, 0) > left.reduce((a, p) => a + p.x, 0)
  const lw = o.line ?? 1.1
  const sw = o.shadow ?? 2.2
  inkEdge(g, left, rightHeavier ? lw : sw, ramp)
  inkEdge(g, right, rightHeavier ? sw : lw, ramp)
  // distal end (hand/foot side) closes normally
  g.beginPath()
  g.moveTo(left[left.length - 1].x, left[left.length - 1].y)
  g.lineTo(right[right.length - 1].x, right[right.length - 1].y)
  g.lineWidth = lw
  g.strokeStyle = INK
  g.lineCap = 'round'
  g.stroke()
  return outline
}

/** A contour line whose width grows from 0 over the first `ramp` fraction (emerging from a mass). */
export function inkEdge(g: CanvasRenderingContext2D, pts: V[], w: number, ramp = 0.28) {
  const n = pts.length
  const l: V[] = []
  const r: V[] = []
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1)
    const k = ramp > 0 ? Math.min(1, t / ramp) : 1
    const width = w * k * k * (3 - 2 * k) * 0.5
    const a = pts[Math.max(0, i - 1)]
    const b = pts[Math.min(n - 1, i + 1)]
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1
    const nx = -(b.y - a.y) / len
    const ny = (b.x - a.x) / len
    l.push({ x: pts[i].x + nx * width, y: pts[i].y + ny * width })
    r.push({ x: pts[i].x - nx * width, y: pts[i].y - ny * width })
  }
  path(g, [...l, ...r.reverse()])
  g.fillStyle = INK
  g.fill()
}

/** Fill-only smooth patch (no outline): hides a seam where two masses meet (neck into chest). */
export function patch(g: CanvasRenderingContext2D, pts: V[], fill: string) {
  path(g, spline(pts, 8, true))
  g.fillStyle = fill
  g.fill()
}

/** Tapered stroke (drapery folds, muscle separations, hair strands): thick at the start. */
export function fold(g: CanvasRenderingContext2D, pts: V[], w0 = 1.6, w1 = 0.15, color = INK) {
  const s = spline(pts, 8)
  const n = s.length
  const l: V[] = []
  const r: V[] = []
  for (let i = 0; i < n; i++) {
    const a = s[Math.max(0, i - 1)]
    const b = s[Math.min(n - 1, i + 1)]
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1
    const nx = -(b.y - a.y) / len
    const ny = (b.x - a.x) / len
    const w = (w0 + (w1 - w0) * (i / (n - 1))) / 2
    l.push({ x: s[i].x + nx * w, y: s[i].y + ny * w })
    r.push({ x: s[i].x - nx * w, y: s[i].y - ny * w })
  }
  path(g, [...l, ...r.reverse()])
  g.fillStyle = color
  g.fill()
}

export function stroke(g: CanvasRenderingContext2D, pts: V[], w = 0.9, color = INK) {
  const s = spline(pts, 8)
  path(g, s, false)
  g.lineWidth = w
  g.lineCap = 'round'
  g.lineJoin = 'round'
  g.strokeStyle = color
  g.stroke()
}

// ------------------------------------------------------------------ head

export interface HeadOpts {
  skin: string
  hair?: string
  beard?: boolean
  old?: boolean
}

/**
 * ¾ head facing left. (cx, cy) = centre of the cranium, H = head height (crown to chin).
 * Returns key points (chin, top) for hats, crowns and collars.
 */
export function head(g: CanvasRenderingContext2D, cx: number, cy: number, H: number, o: HeadOpts) {
  const u = H / 10 // 10 units per head
  const top = cy - 5 * u
  const chin = { x: cx - 1.6 * u, y: cy + 5 * u }
  // skull + jaw contour, face plane on the left
  const contour = [
    v(cx + 0.6 * u, top), v(cx + 3.6 * u, top + 1.2 * u), v(cx + 4 * u, cy - 0.5 * u), v(cx + 3.2 * u, cy + 2.2 * u), // back of skull, jaw hinge
    v(cx + 1.2 * u, cy + 4.2 * u), chin, v(cx - 3.2 * u, cy + 3.4 * u), // jaw line to chin
    v(cx - 3.4 * u, cy + 1.6 * u), v(cx - 3.9 * u, cy + 0.4 * u), // mouth, nose tip region
    v(cx - 3.3 * u, cy - 0.6 * u), v(cx - 3.4 * u, cy - 1.8 * u), // under the brow, brow
    v(cx - 2.6 * u, top + 0.8 * u),
  ]
  shape(g, contour, o.skin, { line: 0.9, shadow: 1.6, hatch: 1.4, hatchAngle: 1.3, hatchFrom: 0.62 })
  // ear
  shape(g, [v(cx + 1.6 * u, cy - 0.6 * u), v(cx + 2.4 * u, cy - 1 * u), v(cx + 2.6 * u, cy + 0.8 * u), v(cx + 1.8 * u, cy + 1.2 * u)], o.skin, { line: 0.7, shadow: 1 })
  // brow ridge and eyes on the half-height line; near eye (right) larger
  const ey = cy - 0.4 * u
  stroke(g, [v(cx - 3.2 * u, ey - 1.4 * u), v(cx - 2.2 * u, ey - 1.7 * u), v(cx - 1.4 * u, ey - 1.5 * u)], 0.9)
  stroke(g, [v(cx - 0.6 * u, ey - 1.6 * u), v(cx + 0.6 * u, ey - 1.8 * u), v(cx + 1.4 * u, ey - 1.4 * u)], 1)
  const eye = (x: number, w: number) => {
    g.beginPath()
    g.ellipse(x, ey, w, w * 0.45, 0, 0, Math.PI * 2)
    g.fillStyle = '#e8dcc0'
    g.fill()
    g.lineWidth = 0.7
    g.strokeStyle = INK
    g.stroke()
    g.beginPath()
    g.arc(x - w * 0.25, ey, w * 0.42, 0, Math.PI * 2) // dark iris looking left, no highlight
    g.fillStyle = INK
    g.fill()
    stroke(g, [v(x - w, ey - w * 0.2), v(x, ey - w * 0.62), v(x + w, ey - w * 0.25)], 1) // upper lid, heavier
  }
  eye(cx - 2.3 * u, 0.75 * u)
  eye(cx + 0.2 * u, 0.95 * u)
  // nose: bridge from the brow, wing and nostril
  stroke(g, [v(cx - 1.5 * u, ey - 0.8 * u), v(cx - 2.1 * u, cy + 1.2 * u), v(cx - 2.9 * u, cy + 2 * u), v(cx - 1.9 * u, cy + 2.3 * u)], 0.9)
  stroke(g, [v(cx - 1.2 * u, cy + 1.9 * u), v(cx - 0.7 * u, cy + 2.2 * u)], 0.7)
  // mouth at 5/6 with a shadow under the lower lip
  stroke(g, [v(cx - 2.6 * u, cy + 3.2 * u), v(cx - 1.4 * u, cy + 3.35 * u), v(cx - 0.3 * u, cy + 3.1 * u)], 1)
  stroke(g, [v(cx - 2 * u, cy + 3.9 * u), v(cx - 1 * u, cy + 4 * u)], 0.6)
  if (o.old) {
    stroke(g, [v(cx - 0.4 * u, cy + 0.6 * u), v(cx - 0.9 * u, cy + 2.4 * u)], 0.5) // nasolabial fold
    stroke(g, [v(cx - 2.6 * u, top + 2.2 * u), v(cx - 0.6 * u, top + 2 * u)], 0.5) // forehead line
  }
  return { top: v(cx, top), chin, jaw: v(cx + 1.8 * u, cy + 3.8 * u), u }
}

// ------------------------------------------------------------------ hands

/**
 * A hand from the wrist toward `dir` (radians). `grip` curls the fingers around a handle.
 * Size ≈ ¾ of the head height.
 */
export function hand(g: CanvasRenderingContext2D, wrist: V, dir: number, size: number, skin: string, grip = false) {
  const c = Math.cos(dir)
  const s = Math.sin(dir)
  const at = (along: number, across: number) => v(wrist.x + c * along * size - s * across * size, wrist.y + s * along * size + c * across * size)
  const palm = [at(0, -0.22), at(0.5, -0.3), at(grip ? 0.72 : 0.95, -0.24), at(grip ? 0.78 : 1, 0.05), at(grip ? 0.7 : 0.92, 0.26), at(0.5, 0.3), at(0, 0.2)]
  shape(g, palm, skin, { line: 0.7, shadow: 1.2 })
  // finger separations
  for (const k of [-0.1, 0.06, 0.2]) stroke(g, [at(0.55, k), at(grip ? 0.74 : 0.9, k + 0.02)], 0.5)
  // thumb
  shape(g, [at(0.15, -0.2), at(0.45, -0.46), at(0.62, -0.42), at(0.4, -0.18)], skin, { line: 0.7, shadow: 1 })
}
