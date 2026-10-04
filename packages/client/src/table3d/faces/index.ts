// The faces players sit at the table with, and their hands. Nobody has a body: a face floats over the table and two
// hands play the cards, as in Buckshot Roulette. A face is an LED mask (ledMask.ts) or a sculpted head (headMask.ts);
// both answer to the same calls, so the table does not care which one it is.
import * as THREE from 'three'
import { faceKind, type AvatarSpec } from '@la-base/shared'
import { makeLedMask, type FaceRig } from './ledMask'
import { makeHeadMask } from './headMask'
import { sculpted } from './sculpted'
import type { HandPose } from './heads'
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

// The cuff the hand comes out of: a short black glove cuff, flared toward the back and open, dark inside (the arm is lost
// in the dark), so the hand reads as coming out of a sleeve rather than cut off at the wrist. Built along +y and
// turned so the cuff runs back from the wrist, down −z.
const CUFF_PROFILE: [number, number][] = [
  [0.0255, -0.012], [0.0285, -0.004], [0.031, 0.012], [0.0345, 0.032], [0.039, 0.052], [0.0435, 0.068], [0.0445, 0.072],
]
let cuffGeo: THREE.LatheGeometry | null = null
let cuffHem: THREE.TorusGeometry | null = null
function cuffGeometry() {
  if (!cuffGeo) {
    cuffGeo = new THREE.LatheGeometry(CUFF_PROFILE.map(([r, y]) => new THREE.Vector2(r, y)), 24)
    cuffGeo.rotateX(-Math.PI / 2) // +y (the back of the cuff) becomes −z
    cuffHem = new THREE.TorusGeometry(0.0445, 0.0035, 6, 24) // the rolled hem at the open end
    cuffHem.translate(0, 0, -0.072)
  }
  return { cuff: cuffGeo, hem: cuffHem! }
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

/**
 * A floating hand coming out of a black glove cuff whose hem is in the team's colour. `side` is the arm it would be on (+1 right,
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
  const cuffMat = new THREE.MeshStandardMaterial({ color: 0x141214, roughness: 0.85 }) // black cloth, like the room
  const hemMat = new THREE.MeshStandardMaterial({ color: cuffColor, roughness: 0.7 }) // only the hem tells the team
  const darkMat = new THREE.MeshBasicMaterial({ color: 0x050403, side: THREE.BackSide }) // inside the cuff: only the dark
  mats.push(cuffMat, hemMat, darkMat)
  const geo = cuffGeometry()
  const cuff = new THREE.Mesh(geo.cuff, cuffMat)
  const inside = new THREE.Mesh(geo.cuff, darkMat)
  const hem = new THREE.Mesh(geo.hem, hemMat)
  cuff.castShadow = hem.castShadow = true
  inner.add(cuff, inside, hem)
  prepare(g)
  // the sculpted hand looks down −z with its thumb on +x for s = 1: turned half round, it looks down +z and the
  // thumb lands on −x, so the hand of the arm `side` is sculpted as s = −side
  sculpted({ job: 'hand', style, pose, side: side > 0 ? -1 : 1 }).then(([p]) => {
    if (gone) return
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: p.rough })
    mats.push(mat)
    const mesh = new THREE.Mesh(p.geometry, mat)
    mesh.rotation.y = Math.PI
    mesh.castShadow = true
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
