import * as THREE from 'three'
import { CARD_H, TABLE_R, TABLE_Y, seatAngle, playSlot, polar, type PlayerCount } from './seats'

// Card-play choreography, modelled on real truco hands and played by the hand itself: the right hand reaches the
// fan and pinches the top edge of a card, pulls it out, turns it face-down on the way and glides it low over the
// felt; sets it down a card's length short of its place, lifts the near edge and lets go — the card falls over its
// far edge, face up, onto its place, bounces once and settles. The hand holds the card for real (see
// faces/index.ts, grips): its pose comes from the card's, so a card never goes through a finger.
// Pure function of t → scrubbable, and every client reproduces it from one network event (see
// references/choreography-netcode.md).
export const PHASES = {
  reach: [0.0, 0.28], // the hand goes to the card in the fan and pinches its top edge
  extract: [0.28, 0.5], // pulls it up out of the fan
  carry: [0.5, 1.1], // turns it face-down and glides it low to just short of its place
  set: [1.1, 1.24], // touches down, 1 cm of friction slide
  lift: [1.24, 1.48], // lifts the near edge, the far edge still on the felt
  fall: [1.48, 1.68], // let go: the card falls over its far edge, face up
  settle: [1.68, 1.95], // one small bounce
  retract: [1.48, 2.05], // the hand opens and goes back to rest
} as const
export const PLAY_DURATION = 2.05
/** The play path's time at which a card carried by hand joins it (hovering just short of its place). */
export const JOIN_AT = PHASES.set[0]

const ease = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2)
const span = (t: number, [a, b]: readonly [number, number]) => THREE.MathUtils.clamp((t - a) / (b - a), 0, 1)

/** A card frame in the world. */
export interface Frame {
  pos: THREE.Vector3
  quat: THREE.Quaternion
}

export interface PlayPose {
  cardPos: THREE.Vector3
  cardRot: THREE.Quaternion
  /** How much the right hand is holding the card (0: where the arm puts it, 1: pinching it). */
  grip: number
  /** The card frame the hand pinches (the card's own while it holds it; frozen where it let go after). */
  gripAt: Frame
  /** Where the arm aims the wrist while the hand is not (fully) on the card. */
  wrist?: THREE.Vector3
  lean: number
  headPitch: number
  faceVisible: boolean // identity must be known before this turns true
}

const FLAT_DOWN = Math.PI / 2 // rx of a card lying face-down (its top towards its player)
const SET = FLAT_DOWN - 0.3 // rx as it is set down: the far edge on the felt, the near one up under the fingers
// (a card flat on the felt cannot be pinched: the thumb, under it, would be in the table)
const LIFTED = 0.3 // rx when the hand lets go: the near edge up, past 70°
const FLAT_UP = -Math.PI / 2 // rx of a card lying face-up (fallen over its far edge)

/** The card's frame: rx about its width, in its player's frame (yaw), plus a little roll. */
const frameQuat = (rx: number, yaw: number, roll = 0) => new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, yaw, roll, 'YXZ'))

/**
 * `firstPerson`: your own play, seen from your eyes. Your fan is right in front of your camera, so the card does not
 * rise out of it (it would cover the view) but drops straight out toward the table, and your hand takes it only
 * once it is clear of your face.
 */
export function playPose(seat: number, n: PlayerCount, baza: number, t: number, hold?: Frame, firstPerson = false): PlayPose {
  const a = seatAngle(seat, n)
  const yaw = Math.PI / 2 - a
  const out = new THREE.Vector3(Math.cos(a), 0, Math.sin(a))
  const holdF: Frame = hold ?? { pos: polar(TABLE_R + 0.12, a, 1.0), quat: frameQuat(0.35, yaw) }
  const slot = playSlot(seat, n, baza).pos
  const y0 = slot.y
  // the far edge the card falls over (half a card past its place, towards its player), and where it is set down
  // face-down (a whole card towards its player)
  const pivot = slot.clone().addScaledVector(out, CARD_H / 2)
  const down = slot.clone().addScaledVector(out, CARD_H)
  const hover = down.clone().setY(y0 + 0.028)
  // out of the fan: along the card's own length, half a card
  const up = new THREE.Vector3(0, 1, 0).applyQuaternion(holdF.quat)
  // the fan's thumb pushes the card up out of the others first, so the fingers pinch it clear of its neighbours
  const presented = firstPerson ? holdF.pos.clone() : holdF.pos.clone().addScaledVector(up, CARD_H * 0.3)
  const pulled = firstPerson ? holdF.pos.clone().add(new THREE.Vector3(0, -0.05, 0)) : holdF.pos.clone().addScaledVector(up, CARD_H * 0.6)
  const edge = polar(TABLE_R - 0.02, a, TABLE_Y + 0.08)

  let pos: THREE.Vector3
  let quat: THREE.Quaternion
  if (t < PHASES.extract[0]) {
    pos = holdF.pos.clone().lerp(presented, ease(span(t, [0, PHASES.reach[1] * 0.7])))
    quat = holdF.quat.clone()
  } else if (t < PHASES.carry[0]) {
    const u = ease(span(t, PHASES.extract))
    pos = presented.clone().lerp(pulled, u)
    quat = holdF.quat.clone()
  } else if (t < PHASES.set[0]) {
    const u = span(t, PHASES.carry)
    const e = ease(u)
    // up out of the fan, over the table's edge, low over the felt
    pos = new THREE.CubicBezierCurve3(pulled, pulled.clone().lerp(edge, 0.6).setY(Math.max(pulled.y, edge.y) + 0.02), edge.clone().lerp(hover, 0.35), hover).getPoint(e)
    const turn = ease(THREE.MathUtils.clamp(u * 1.6, 0, 1)) // face-down by the time it is over the felt
    quat = holdF.quat.clone().slerp(frameQuat(FLAT_DOWN, yaw, Math.sin(u * Math.PI) * 0.1), turn)
  } else if (t < PHASES.lift[0]) {
    // the far edge touches down first and skids a centimetre; the near edge stays up in the fingers
    const u = span(t, PHASES.set)
    const rx = THREE.MathUtils.lerp(FLAT_DOWN, SET, ease(u))
    const along = new THREE.Vector3(0, Math.cos(rx), Math.sin(rx)).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw)
    const onPivot = pivot.clone().addScaledVector(out, 0.01 * (1 - ease(u))).addScaledVector(along, CARD_H / 2)
    pos = hover.clone().lerp(onPivot, ease(Math.min(1, u * 1.5)))
    quat = frameQuat(rx, yaw)
  } else {
    // over the far edge: the centre swings round the pivot, half a card away
    let rx: number
    if (t < PHASES.fall[0]) rx = THREE.MathUtils.lerp(SET, LIFTED, ease(span(t, PHASES.lift)))
    else if (t < PHASES.settle[0]) {
      const u = span(t, PHASES.fall)
      rx = LIFTED + (FLAT_UP - LIFTED) * u * u // falling: faster and faster
    } else {
      const u = span(t, PHASES.settle)
      rx = FLAT_UP + 0.16 * Math.exp(-5 * u) * Math.abs(Math.sin(u * Math.PI * 2.2)) // one bounce off the felt, dying
    }
    const along = new THREE.Vector3(0, Math.cos(rx), Math.sin(rx)).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw)
    const slide = t > PHASES.settle[0] ? -0.004 * ease(span(t, PHASES.settle)) : 0 // it skids a few mm on landing
    pos = pivot.clone().addScaledVector(along, CARD_H / 2).addScaledVector(out, slide)
    pos.y = Math.max(pos.y, y0)
    quat = frameQuat(rx, yaw)
  }

  // the hand: reaches for the card in the fan, holds it until the fall, then lets go where it was
  let grip: number
  let gripAt: Frame
  let wrist: THREE.Vector3 | undefined
  const rest = polar(TABLE_R - 0.04, a, TABLE_Y + 0.03)
  if (firstPerson && t < PHASES.carry[0] + 0.25) {
    grip = ease(span(t, [PHASES.carry[0], PHASES.carry[0] + 0.25]))
    gripAt = { pos: pos.clone(), quat: quat.clone() }
    wrist = pos.clone().add(new THREE.Vector3(0, 0.06, 0))
  } else if (t < PHASES.reach[1]) {
    grip = ease(span(t, [PHASES.reach[1] * 0.35, PHASES.reach[1]])) // (the card is on its way up when the fingers close)
    gripAt = { pos: pos.clone(), quat: quat.clone() }
    wrist = holdF.pos.clone().addScaledVector(up, CARD_H * 0.6)
  } else if (t < PHASES.fall[0]) {
    grip = 1
    gripAt = { pos: pos.clone(), quat: quat.clone() }
  } else {
    // let go at the top of the lift: the hand stays a beat where it opened, then goes back to rest
    const at = playPose(seat, n, baza, PHASES.fall[0] - 1e-4, hold, firstPerson)
    gripAt = at.gripAt
    const u = span(t, PHASES.retract)
    grip = 1 - ease(Math.min(1, u * 1.8))
    wrist = at.gripAt.pos.clone().add(new THREE.Vector3(0, 0.05, 0)).lerp(rest, ease(u))
  }

  const reaching = t > PHASES.carry[0] && t < PHASES.retract[1]
  const lean = reaching ? Math.sin(Math.min(1, (t - PHASES.carry[0]) / (PHASES.retract[1] - PHASES.carry[0])) * Math.PI) : 0
  return {
    cardPos: pos,
    cardRot: quat,
    grip,
    gripAt,
    wrist,
    lean,
    headPitch: reaching ? -0.45 * lean : -0.1,
    // others see its face once it passes upright
    faceVisible: t >= PHASES.lift[0] + (PHASES.lift[1] - PHASES.lift[0]) * 0.9,
  }
}
