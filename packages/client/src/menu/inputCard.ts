import * as THREE from 'three'
import { TABLE_Y } from '../table3d/seats'
import { PALETTE, SUIT_INK } from '../table3d/look'

// A blank card lying on the felt that you write on (Inscryption's name-the-card moment): the
// label is printed, your text appears in ink as you type, with a blinking nib caret. The real
// input is a hidden DOM <input> (keyboard, IME, mobile) that this card mirrors.

export interface InputCardState {
  label: string
  value: string
  placeholder: string
  focused: boolean
  mono?: boolean // room codes: spaced capitals
  hint?: string // replaces the default 'tocá la carta para escribir' line
}

const W = 600
const H = 900
const SIZE = 0.31 // metres, width

// dims the paper under the lamp so it reads as cream, not white: the writing then keeps its contrast
const PAPER_TINT = 0x9f9a8c

export class InputCard {
  mesh: THREE.Mesh
  hit: THREE.Mesh
  private cv = document.createElement('canvas')
  private tex: THREE.CanvasTexture
  private state: InputCardState | null = null
  private caretOn = true
  private lift = 0

  constructor() {
    this.cv.width = W
    this.cv.height = H
    this.tex = new THREE.CanvasTexture(this.cv)
    this.tex.colorSpace = THREE.SRGBColorSpace
    this.tex.anisotropy = 8
    const geo = new THREE.PlaneGeometry(SIZE, (SIZE * H) / W)
    this.mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: this.tex, color: PAPER_TINT, emissive: 0xffffff, emissiveMap: this.tex, emissiveIntensity: 0, roughness: 0.95 }))
    this.mesh.castShadow = true
    this.hit = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }))
    this.hit.visible = false
    this.mesh.visible = false
  }

  set(s: InputCardState | null) {
    this.state = s
    this.mesh.visible = !!s
    if (s) this.draw()
  }

  private draw() {
    const s = this.state
    if (!s) return
    const g = this.cv.getContext('2d')!
    g.fillStyle = PALETTE.bone
    g.fillRect(0, 0, W, H)
    for (let i = 0; i < 18; i++) {
      g.fillStyle = `rgba(90,60,30,${0.03 + ((i * 37) % 7) * 0.01})`
      g.beginPath()
      g.arc((i * 131) % W, (i * 211) % H, 40 + ((i * 53) % 90), 0, Math.PI * 2)
      g.fill()
    }
    g.strokeStyle = PALETTE.ink
    g.lineWidth = 10
    g.strokeRect(24, 24, W - 48, H - 48)
    g.lineWidth = 4
    g.strokeStyle = PALETTE.oxblood
    g.strokeRect(44, 44, W - 88, H - 88)
    // a watching sun at the top (the deck's oros sun)
    const cx = W / 2
    const cy = 190
    g.fillStyle = SUIT_INK.oros
    g.beginPath()
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2
      const r = i % 2 ? 62 : 82
      g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r)
    }
    g.closePath()
    g.fill()
    g.lineWidth = 5
    g.strokeStyle = PALETTE.ink
    g.stroke()
    g.beginPath()
    g.arc(cx, cy, 44, 0, Math.PI * 2)
    g.fillStyle = PALETTE.bone
    g.fill()
    g.stroke()
    g.fillStyle = PALETTE.ink
    g.fillRect(cx - 22, cy - 12, 12, 9)
    g.fillRect(cx + 10, cy - 12, 12, 9)
    g.fillRect(cx - 16, cy + 14, 32, 5)
    // printed label
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillStyle = PALETTE.ink
    g.font = '64px "IM Fell English SC", Georgia, serif'
    g.fillText(s.label, cx, 360)
    // writing line
    g.strokeStyle = 'rgba(20,14,12,0.6)'
    g.lineWidth = 3
    g.beginPath()
    g.moveTo(90, 560)
    g.lineTo(W - 90, 560)
    g.stroke()
    // the written text (or the faint placeholder)
    const text = s.value || s.placeholder
    const size = s.mono ? 112 : text.length > 10 ? 76 : 100
    g.font = s.mono ? `${size}px "VT323", monospace` : `italic ${size}px "IM Fell English", Georgia, serif`
    g.fillStyle = s.value ? PALETTE.ink : 'rgba(20,14,12,0.4)'
    const shown = s.mono ? text.split('').join(' ') : text
    g.fillText(shown, cx, 510)
    if (s.value) {
      // VT323 is hairline-thin: thicken the strokes so the lamp's glare cannot wash them out
      g.lineJoin = 'round'
      g.lineWidth = s.mono ? 5 : 2
      g.strokeStyle = PALETTE.ink
      g.strokeText(shown, cx, 510)
    }
    if (s.focused && this.caretOn) {
      const w = s.value ? g.measureText(s.mono ? s.value.split('').join(' ') : s.value).width : 0
      g.fillStyle = PALETTE.oxblood
      g.fillRect(cx + w / 2 + 8, 470, 6, 76)
    }
    g.font = '42px "IM Fell English", Georgia, serif'
    g.fillStyle = PALETTE.ink
    g.fillText(s.hint ?? (s.focused ? 'escribí · enter para confirmar' : 'tocá la carta para escribir'), cx, 700)
    this.tex.needsUpdate = true
  }

  /** Lies on the felt at (x, z), tilted toward the viewer; lifts when hovered. */
  update(time: number, x: number, z: number, hovered: boolean) {
    if (!this.state) return
    const caret = Math.floor(time * 2) % 2 === 0
    if (caret !== this.caretOn && this.state.focused) {
      this.caretOn = caret
      this.draw()
    }
    const tilt = 0.55
    const halfH = (SIZE * H) / W / 2
    const restY = TABLE_Y + 0.004 + Math.sin(tilt) * halfH
    this.hit.position.set(x, restY, z)
    this.hit.rotation.set(-Math.PI / 2 + tilt, 0, 0)
    this.hit.updateMatrixWorld()
    this.lift += ((hovered || this.state.focused ? 1 : 0) - this.lift) * 0.15
    this.mesh.position.set(x, restY + this.lift * 0.015, z)
    this.mesh.rotation.copy(this.hit.rotation)
    ;(this.mesh.material as THREE.MeshStandardMaterial).emissiveIntensity = this.lift * 0.04
  }
}
