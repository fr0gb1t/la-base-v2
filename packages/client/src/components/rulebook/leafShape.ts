// The shape of a page being turned. A leaf is bound at the spine (x = 0) and turns over it:
// `angle` 0 = lying flat on the right stack, π = flat on the left one. Each row of the leaf
// (top to bottom) is a curve integrated along its length from the spine, so the paper never
// stretches. Where it is held changes how it bends:
//   - by a corner: the curl concentrates there; the rest of the page lags behind, flatter;
//   - by the outer edge: the whole page turns, arching up from the binding;
//   - by the middle: the part beyond the hand hangs under its own weight.
// Turning fast makes the free edge trail behind (air). Nothing goes through the stacks.

export const SEG_U = 40; // segments from the spine to the outer edge
export const SEG_V = 24; // segments from the top to the bottom

export interface LeafShape {
  angle: number; // the turn at the held row
  omega: number; // how fast it turns (rad/s), for the air drag
  grabU: number; // where it is held: 0 spine → 1 outer edge
  grabV: number; // 0 top → 1 bottom
  rigid: boolean; // the cover board doesn't bend
}

export interface LeafFrame {
  w: number; // page width (spine to edge)
  h: number; // page height
  rightTop: number; // height of each stack's top page
  leftTop: number;
}

const GUTTER_W = 0.16; // how far from the spine the pages dip into the binding (× w)
const GUTTER_D = 0.018; // how deep (× w)
const GRAVITY = 90; // how floppy the paper is
const AIR = 0.07; // seconds of lag of the free edge per rad/s
const LIFT = 0.0025; // the leaf floats this much over the page under it

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** How far a page surface sinks toward the binding at `x` from the spine (a thin stack, less). */
export function gutter(x: number, w: number, stack = Infinity): number {
  const t = Math.max(0, 1 - Math.abs(x) / (GUTTER_W * w));
  return Math.min(GUTTER_D * w, stack * 0.85) * t * t;
}

/** How the bend is distributed for a grab point. */
function profile(s: LeafShape) {
  const u = Math.max(0.3, s.grabU);
  const edge = Math.min(s.grabV, 1 - s.grabV);
  const corner = smooth(0.6, 0.95, s.grabU) * (1 - smooth(0.12, 0.38, edge));
  return {
    u,
    corner,
    // (both lags ≤ 1: the lagging part never dips below flat, as sin a ≤ a)
    spineLag: 0.45 + 0.45 * corner, // the binding end stays behind…
    ramp: (0.22 + 0.5 * corner) * u, // …and catches up over this length (× w)
    rowLag: Math.min(0.9, 0.15 + 0.55 * corner + 0.2 * (1 - u)), // rows far from the hand stay behind
    sigma: 0.7 - 0.25 * corner, // reach of the hand along the height (× h)
    bow: 0.22 * (1 - corner), // held from the middle, the part up to the hand hangs a little too
  };
}

/**
 * Writes one row of the leaf (SEG_U + 1 points, x/y in the turning plane) into `out`
 * at `offset` (stride 3, z left alone). Returns the row's turn angle.
 */
function row(s: LeafShape, f: LeafFrame, v: number, out: Float32Array, offset: number, p = profile(s)): void {
  const { w } = f;
  const turnT = s.angle / Math.PI;
  const baseY = f.rightTop + (f.leftTop - f.rightTop) * turnT + LIFT;
  const ds = w / SEG_U;
  const free = s.rigid ? 0 : 1;
  const g = Math.exp(-(((v - s.grabV) / p.sigma) ** 2));
  const a = Math.max(0, Math.min(Math.PI, s.angle - free * p.rowLag * (1 - g) * Math.sin(s.angle)));
  const lift = Math.sin(a);
  const air = free * Math.max(-0.7, Math.min(0.7, AIR * s.omega));
  const grabS = p.u * w;
  let x = 0;
  let y = baseY;
  let sag = 0; // the angle the hanging part has fallen
  for (let i = 0; i <= SEG_U; i++) {
    const k = offset + i * 3;
    // sit on the page below where it lies flat, and dip into the binding like it
    const flat = Math.cos(a) ** 2;
    const top = x >= 0 ? f.rightTop : f.leftTop;
    const dip = gutter(x, w, top);
    out[k] = x;
    out[k + 1] = Math.max(y - dip * flat, top - dip + LIFT);
    if (i === SEG_U) break;
    const sm = (i + 0.5) * ds;
    let th = a - free * p.spineLag * lift * (1 - smooth(0, p.ramp * w, sm));
    th -= air * (sm / w) ** 1.5;
    // between the binding and the hand: flatter first, steeper toward the hand (a slack sheet)
    if (free && sm < grabS) th -= p.bow * lift * Math.cos(th) * Math.cos((Math.PI * sm) / grabS);
    if (free && sm > grabS) {
      // beyond the hand the paper hangs: the bend grows with the weight still to hold
      const rest = (w - sm) / w;
      sag += -GRAVITY * 0.5 * rest * rest * Math.cos(th + sag) * (ds / w) * lift;
      th += sag;
    }
    x += Math.cos(th) * ds;
    y += Math.sin(th) * ds;
  }
}

/** Positions of the whole leaf: (SEG_V + 1) rows × (SEG_U + 1) points, xyz, top row first. */
export function shapeLeaf(s: LeafShape, f: LeafFrame, out: Float32Array): Float32Array {
  const p = profile(s);
  for (let j = 0; j <= SEG_V; j++) {
    const v = j / SEG_V;
    const offset = j * (SEG_U + 1) * 3;
    row(s, f, v, out, offset, p);
    const z = (v - 0.5) * f.h;
    for (let i = 0; i <= SEG_U; i++) out[offset + i * 3 + 2] = z;
  }
  return out;
}

const probe = new Float32Array((SEG_U + 1) * 3);

/** Where (x) the held point is for a given turn. */
function heldX(s: LeafShape, f: LeafFrame): number {
  row(s, f, s.grabV, probe, 0);
  const i = Math.round(Math.max(0.3, s.grabU) * SEG_U);
  return probe[i * 3];
}

/** The turn that puts the held point right under the pointer (at `x` from the spine). */
export function angleFor(x: number, s: LeafShape, f: LeafFrame): number {
  let lo = 0;
  let hi = Math.PI;
  const at = (angle: number) => heldX({ ...s, angle }, f);
  if (x >= at(lo)) return lo;
  if (x <= at(hi)) return hi;
  for (let k = 0; k < 18; k++) {
    const mid = (lo + hi) / 2;
    if (at(mid) > x) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}
