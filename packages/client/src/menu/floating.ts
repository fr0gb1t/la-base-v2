import * as THREE from 'three'
import { TABLE_Y } from '../table3d/seats'
import { PALETTE, SUIT_INK } from '../table3d/look'

// Floating buttons on the felt: paper tags, oxblood stamps (primary actions) and round chips
// (numbers). They hover over the table facing the viewer, lift and glow under the cursor.
// Hover is tested against an invisible twin at the REST pose (no flicker from the lift/bob).

export interface FloatItem {
  id: string
  label: string
  sub?: string
  hint?: string // longer description shown in the caption while hovered
  kind?: 'tag' | 'stamp' | 'chip' | 'label' // label: a chalked title, not a button
  icon?: 'plane' // a small engraved glyph above the label (chips)
  raise?: number // labels: metres above the row they name (default LABEL_RAISE)
  at: [number, number] // table x, z
  selected?: boolean
  disabled?: boolean
  onPick: () => void
}

const PX_PER_M = 1400
const LABEL_RAISE = 0.1 // m above the buttons it names
const FONT = '"IM Fell English SC", Georgia, serif'

/** A small propeller plane seen from above (the kamikaze token). */
export function plane(g: CanvasRenderingContext2D, cx: number, cy: number, s: number, color: string) {
  // a WWII-style monoplane seen from above, nose up: swept wings, round cowling, tailplane, prop
  g.save()
  g.translate(cx, cy)
  g.fillStyle = color
  g.beginPath() // fuselage: round cowling tapering to the tail
  g.moveTo(0, -s * 0.5)
  g.bezierCurveTo(s * 0.13, -s * 0.5, s * 0.12, -s * 0.1, s * 0.05, s * 0.45)
  g.lineTo(-s * 0.05, s * 0.45)
  g.bezierCurveTo(-s * 0.12, -s * 0.1, -s * 0.13, -s * 0.5, 0, -s * 0.5)
  g.fill()
  g.beginPath() // wings, swept back with rounded tips
  g.moveTo(-s * 0.08, -s * 0.2)
  g.lineTo(-s * 0.62, -s * 0.02)
  g.quadraticCurveTo(-s * 0.68, s * 0.08, -s * 0.56, s * 0.08)
  g.lineTo(-s * 0.08, s * 0.02)
  g.lineTo(s * 0.08, s * 0.02)
  g.lineTo(s * 0.56, s * 0.08)
  g.quadraticCurveTo(s * 0.68, s * 0.08, s * 0.62, -s * 0.02)
  g.lineTo(s * 0.08, -s * 0.2)
  g.closePath()
  g.fill()
  g.beginPath() // tailplane
  g.moveTo(-s * 0.04, s * 0.3)
  g.lineTo(-s * 0.26, s * 0.42)
  g.lineTo(-s * 0.24, s * 0.49)
  g.lineTo(s * 0.24, s * 0.49)
  g.lineTo(s * 0.26, s * 0.42)
  g.lineTo(s * 0.04, s * 0.3)
  g.closePath()
  g.fill()
  g.lineWidth = Math.max(1.5, s * 0.05) // propeller blur
  g.strokeStyle = color
  g.beginPath()
  g.moveTo(-s * 0.24, -s * 0.55)
  g.lineTo(s * 0.24, -s * 0.55)
  g.stroke()
  g.restore()
}

/** A title written in chalk, floating over a group of buttons (transparent, no frame). */
function labelTexture(text: string) {
  const cv = document.createElement('canvas')
  const g = cv.getContext('2d')!
  const font = `46px ${FONT}`
  g.font = font
  cv.width = Math.ceil(g.measureText(text).width + 30)
  cv.height = 68
  g.font = font
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  // bone letters with an ink edge: they must read over the bright felt under the lamp
  g.lineJoin = 'round'
  g.lineWidth = 8
  g.strokeStyle = PALETTE.ink
  g.strokeText(text, cv.width / 2, 36)
  g.fillStyle = PALETTE.bone
  g.fillText(text, cv.width / 2, 36)
  const t = new THREE.CanvasTexture(cv)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  return { t, w: cv.width / PX_PER_M, h: cv.height / PX_PER_M }
}

function texture(item: FloatItem) {
  const kind = item.kind ?? 'tag'
  const cv = document.createElement('canvas')
  const g = cv.getContext('2d')!
  if (kind === 'label') return labelTexture(item.label)
  const title = `${kind === 'chip' ? 64 : 44}px ${FONT}`
  g.font = title
  const tw = g.measureText(item.label).width
  g.font = `26px ${FONT}`
  const sw = item.sub ? g.measureText(item.sub).width : 0
  const w = kind === 'chip' ? 128 : Math.max(tw, sw) + 70
  const h = kind === 'chip' ? 128 : item.sub ? 118 : 86
  cv.width = Math.ceil(w)
  cv.height = h
  const bg = kind === 'stamp' ? PALETTE.oxblood : PALETTE.bone
  const ink = kind === 'stamp' ? PALETTE.bone : PALETTE.ink
  if (kind === 'chip') {
    g.beginPath()
    g.arc(64, 64, 58, 0, Math.PI * 2)
    g.fillStyle = item.selected ? PALETTE.bone : '#2a221c'
    g.fill()
    g.lineWidth = 6
    g.strokeStyle = item.selected ? SUIT_INK.oros : PALETTE.chalk
    g.stroke()
    g.beginPath()
    g.arc(64, 64, 46, 0, Math.PI * 2)
    g.lineWidth = 2
    g.stroke()
    g.fillStyle = item.selected ? PALETTE.ink : PALETTE.bone
  } else {
    g.fillStyle = bg
    g.fillRect(0, 0, cv.width, h)
    // foxing + stipple
    for (let i = 0; i < 260; i++) {
      g.fillStyle = `rgba(20,14,12,${kind === 'stamp' ? 0.25 : 0.12})`
      g.fillRect(Math.random() * cv.width, Math.random() * h, 1.5, 1.5)
    }
    g.strokeStyle = ink
    g.lineWidth = 4
    g.strokeRect(6, 6, cv.width - 12, h - 12)
    if (item.selected) {
      g.lineWidth = 3
      g.strokeStyle = SUIT_INK.oros
      g.strokeRect(14, 14, cv.width - 28, h - 28)
    }
    g.fillStyle = ink
  }
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.font = title
  if (item.icon === 'plane' && kind === 'chip') {
    plane(g, 64, 42, 48, g.fillStyle as string)
    g.font = `42px ${FONT}`
    g.fillText(item.label, 64, 94)
  } else g.fillText(item.label, cv.width / 2, kind === 'chip' ? 68 : item.sub ? h * 0.4 : h / 2 + 2)
  if (item.sub && kind !== 'chip') {
    g.font = `26px ${FONT}`
    g.globalAlpha = 0.75
    g.fillText(item.sub, cv.width / 2, h * 0.74)
    g.globalAlpha = 1
  }
  const t = new THREE.CanvasTexture(cv)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  return { t, w: cv.width / PX_PER_M, h: h / PX_PER_M }
}

interface Live {
  def: FloatItem
  key: string
  mesh: THREE.Mesh
  hit: THREE.Mesh
  blob: THREE.Mesh | null
  lift: number
  phase: number
}

let blobTex: THREE.Texture | null = null
function blobTexture() {
  if (blobTex) return blobTex
  const cv = document.createElement('canvas')
  cv.width = cv.height = 64
  const g = cv.getContext('2d')!
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32)
  grd.addColorStop(0, 'rgba(0,0,0,0.75)')
  grd.addColorStop(0.6, 'rgba(0,0,0,0.35)')
  grd.addColorStop(1, 'rgba(0,0,0,0)')
  g.fillStyle = grd
  g.fillRect(0, 0, 64, 64)
  blobTex = new THREE.CanvasTexture(cv)
  return blobTex
}

export class FloatingItems {
  group = new THREE.Group()
  private live = new Map<string, Live>()
  hovered: string | null = null

  set(items: FloatItem[]) {
    const seen = new Set<string>()
    for (const def of items) {
      seen.add(def.id)
      const key = `${def.label}|${def.sub}|${def.kind}|${def.selected}|${def.disabled}`
      const cur = this.live.get(def.id)
      if (cur && cur.key === key) {
        cur.def = def
        continue
      }
      if (cur) this.remove(cur)
      const { t, w, h } = texture(def)
      const geo = new THREE.PlaneGeometry(w, h)
      const flat = def.kind === 'chip' || def.kind === 'label'
      const mat = new THREE.MeshStandardMaterial({ map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.3, roughness: 0.85, transparent: flat, side: THREE.DoubleSide })
      const mesh = new THREE.Mesh(geo, mat)
      // a vertical chip lit from above would cast a thin bar: round chips get a soft round contact
      // shadow on the felt instead (tags keep their real, rectangular shadow)
      mesh.castShadow = !flat
      let blob: THREE.Mesh | null = null
      if (def.kind === 'chip') {
        blob = new THREE.Mesh(new THREE.CircleGeometry(w * 0.55, 32), new THREE.MeshBasicMaterial({ map: blobTexture(), transparent: true, depthWrite: false }))
        blob.rotation.x = -Math.PI / 2
        this.group.add(blob)
      }
      const hit = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }))
      hit.visible = false
      hit.userData.floatId = def.id
      this.group.add(mesh, hit)
      this.live.set(def.id, { def, key, mesh, hit, blob, lift: cur?.lift ?? 0, phase: Math.random() * 6 })
    }
    for (const [id, l] of this.live) if (!seen.has(id)) this.remove(l)
  }

  private remove(l: Live) {
    this.group.remove(l.mesh, l.hit)
    if (l.blob) this.group.remove(l.blob)
    ;(l.mesh.material as THREE.MeshStandardMaterial).map?.dispose()
    ;(l.mesh.material as THREE.Material).dispose()
    l.mesh.geometry.dispose()
    this.live.delete(l.def.id)
  }

  /** Per frame: pose every item facing the camera; hover against the rest-pose twins. */
  update(time: number, camera: THREE.Camera, raycaster: THREE.Raycaster, calm: boolean) {
    const targets: THREE.Object3D[] = []
    for (const l of this.live.values()) {
      const h = (l.mesh.geometry as THREE.PlaneGeometry).parameters.height
      // a label sits over the row of buttons it names (same depth, one button higher)
      const raise = l.def.kind === 'label' ? l.def.raise ?? LABEL_RAISE : 0
      const rest = new THREE.Vector3(l.def.at[0], TABLE_Y + 0.025 + h / 2 + raise, l.def.at[1])
      l.hit.position.copy(rest)
      l.hit.lookAt(camera.position)
      l.hit.updateMatrixWorld()
      if (!l.def.disabled && l.def.kind !== 'label') targets.push(l.hit)
    }
    const hit = raycaster.intersectObjects(targets, false)[0]
    this.hovered = hit ? (hit.object.userData.floatId as string) : null
    for (const l of this.live.values()) {
      const on = this.hovered === l.def.id
      l.lift += ((on ? 1 : 0) - l.lift) * 0.2
      const bob = calm ? 0 : Math.sin(time * 1.4 + l.phase) * 0.004
      l.mesh.position.copy(l.hit.position).add(new THREE.Vector3(0, l.lift * 0.02 + bob, 0))
      l.mesh.quaternion.copy(l.hit.quaternion)
      l.mesh.scale.setScalar(1 + l.lift * 0.08)
      if (l.blob) {
        l.blob.position.set(l.def.at[0], TABLE_Y + 0.002, l.def.at[1])
        const k = 1 - l.lift * 0.25 // higher chip → smaller, fainter shadow
        l.blob.scale.set(k, k * 0.75, k)
        ;(l.blob.material as THREE.MeshBasicMaterial).opacity = l.def.disabled ? 0.3 : 0.85 - l.lift * 0.3
      }
      const mat = l.mesh.material as THREE.MeshStandardMaterial
      mat.emissiveIntensity = l.def.kind === 'label' ? 0.55 : l.def.disabled ? 0.08 : 0.3 + l.lift * 0.35
      mat.opacity = l.def.disabled ? 0.45 : 1
      mat.transparent = l.def.disabled || l.def.kind === 'chip' || l.def.kind === 'label'
    }
    return this.hovered
  }

  pick(id: string | null) {
    const l = id ? this.live.get(id) : null
    if (l && !l.def.disabled) l.def.onPick()
  }

  hint(id: string | null) {
    return id ? this.live.get(id)?.def.hint ?? null : null
  }
}
