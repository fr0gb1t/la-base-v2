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
/** How close to a head the centre of someone's view must pass to read the face (m). */
export const FACE_AIM_RADIUS = 0.14;
/**
 * A face shows unless it is practically turned away: the angle between where it faces and the
 * viewer must stay under ~114° (cos = -0.4). Profiles and ¾ views still show the seña.
 */
export const FACE_BACK_DOT = -0.4;

export const seatAngle = (i: number, n: number) => Math.PI / 2 + (i / n) * Math.PI * 2;

const polar = (r: number, a: number, y: number): Vec3 => ({ x: Math.cos(a) * r, y, z: Math.sin(a) * r });
export const eyePosition = (seat: number, n: number) => polar(EYE_RADIUS, seatAngle(seat, n), EYE_HEIGHT);
export const headPosition = (seat: number, n: number) => polar(HEAD_RADIUS, seatAngle(seat, n), HEAD_HEIGHT);

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
 * Does the viewer read the signer's face? The centre of the viewer's view passes over the
 * signer's head, and the signer is not practically turned away from the viewer.
 */
export function seesFace(viewer: number, viewerGaze: Gaze, signer: number, signerGaze: Gaze, n: number): boolean {
  const eye = eyePosition(viewer, n);
  const head = headPosition(signer, n);
  const toHead = sub(head, eye);
  const dir = gazeDirection(viewer, n, viewerGaze);
  const along = dot(toHead, dir);
  if (along <= 0) return false;
  const miss = len(sub(toHead, { x: dir.x * along, y: dir.y * along, z: dir.z * along }));
  if (miss > FACE_AIM_RADIUS) return false;
  const face = gazeDirection(signer, n, signerGaze);
  const toViewer = sub(eye, head);
  return dot(face, toViewer) / len(toViewer) > FACE_BACK_DOT;
}
