import * as THREE from 'three'
import { CARD_W, CARD_H } from './seats'
import { drawFace, toTexture, type Rank, type Suit } from './cardFace'
import { backTexture } from './cardBacks'
import { toProps } from './propsLayer'

const geo = new THREE.PlaneGeometry(CARD_W, CARD_H)
const backMat = new THREE.MeshStandardMaterial({ map: backTexture(), roughness: 0.85 })
const FACE_TINT = 0xa8a398 // multiplies the face print: ~0.65
const faceCache = new Map<string, THREE.MeshStandardMaterial>()

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
}

// A card whose identity is UNKNOWN until setIdentity() — remote cards start as back-only,
// exactly like the network model (identity only arrives with the reveal event).
export function makeCard(): CardView {
  const root = new THREE.Group()
  const back = new THREE.Mesh(geo, backMat)
  back.rotation.y = Math.PI
  const face = new THREE.Mesh(geo, backMat) // placeholder: back texture on both sides
  back.castShadow = face.castShadow = true
  root.add(face, back)
  toProps(root) // drawn smooth with «Bordes suaves»
  return {
    root,
    setIdentity(suit, rank) {
      face.material = faceMat(suit, rank)
    },
    forget() {
      face.material = backMat
    },
  }
}
