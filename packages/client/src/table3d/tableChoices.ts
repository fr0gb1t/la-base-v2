import * as THREE from 'three'
import { FloatingItems, type FloatItem } from '../menu/floating'
import { PALETTE, hex } from './look'
import { TABLE_Y, TABLE_R, PLAY_R, seatAngle, polar } from './seats'

// Decisions taken on the table itself instead of in a flat menu:
//  - As de Copas: two floating tags in front of you (mantener / invertir) and a chalk arrow
//    running round the centre circle that previews the direction of play for the one you point at
//  - As de Oros: a tag floats over each teammate you may pick; click it, or click their face
// Horario = seat index increasing = angle increasing (clockwise seen from above: play passes to
// your left), as on the server.

export type Direction = 'horario' | 'antihorario'
export type CopasChoice = 'mantener' | 'invertir'

const ARROW_R = 0.36 // just outside the centre circle (r 0.3)
const ARROW_SPEED = 0.9 // rad/s

interface Pending {
  ids: string[]
  resolve: (id: string | null) => void
}

export class TableChoices {
  group = new THREE.Group()
  private floating = new FloatingItems()
  private arrows = new THREE.Group()
  private heads = new Map<THREE.Object3D, string>() // pickable faces (As de Oros) → player id
  private pending: Pending | null = null
  private current: Direction | null = null // direction of play while choosing (copas)
  private phase = 0
  hovered: string | null = null

  constructor() {
    this.group.add(this.floating.group, this.arrows)
    const chalk = new THREE.MeshBasicMaterial({ color: new THREE.Color(hex(PALETTE.chalk)).multiplyScalar(1.4), transparent: true, opacity: 0.85, depthWrite: false })
    const ring = new THREE.Mesh(new THREE.RingGeometry(ARROW_R - 0.005, ARROW_R + 0.005, 96), chalk)
    ring.rotation.x = -Math.PI / 2
    this.arrows.add(ring)
    const head = new THREE.Shape([new THREE.Vector2(0.03, 0), new THREE.Vector2(-0.02, 0.026), new THREE.Vector2(-0.02, -0.026)])
    for (let k = 0; k < 4; k++) {
      const m = new THREE.Mesh(new THREE.ShapeGeometry(head), chalk)
      m.rotation.x = -Math.PI / 2
      this.arrows.add(m)
    }
    this.arrows.position.y = TABLE_Y + 0.003
    this.arrows.visible = false
  }

  get active() {
    return this.pending !== null
  }

  /** As de Copas: keep or invert the direction of play (null: you take the card back). */
  askDirection(current: Direction): Promise<CopasChoice | null> {
    const answer = this.ask(
      [
        { id: 'mantener', label: 'Mantener', sub: current, at: [-0.16, 0.4], hint: `el sentido sigue ${current}` },
        { id: 'invertir', label: 'Invertir', kind: 'stamp', sub: flip(current), at: [0.16, 0.4], hint: `el sentido pasa a ${flip(current)} hasta el fin de la ronda` },
        { id: 'no', label: 'no jugarla', at: [0, 0.54], hint: 'la carta vuelve a tu mano' },
      ],
      [],
    )
    this.current = current // after ask(): it clears the previous question
    this.arrows.visible = true
    return answer as Promise<CopasChoice | null>
  }

  /** As de Oros: pick who of your team opens the next base (a tag over their spot, or their face). */
  askOpener(options: Array<{ id: string; name: string; seat: number; head: THREE.Object3D }>, n: number): Promise<string> {
    const items = options.map((o) => {
      const p = polar(PLAY_R - 0.2, seatAngle(o.seat, n), 0)
      // across the table a tag would be tiny: grow it with the distance from your seat
      const far = Math.hypot(p.x, p.z - TABLE_R)
      return { id: o.id, label: o.name, sub: 'abre la próxima base', at: [p.x, p.z] as [number, number], scale: Math.min(2.4, Math.max(1, far / 0.55)), hint: `${o.name} abre la próxima base` }
    })
    return this.ask(items, options.map((o) => [o.head, o.id] as const)) as Promise<string>
  }

  /** Answer the open question from outside (keyboard / screen-reader buttons, tests). */
  choose(id: string | null) {
    const p = this.pending
    if (!p || (id !== null && !p.ids.includes(id))) return
    this.close()
    p.resolve(id === 'no' ? null : id)
  }

  cancel() {
    const p = this.pending
    this.close()
    p?.resolve(null)
  }

  /** Per frame: hover (floating tags first, then faces) and the direction preview. */
  update(time: number, dt: number, camera: THREE.Camera, raycaster: THREE.Raycaster) {
    if (!this.pending) {
      this.hovered = null
      return null
    }
    this.hovered = this.floating.update(time, camera, raycaster, false)
    if (!this.hovered && this.heads.size) {
      const hit = raycaster.intersectObjects([...this.heads.keys()], true)[0]
      let o: THREE.Object3D | null = hit?.object ?? null
      while (o && !this.heads.has(o)) o = o.parent
      this.hovered = o ? this.heads.get(o)! : null
    }
    if (this.current) {
      // preview: the arrows run the way play would go with the option you point at
      const dir = this.hovered === 'invertir' ? flip(this.current) : this.current
      const sign = dir === 'horario' ? 1 : -1
      this.phase += sign * ARROW_SPEED * dt
      const heads = this.arrows.children.slice(1)
      heads.forEach((m, k) => {
        const a = this.phase + (k / heads.length) * Math.PI * 2
        m.position.set(Math.cos(a) * ARROW_R, 0.0005, Math.sin(a) * ARROW_R)
        m.rotation.z = -(a + (sign * Math.PI) / 2) // tangent, pointing the way it runs
      })
      const mat = (this.arrows.children[0] as THREE.Mesh).material as THREE.MeshBasicMaterial
      mat.color.set(hex(this.hovered === 'invertir' ? PALETTE.oxblood : PALETTE.chalk)).multiplyScalar(this.hovered === 'invertir' ? 2.4 : 1.4)
    }
    return this.hovered
  }

  /** A click: picks what is under the pointer. True when it was consumed. */
  click() {
    if (!this.pending || !this.hovered) return Boolean(this.pending)
    this.choose(this.hovered)
    return true
  }

  positionOf(id: string) {
    return this.floating.positionOf(id)
  }

  hint() {
    return this.floating.hint(this.hovered)
  }

  private ask(items: Array<Omit<FloatItem, 'onPick'>>, heads: ReadonlyArray<readonly [THREE.Object3D, string]>) {
    this.cancel()
    this.floating.set(items.map((it) => ({ ...it, onPick: () => this.choose(it.id) })))
    this.heads = new Map(heads)
    return new Promise<string | null>((resolve) => {
      this.pending = { ids: items.map((i) => i.id), resolve }
    })
  }

  private close() {
    this.pending = null
    this.current = null
    this.hovered = null
    this.heads = new Map()
    this.floating.set([])
    this.arrows.visible = false
  }
}

const flip = (d: Direction): Direction => (d === 'horario' ? 'antihorario' : 'horario')
