import * as THREE from 'three'
import { PALETTE, hex } from '../table3d/look'

// A small round side table, off to one side of the main one: each holds one of the menu's
// televisions (ajustes, novedades). Its origin is on the floor under its centre.

export const SIDE_TABLE_H = 0.6 // height of its top
const TOP_R = 0.3

export function buildSideTable(): THREE.Group {
  const g = new THREE.Group()
  const wood = new THREE.MeshStandardMaterial({ color: hex(PALETTE.walnut), roughness: 0.62 })
  const darker = new THREE.MeshStandardMaterial({ color: 0x1d0f08, roughness: 0.7 })
  const top = new THREE.Mesh(new THREE.CylinderGeometry(TOP_R, TOP_R, 0.035, 28), wood)
  top.position.y = SIDE_TABLE_H - 0.0175
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, SIDE_TABLE_H - 0.05, 10), darker)
  post.position.y = (SIDE_TABLE_H - 0.05) / 2 + 0.02
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.03, 20), darker)
  foot.position.y = 0.015
  for (const m of [top, post, foot]) {
    m.castShadow = true
    m.receiveShadow = true
  }
  g.add(top, post, foot)
  g.userData.dispose = () => {
    for (const m of [top, post, foot]) m.geometry.dispose()
    wood.dispose()
    darker.dispose()
  }
  return g
}
