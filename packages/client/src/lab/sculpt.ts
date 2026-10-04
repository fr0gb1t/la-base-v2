// Sculpting with distance fields (development only, used by the character lab). A model is a list of parts — balls,
// ellipsoids, tapered capsules, rounded boxes, rings — melted into each other (smooth union) or carved out of what is
// already there (smooth subtraction), the way clay is worked. The field is then meshed with surface nets; normals come
// from the field's gradient, colour from the part nearest each vertex, and the crevices are darkened by sampling the
// field along the normal (ambient occlusion), which is what makes it read as sculpted rather than assembled.
import * as THREE from 'three/webgpu'

export type V3 = [number, number, number]
type Fn3 = (x: number, y: number, z: number) => number
type Paint = (x: number, y: number, z: number) => V3

export interface Part {
  d: Fn3
  c: V3 | Paint
  k: number // how far it melts into what is already there (0: a hard edge)
  sub?: boolean // carve instead of add
  b: [number, number, number, number] // bounding sphere (centre, radius), to skip parts that cannot matter
}

export interface Model {
  parts: Part[]
  disp?: Fn3 // a small displacement on top (cloth wrinkles, clay lumps, wool)
  paint?: (x: number, y: number, z: number, c: V3) => V3 // painting over the part colours
  ao?: number // crevice darkening strength (default 1)
}

/** sRGB hex to the linear colour the vertex colours want. */
export const col = (hex: number): V3 => {
  const c = new THREE.Color(hex)
  return [c.r, c.g, c.b]
}
export const mixc = (a: V3, b: V3, t: number): V3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]

// ------------------------------------------------------------------------------------------------ orientation
/** Rows of the inverse rotation for an Euler (XYZ) angle, so local = R⁻¹ (p − c). */
function inv(e?: V3) {
  if (!e) return null
  const m = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(e[0], e[1], e[2])).invert().elements
  return [m[0], m[4], m[8], m[1], m[5], m[9], m[2], m[6], m[10]]
}

// ------------------------------------------------------------------------------------------------ parts
export function ball(c: V3, r: number, color: V3 | Paint, k = 0, sub = false): Part {
  return { d: (x, y, z) => Math.hypot(x - c[0], y - c[1], z - c[2]) - r, c: color, k, sub, b: [c[0], c[1], c[2], r] }
}

export function ell(c: V3, r: V3, color: V3 | Paint, k = 0, sub = false, rot?: V3): Part {
  const R = inv(rot)
  return {
    d: (x, y, z) => {
      let px = x - c[0]
      let py = y - c[1]
      let pz = z - c[2]
      if (R) {
        const a = R[0] * px + R[1] * py + R[2] * pz
        const b = R[3] * px + R[4] * py + R[5] * pz
        pz = R[6] * px + R[7] * py + R[8] * pz
        px = a
        py = b
      }
      const k0 = Math.hypot(px / r[0], py / r[1], pz / r[2])
      const k1 = Math.hypot(px / (r[0] * r[0]), py / (r[1] * r[1]), pz / (r[2] * r[2]))
      return k1 === 0 ? -Math.min(r[0], r[1], r[2]) : (k0 * (k0 - 1)) / k1
    },
    c: color,
    k,
    sub,
    b: [c[0], c[1], c[2], Math.max(r[0], r[1], r[2])],
  }
}

/** A capsule from a to b whose radius goes from ra to rb (a "round cone"). */
export function cone(a: V3, b: V3, ra: number, rb: number, color: V3 | Paint, k = 0, sub = false): Part {
  const bx = b[0] - a[0]
  const by = b[1] - a[1]
  const bz = b[2] - a[2]
  const l2 = bx * bx + by * by + bz * bz
  const rr = ra - rb
  const a2 = l2 - rr * rr
  const il2 = 1 / l2
  return {
    d: (x, y, z) => {
      // Inigo Quilez's exact round cone
      const px = x - a[0]
      const py = y - a[1]
      const pz = z - a[2]
      const yv = px * bx + py * by + pz * bz
      const zv = yv - l2
      const qx = px * l2 - bx * yv
      const qy = py * l2 - by * yv
      const qz = pz * l2 - bz * yv
      const x2 = qx * qx + qy * qy + qz * qz
      const y2 = yv * yv * l2
      const z2 = zv * zv * l2
      const k2 = Math.sign(rr) * rr * rr * x2
      if (Math.sign(zv) * a2 * z2 > k2) return Math.sqrt(x2 + z2) * il2 - rb
      if (Math.sign(yv) * a2 * y2 < k2) return Math.sqrt(x2 + y2) * il2 - ra
      return (Math.sqrt(x2 * a2 * il2) + yv * rr) * il2 - ra
    },
    c: color,
    k,
    sub,
    b: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2, Math.sqrt(l2) / 2 + Math.max(ra, rb)],
  }
}

/** A chain of round cones through points with radii: horns, combs, manes, fingers. */
export function chain(pts: V3[], radii: number[], color: V3 | Paint, k = 0, sub = false): Part[] {
  const out: Part[] = []
  for (let i = 0; i < pts.length - 1; i++) out.push(cone(pts[i], pts[i + 1], radii[i], radii[i + 1], color, k, sub))
  return out
}

export function box(c: V3, h: V3, round: number, color: V3 | Paint, k = 0, sub = false, rot?: V3): Part {
  const R = inv(rot)
  return {
    d: (x, y, z) => {
      let px = x - c[0]
      let py = y - c[1]
      let pz = z - c[2]
      if (R) {
        const a = R[0] * px + R[1] * py + R[2] * pz
        const b = R[3] * px + R[4] * py + R[5] * pz
        pz = R[6] * px + R[7] * py + R[8] * pz
        px = a
        py = b
      }
      const qx = Math.abs(px) - h[0] + round
      const qy = Math.abs(py) - h[1] + round
      const qz = Math.abs(pz) - h[2] + round
      return Math.hypot(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qy, qz), 0) - round
    },
    c: color,
    k,
    sub,
    b: [c[0], c[1], c[2], Math.hypot(h[0], h[1], h[2])],
  }
}

/** An elliptical ring (a torus squashed to an ellipse) lying in the plane its rotation gives (default: facing z). */
export function ring(c: V3, rx: number, ry: number, r: number, color: V3 | Paint, k = 0, sub = false, rot?: V3): Part {
  const R = inv(rot)
  const m = Math.min(rx, ry)
  return {
    d: (x, y, z) => {
      let px = x - c[0]
      let py = y - c[1]
      let pz = z - c[2]
      if (R) {
        const a = R[0] * px + R[1] * py + R[2] * pz
        const b = R[3] * px + R[4] * py + R[5] * pz
        pz = R[6] * px + R[7] * py + R[8] * pz
        px = a
        py = b
      }
      const e = (Math.hypot(px / rx, py / ry) - 1) * m
      return Math.hypot(e, pz) - r
    },
    c: color,
    k,
    sub,
    b: [c[0], c[1], c[2], Math.max(rx, ry) + r],
  }
}

/** Wraps a part so it only exists on one side of a plane (n·p > o), softly: for half shells, open hems. */
export function clip(p: Part, n: V3, o: number, k = 0.004): Part {
  const d = p.d
  return { ...p, d: (x, y, z) => smax(d(x, y, z), o - (n[0] * x + n[1] * y + n[2] * z), k) }
}

/** Mirrors parts across x = 0 (most of a face is two of everything). */
export const both = (make: (s: 1 | -1) => Part | Part[]): Part[] => [make(1), make(-1)].flat()

// ------------------------------------------------------------------------------------------------ field
function smin(a: number, b: number, k: number) {
  if (k <= 0) return Math.min(a, b)
  const h = Math.max(k - Math.abs(a - b), 0) / k
  return Math.min(a, b) - h * h * k * 0.25
}
function smax(a: number, b: number, k: number) {
  return -smin(-a, -b, k)
}

export function field(m: Model): Fn3 {
  const parts = m.parts
  const n = parts.length
  const disp = m.disp
  return (x, y, z) => {
    let d = 1e9
    for (let i = 0; i < n; i++) {
      const p = parts[i]
      const bd = Math.hypot(x - p.b[0], y - p.b[1], z - p.b[2]) - p.b[3]
      if (p.sub) {
        if (bd > p.k + 1e-4 || d > 0.05) continue // too far to carve here, or nothing here to carve
        d = smax(d, -p.d(x, y, z), p.k)
      } else {
        if (bd > d + p.k) continue // this part cannot come closer than what is already here
        d = smin(d, p.d(x, y, z), p.k)
      }
    }
    return disp ? d + disp(x, y, z) : d
  }
}

function colourAt(m: Model, x: number, y: number, z: number): V3 {
  let r = 0
  let g = 0
  let b = 0
  let wsum = 0
  for (const p of m.parts) {
    const bd = Math.hypot(x - p.b[0], y - p.b[1], z - p.b[2]) - p.b[3]
    if (bd > 0.02) continue
    const di = Math.abs(p.d(x, y, z))
    const w = Math.exp(-di / 0.0018) + 1e-12
    const c = typeof p.c === 'function' ? p.c(x, y, z) : p.c
    r += c[0] * w
    g += c[1] * w
    b += c[2] * w
    wsum += w
  }
  const c: V3 = wsum > 0 ? [r / wsum, g / wsum, b / wsum] : [0.5, 0.5, 0.5]
  return m.paint ? m.paint(x, y, z, c) : c
}

/** How shut in a point is: the field sampled a few steps out along the normal (crevices come out dark). */
function occlusion(f: Fn3, x: number, y: number, z: number, nx: number, ny: number, nz: number, k: number) {
  let occ = 0
  let w = 1
  for (let s = 1; s <= 4; s++) {
    const h = 0.004 * s
    occ += w * Math.max(0, h - f(x + nx * h, y + ny * h, z + nz * h))
    w *= 0.6
  }
  return Math.max(0.25, 1 - k * occ * 60)
}

// ------------------------------------------------------------------------------------------------ meshing
/** Meshes a model inside a box, at a given cell size, with surface nets. */
export function sculpt(m: Model, min: V3, max: V3, cell: number): THREE.BufferGeometry {
  const f = field(m)
  const nx = Math.ceil((max[0] - min[0]) / cell)
  const ny = Math.ceil((max[1] - min[1]) / cell)
  const nz = Math.ceil((max[2] - min[2]) / cell)
  const sx = nx + 1
  const sy = ny + 1
  const val = new Float32Array(sx * sy * (nz + 1))
  for (let k = 0; k <= nz; k++) {
    const z = min[2] + k * cell
    for (let j = 0; j <= ny; j++) {
      const y = min[1] + j * cell
      for (let i = 0; i <= nx; i++) val[i + sx * (j + sy * k)] = f(min[0] + i * cell, y, z)
    }
  }
  const at = (i: number, j: number, k: number) => val[i + sx * (j + sy * k)]
  const cellIdx = new Int32Array(nx * ny * nz).fill(-1)
  const pos: number[] = []
  const EDGES = [
    [0, 0, 0, 1, 0, 0], [0, 1, 0, 1, 1, 0], [0, 0, 1, 1, 0, 1], [0, 1, 1, 1, 1, 1],
    [0, 0, 0, 0, 1, 0], [1, 0, 0, 1, 1, 0], [0, 0, 1, 0, 1, 1], [1, 0, 1, 1, 1, 1],
    [0, 0, 0, 0, 0, 1], [1, 0, 0, 1, 0, 1], [0, 1, 0, 0, 1, 1], [1, 1, 0, 1, 1, 1],
  ]
  // one vertex per cell the surface crosses, at the mean of the edge crossings
  for (let k = 0; k < nz; k++) {
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        let vx = 0
        let vy = 0
        let vz = 0
        let cnt = 0
        for (const e of EDGES) {
          const a = at(i + e[0], j + e[1], k + e[2])
          const b = at(i + e[3], j + e[4], k + e[5])
          if (a < 0 === b < 0) continue
          const t = a / (a - b)
          vx += e[0] + (e[3] - e[0]) * t
          vy += e[1] + (e[4] - e[1]) * t
          vz += e[2] + (e[5] - e[2]) * t
          cnt++
        }
        if (!cnt) continue
        cellIdx[i + nx * (j + ny * k)] = pos.length / 3
        pos.push(min[0] + (i + vx / cnt) * cell, min[1] + (j + vy / cnt) * cell, min[2] + (k + vz / cnt) * cell)
      }
    }
  }
  const ci = (i: number, j: number, k: number) => cellIdx[i + nx * (j + ny * k)]
  const idx: number[] = []
  const quad = (a: number, b: number, c: number, d: number) => {
    if (a < 0 || b < 0 || c < 0 || d < 0) return
    idx.push(a, b, c, a, c, d)
  }
  // a quad across every grid edge the surface crosses, joining the four cells around it
  for (let k = 0; k < nz; k++) {
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const v0 = at(i, j, k) < 0
        if (j > 0 && k > 0 && v0 !== at(i + 1, j, k) < 0) quad(ci(i, j, k), ci(i, j - 1, k), ci(i, j - 1, k - 1), ci(i, j, k - 1))
        if (i > 0 && k > 0 && v0 !== at(i, j + 1, k) < 0) quad(ci(i, j, k), ci(i - 1, j, k), ci(i - 1, j, k - 1), ci(i, j, k - 1))
        if (i > 0 && j > 0 && v0 !== at(i, j, k + 1) < 0) quad(ci(i, j, k), ci(i - 1, j, k), ci(i - 1, j - 1, k), ci(i, j - 1, k))
      }
    }
  }
  // normals from the field, colour from the parts, crevices darkened
  const nv = pos.length / 3
  const nor = new Float32Array(nv * 3)
  const colr = new Float32Array(nv * 3)
  const e = cell * 0.5
  const aoK = m.ao ?? 1
  for (let v = 0; v < nv; v++) {
    const x = pos[v * 3]
    const y = pos[v * 3 + 1]
    const z = pos[v * 3 + 2]
    let gx = f(x + e, y, z) - f(x - e, y, z)
    let gy = f(x, y + e, z) - f(x, y - e, z)
    let gz = f(x, y, z + e) - f(x, y, z - e)
    const gl = Math.hypot(gx, gy, gz) || 1
    gx /= gl
    gy /= gl
    gz /= gl
    nor.set([gx, gy, gz], v * 3)
    const ao = occlusion(f, x, y, z, gx, gy, gz, aoK)
    const c = colourAt(m, x, y, z)
    colr.set([c[0] * ao, c[1] * ao, c[2] * ao], v * 3)
  }
  // wind every triangle the way its normals face
  for (let t = 0; t < idx.length; t += 3) {
    const a = idx[t] * 3
    const b = idx[t + 1] * 3
    const c = idx[t + 2] * 3
    const ux = pos[b] - pos[a]
    const uy = pos[b + 1] - pos[a + 1]
    const uz = pos[b + 2] - pos[a + 2]
    const wx = pos[c] - pos[a]
    const wy = pos[c + 1] - pos[a + 1]
    const wz = pos[c + 2] - pos[a + 2]
    const cx = uy * wz - uz * wy
    const cy = uz * wx - ux * wz
    const cz = ux * wy - uy * wx
    const nx2 = nor[a] + nor[b] + nor[c]
    const ny2 = nor[a + 1] + nor[b + 1] + nor[c + 1]
    const nz2 = nor[a + 2] + nor[b + 2] + nor[c + 2]
    if (cx * nx2 + cy * ny2 + cz * nz2 < 0) {
      const tmp = idx[t + 1]
      idx[t + 1] = idx[t + 2]
      idx[t + 2] = tmp
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3))
  g.setAttribute('color', new THREE.BufferAttribute(colr, 3))
  g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(nv * 2), 2)) // the PS1 pass reads one; there is no texture
  g.setIndex(idx)
  return g
}

// ------------------------------------------------------------------------------------------------ blend shapes
/**
 * A blend shape: the rest mesh's own vertices carried onto another sculpt (the same face making a gesture), each one
 * walked down the field to the new surface. Same vertices, same triangles, so the game can mix rest and gesture by
 * any amount. Position, normal and colour (a painted lip moves with the lip).
 */
export function morphTarget(rest: THREE.BufferGeometry, pose: Model) {
  const f = field(pose)
  const src = rest.getAttribute('position')
  const n = src.count
  const pos = new Float32Array(n * 3)
  const nor = new Float32Array(n * 3)
  const colr = new Float32Array(n * 3)
  const e = 0.0008
  const grad = (x: number, y: number, z: number): V3 => [f(x + e, y, z) - f(x - e, y, z), f(x, y + e, z) - f(x, y - e, z), f(x, y, z + e) - f(x, y, z - e)]
  const aoK = pose.ao ?? 1
  for (let v = 0; v < n; v++) {
    let x = src.getX(v)
    let y = src.getY(v)
    let z = src.getZ(v)
    for (let it = 0; it < 8; it++) {
      const d = f(x, y, z)
      if (Math.abs(d) < 1e-5) break
      const g = grad(x, y, z)
      const gl = Math.hypot(g[0], g[1], g[2]) || 1
      const step = Math.max(-0.012, Math.min(0.012, d))
      x -= (g[0] / gl) * step
      y -= (g[1] / gl) * step
      z -= (g[2] / gl) * step
    }
    const g = grad(x, y, z)
    const gl = Math.hypot(g[0], g[1], g[2]) || 1
    const nx = g[0] / gl
    const ny = g[1] / gl
    const nz = g[2] / gl
    pos.set([x, y, z], v * 3)
    nor.set([nx, ny, nz], v * 3)
    const ao = occlusion(f, x, y, z, nx, ny, nz, aoK)
    const c = colourAt(pose, x, y, z)
    colr.set([c[0] * ao, c[1] * ao, c[2] * ao], v * 3)
  }
  return { position: new THREE.BufferAttribute(pos, 3), normal: new THREE.BufferAttribute(nor, 3), color: new THREE.BufferAttribute(colr, 3) }
}

/** Gives a rest mesh its gestures, in order: mesh.morphTargetInfluences[i] then mixes gesture i in. */
export function withGestures(rest: THREE.BufferGeometry, poses: Model[]) {
  const t = poses.map((p) => morphTarget(rest, p))
  rest.morphAttributes.position = t.map((x) => x.position)
  rest.morphAttributes.normal = t.map((x) => x.normal)
  rest.morphAttributes.color = t.map((x) => x.color)
  return rest
}

// ------------------------------------------------------------------------------------------------ a little noise
/** Cheap smooth value noise in 3D, for lumps, grime and wrinkles. */
export function noise3(x: number, y: number, z: number) {
  const xi = Math.floor(x)
  const yi = Math.floor(y)
  const zi = Math.floor(z)
  const xf = x - xi
  const yf = y - yi
  const zf = z - zi
  const s = (t: number) => t * t * (3 - 2 * t)
  const h = (i: number, j: number, k: number) => {
    let n = (i * 374761393 + j * 668265263 + k * 2147483647) | 0
    n = Math.imul(n ^ (n >>> 13), 1274126177)
    return ((n ^ (n >>> 16)) & 0xffff) / 0xffff
  }
  const u = s(xf)
  const v = s(yf)
  const w = s(zf)
  const l = (a: number, b: number, t: number) => a + (b - a) * t
  return (
    l(
      l(l(h(xi, yi, zi), h(xi + 1, yi, zi), u), l(h(xi, yi + 1, zi), h(xi + 1, yi + 1, zi), u), v),
      l(l(h(xi, yi, zi + 1), h(xi + 1, yi, zi + 1), u), l(h(xi, yi + 1, zi + 1), h(xi + 1, yi + 1, zi + 1), u), v),
      w,
    ) *
      2 -
    1
  )
}
