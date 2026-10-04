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

/**
 * A floating hand, cut at the wrist, with a cuff in the team's colour. `side` is the arm it would be on (+1 right,
 * −1 left); its fingers point down +z (the way the table's arms aim a hand) and the thumb points inward, toward the
 * body's midline. The hand shows once the sculptor has made it; `prepare` is run on the group then and at once.
 */
export function makeHand(style: HandStyleKey, pose: HandPose, side: 1 | -1, cuffColor: THREE.ColorRepresentation, prepare: (o: THREE.Object3D) => void = () => {}) {
  const g = new THREE.Group()
  const mats: THREE.Material[] = []
  let gone = false
  const cuffMat = new THREE.MeshStandardMaterial({ color: cuffColor, roughness: 0.7 })
  mats.push(cuffMat)
  const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.009, 8, 20), cuffMat)
  cuff.position.z = -0.012
  g.add(cuff)
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
    g.add(mesh)
    prepare(g) // (the table puts hands on their own layer and draws them last: the new mesh too)
  })
  return {
    group: g,
    dispose() {
      gone = true
      cuff.geometry.dispose()
      mats.forEach((m) => m.dispose())
    },
  }
}
