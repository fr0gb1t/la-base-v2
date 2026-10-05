import * as THREE from 'three'
import { makeFace, makeHand, handStyleOf, handIdle } from './faces'
import { CARD_H, CHAIR_R, LEAN_REACH, SHOULDER_R, SHOULDER_Y, TABLE_R, TABLE_Y, seatAngle, polar, type PlayerCount } from './seats'
import { makeCard, type CardView } from './cards'
import { toProps } from './propsLayer'
import { randomAvatar, type AvatarSpec, type Sena } from '@la-base/shared'

// Nobody at the table has a body, as in Buckshot Roulette: a face floats where the head would be (an LED mask or a
// sculpted head, the one the player chose) and two hands float where the wrists would be. The arms are still
// solved, unseen, so each hand points the way a forearm would hold it.
export const MAX_HAND = 6
export const FAN_Y = 1.06 // height of the held fan: above the name tag at the belly
const UPPER = 0.32
const FORE = 0.3

export type { Sena }

/** Drawing priority of the hands: above every card lying on the table (see CARD_ORDER in TableScene). */
export const HAND_ORDER = 5000

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

// ---- the face (an LED mask or a sculpted head, see faces/) and the floating hands ----------------------------

/** What a face looks like when nobody has chosen one: derived from the seat, so it is always the same one. */
export function fallbackAvatar(seed: number): AvatarSpec {
  let x = (seed + 1) * 2654435761
  const rng = () => ((x = (x * 1664525 + 1013904223) >>> 0) / 4294967296)
  return randomAvatar(rng)
}

/** Hands are drawn last, over every card lying on the table, and on the smooth props layer. */
function asHand(o: THREE.Object3D) {
  o.traverse((c) => {
    c.castShadow = true
    // the hand has the highest drawing priority: it is drawn after everything lying on the table (the
    // cards, in the order they were laid), so it always shows over them, never through them
    if (c instanceof THREE.Mesh) {
      c.renderOrder = HAND_ORDER
      ;(c.material as THREE.Material).transparent = true
    }
  })
  toProps(o)
}

export interface Avatar {
  root: THREE.Group
  seat: number
  hand: CardView[] // face-down cards held in the left hand (identity unknown to others)
  setHandCount(count: number): void
  /** A card of the fan lifted a little out of it (a remote player fingering it), 0..1. */
  setLift(slot: number, amount: number): void
  head: THREE.Group
  sena(s: Sena | null, amount: number): void
  // Pose in WORLD space; the avatar converts to local and solves IK.
  pose(p: AvatarPose): void
}

/** A card's frame in the world (where a hand holds a card). */
export interface CardFrame {
  pos: THREE.Vector3
  quat: THREE.Quaternion
}

export interface AvatarPose {
  rightWrist?: THREE.Vector3
  leftWrist?: THREE.Vector3
  /**
   * The right hand holds a card: pinched by its edge (`pinch`) or pressed flat under the palm (`press`). Its pose
   * then comes from the card's (`at`), so the card sits between its fingers; `amount` blends from where the arm
   * would put the hand (0) to the grip (1), for reaching for a card and letting go of it.
   */
  rightGrip?: { at: CardFrame; amount: number; kind?: 'pinch' | 'press' }
  /** First person: the frame of the middle card of your fan (the left hand holds it from below). */
  leftFan?: CardFrame
  /** How high the table is at (x, z) — the felt, or the cards lying on it; −∞ off the table. No hand goes under it. */
  floor?: (x: number, z: number) => number
  lean: number
  headYaw: number
  headPitch: number
}

export function makeAvatar(seat: number, n: PlayerCount, firstPerson = false, avatarSpec: AvatarSpec = fallbackAvatar(seat)): Avatar {
  const a = seatAngle(seat, n)
  const root = new THREE.Group()
  root.position.copy(polar(CHAIR_R, a, 0))
  root.rotation.y = Math.PI / 2 - a // local -Z faces the table centre

  // where the body would be: nothing shows, but it still leans in and carries the face
  const torso = new THREE.Group()
  root.add(torso)
  const face = makeFace(avatarSpec, seat)
  const head = new THREE.Group() // turned and nodded by the table; the face inside it floats
  head.position.set(0, 1.18, -0.04) // a little lower than a seated head: the faces hang close over the felt
  head.add(face.head)
  torso.add(head)
  const sena = face.sena

  // the hands, cut at the wrist: the right one open, resting on the felt and playing; the left one closed round the fan
  const style = handStyleOf(avatarSpec)
  const arms = ([-1, 1] as const).map((sx) => {
    const h = makeHand(style, sx > 0 ? 'rest' : 'hold', sx, asHand, seat * 1.9)
    return { sx, glove: h.group, hand: h }
  })
  arms.forEach((r) => root.add(r.glove))

  // Everyone sits the same way, and that is what the others see of you too: the fan (backs out,
  // faces toward its owner) held in the LEFT hand, off to the side; the RIGHT hand resting on the
  // table edge until it plays. FAN_X is the avatar's left (-x; it faces -z).
  const FAN_X = -0.21
  // The fan's frame: the middle card's, unspread. The left hand holds the cards' bottoms in its fist; each card
  // turns about that point to spread the fan.
  const fanBase = new THREE.Matrix4().compose(new THREE.Vector3(FAN_X, FAN_Y, -0.33), new THREE.Quaternion().setFromEuler(new THREE.Euler(0.35, 0.25, 0, 'YXZ')), new THREE.Vector3(1, 1, 1))
  const PIVOT = -(CARD_H / 2 - 0.012) // card space: the point pinched (the cards' bottom edge, 12 mm in)
  const hand = Array.from({ length: MAX_HAND }, () => {
    const c = makeCard()
    root.add(c.root)
    return c
  })
  let shown = 0
  const lift = Array(MAX_HAND).fill(0)
  const liftTo = Array(MAX_HAND).fill(0)
  function setHandCount(count: number) {
    shown = Math.min(count, MAX_HAND)
    hand.forEach((c, k) => (c.root.visible = !firstPerson && k < shown))
  }
  /** Card k of the fan, in the fan's frame. */
  function fanCard(k: number) {
    const off = k - (shown - 1) / 2
    return new THREE.Matrix4()
      .makeTranslation(0, PIVOT, 0)
      .multiply(new THREE.Matrix4().makeRotationZ(-off * 0.17))
      .multiply(new THREE.Matrix4().makeTranslation(0, -PIVOT + lift[k] * 0.025, -off * 0.0004)) // (a hair apart, the stack centred between the thumb and the index)
  }
  setHandCount(0)
  const tableRest = new THREE.Vector3(0.2, TABLE_Y + 0.03, -(CHAIR_R - (TABLE_R - 0.04))) // right wrist on the table
  const shoulderLocal = (sx: number, lean: number) => new THREE.Vector3(sx * 0.19, SHOULDER_Y - lean * 0.06, -(CHAIR_R - SHOULDER_R) - lean * LEAN_REACH)

  // First person: only the hands exist (the camera lives where the face would be).
  if (firstPerson) {
    torso.visible = false
    hand.forEach((c) => (c.root.visible = false))
  }
  // the face hangs in the air: a slow bob and sway, in stop-motion like the rest of the puppet
  const phase = seat * 1.7
  function float(t: number) {
    const ts = Math.floor(t * 15) / 15
    face.head.position.y = Math.sin(ts * 1.3 + phase) * 0.006
    face.head.position.x = Math.sin(ts * 0.7 + phase * 1.7) * 0.004
    face.head.rotation.z = Math.sin(ts * 0.9 + phase) * 0.04
    face.tick(t)
  }

  const m4 = new THREE.Matrix4()
  const inv = new THREE.Matrix4()
  const tmpP = new THREE.Vector3()
  const tmpQ = new THREE.Quaternion()
  const tmpS = new THREE.Vector3()
  /** Puts a hand's group where it holds the card frame `card` (root space). */
  function holdAt(r: (typeof arms)[number], card: THREE.Matrix4, kind: 'pinch' | 'hold' | 'press') {
    m4.copy(card).multiply(inv.copy(r.hand.grip(kind)).invert())
    m4.decompose(tmpP, tmpQ, tmpS)
  }

  const sample = new THREE.Vector3()
  /** Lifts a hand clear of the table (the felt and the cards on it), if any of it went under. */
  function keepAbove(r: (typeof arms)[number], floor?: (x: number, z: number) => number) {
    if (!floor) return
    const smp = r.hand.samples()
    if (!smp) return
    r.glove.updateMatrixWorld(true)
    let deficit = 0
    for (const q of smp.points) {
      sample.copy(q).applyMatrix4(smp.mesh.matrixWorld)
      const under = floor(sample.x, sample.z) + 0.0015 - sample.y
      if (under > deficit) deficit = under
    }
    if (deficit > 0) r.glove.position.y += deficit // (the root only turns about y: up is up)
  }

  function pose(p: AvatarPose) {
    torso.position.z = -p.lean * LEAN_REACH
    torso.rotation.x = -p.lean * 0.32
    head.rotation.set(p.headPitch, p.headYaw, 0, 'YXZ')
    const t = performance.now() / 1000
    float(t)
    root.updateWorldMatrix(true, false)
    const toRoot = new THREE.Matrix4().copy(root.matrixWorld).invert()
    // the fan sways with the hand that holds it (breathing, in stop-motion), the cards and the fist together
    const sway = handIdle(firstPerson ? 0 : t, 'hold', phase)
    const fan = fanBase.clone().multiply(new THREE.Matrix4().makeTranslation(0, PIVOT + sway.y, 0)).multiply(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(sway.rx, sway.ry, sway.rz))).multiply(new THREE.Matrix4().makeTranslation(0, -PIVOT, 0))
    hand.forEach((c, k) => {
      lift[k] += (liftTo[k] - lift[k]) * 0.3
      if (k >= shown) return
      fan.clone().multiply(fanCard(k)).decompose(c.root.position, c.root.quaternion, tmpS)
    })
    for (const r of arms) {
      const s = shoulderLocal(r.sx, p.lean)
      const wristWorld = r.sx > 0 ? p.rightWrist : p.leftWrist
      if (r.sx < 0) {
        // the left hand holds the fan from below: its pose is the fan's (yours: the fan in front of your camera)
        r.hand.setPose('pinch')
        r.hand.idle(0)
        if (p.leftFan) holdAt(r, toRoot.clone().multiply(new THREE.Matrix4().compose(p.leftFan.pos, p.leftFan.quat, new THREE.Vector3(1, 1, 1))), 'hold')
        else holdAt(r, fan, 'hold')
        r.glove.position.copy(tmpP)
        r.glove.quaternion.copy(tmpQ)
        continue
      }
      const target = wristWorld ? root.worldToLocal(wristWorld.clone()) : tableRest.clone()
      const pole = s.clone().add(new THREE.Vector3(r.sx * 0.4, -0.5, 0.1))
      const { elbow, wrist } = solveElbow(s, target, pole) // the arm is not drawn: it only aims the hand
      r.glove.position.copy(wrist)
      r.glove.lookAt(root.localToWorld(wrist.clone().add(wrist.clone().sub(elbow))))
      const g = p.rightGrip
      if (g && g.amount > 0) {
        // holding a card: the hand is where the card says, blended from where the arm put it
        const kind = g.kind ?? 'pinch'
        holdAt(r, toRoot.clone().multiply(new THREE.Matrix4().compose(g.at.pos, g.at.quat, new THREE.Vector3(1, 1, 1))), kind)
        r.glove.position.lerp(tmpP, g.amount)
        r.glove.quaternion.slerp(tmpQ, g.amount)
        r.hand.setPose(kind === 'press' ? 'rest' : g.amount > 0.6 ? 'pinch' : 'rest')
        r.hand.idle(0)
        keepAbove(r, p.floor)
        continue
      }
      r.hand.setPose('rest')
      // waiting, a hand breathes and drums; while it plays (the table moves its wrist) it keeps still
      if (wristWorld) r.hand.idle(0)
      else r.hand.idle(t)
      keepAbove(r, p.floor)
    }
  }
  function setLift(slot: number, amount: number) {
    if (slot >= 0 && slot < MAX_HAND) liftTo[slot] = amount
  }
  return { root, seat, hand, setHandCount, setLift, head, sena, pose }
}
