import * as THREE from 'three'
import { CARD_W, CARD_H } from './seats'
import { drawFace, toTexture, type Rank, type Suit } from './cardFace'
import { backTexture } from './cardBacks'
import { toProps } from './propsLayer'

const backMat = new THREE.MeshStandardMaterial({ map: backTexture(), roughness: 0.85 })
const FACE_TINT = 0xa8a398 // multiplies the face print: ~0.65
const faceCache = new Map<string, THREE.MeshStandardMaterial>()
const SEGS = 10 // rows along the card's length: enough for it to bend smoothly

function faceMat(suit: Suit, rank: Rank) {
  const key = `${suit}${rank}`
  let m = faceCache.get(key)
  if (!m) {
    // Faces are slightly emissive so they stay the brightest thing under the lamp and land ABOVE
    // the dark-snap threshold of the post pass (legibility rule) — but not so much that a card
    // lying flat right under the lamp burns out: the diffuse is dimmed so the paper reads cream
    // with its ink and colours intact (no zoom needed).
    const map = toTexture(drawFace(suit, rank))
    m = new THREE.MeshStandardMaterial({ map, color: FACE_TINT, roughness: 0.8, emissive: 0xffffff, emissiveMap: map, emissiveIntensity: 0.12 })
    faceCache.set(key, m)
  }
  return m
}

export interface CardView {
  root: THREE.Group
  setIdentity(suit: Suit, rank: Rank): void
  forget(): void // back on both sides again (card returned to the deck)
  /**
   * Bends the card along its length, as cardboard does: held by its top edge (+y), its bottom end deflected by
   * `tip` metres along its face's normal (+z; negative: toward its back). 0: flat.
   */
  bend(tip: number): void
  readonly bent: number
}

// A card whose identity is UNKNOWN until setIdentity() — remote cards start as back-only,
// exactly like the network model (identity only arrives with the reveal event).
export function makeCard(): CardView {
  const root = new THREE.Group()
  // each card has its own two sheets (it bends on its own); the back is turned half round, so its z runs the other way
  const faceGeo = new THREE.PlaneGeometry(CARD_W, CARD_H, 1, SEGS)
  const backGeo = new THREE.PlaneGeometry(CARD_W, CARD_H, 1, SEGS)
  const back = new THREE.Mesh(backGeo, backMat)
  back.rotation.y = Math.PI
  const face = new THREE.Mesh(faceGeo, backMat) // placeholder: back texture on both sides
  back.castShadow = face.castShadow = true
  root.add(face, back)
  toProps(root) // drawn smooth with «Bordes suaves»
  let bent = 0
  function bend(tip: number) {
    if (Math.abs(tip - bent) < 1e-5) return
    bent = Math.abs(tip) < 1e-5 ? 0 : tip
    for (const [g, sign] of [[faceGeo, 1], [backGeo, -1]] as const) {
      const pos = g.getAttribute('position')
      for (let i = 0; i < pos.count; i++) {
        const u = (CARD_H / 2 - pos.getY(i)) / CARD_H // 0 at the held edge, 1 at the far end
        pos.setZ(i, sign * bent * u * u)
      }
      pos.needsUpdate = true
      g.computeVertexNormals()
      g.computeBoundingSphere()
    }
  }
  return {
    root,
    setIdentity(suit, rank) {
      face.material = faceMat(suit, rank)
    },
    forget() {
      face.material = backMat
      bend(0)
    },
    bend,
    get bent() {
      return bent
    },
  }
}
