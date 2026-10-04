/**
 * Table geometry shared by the client (3D table) and the server (who sees whose señas). Metres;
 * seat i sits at angle seatAngle(i, n) on the ground plane (x, z), facing the centre. A gaze is a
 * head turn from the seat: yaw (+ = to the left) and pitch (+ = up), as the look stream sends it.
 */
export interface Vec3 {
  x: number;
  y: number;
  z: number;
}
export interface Gaze {
  yaw: number;
  pitch: number;
}

export const TABLE_RADIUS = 0.9;
export const CHAIR_RADIUS = TABLE_RADIUS + 0.45;
export const EYE_RADIUS = TABLE_RADIUS + 0.36;
export const EYE_HEIGHT = 1.34;
export const HEAD_RADIUS = CHAIR_RADIUS - 0.04; // the mask sits slightly in front of the chair
export const HEAD_HEIGHT = 1.3;
/**
 * A seat's zone is the stretch from the head down to the player's place on the table. To read a
 * face the centre of the viewer's view only has to pass within this distance of that stretch (m):
 * pointing at where someone is sitting is enough, not at the exact face.
 */
export const SEAT_AIM_RADIUS = 0.34;
/** Where the zone ends on the table: the player's own place, a little in from the edge. */
export const SEAT_SPOT_RADIUS = TABLE_RADIUS - 0.28;
export const SEAT_SPOT_HEIGHT = 0.8;
/**
 * A face shows unless it is practically turned away: the angle between where it faces and the
 * viewer must stay under ~114° (cos = -0.4). Profiles and ¾ views still show the seña.
 */
export const FACE_BACK_DOT = -0.4;

export const seatAngle = (i: number, n: number) => Math.PI / 2 + (i / n) * Math.PI * 2;

const polar = (r: number, a: number, y: number): Vec3 => ({ x: Math.cos(a) * r, y, z: Math.sin(a) * r });
export const eyePosition = (seat: number, n: number) => polar(EYE_RADIUS, seatAngle(seat, n), EYE_HEIGHT);
export const headPosition = (seat: number, n: number) => polar(HEAD_RADIUS, seatAngle(seat, n), HEAD_HEIGHT);
/** A player's place on the table (the lower end of their zone). */
export const seatSpot = (seat: number, n: number) => polar(SEAT_SPOT_RADIUS, seatAngle(seat, n), SEAT_SPOT_HEIGHT);

/** World direction of a gaze from a seat (unit vector). */
export function gazeDirection(seat: number, n: number, g: Gaze): Vec3 {
  const yaw = Math.PI / 2 - seatAngle(seat, n) + g.yaw; // seat's own facing + the head turn
  const c = Math.cos(g.pitch);
  return { x: -Math.sin(yaw) * c, y: Math.sin(g.pitch), z: -Math.cos(yaw) * c };
}

/** The gaze from `from` that looks straight at `to`'s face. */
export function gazeToward(from: number, to: number, n: number): Gaze {
  const e = eyePosition(from, n);
  const h = headPosition(to, n);
  const d = { x: h.x - e.x, y: h.y - e.y, z: h.z - e.z };
  let yaw = Math.atan2(-d.x, -d.z) - (Math.PI / 2 - seatAngle(from, n));
  yaw = Math.atan2(Math.sin(yaw), Math.cos(yaw));
  return { yaw, pitch: Math.atan2(d.y, Math.hypot(d.x, d.z)) };
}

const sub = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z;
const len = (a: Vec3) => Math.sqrt(dot(a, a));

/**
 * How far the straight line of sight (from `origin` along `dir`, a unit vector) passes from a seat's
 * zone, and how far along it that happens; `along` <= 0 means the seat is behind the viewer. The zone
 * is the segment from the head to the player's place on the table.
 */
export function aimAtSeat(origin: Vec3, dir: Vec3, seat: number, n: number): { miss: number; along: number } {
  const a = headPosition(seat, n);
  const b = seatSpot(seat, n);
  const ab = sub(b, a);
  // the closest approach of the ray to the segment: minimise |a + t·ab − (origin + s·dir)| over t∈[0,1], s≥0
  const w = sub(a, origin);
  const abab = dot(ab, ab);
  const abd = dot(ab, dir);
  const abw = dot(ab, w);
  const dw = dot(dir, w);
  const den = abab - abd * abd; // dir is unit
  let t = den > 1e-9 ? (abd * dw - abw) / den : 0;
  t = Math.min(1, Math.max(0, t));
  const point = { x: a.x + ab.x * t, y: a.y + ab.y * t, z: a.z + ab.z * t };
  const to = sub(point, origin);
  const along = dot(to, dir);
  const off = sub(to, { x: dir.x * along, y: dir.y * along, z: dir.z * along });
  return { miss: len(off), along };
}

/**
 * The seat the line of sight is on: the one whose zone it passes most squarely (nearest to its stretch),
 * within SEAT_AIM_RADIUS, ahead of the viewer. Only one seat at a time, so aiming between two
 * neighbours reads whichever you are closest to and never both. -1 = none.
 */
export function seatUnderAim(origin: Vec3, dir: Vec3, n: number, skip: number): number {
  let best = -1;
  let bestMiss = Infinity;
  for (let s = 0; s < n; s++) {
    if (s === skip) continue;
    const { miss, along } = aimAtSeat(origin, dir, s, n);
    if (along > 0 && miss < SEAT_AIM_RADIUS && miss < bestMiss) {
      best = s;
      bestMiss = miss;
    }
  }
  return best;
}

/**
 * Does the viewer read the signer's face? The centre of the viewer's view is on the signer's zone
 * (where they sit; see seatUnderAim), and the signer is not practically turned away from the viewer.
 */
export function seesFace(viewer: number, viewerGaze: Gaze, signer: number, signerGaze: Gaze, n: number): boolean {
  const eye = eyePosition(viewer, n);
  if (seatUnderAim(eye, gazeDirection(viewer, n, viewerGaze), n, viewer) !== signer) return false;
  const head = headPosition(signer, n);
  const face = gazeDirection(signer, n, signerGaze);
  const toViewer = sub(eye, head);
  return dot(face, toViewer) / len(toViewer) > FACE_BACK_DOT;
}
