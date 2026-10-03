import * as THREE from 'three'
import { PALETTE, hex } from './look'
import { CHAIR_R } from './seats'
import { isTouch } from '../lib/device'

// The in-game controls as a slate hanging at the back of the room (anotador, historial, reglas,
// ajustes, salir): round chalk buttons, the name written beneath the one under the pointer. It
// hangs above everybody's heads on two chains, so no seat count can stand in front of it, and is
// lit by a little lamp of its own.

export interface HudItem {
  id: string
  label: string // shown under the button while the pointer is on it
  hint?: string // longer description for the caption
  svg: string // the icon, as an SVG string (its colour is set here)
  danger?: boolean // chalked in red
}

const BOARD_W = 1.8
const BOARD_H = 0.5
const ICON_D = 0.21
const SPACING = 0.34
const FONT = '"IM Fell English SC", Georgia, serif'
const RED = '#c2483c'
const SLATE_Y = 1.7 // centre height: above the heads, inside the default view
const WALL_Z = -(CHAIR_R + 0.78) // behind the far chairs

function chalkRing(g: CanvasRenderingContext2D, size: number, color: string, w: number, seed: number) {
  // a hand-drawn ring: two passes, slightly off, not quite closed
  g.strokeStyle = color
  g.lineCap = 'round'
  for (let pass = 0; pass < 2; pass++) {
    g.lineWidth = w * (pass ? 0.55 : 1)
    g.globalAlpha = pass ? 0.6 : 0.95
    g.beginPath()
    const r = size * 0.43 + pass * 3
    for (let a = 0.25 + pass * 0.3; a < Math.PI * 2 + 0.05 + pass * 0.2; a += 0.12) {
      const wob = Math.sin(a * 3 + seed + pass) * 2.2
      const x = size / 2 + Math.cos(a) * (r + wob)
      const y = size / 2 + Math.sin(a) * (r + wob)
      if (a === 0.25 + pass * 0.3) g.moveTo(x, y)
      else g.lineTo(x, y)
    }
    g.stroke()
  }
  g.globalAlpha = 1
}

function iconTexture(item: HudItem, hot: boolean): Promise<THREE.CanvasTexture> {
  const size = 256
  const cv = document.createElement('canvas')
  cv.width = cv.height = size
  const g = cv.getContext('2d')!
  const color = item.danger ? RED : PALETTE.chalk
  const tex = new THREE.CanvasTexture(cv)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  if (hot) {
    g.beginPath()
    g.arc(size / 2, size / 2, size * 0.41, 0, Math.PI * 2)
    g.fillStyle = item.danger ? 'rgba(194,72,60,0.22)' : 'rgba(207,198,168,0.2)'
    g.fill()
  }
  chalkRing(g, size, color, hot ? 11 : 8, item.id.length)
  const svg = item.svg.replace(/currentColor/g, color).replace(/ (width|height)="[^"]*"/g, '').replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"')
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const s = size * 0.5
      g.globalAlpha = hot ? 1 : 0.9
      g.drawImage(img, (size - s) / 2, (size - s) / 2, s, s)
      g.globalAlpha = 1
      tex.needsUpdate = true
      resolve(tex)
    }
    img.onerror = () => { console.warn('[hud] icon failed', item.id, svg.slice(0, 160)); resolve(tex) }
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  })
}

function labelTexture(text: string, color: string) {
  const cv = document.createElement('canvas')
  const g = cv.getContext('2d')!
  g.font = `64px ${FONT}`
  cv.width = Math.ceil(g.measureText(text).width + 24)
  cv.height = 88
  g.font = `64px ${FONT}`
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillStyle = color
  g.fillText(text, cv.width / 2, 46)
  const t = new THREE.CanvasTexture(cv)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  return { t, aspect: cv.width / cv.height }
}

/** The slate itself: dark with chalk-dust smudges where it has been wiped. */
function slateTexture() {
  const cv = document.createElement('canvas')
  cv.width = 512
  cv.height = 160
  const g = cv.getContext('2d')!
  g.fillStyle = '#2b3431'
  g.fillRect(0, 0, 512, 160)
  let seed = 11
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  for (let i = 0; i < 26; i++) {
    g.fillStyle = `rgba(207,198,168,${0.025 + rnd() * 0.05})`
    g.beginPath()
    g.ellipse(rnd() * 512, rnd() * 160, 30 + rnd() * 90, 8 + rnd() * 24, rnd() * 3, 0, Math.PI * 2)
    g.fill()
  }
  const t = new THREE.CanvasTexture(cv)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

interface Live {
  item: HudItem
  key: string
  base: THREE.Mesh
  hot: THREE.Mesh
  label: THREE.Mesh
  hit: THREE.Mesh
  x: number
  glow: number // 0–1 eased hover
}

export class HudBoard {
  readonly group = new THREE.Group()
  hovered: string | null = null
  private live = new Map<string, Live>()
  private disposables: Array<{ dispose(): void }> = []

  constructor() {
    const wood = new THREE.MeshStandardMaterial({ color: hex(PALETTE.walnut), roughness: 0.6 })
    const frame = new THREE.Mesh(new THREE.BoxGeometry(BOARD_W + 0.08, BOARD_H + 0.08, 0.04), wood)
    const slateTex = slateTexture()
    const slate = new THREE.Mesh(new THREE.PlaneGeometry(BOARD_W, BOARD_H), new THREE.MeshStandardMaterial({ map: slateTex, roughness: 0.9, emissive: 0x2a3633, emissiveIntensity: 0.6 }))
    slate.position.z = 0.022
    this.group.add(frame, slate)
    // the two chains it hangs by, lost in the dark above
    const chain = new THREE.MeshStandardMaterial({ color: 0x3a342e, roughness: 0.5, metalness: 0.5 })
    for (const x of [-BOARD_W * 0.42, BOARD_W * 0.42]) {
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 2, 6), chain)
      c.position.set(x, BOARD_H / 2 + 1, 0)
      this.group.add(c)
    }
    // its own lamp, from above and in front: warm, close, small
    const lamp = new THREE.PointLight(hex(PALETTE.amber), 1.6, 2.4, 1.6)
    lamp.position.set(0, BOARD_H / 2 + 0.35, 0.7)
    this.group.add(lamp)
    this.group.position.set(0, SLATE_Y, WALL_Z)
    this.disposables.push(slateTex, frame.geometry, slate.geometry, wood, chain, slate.material as THREE.Material)
  }

  /** The buttons (replaces the previous set; unchanged ones keep their pictures). */
  set(items: HudItem[]) {
    const n = items.length
    const seen = new Set<string>()
    items.forEach((item, i) => {
      seen.add(item.id)
      const key = `${item.label}|${item.danger}|${item.svg.length}`
      const x = (i - (n - 1) / 2) * SPACING
      const cur = this.live.get(item.id)
      if (cur && cur.key === key) {
        cur.item = item
        cur.x = x
        return
      }
      if (cur) this.remove(cur)
      this.live.set(item.id, this.build(item, key, x))
    })
    for (const [id, l] of this.live) if (!seen.has(id)) this.remove(l)
  }

  private build(item: HudItem, key: string, x: number): Live {
    const plane = (tex: THREE.Texture | null, opacity: number) =>
      new THREE.Mesh(new THREE.PlaneGeometry(ICON_D, ICON_D), new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity, depthWrite: false, fog: false, color: new THREE.Color(0.92, 0.92, 0.92) }))
    const base = plane(null, 1)
    const hot = plane(null, 0)
    void iconTexture(item, false).then((t) => { (base.material as THREE.MeshBasicMaterial).map = t; (base.material as THREE.Material).needsUpdate = true })
    void iconTexture(item, true).then((t) => { (hot.material as THREE.MeshBasicMaterial).map = t; (hot.material as THREE.Material).needsUpdate = true })
    const { t, aspect } = labelTexture(item.label, item.danger ? RED : PALETTE.chalk)
    const label = new THREE.Mesh(new THREE.PlaneGeometry(0.11 * aspect, 0.11), new THREE.MeshBasicMaterial({ map: t, transparent: true, opacity: 0, depthWrite: false, fog: false }))
    label.position.set(x, -BOARD_H / 2 + 0.08, 0.03)
    base.position.set(x, 0.06, 0.03)
    hot.position.set(x, 0.06, 0.031)
    const hit = new THREE.Mesh(new THREE.CircleGeometry(ICON_D * (isTouch ? 0.8 : 0.55), 20), new THREE.MeshBasicMaterial({ visible: false }))
    hit.position.set(x, 0.06, 0.032)
    hit.userData.hudId = item.id
    this.group.add(base, hot, label, hit)
    return { item, key, base, hot, label, hit, x, glow: 0 }
  }

  private remove(l: Live) {
    this.group.remove(l.base, l.hot, l.label, l.hit)
    for (const m of [l.base, l.hot, l.label]) {
      const mat = m.material as THREE.MeshBasicMaterial
      mat.map?.dispose()
      mat.dispose()
      m.geometry.dispose()
    }
    l.hit.geometry.dispose()
    ;(l.hit.material as THREE.Material).dispose()
    this.live.delete(l.item.id)
  }

  /** Per frame: ease the hover glow; returns the button under the ray (null when `enabled` is off). */
  update(dt: number, raycaster: THREE.Raycaster, enabled: boolean): string | null {
    this.group.updateMatrixWorld(true)
    const hit = enabled ? raycaster.intersectObjects([...this.live.values()].map((l) => l.hit), false)[0] : undefined
    this.hovered = hit ? (hit.object.userData.hudId as string) : null
    for (const l of this.live.values()) {
      const on = this.hovered === l.item.id
      l.glow += ((on ? 1 : 0) - l.glow) * Math.min(1, dt * 14)
      for (const m of [l.base, l.hot, l.hit]) m.position.x = l.x
      l.label.position.x = l.x
      const s = 1 + l.glow * 0.1
      l.base.scale.setScalar(s)
      l.hot.scale.setScalar(s)
      ;(l.hot.material as THREE.MeshBasicMaterial).opacity = l.glow
      ;(l.base.material as THREE.MeshBasicMaterial).opacity = 1 - l.glow * 0.4
      ;(l.label.material as THREE.MeshBasicMaterial).opacity = l.glow
    }
    return this.hovered
  }

  hint(id: string | null) {
    return id ? this.live.get(id)?.item.hint ?? null : null
  }

  /** Screen point of a button (tests). */
  screenOf(id: string, camera: THREE.Camera, rect: DOMRect) {
    const l = this.live.get(id)
    if (!l) return null
    this.group.updateMatrixWorld(true)
    const p = l.hit.getWorldPosition(new THREE.Vector3()).project(camera)
    return { x: rect.left + ((p.x + 1) / 2) * rect.width, y: rect.top + ((1 - p.y) / 2) * rect.height }
  }

  dispose() {
    for (const l of [...this.live.values()]) this.remove(l)
    this.disposables.forEach((d) => d.dispose())
  }
}
