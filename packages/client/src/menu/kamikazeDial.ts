import * as THREE from 'three'
import { PALETTE, SUIT_INK } from '../table3d/look'
import { NUMERAL_FONT } from '../table3d/cardFace'
import { TABLE_Y } from '../table3d/seats'

// The kamikaze counter of the game config: a small round badge at the upper right of the plane
// button, like an exponent (the plane to the power of N). Each change of value turns it half a turn about its vertical axis (always the same
// way, like the aces flipping), so the new number comes round on the other face.

const D = 0.05 // diameter (m): smaller than the plane's disc (0.09)
const EXP_DX = 0.056 // where its centre sits relative to the plane's: up and to the right
const EXP_Y = 0.128 // height of its centre above the table
const SPIN = 7 // how fast it turns (eased per second)

function face(value: number) {
  const cv = document.createElement('canvas')
  cv.width = cv.height = 192
  const g = cv.getContext('2d')!
  const lit = value > 0
  g.beginPath()
  g.arc(96, 96, 90, 0, Math.PI * 2)
  g.fillStyle = lit ? PALETTE.bone : '#2a221c'
  g.fill()
  g.lineWidth = 9
  g.strokeStyle = lit ? SUIT_INK.oros : PALETTE.chalk
  g.stroke()
  g.beginPath()
  g.arc(96, 96, 72, 0, Math.PI * 2)
  g.lineWidth = 3
  g.stroke()
  g.fillStyle = lit ? PALETTE.ink : PALETTE.bone
  g.font = `bold 112px ${NUMERAL_FONT}`
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillText(String(value), 96, 104)
  const t = new THREE.CanvasTexture(cv)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  return t
}

export class KamikazeDial {
  readonly group = new THREE.Group() // placed and aimed at the camera exactly like the plane button
  private spinner = new THREE.Group() // the half turns happen here, about the badge's own vertical axis
  private faces: [THREE.Mesh, THREE.Mesh]
  private turns = 0 // half turns made so far
  private angle = 0
  private value = -1
  private at: [number, number] = [0, 0.55]

  constructor() {
    const mk = () =>
      new THREE.Mesh(
        new THREE.CircleGeometry(D / 2, 40),
        new THREE.MeshStandardMaterial({ roughness: 0.85, emissive: 0xffffff, emissiveIntensity: 0.3, transparent: true }),
      )
    this.faces = [mk(), mk()]
    this.faces[1].rotation.y = Math.PI // the other face looks the other way
    this.spinner.add(...this.faces)
    this.group.add(this.spinner)
    this.group.visible = false
  }

  /** Show `value` (0–3) as the exponent of the plane button standing at table spot `at`; a new value turns the badge half a turn. */
  set(value: number, at: [number, number]) {
    this.at = at
    if (value === this.value) return
    const first = this.value < 0
    this.value = value
    if (!first) this.turns++
    const f = this.faces[this.turns % 2]
    const mat = f.material as THREE.MeshStandardMaterial
    mat.map?.dispose()
    mat.map = mat.emissiveMap = face(value)
    mat.needsUpdate = true
    if (first) this.angle = this.turns * Math.PI
  }

  update(dt: number, camera: THREE.Camera, visible: boolean) {
    this.group.visible = visible
    if (!visible) return
    this.angle += (this.turns * Math.PI - this.angle) * Math.min(1, dt * SPIN)
    this.group.position.set(this.at[0] + EXP_DX, TABLE_Y + EXP_Y, this.at[1])
    this.group.lookAt(camera.position) // the same tilt as the plane's disc (the buttons face the camera)
    this.spinner.rotation.y = this.angle
  }

  dispose() {
    for (const f of this.faces) {
      const m = f.material as THREE.MeshStandardMaterial
      m.map?.dispose()
      m.dispose()
      f.geometry.dispose()
    }
  }
}
