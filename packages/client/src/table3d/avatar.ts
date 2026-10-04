import * as THREE from 'three'
import { PALETTE, hex } from './look'
import { CHAIR_R, LEAN_REACH, SHOULDER_R, SHOULDER_Y, TABLE_R, TABLE_Y, seatAngle, teamOf, polar, type PlayerCount } from './seats'
import { makeCard, type CardView } from './cards'
import { toProps } from './propsLayer'
import { randomAvatar, type AvatarSpec, type Sena } from '@la-base/shared'
import { EYE_COLOR_LOOK } from './avatarLook'

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

// Eyes, drawn in light on the black mask: an outline (`ring`) and a dot, in the eye colour; the lid is the black
// of the mask, closing from above. `lid*` is the size of the lid (it must cover the whole eye); `tilt` turns the
// outer corner (± per side).
const EYES = [
  { w: 1, h: 1, r: 0.022, ring: true, dot: 0.008, lidW: 0.05, lidH: 0.05, tilt: 0 }, // redondos
  { w: 1.55, h: 0.5, r: 0.022, ring: true, dot: 0.0055, lidW: 0.078, lidH: 0.036, tilt: 0 }, // rasgados
  { w: 1, h: 1, r: 0.031, ring: true, dot: 0.0115, lidW: 0.07, lidH: 0.07, tilt: 0 }, // grandes
  { w: 1.25, h: 0.85, r: 0.022, ring: true, dot: 0.007, lidW: 0.062, lidH: 0.046, tilt: 0.3 }, // caídos
  { w: 1, h: 1, r: 0.0125, ring: false, dot: 0.0125, lidW: 0.036, lidH: 0.036, tilt: 0 }, // puntitos
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

/**
 * What makes the black sphere read as a hood: a rolled edge of cloth framing the mask, a little peak at the
 * back where the hood gathers, and a cowl over the neck down into the coat.
 */
function hoodTrim() {
  const g = new THREE.Group()
  const cloth = new THREE.MeshStandardMaterial({ color: 0x231d1a, roughness: 1 }) // the same black, a touch lifted so the fold catches light
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.128, 0.017, 10, 36), cloth)
  rim.scale.set(0.96, 1.2, 1) // an oval, like the mask it frames
  rim.position.set(0, 0.006, -0.068)
  rim.rotation.y = Math.PI
  const peak = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.15, 12), cloth)
  peak.position.set(0, 0.145, 0.15)
  peak.rotation.x = -1.0 // a point trailing back and up
  const cowl = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.185, 0.17, 18, 1, true), cloth)
  cowl.position.set(0, -0.15, 0.03)
  cowl.scale.z = 0.9
  g.add(rim, peak, cowl)
  return g
}

/**
 * The symbol on the forehead: a geometric outline of light, the one thing the masks of the guards in the show
 * wear. Circle, triangle, square, diamond, pentagon. It is laid on the mask itself: every point of the line is
 * put on the surface of the face's dome (a flat shape would sink into it at the edges).
 */
function symbolOf(kind: number, mat: THREE.Material) {
  const R = 0.037
  const T = 0.0072 // line width
  const CY = 0.104
  // the shape's outline, closed, walked finely so it can bend with the dome
  const corners = (n: number, rot: number, k = 1, sy = 1) => Array.from({ length: n }, (_, i) => new THREE.Vector2(Math.cos(rot + (i / n) * Math.PI * 2) * R * k, Math.sin(rot + (i / n) * Math.PI * 2) * R * k * sy))
  const walk = (pts: THREE.Vector2[], step = 0.004) => {
    const out: THREE.Vector2[] = []
    pts.forEach((a, i) => {
      const b = pts[(i + 1) % pts.length]
      const n = Math.max(1, Math.ceil(a.distanceTo(b) / step))
      for (let j = 0; j < n; j++) out.push(a.clone().lerp(b, j / n))
    })
    return out
  }
  const outline = [
    () => walk(corners(48, 0), 1), // círculo (48 points)
    () => walk(corners(3, Math.PI / 2, 1.1)), // triángulo (point up)
    () => walk(corners(4, Math.PI / 4, 1.05)), // cuadrado (flat sides)
    () => walk(corners(4, 0, 1.05, 1.35)), // rombo
    () => walk(corners(5, Math.PI / 2, 1.02)), // pentágono (point up)
  ][kind]()
  // the dome of the face: x half-width .125, y half-height .1625, depth .069, centred at z −.06 (see makeMask)
  const surface = (x: number, y: number) => -0.06 - 0.069 * Math.sqrt(Math.max(0, 1 - (x / 0.125) ** 2 - (y / 0.1625) ** 2)) - 0.0018
  const pos: number[] = []
  const idx: number[] = []
  const n = outline.length
  outline.forEach((p, i) => {
    const prev = outline[(i + n - 1) % n]
    const next = outline[(i + 1) % n]
    const tan = next.clone().sub(prev).normalize()
    const nrm = new THREE.Vector2(tan.y, -tan.x) // out of the shape, for a clockwise walk; either way the strip is symmetric
    for (const side of [-0.5, 0.5]) {
      const x = p.x + nrm.x * T * side
      const y = CY + p.y + nrm.y * T * side
      pos.push(x, y, surface(x, y))
    }
    const a = i * 2
    const b = ((i + 1) % n) * 2
    idx.push(a, a + 1, b, a + 1, b + 1, b)
  })
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  geo.setIndex(idx)
  const m = new THREE.Mesh(geo, mat.clone())
  ;(m.material as THREE.Material).side = THREE.DoubleSide
  const g = new THREE.Group()
  g.add(m)
  return g
}

// Puppet mask: a Buckshot-style mask that is ARTICULATED so the truco señas still read, under a black hood
// that covers everything else: no hair, the face is all that tells the players apart. Its face is the
// avatar's: eyes, mouth and brows, and the colour of the eyes.
export function makeMask(avatar: AvatarSpec) {
  const head = new THREE.Group()
  const hood = new THREE.Mesh(new THREE.SphereGeometry(0.15, 16, 12), mat(PALETTE.soot, 1))
  hood.scale.set(1, 1.15, 1)
  hood.position.z = 0.03
  // the mask is black, with a sheen the lamp can catch; everything on it is light (unlit, so it shows in the dark)
  const black = new THREE.MeshStandardMaterial({ color: 0x0d0a09, roughness: 0.32, metalness: 0.1 })
  const face = new THREE.Mesh(new THREE.SphereGeometry(0.125, 20, 14, 0, Math.PI * 2, 0, Math.PI / 2), black)
  face.rotation.x = -Math.PI / 2
  face.scale.set(1, 0.55, 1.3)
  face.position.z = -0.06
  const glow = new THREE.MeshBasicMaterial({ color: hex(PALETTE.chalk) }) // brows, mouth, symbol
  const eyeLook = EYES[avatar.eyes]
  const eyeMat = new THREE.MeshBasicMaterial({ color: hex(EYE_COLOR_LOOK[avatar.eyeColor].hex), side: THREE.DoubleSide })
  const browLook = BROWS[avatar.brows]
  const browMat = glow
  // the features sit a little low on the mask, as one block, so the forehead stays free for the symbol
  const features = new THREE.Group()
  features.position.y = -0.022
  const eyes = [-1, 1].map((sx) => {
    const flat = (geo: THREE.BufferGeometry, z: number, m: THREE.Material, w = 1, h = 1) => {
      const d = new THREE.Mesh(geo, m)
      d.position.set(sx * 0.045, 0.03, z)
      d.rotation.set(0, Math.PI, -sx * eyeLook.tilt)
      d.scale.set(w, h, 1)
      return d
    }
    const outline = flat(eyeLook.ring ? new THREE.RingGeometry(eyeLook.r * 0.7, eyeLook.r, 20) : new THREE.CircleGeometry(eyeLook.r, 16), -0.1335, eyeMat, eyeLook.w, eyeLook.h)
    const dot = eyeLook.ring ? flat(new THREE.CircleGeometry(eyeLook.dot, 14), -0.1338, eyeMat) : null
    const lid = new THREE.Mesh(new THREE.PlaneGeometry(eyeLook.lidW, eyeLook.lidH), black)
    lid.geometry.translate(0, -eyeLook.lidH / 2, 0) // hinge at the top edge
    lid.position.set(sx * 0.045, 0.03 + eyeLook.lidH / 2, -0.1365)
    lid.rotation.y = Math.PI
    lid.scale.y = 0.01
    const brow = new THREE.Mesh(new THREE.BoxGeometry(browLook.w, browLook.h, 0.012), browMat)
    brow.position.set(sx * 0.045, browLook.y, -0.132)
    brow.rotation.z = sx * browLook.tilt
    features.add(outline, ...(dot ? [dot] : []), lid, brow)
    return { lid, brow, sx }
  })
  // mouth: a shape scaled into a line (rest), an O (kiss), an open oval (fish)...
  const MOUTH = MOUTHS[avatar.mouth]
  const mouth = new THREE.Mesh(MOUTH.curve === 0 ? new THREE.CircleGeometry(1, 20) : arc(MOUTH.curve), glow)
  mouth.position.set(0, -0.05, -0.134)
  mouth.rotation.y = Math.PI
  mouth.scale.set(MOUTH.x, MOUTH.y, 1)
  // puckered lips (kiss) and two front teeth over the lower lip (bite): hidden at rest
  const lips = new THREE.Mesh(new THREE.RingGeometry(0.011, 0.019, 20), glow)
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
  const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.035, 0.05), black)
  jaw.position.set(0, -0.085, -0.1)
  jaw.visible = false // it poked out under the mouth at rest like a little tooth: only the 'porno' seña drops it
  features.add(mouth, lips, teeth, jaw)
  head.add(hood, face, features, symbolOf(avatar.symbol, glow), hoodTrim())
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
