import * as THREE from 'three'
import { PALETTE, SUIT_INK, hex } from './look'
import { TABLE_Y } from './seats'

// The anotador as an object on the table: a small spiral notepad with a pencil lying across it,
// diagonal to the little heap of beans. Click it (or press H) and the real scoresheet opens, floating
// in the middle of the screen (components/Anotador.tsx).

const W = 0.12 // pad size (m)
const D = 0.165
const T = 0.012
// opposite corner of the centre from the bean heap (which lies at +x, -z)
export const NOTEPAD_AT = new THREE.Vector3(-0.2, 0, 0.17)
const YAW = 0.5 // turned toward you a little

/** Ruled paper with a few pencil scribbles (no text: it must read as a notepad, not as a sheet). */
function paperTexture() {
  const cv = document.createElement('canvas')
  cv.width = 240
  cv.height = 330
  const g = cv.getContext('2d')!
  g.fillStyle = PALETTE.bone
  g.fillRect(0, 0, cv.width, cv.height)
  let seed = 5
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  // ruled lines and the margin
  g.strokeStyle = 'rgba(70, 90, 120, 0.45)'
  g.lineWidth = 2
  for (let y = 60; y < cv.height - 10; y += 26) {
    g.beginPath()
    g.moveTo(10, y)
    g.lineTo(cv.width - 10, y)
    g.stroke()
  }
  g.strokeStyle = 'rgba(160, 60, 50, 0.55)'
  g.beginPath()
  g.moveTo(44, 12)
  g.lineTo(44, cv.height - 8)
  g.stroke()
  // pencil: tally marks (four and a slash) and a couple of figures
  g.strokeStyle = 'rgba(30, 24, 20, 0.85)'
  g.lineWidth = 4
  g.lineCap = 'round'
  const stroke = (x1: number, y1: number, x2: number, y2: number) => {
    g.beginPath()
    g.moveTo(x1 + rnd() * 3, y1 + rnd() * 3)
    g.quadraticCurveTo((x1 + x2) / 2 + rnd() * 5, (y1 + y2) / 2 + rnd() * 5, x2 + rnd() * 3, y2 + rnd() * 3)
    g.stroke()
  }
  for (const row of [0, 1]) {
    const y = 82 + row * 52
    for (let k = 0; k < 4; k++) stroke(62 + k * 15, y, 62 + k * 15 + rnd() * 3, y + 20)
    stroke(58, y + 16, 124, y + 2)
    for (let k = 0; k < 2 - row; k++) stroke(146 + k * 15, y, 146 + k * 15, y + 20)
  }
  g.lineWidth = 3
  g.beginPath()
  g.moveTo(60, 214)
  g.bezierCurveTo(90, 200, 120, 236, 170, 212)
  g.stroke()
  const tex = new THREE.CanvasTexture(cv)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  return tex
}

export class Notepad {
  readonly group = new THREE.Group()
  readonly hit: THREE.Mesh
  hovered = false
  private lift = 0
  private disposables: Array<{ dispose(): void }> = []

  constructor() {
    const paperTex = paperTexture()
    const paper = new THREE.MeshStandardMaterial({ map: paperTex, roughness: 0.9, emissive: 0xffffff, emissiveMap: paperTex, emissiveIntensity: 0.12 })
    const edge = new THREE.MeshStandardMaterial({ color: hex(PALETTE.bone), roughness: 0.95 })
    const card = new THREE.MeshStandardMaterial({ color: hex(PALETTE.oxblood), roughness: 0.8 })
    // the cardboard back, a little bigger, and the sheets on it (the top face carries the picture)
    const back = new THREE.Mesh(new THREE.BoxGeometry(W + 0.01, 0.004, D + 0.01), card)
    back.position.y = 0.002
    const sheets = new THREE.Mesh(new THREE.BoxGeometry(W, T, D), [edge, edge, paper, edge, edge, edge])
    sheets.position.y = 0.004 + T / 2
    for (const m of [back, sheets]) m.castShadow = m.receiveShadow = true
    this.group.add(back, sheets)
    // the spiral: little rings along the top edge
    const wire = new THREE.MeshStandardMaterial({ color: 0x8a8378, roughness: 0.4, metalness: 0.7 })
    const ringGeo = new THREE.TorusGeometry(0.0055, 0.0011, 6, 12)
    for (let i = 0; i < 9; i++) {
      const r = new THREE.Mesh(ringGeo, wire)
      r.position.set(-W / 2 + 0.01 + (i * (W - 0.02)) / 8, 0.012, -D / 2 - 0.001)
      r.rotation.y = Math.PI / 2
      this.group.add(r)
    }
    // the pencil, across the sheets
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.0034, 0.0034, 0.12, 6), new THREE.MeshStandardMaterial({ color: hex(SUIT_INK.oros), roughness: 0.5 }))
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.0034, 0.012, 6), new THREE.MeshStandardMaterial({ color: hex(PALETTE.bone), roughness: 0.9 }))
    const lead = new THREE.Mesh(new THREE.ConeGeometry(0.0013, 0.004, 6), new THREE.MeshStandardMaterial({ color: 0x1a1613 }))
    const eraser = new THREE.Mesh(new THREE.CylinderGeometry(0.0036, 0.0036, 0.009, 6), new THREE.MeshStandardMaterial({ color: hex(PALETTE.rose), roughness: 0.9 }))
    tip.position.y = -0.066
    tip.rotation.z = Math.PI
    lead.position.y = -0.0745
    lead.rotation.z = Math.PI
    eraser.position.y = 0.0645
    const pencil = new THREE.Group()
    pencil.add(body, tip, lead, eraser)
    pencil.position.set(0.028, 0.004 + T + 0.0036, 0.016)
    pencil.rotation.set(0, 0, Math.PI / 2) // lying along x…
    pencil.rotateOnWorldAxis(new THREE.Vector3(0, 1, 0), -0.55) // …slanted across the pad
    pencil.traverse((o) => (o.castShadow = true))
    this.group.add(pencil)
    this.hit = new THREE.Mesh(new THREE.BoxGeometry(W + 0.03, 0.04, D + 0.03), new THREE.MeshBasicMaterial({ visible: false }))
    this.hit.position.y = 0.02
    this.group.add(this.hit)
    this.group.position.set(NOTEPAD_AT.x, TABLE_Y, NOTEPAD_AT.z)
    this.group.rotation.y = YAW
    this.disposables.push(paperTex, paper, edge, card, wire, ringGeo, back.geometry, sheets.geometry, this.hit.geometry)
  }

  /** Per frame: a little lift (and a warm glow) while the pointer is on it. */
  update(dt: number) {
    this.lift += ((this.hovered ? 1 : 0) - this.lift) * Math.min(1, dt * 12)
    this.group.position.y = TABLE_Y + this.lift * 0.012
    this.group.rotation.y = YAW - this.lift * 0.06
  }

  dispose() {
    this.group.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose()
        const m = o.material
        ;(Array.isArray(m) ? m : [m]).forEach((x) => x.dispose())
      }
    })
    this.disposables.forEach((d) => d.dispose())
  }
}
