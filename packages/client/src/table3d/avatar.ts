import * as THREE from 'three'
import { makeFace, makeHand, handStyleOf } from './faces'
import { CHAIR_R, LEAN_REACH, SHOULDER_R, SHOULDER_Y, TABLE_R, TABLE_Y, seatAngle, polar, type PlayerCount } from './seats'
import { makeCard, type CardView } from './cards'
import { toProps } from './propsLayer'
import { type AvatarSpec, type Sena } from '@la-base/shared'
import { fallbackAvatar } from './tableFaces'

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

export { fallbackAvatar, tableFaces } from './tableFaces'

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

  function pose(p: AvatarPose) {
    torso.position.z = -p.lean * LEAN_REACH
    torso.rotation.x = -p.lean * 0.32
    head.rotation.set(p.headPitch, p.headYaw, 0, 'YXZ')
    float(performance.now() / 1000)
    for (const r of arms) {
      const s = shoulderLocal(r.sx, p.lean)
      const wristWorld = r.sx > 0 ? p.rightWrist : p.leftWrist
      const target = wristWorld ? root.worldToLocal(wristWorld.clone()) : (r.sx > 0 ? tableRest : fanHold).clone()
      const pole = s.clone().add(new THREE.Vector3(r.sx * 0.4, -0.5, 0.1))
      const { elbow, wrist } = solveElbow(s, target, pole) // the arm is not drawn: it only aims the hand
      r.glove.position.copy(wrist)
      r.glove.lookAt(root.localToWorld(wrist.clone().add(wrist.clone().sub(elbow))))
      // waiting, a hand breathes and sways; while it plays (the table moves its wrist) it keeps still
      if (wristWorld) r.hand.idle(0)
      else r.hand.idle(performance.now() / 1000)
    }
  }
  return { root, seat, hand, setHandCount, head, sena, pose }
}
