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

// The sleeve the hand comes out of: a short, loose black cuff, wide even at the wrist (the hand comes out of it
// without touching it), opening a little more toward the back, round all the way. Dark inside (the
// arm is lost in the dark); only the hem round the open end is in the team's colour. It runs back from the wrist,
// down −z.
const SLEEVE_LEN = 0.06
const SLEEVE_SEG = 32
const SLEEVE_RINGS = 14
/** The sleeve's radius at a point: u from 0 (wrist) to 1 (open end). Round, no folds. */
const sleeveR = (u: number, _a: number) => 0.039 + 0.014 * Math.pow(u, 1.4) // loose all along, a little wider at the back
/** How far the open end hangs down (a little, evenly: it stays round). */
const sleeveSag = (u: number, _a: number) => -0.006 * u * u
let sleeveGeo: { sleeve: THREE.BufferGeometry; hem: THREE.BufferGeometry } | null = null
function sleeveGeometry() {
  if (sleeveGeo) return sleeveGeo
  const pos: number[] = []
  const idx: number[] = []
  for (let j = 0; j <= SLEEVE_RINGS; j++) {
    const u = j / SLEEVE_RINGS
    for (let i = 0; i <= SLEEVE_SEG; i++) {
      const a = (i / SLEEVE_SEG) * Math.PI * 2
      const r = sleeveR(u, a)
      const len = SLEEVE_LEN
      pos.push(Math.cos(a) * r, Math.sin(a) * r + sleeveSag(u, a), 0.012 - u * len) // back from the wrist, down −z
    }
  }
  for (let j = 0; j < SLEEVE_RINGS; j++) {
    for (let i = 0; i < SLEEVE_SEG; i++) {
      const k = j * (SLEEVE_SEG + 1) + i
      idx.push(k, k + SLEEVE_SEG + 1, k + 1, k + 1, k + SLEEVE_SEG + 1, k + SLEEVE_SEG + 2) // wound so the outside faces out
    }
  }
  const sleeve = new THREE.BufferGeometry()
  sleeve.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  sleeve.setIndex(idx)
  sleeve.computeVertexNormals()
  // the hem: a thin roll round the open end
  const last = SLEEVE_RINGS * (SLEEVE_SEG + 1)
  const edge = Array.from({ length: SLEEVE_SEG }, (_, i) => new THREE.Vector3(pos[(last + i) * 3], pos[(last + i) * 3 + 1], pos[(last + i) * 3 + 2]))
  const hem = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(edge, true), 64, 0.0032, 6, true)
  sleeveGeo = { sleeve, hem }
  return sleeveGeo
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
 * A floating hand coming out of a loose black sleeve whose hem is in the team's colour. `side` is the arm it would be on (+1 right,
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
  const geo = sleeveGeometry()
  const cuff = new THREE.Mesh(geo.sleeve, cuffMat)
  const inside = new THREE.Mesh(geo.sleeve, darkMat)
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
