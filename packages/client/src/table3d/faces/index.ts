// The faces players sit at the table with, and their hands. Nobody has a body: a face floats over the table and two
// hands play the cards, as in Buckshot Roulette. A face is an LED mask (ledMask.ts) or a sculpted head (headMask.ts);
// both answer to the same calls, so the table does not care which one it is.
import * as THREE from 'three'
import { faceKind, type AvatarSpec } from '@la-base/shared'
import { makeLedMask, type FaceRig } from './ledMask'
import { makeHeadMask } from './headMask'
import { sculpted } from './sculpted'
import { HAND_CURL, HEADS, LED_HANDS, RING_FINGER, type HandPose } from './heads'
import type { HandStyleKey } from './sculptJobs'

export type { FaceRig }

/** How big the faces are at the table: a little over life size, so the señas read from across it. */
export const FACE_SCALE = { led: 1.5, cabeza: 1.65 }

export function makeFace(avatar: AvatarSpec, seed = 0): FaceRig {
  const f = faceKind(avatar.face)
  const rig = f.kind === 'led' ? makeLedMask(f.name, seed) : makeHeadMask(f.name, seed)
  rig.head.scale.setScalar(f.kind === 'led' ? FACE_SCALE.led : FACE_SCALE.cabeza)
  return rig
}

/** Which gloves or hands go with a face. */
export const handStyleOf = (avatar: AvatarSpec): HandStyleKey => {
  const f = faceKind(avatar.face)
  return f.kind === 'led' ? 'led' : f.name
}

// No sleeve and no cuff, as in Buckshot Roulette: a bare hand whose wrist sinks into the dark. Its colours darken from
// the back of the hand to the end of the wrist, to nearly black, so in the gloom of the room the hand seems to come
// out of nowhere. The geometry is shared (one per style and pose), so it is darkened once.
const FADE_FROM = -0.014 // sculpt space: the wrist runs back toward +z, the end of it at about +0.035
const FADE_TO = 0.032
function fadeWrist(g: THREE.BufferGeometry) {
  if (g.userData.wristFaded) return
  g.userData.wristFaded = true
  const pos = g.getAttribute('position')
  const col = g.getAttribute('color')
  for (let i = 0; i < pos.count; i++) {
    const u = Math.min(1, Math.max(0, (pos.getZ(i) - FADE_FROM) / (FADE_TO - FADE_FROM)))
    const k = 1 - 0.98 * u * u * (3 - 2 * u) // smoothstep: full colour at the back of the hand, almost black at the end
    col.setXYZ(i, col.getX(i) * k, col.getY(i) * k, col.getZ(i) * k)
  }
  col.needsUpdate = true
}

/**
 * How a hand moves while it waits, in stop-motion like the rest of the puppets: it breathes, sways a little, and the
 * open hand (`rest`) now and then drums twice on the felt; the closed one (`hold`, round the fan) only tilts a
 * little, so the cards it holds do not wander. Rotations are about the wrist; fingers point down +z.
 */
export function handIdle(t: number, pose: HandPose, seed: number) {
  const ts = Math.floor(t * 15) / 15
  const breathe = Math.sin(ts * 1.1 + seed * 2.3)
  if (pose === 'hold') return { y: breathe * 0.003, rx: Math.sin(ts * 0.7 + seed) * 0.04, ry: 0, rz: Math.sin(ts * 0.5 + seed * 1.7) * 0.05 }
  const PERIOD = 4.6
  const u = (ts + seed * 1.37) % PERIOD // seconds into this drumming cycle
  const tap = u < 0.7 ? -0.32 * Math.abs(Math.sin((u / 0.7) * Math.PI * 2)) : 0 // two quick taps: the fingers lift and fall
  return { y: breathe * 0.004, rx: tap + Math.sin(ts * 0.6 + seed) * 0.05, ry: Math.sin(ts * 0.4 + seed * 0.9) * 0.08, rz: Math.sin(ts * 0.8 + seed) * 0.04 }
}

const RING_GEO = new THREE.TorusGeometry(0.01, 0.0026, 6, 16)
/** Where the ring sits: round the first bone of the ring finger, a little past the knuckle (sculpt space). */
function ringOn(s: 1 | -1, pose: HandPose, style: HandStyleKey) {
  const f = RING_FINGER
  const th = (style === 'led' ? LED_HANDS : HEADS[style].hands).thin ?? 1
  const pitch = HAND_CURL[pose].curl[2] * 0.8
  const yaw = s * f.yaw
  const dir = new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), -Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch)).normalize()
  const at = new THREE.Vector3(s * f.x * th, 0.002, f.z).addScaledVector(dir, f.len * 0.42)
  return { at, dir, radius: 0.0091 * th + 0.0008 }
}

/**
 * A floating bare hand, its wrist lost in the dark, with a ring in the team's colour. `side` is the arm it would be on (+1 right,
 * −1 left); its fingers point down +z (the way the table's arms aim a hand) and the thumb points inward, toward the
 * body's midline. The hand shows once the sculptor has made it; `prepare` is run on the group then and at once.
 * `idle(t)` moves the hand inside its group (the group itself is placed and aimed by the caller).
 */
export function makeHand(style: HandStyleKey, pose: HandPose, side: 1 | -1, cuffColor: THREE.ColorRepresentation, prepare: (o: THREE.Object3D) => void = () => {}, seed = 0) {
  const g = new THREE.Group()
  const inner = new THREE.Group() // what the idle animation turns, about the wrist
  g.add(inner)
  const mats: THREE.Material[] = []
  let gone = false
  prepare(g)
  // the sculpted hand looks down −z with its thumb on +x for s = 1: turned half round, it looks down +z and the
  // thumb lands on −x, so the hand of the arm `side` is sculpted as s = −side
  const s = side > 0 ? -1 : 1
  sculpted({ job: 'hand', style, pose, side: s }).then(([p]) => {
    if (gone) return
    fadeWrist(p.geometry)
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: p.rough })
    // the team's colour: a thin ring on the ring finger
    const ringMat = new THREE.MeshStandardMaterial({ color: cuffColor, roughness: 0.35, metalness: 0.4 })
    mats.push(mat, ringMat)
    const mesh = new THREE.Mesh(p.geometry, mat)
    mesh.rotation.y = Math.PI
    mesh.castShadow = true
    const r = ringOn(s, pose, style)
    const ring = new THREE.Mesh(RING_GEO, ringMat)
    ring.position.copy(r.at)
    ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), r.dir)
    ring.scale.setScalar(r.radius / 0.01)
    mesh.add(ring)
    inner.add(mesh)
    prepare(g) // (the table puts hands on their own layer and draws them last: the new mesh too)
  })
  return {
    group: g,
    idle(t: number) {
      const m = handIdle(t, pose, seed + (side > 0 ? 0 : 3.1))
      inner.position.y = m.y
      inner.rotation.set(m.rx, m.ry, m.rz)
    },
    dispose() {
      gone = true
      mats.forEach((m) => m.dispose())
    },
  }
}
