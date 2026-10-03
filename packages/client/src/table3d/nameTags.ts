import * as THREE from 'three'
import { PALETTE } from './look'

// Player names floating in front of each body at belly height, in the team's colour. They turn
// to face your camera (mostly), keeping a slight tilt from where the player sits.

const TEAM_COLOR = { nosotros: PALETTE.teal, ellos: PALETTE.rose, random: PALETTE.chalk } as const
type Team = keyof typeof TEAM_COLOR

const FACE_CAMERA = 0.85 // 1 = perfectly flat to you, 0 = aligned with the seat
const H = 0.07 // metres, text height
/** Where names float: in front of each body at belly height, over the table edge. */
export const TAG_Y = 0.84
export const TAG_R_OFFSET = 0.15 // past the table edge (never inside the body)

export class NameTag {
  mesh: THREE.Mesh
  private cv = document.createElement('canvas')
  private tex: THREE.CanvasTexture
  private key = ''
  private seatQuat = new THREE.Quaternion()

  /** `height`: metres of text (smaller in the menus, where the room must breathe). */
  constructor(private height = H) {
    this.cv.width = 512
    this.cv.height = 96
    this.tex = new THREE.CanvasTexture(this.cv)
    this.tex.colorSpace = THREE.SRGBColorSpace
    this.tex.anisotropy = 4
    // unlit: names must read in the dark around the table, but dimmed to sit in the scene
    // drawn over everything (no depth test): the hands holding cards sit right where the belly is,
    // and a name must always read
    const mat = new THREE.MeshBasicMaterial({ map: this.tex, transparent: true, depthWrite: false, depthTest: false, color: new THREE.Color(0.85, 0.85, 0.85) })
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat)
    this.mesh.renderOrder = 9000 // names are drawn over everything (they ignore depth)
  }

  set(name: string, team: Team, connected: boolean) {
    const key = `${name}|${team}|${connected}`
    if (key === this.key) return
    this.key = key
    const g = this.cv.getContext('2d')!
    g.clearRect(0, 0, this.cv.width, this.cv.height)
    g.font = '64px "IM Fell English SC", Georgia, serif'
    const text = connected ? name : `${name} (se fue)`
    const w = Math.min(this.cv.width - 20, g.measureText(text).width)
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.lineJoin = 'round'
    g.lineWidth = 10
    g.strokeStyle = 'rgba(11,9,8,0.9)' // dark halo so it reads over the felt and the coat
    g.strokeText(text, 256, 50, this.cv.width - 20)
    g.fillStyle = TEAM_COLOR[team]
    g.globalAlpha = connected ? 1 : 0.55
    g.fillText(text, 256, 50, this.cv.width - 20)
    g.globalAlpha = 1
    this.tex.needsUpdate = true
    const aspect = (w + 40) / this.cv.height
    this.mesh.scale.set(this.height * aspect * (this.cv.height / 64), this.height * (this.cv.height / 64), 1)
    // crop the plane to the text width by adjusting UVs
    const u = (w + 40) / this.cv.width / 2
    const uv = this.mesh.geometry.attributes.uv as THREE.BufferAttribute
    uv.setXY(0, 0.5 - u, 1)
    uv.setXY(1, 0.5 + u, 1)
    uv.setXY(2, 0.5 - u, 0)
    uv.setXY(3, 0.5 + u, 0)
    uv.needsUpdate = true
  }

  /** `at`: belly point in world space; `seatYaw`: the direction the player faces. */
  place(at: THREE.Vector3, seatYaw: number, camera: THREE.Camera) {
    this.mesh.position.copy(at)
    this.seatQuat.setFromEuler(new THREE.Euler(0, seatYaw + Math.PI, 0)) // text faces the table centre
    const look = new THREE.Matrix4().lookAt(camera.position, at, new THREE.Vector3(0, 1, 0))
    const toCam = new THREE.Quaternion().setFromRotationMatrix(look)
    this.mesh.quaternion.copy(this.seatQuat).slerp(toCam, FACE_CAMERA)
  }

  dispose() {
    this.tex.dispose()
    ;(this.mesh.material as THREE.Material).dispose()
    this.mesh.geometry.dispose()
  }
}
