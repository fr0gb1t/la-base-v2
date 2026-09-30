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
  kind?: 'tag' | 'stamp' | 'chip'
  at: [number, number] // table x, z
  selected?: boolean
  disabled?: boolean
  onPick: () => void
}

const PX_PER_M = 1400
const FONT = '"IM Fell English SC", Georgia, serif'

function texture(item: FloatItem) {
  const kind = item.kind ?? 'tag'
  const cv = document.createElement('canvas')
  const g = cv.getContext('2d')!
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
  g.fillText(item.label, cv.width / 2, kind === 'chip' ? 68 : item.sub ? h * 0.4 : h / 2 + 2)
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
  lift: number
  phase: number
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
      const mat = new THREE.MeshStandardMaterial({ map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.3, roughness: 0.85, transparent: def.kind === 'chip', side: THREE.DoubleSide })
      const mesh = new THREE.Mesh(geo, mat)
      mesh.castShadow = true
      const hit = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }))
      hit.visible = false
      hit.userData.floatId = def.id
      this.group.add(mesh, hit)
      this.live.set(def.id, { def, key, mesh, hit, lift: cur?.lift ?? 0, phase: Math.random() * 6 })
    }
    for (const [id, l] of this.live) if (!seen.has(id)) this.remove(l)
  }

  private remove(l: Live) {
    this.group.remove(l.mesh, l.hit)
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
      const rest = new THREE.Vector3(l.def.at[0], TABLE_Y + 0.025 + h / 2, l.def.at[1])
      l.hit.position.copy(rest)
      l.hit.lookAt(camera.position)
      l.hit.updateMatrixWorld()
      if (!l.def.disabled) targets.push(l.hit)
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
      const mat = l.mesh.material as THREE.MeshStandardMaterial
      mat.emissiveIntensity = l.def.disabled ? 0.08 : 0.3 + l.lift * 0.35
      mat.opacity = l.def.disabled ? 0.45 : 1
      mat.transparent = l.def.disabled || l.def.kind === 'chip'
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
