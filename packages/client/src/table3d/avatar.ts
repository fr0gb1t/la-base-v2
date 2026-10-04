import * as THREE from 'three'
import { PALETTE, hex } from './look'
import { CHAIR_R, LEAN_REACH, SHOULDER_R, SHOULDER_Y, TABLE_R, TABLE_Y, seatAngle, teamOf, polar, type PlayerCount } from './seats'
import { makeCard, type CardView } from './cards'
import { toProps } from './propsLayer'
import { randomAvatar, type AvatarSpec, type Sena } from '@la-base/shared'
import { EYE_COLOR_LOOK, HAIR_COLOR_LOOK } from './avatarLook'

// Placeholder anatomy for the demo (boxes/cylinders read fine at 360p under heavy post).
// Production avatars: use the `modeling-3d-human-characters` skill for real arms and hands.
export const MAX_HAND = 6
export const FAN_Y = 1.06 // height of the held fan: above the name tag at the belly
const UPPER = 0.32
const FORE = 0.3
const Y_AXIS = new THREE.Vector3(0, 1, 0)

export type { Sena }

/** Drawing priority of the hands: above every card lying on the table (see CARD_ORDER in TableScene). */
export const HAND_ORDER = 5000

const mat = (c: string, rough = 0.8) => new THREE.MeshStandardMaterial({ color: hex(c), roughness: rough })

function segment(mesh: THREE.Mesh, a: THREE.Vector3, b: THREE.Vector3) {
  const d = b.clone().sub(a)
  mesh.position.copy(a).addScaledVector(d, 0.5)
  mesh.quaternion.setFromUnitVectors(Y_AXIS, d.normalize())
}

// Analytic two-bone IK: elbow bends toward `pole`.
function solveElbow(s: THREE.Vector3, t: THREE.Vector3, pole: THREE.Vector3) {
  const toT = t.clone().sub(s)
  const d = THREE.MathUtils.clamp(toT.length(), 0.05, UPPER + FORE - 1e-3)
  const dir = toT.normalize()
  const a = (UPPER * UPPER + d * d - FORE * FORE) / (2 * d)
  const h = Math.sqrt(Math.max(UPPER * UPPER - a * a, 0))
  const p = pole.clone().sub(s)
  const bend = p.sub(dir.clone().multiplyScalar(p.dot(dir))).normalize()
  return { elbow: s.clone().addScaledVector(dir, a).addScaledVector(bend, h), wrist: s.clone().addScaledVector(dir, d) }
}

// `sx` is the arm's side (+1 right, −1 left): the thumb always points inward, toward the body's midline.
function glove(cuff: string, sx: number) {
  const g = new THREE.Group()
  const bone = mat(PALETTE.bone, 0.7)
  const palm = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.025, 0.08), bone)
  palm.position.z = 0.04
  const fingers = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.018, 0.07), bone)
  fingers.position.set(0, -0.006, 0.11)
  fingers.rotation.x = 0.35
  const thumb = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 0.05), bone)
  thumb.position.set(sx * 0.045, -0.005, 0.05) // the glove's +x is the avatar's −x (it looks along −z)
  thumb.rotation.y = sx * 0.5 // the tip splays away from the palm (turned over on itself: a right thumb, not a left one)
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.03, 10), mat(cuff))
  band.rotation.x = Math.PI / 2
  g.add(palm, fingers, thumb, band)
  g.traverse((o) => {
    o.castShadow = true
    // the hand has the highest drawing priority: it is drawn after everything lying on the table (the
    // cards, in the order they were laid), so it always shows over them, never through them
    if (o instanceof THREE.Mesh) {
      o.renderOrder = HAND_ORDER
      ;(o.material as THREE.Material).transparent = true
    }
  })
  return toProps(g) as THREE.Group
}

// ---- the face, put together from the avatar's four parts (see @la-base/shared avatar.ts) ----------------

/** What a face looks like when nobody has chosen one: derived from the seat, so it is always the same one. */
export function fallbackAvatar(seed: number): AvatarSpec {
  let x = (seed + 1) * 2654435761
  const rng = () => ((x = (x * 1664525 + 1013904223) >>> 0) / 4294967296)
  return randomAvatar(rng)
}

const shade = (c: string, k: number) => '#' + new THREE.Color(hex(c)).multiplyScalar(k).getHexString()

// Eyes: the dark hole, a coloured iris and a pupil on top of it, a lid that closes from above. `lid*`
// is the size of the lid (it must cover the whole eye); `tilt` turns the outer corner (± per side).
const EYES = [
  { w: 1, h: 1, r: 0.022, iris: 0.014, pupil: 0.0065, lidW: 0.05, lidH: 0.05, tilt: 0 }, // redondos
  { w: 1.55, h: 0.5, r: 0.022, iris: 0.0085, pupil: 0.0045, lidW: 0.078, lidH: 0.036, tilt: 0 }, // rasgados
  { w: 1, h: 1, r: 0.031, iris: 0.021, pupil: 0.0095, lidW: 0.07, lidH: 0.07, tilt: 0 }, // grandes
  { w: 1.25, h: 0.85, r: 0.022, iris: 0.012, pupil: 0.0055, lidW: 0.062, lidH: 0.046, tilt: 0.3 }, // caídos
  { w: 1, h: 1, r: 0.013, iris: 0.0095, pupil: 0.0045, lidW: 0.036, lidH: 0.036, tilt: 0 }, // puntitos
]

// Brows: size, resting height and tilt (inner end down is positive; mirrored on the other side).
const BROWS = [
  { w: 0.05, h: 0.006, y: 0.073, tilt: 0 }, // finas
  { w: 0.058, h: 0.02, y: 0.071, tilt: 0 }, // gruesas
  { w: 0.055, h: 0.011, y: 0.068, tilt: 0.38 }, // bravas
  { w: 0.05, h: 0.008, y: 0.082, tilt: -0.22 }, // arqueadas
  { w: 0.03, h: 0.012, y: 0.069, tilt: 0 }, // cortitas
]

// Mouths: `curve` bends a strip into a smile (+) or a frown (−); 0 is a flat oval. `x` and `y` are the
// resting size, and every seña below scales from that.
const MOUTHS = [
  { x: 0.035, y: 0.007, curve: 0 }, // línea
  { x: 0.034, y: 0.034, curve: 0.34 }, // sonrisa
  { x: 0.034, y: 0.034, curve: -0.34 }, // seria
  { x: 0.052, y: 0.008, curve: 0 }, // ancha
  { x: 0.017, y: 0.011, curve: 0 }, // chiquita
]

/** A unit-wide strip (x from −1 to 1) bent into an arc: the shape of a smile or a frown. */
function arc(curve: number) {
  const shape = new THREE.Shape()
  const th = 0.17
  const N = 14
  const y = (x: number) => curve * (x * x - 0.5)
  shape.moveTo(-1, y(-1) + th / 2)
  for (let i = 1; i <= N; i++) { const x = -1 + (2 * i) / N; shape.lineTo(x, y(x) + th / 2) }
  for (let i = N; i >= 0; i--) { const x = -1 + (2 * i) / N; shape.lineTo(x, y(x) - th / 2) }
  return new THREE.ShapeGeometry(shape)
}

/** Hair on the head, in the avatar's colour: where it grows and how much of the skull it covers. */
function hairOf(kind: number, color: string) {
  const m = new THREE.MeshStandardMaterial({ color: hex(color), roughness: 0.95 })
  const g = new THREE.Group()
  const cap = (r: number, open: number, tilt: number, y = 0.015) => {
    const c = new THREE.Mesh(new THREE.SphereGeometry(r, 20, 12, 0, Math.PI * 2, 0, open), m)
    c.position.set(0, y, 0.03)
    c.scale.y = 1.12 // like the hood under it
    c.rotation.x = tilt // tipped back: the forehead stays clear
    return c
  }
  const ball = (r: number, x: number, y: number, z: number, sx = 1, sy = 1, sz = 1) => {
    const b = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 10), m)
    b.position.set(x, y, z)
    b.scale.set(sx, sy, sz)
    return b
  }
  const lock = (x: number, y: number, z: number, len: number, r = 0.03) => {
    const c = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 4, 10), m)
    c.position.set(x, y, z)
    return c
  }
  if (kind === 0) g.add(cap(0.166, 1.08, 0.18)) // corto: a close cap over the forehead
  if (kind === 1) {
    // largo: the cap, a soft mass behind the head and a lock hanging down each side
    g.add(cap(0.168, 1.12, 0.2), ball(0.15, 0, -0.08, 0.15, 1.05, 1.7, 0.55), lock(-0.142, -0.04, 0.05, 0.2), lock(0.142, -0.04, 0.05, 0.2))
  }
  if (kind === 2) {
    // cresta: a fan of spikes from ear to ear over the top
    for (const x of [-0.1, -0.05, 0, 0.05, 0.1]) {
      const sp = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.1 - Math.abs(x) * 0.25, 6), m)
      sp.position.set(x * 1.05, 0.165 + (0.022 - Math.abs(x) * 0.18), 0.03)
      sp.rotation.z = -x * 3
      g.add(sp)
    }
    g.add(cap(0.16, 0.7, 0.1)) // a little stubble under them
  }
  if (kind === 3) {
    // rulos: a cloud of curls over the top and sides
    for (const [x, y, z, r] of [[0, 0.17, 0.02, 0.06], [-0.085, 0.14, 0.0, 0.055], [0.085, 0.14, 0.0, 0.055], [-0.125, 0.07, 0.05, 0.05], [0.125, 0.07, 0.05, 0.05], [-0.06, 0.15, 0.1, 0.055], [0.06, 0.15, 0.1, 0.055], [0, 0.09, 0.16, 0.06]]) g.add(ball(r, x, y, z))
  }
  if (kind === 4) {
    // rodete: a smooth cap and a bun on top
    g.add(cap(0.166, 1.04, 0.2), ball(0.058, 0, 0.215, 0.07))
  }
  g.traverse((o) => (o.castShadow = true))
  return g
}

// Puppet mask: a Buckshot-style mask that is ARTICULATED so the truco señas still read. Its face is the
// avatar's: eyes, mouth, brows and hair, with the colours of the eyes and the hair.
export function makeMask(avatar: AvatarSpec) {
  const head = new THREE.Group()
  const hood = new THREE.Mesh(new THREE.SphereGeometry(0.15, 16, 12), mat(PALETTE.soot, 1))
  hood.scale.set(1, 1.15, 1)
  hood.position.z = 0.03
  const face = new THREE.Mesh(new THREE.SphereGeometry(0.125, 20, 14, 0, Math.PI * 2, 0, Math.PI / 2), mat(PALETTE.bone, 0.55))
  face.rotation.x = -Math.PI / 2
  face.scale.set(1, 0.55, 1.3)
  face.position.z = -0.06
  const ink = new THREE.MeshBasicMaterial({ color: hex(PALETTE.ink) })
  const eyeLook = EYES[avatar.eyes]
  const irisMat = new THREE.MeshBasicMaterial({ color: hex(EYE_COLOR_LOOK[avatar.eyeColor].hex) })
  const browLook = BROWS[avatar.brows]
  const browMat = new THREE.MeshBasicMaterial({ color: hex(shade(HAIR_COLOR_LOOK[avatar.hairColor].hex, 0.85)) })
  const eyes = [-1, 1].map((sx) => {
    const flat = (r: number, z: number, m: THREE.Material, w = 1, h = 1) => {
      const d = new THREE.Mesh(new THREE.CircleGeometry(r, 16), m)
      d.position.set(sx * 0.045, 0.03, z)
      d.rotation.set(0, Math.PI, -sx * eyeLook.tilt)
      d.scale.set(w, h, 1)
      return d
    }
    const hole = flat(eyeLook.r, -0.132, ink, eyeLook.w, eyeLook.h)
    const iris = flat(eyeLook.iris, -0.1335, irisMat)
    const pupil = flat(eyeLook.pupil, -0.1342, ink)
    const lid = new THREE.Mesh(new THREE.PlaneGeometry(eyeLook.lidW, eyeLook.lidH), mat(PALETTE.bone, 0.55))
    lid.geometry.translate(0, -eyeLook.lidH / 2, 0) // hinge at the top edge
    lid.position.set(sx * 0.045, 0.03 + eyeLook.lidH / 2, -0.135)
    lid.rotation.y = Math.PI
    lid.scale.y = 0.01
    const brow = new THREE.Mesh(new THREE.BoxGeometry(browLook.w, browLook.h, 0.012), browMat)
    brow.position.set(sx * 0.045, browLook.y, -0.132)
    brow.rotation.z = sx * browLook.tilt
    head.add(hole, iris, pupil, lid, brow)
    return { lid, brow, sx }
  })
  // mouth: a shape scaled into a line (rest), an O (kiss), an open oval (fish)...
  const MOUTH = MOUTHS[avatar.mouth]
  const mouth = new THREE.Mesh(MOUTH.curve === 0 ? new THREE.CircleGeometry(1, 20) : arc(MOUTH.curve), ink)
  mouth.position.set(0, -0.05, -0.134)
  mouth.rotation.y = Math.PI
  mouth.scale.set(MOUTH.x, MOUTH.y, 1)
  // puckered lips (kiss) and two front teeth over the lower lip (bite): hidden at rest
  const lips = new THREE.Mesh(new THREE.RingGeometry(0.011, 0.019, 20), mat(PALETTE.rose, 0.6))
  lips.position.set(0, -0.05, -0.137)
  lips.rotation.y = Math.PI
  const teeth = new THREE.Group()
  for (const sx of [-1, 1]) {
    const t = new THREE.Mesh(new THREE.PlaneGeometry(0.015, 0.014), new THREE.MeshBasicMaterial({ color: 0xf6efe0 }))
    t.position.set(sx * 0.0075, 0, 0)
    t.rotation.y = Math.PI
    teeth.add(t)
  }
  teeth.position.set(0, -0.053, -0.136)
  const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.035, 0.05), mat(PALETTE.bone, 0.55))
  jaw.position.set(0, -0.085, -0.1)
  jaw.visible = false // it poked out under the mouth at rest like a little tooth: only the 'porno' seña drops it
  head.add(hood, face, mouth, lips, teeth, jaw, hairOf(avatar.hair, HAIR_COLOR_LOOK[avatar.hairColor].hex))
  head.traverse((o) => (o.castShadow = true))

  // Each seña is a pose of lids / brows / mouth / jaw, seen from the signer: "right" is the
  // mask's own right (+x, it faces -z). amount 0..1 lets it flash and relax.
  function sena(s: Sena | null, amount: number) {
    const k = s ? amount : 0
    eyes.forEach((e) => {
      e.lid.scale.y = 0.01
      e.brow.position.y = browLook.y
      e.brow.rotation.z = e.sx * browLook.tilt
    })
    mouth.position.set(0, -0.05, -0.134)
    mouth.rotation.z = 0
    mouth.scale.set(MOUTH.x, MOUTH.y, 1)
    lips.visible = teeth.visible = false
    jaw.position.y = -0.085
    jaw.visible = false
    if (s === 'ancho-espada') eyes.forEach((e) => (e.brow.position.y = browLook.y + 0.034 * k))
    if (s === 'ancho-basto') {
      eyes[1].lid.scale.y = Math.max(0.01, k)
      eyes[1].brow.position.y = browLook.y - 0.008 * k
      eyes[1].brow.rotation.z = eyes[1].sx * browLook.tilt + 0.25 * k
    }
    if (s === 'ancho-copa' || s === 'ancho-oro') {
      const side = s === 'ancho-copa' ? 1 : -1
      mouth.position.x = side * 0.028 * k
      mouth.rotation.z = side * 0.18 * k // a crooked smirk toward that side
      mouth.scale.x = MOUTH.x * (1 - 0.25 * k)
    }
    if (s === 'figuras') {
      // the mouth stretched to both sides at once: a long, tight line
      mouth.scale.set(MOUTH.x * (1 + 0.75 * k), MOUTH.y * (1 - 0.45 * k), 1)
      jaw.position.y = -0.085 + 0.004 * k
    }
    if (s === 'tres') {
      mouth.position.y = -0.05 - 0.004 * k
      mouth.scale.y = MOUTH.y * (1 - 0.5 * k)
      teeth.visible = k > 0.15
      teeth.scale.y = k
    }
    if (s === 'dos') {
      mouth.scale.set(THREE.MathUtils.lerp(MOUTH.x, 0.011, k), THREE.MathUtils.lerp(MOUTH.y, 0.011, k), 1)
      lips.visible = k > 0.15
      lips.scale.setScalar(0.4 + 0.6 * k)
    }
    if (s === 'porno') {
      mouth.scale.set(THREE.MathUtils.lerp(MOUTH.x, 0.028, k), THREE.MathUtils.lerp(MOUTH.y, 0.016, k), 1)
      mouth.position.y = -0.05 - 0.006 * k
      jaw.position.y = -0.085 - 0.014 * k
      jaw.visible = k > 0.15
    }
    if (s === 'nada') eyes.forEach((e) => (e.lid.scale.y = Math.max(0.01, k)))
  }
  sena(null, 0) // rest: lips, teeth and the jaw start hidden
  return { head, sena }
}

export interface Avatar {
  root: THREE.Group
  seat: number
  hand: CardView[] // face-down cards held at the chest (identity unknown to others)
  setHandCount(count: number): void
  head: THREE.Group
  sena(s: Sena | null, amount: number): void
  // Pose in WORLD space; the avatar converts to local and solves IK.
  pose(p: AvatarPose): void
}

export interface AvatarPose {
  rightWrist?: THREE.Vector3
  leftWrist?: THREE.Vector3
  lean: number
  headYaw: number
  headPitch: number
}

export function makeAvatar(seat: number, n: PlayerCount, firstPerson = false, face: AvatarSpec = fallbackAvatar(seat)): Avatar {
  const a = seatAngle(seat, n)
  const root = new THREE.Group()
  root.position.copy(polar(CHAIR_R, a, 0))
  root.rotation.y = Math.PI / 2 - a // local -Z faces the table centre
  const cuff = teamOf(seat) ? PALETTE.rose : PALETTE.teal // teal = your team (seat 0 and your partners), as on the name tags

  const torso = new THREE.Group()
  root.add(torso)
  const coat = new THREE.Mesh(
    new THREE.LatheGeometry([0, 0.2, 0.24, 0.23, 0.2, 0.08].map((r, i) => new THREE.Vector2(r + 0.001, 0.5 + [0, 0.02, 0.3, 0.52, 0.6, 0.66][i])), 14),
    mat(PALETTE.soot, 1),
  )
  coat.scale.z = 0.7
  coat.castShadow = true
  torso.add(coat)
  const { head, sena } = makeMask(face)
  head.position.set(0, 1.3, -0.04)
  torso.add(head)

  const armMat = mat(PALETTE.soot, 1)
  const mk = () => new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.035, 1, 8), armMat)
  const arms = [-1, 1].map((sx) => ({ sx, upper: mk(), fore: mk(), glove: glove(cuff, sx) }))
  arms.forEach((r) => {
    r.upper.scale.y = UPPER
    r.fore.scale.y = FORE
    r.upper.castShadow = r.fore.castShadow = true
    root.add(r.upper, r.fore, r.glove)
  })

  // Everyone sits the same way, and that is what the others see of you too: the fan (backs out,
  // faces toward its owner) held in the LEFT hand, off to the side; the RIGHT hand resting on the
  // table edge until it plays. FAN_X is the avatar's left (-x; it faces -z).
  const FAN_X = -0.21
  // Held fan (up to 6 cards): backs toward the table.
  const hand = Array.from({ length: MAX_HAND }, () => {
    const c = makeCard()
    root.add(c.root)
    return c
  })
  function setHandCount(count: number) {
    const n = Math.min(count, MAX_HAND)
    hand.forEach((c, k) => {
      c.root.visible = !firstPerson && k < n
      const off = k - (n - 1) / 2
      c.root.position.set(FAN_X + off * 0.016, FAN_Y - Math.abs(off) * 0.004, -0.33 + k * 0.0015)
      c.root.rotation.set(0.35, 0.25, off * -0.1, 'YXZ') // face toward the owner (turned a bit inward), back toward the table
    })
  }
  setHandCount(0)

  const fanHold = new THREE.Vector3(FAN_X + 0.01, FAN_Y - 0.08, -0.32) // left wrist, under the fan
  const tableRest = new THREE.Vector3(0.2, TABLE_Y + 0.03, -(CHAIR_R - (TABLE_R - 0.04))) // right wrist on the table
  const shoulderLocal = (sx: number, lean: number) => new THREE.Vector3(sx * 0.19, SHOULDER_Y - lean * 0.06, -(CHAIR_R - SHOULDER_R) - lean * LEAN_REACH)

  // First person: only the arms exist (the camera lives where the head would be).
  if (firstPerson) {
    torso.visible = false
    hand.forEach((c) => (c.root.visible = false))
  }

  function pose(p: AvatarPose) {
    torso.position.z = -p.lean * LEAN_REACH
    torso.rotation.x = -p.lean * 0.32
    head.rotation.set(p.headPitch, p.headYaw, 0, 'YXZ')
    for (const r of arms) {
      const s = shoulderLocal(r.sx, p.lean)
      const wristWorld = r.sx > 0 ? p.rightWrist : p.leftWrist
      const target = wristWorld ? root.worldToLocal(wristWorld.clone()) : (r.sx > 0 ? tableRest : fanHold).clone()
      const pole = s.clone().add(new THREE.Vector3(r.sx * 0.4, -0.5, 0.1))
      const { elbow, wrist } = solveElbow(s, target, pole)
      segment(r.upper, s, elbow)
      segment(r.fore, elbow, wrist)
      r.glove.position.copy(wrist)
      r.glove.lookAt(root.localToWorld(wrist.clone().add(wrist.clone().sub(elbow))))
    }
  }
  return { root, seat, hand, setHandCount, head, sena, pose }
}
