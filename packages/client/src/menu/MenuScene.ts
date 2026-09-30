import * as THREE from 'three'
import { buildLamp, buildRoom, type SeatLabel } from '../table3d/table'
import { TABLE_Y, CARD_H } from '../table3d/seats'
import { makeAvatar, type Avatar } from '../table3d/avatar'
import { makeCard, type CardView } from '../table3d/cards'
import { drawFace, toTexture, type Rank, type Suit } from '../table3d/cardFace'
import { makePost } from '../table3d/post'
import { PALETTE } from '../table3d/look'

// ---------------------------------------------------------------------------------------------
// The menu is the same basement as the game, before anyone sits down. The camera moves between
// "stations" (one per menu screen) and the options are physical things on the felt: three big
// cards in the lobby, the three powered aces in the config, the players' masks in the room.
// DOM stays the source of truth (forms, buttons, a11y); this only paints and reports hovers.
// ---------------------------------------------------------------------------------------------

export type Station = 'entrada' | 'lobby' | 'crear' | 'unirse' | 'reglas' | 'sala' | 'config'
export interface MenuPlayer { name: string; team: 'nosotros' | 'ellos' | 'random'; isBot?: boolean }
export interface AcePowers { espadas: boolean; copas: boolean; oros: boolean }

interface Shot { pos: THREE.Vector3; target: THREE.Vector3; fov: number }
const SHOTS: Record<Station, Shot> = {
  entrada: { pos: new THREE.Vector3(0, 2.35, 2.1), target: new THREE.Vector3(0, 0.8, 0), fov: 50 },
  lobby: { pos: new THREE.Vector3(0, 1.45, 1.32), target: new THREE.Vector3(0, 0.72, 0.28), fov: 50 },
  crear: { pos: new THREE.Vector3(0, 2.0, 1.85), target: new THREE.Vector3(0, 0.76, 0), fov: 54 },
  unirse: { pos: new THREE.Vector3(0, 2.0, 1.85), target: new THREE.Vector3(0, 0.76, 0), fov: 54 },
  reglas: { pos: new THREE.Vector3(-0.4, 1.25, 1.2), target: new THREE.Vector3(0.3, 0.85, -0.6), fov: 52 },
  // the room panel sits on the right: look a bit right of the table so it lands in the free left area
  sala: { pos: new THREE.Vector3(0.45, 1.7, 1.9), target: new THREE.Vector3(0.45, 1.02, -0.3), fov: 60 },
  config: { pos: new THREE.Vector3(0.3, 1.32, 1.02), target: new THREE.Vector3(0.3, 0.74, 0.1), fov: 50 },
}

export const MENU_OPTIONS: Array<{ id: 'crear' | 'unirse' | 'reglas'; title: string; suit: Suit; rank: Rank }> = [
  { id: 'crear', title: 'Armar mesa', suit: 'oros', rank: 10 },
  { id: 'unirse', title: 'Sentarse', suit: 'copas', rank: 11 },
  { id: 'reglas', title: 'Reglamento', suit: 'espadas', rank: 12 },
]

const ACE_SUITS: Array<keyof AcePowers> = ['espadas', 'copas', 'oros']
const FACE_UP = -Math.PI / 2
const OPTION_SCALE = 1.8 // cards are already 1.75x real size in the game
const FACE_DOWN = Math.PI / 2
const reduced = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches

/** A big option card: a real deck figure with the option's name printed on a banner. */
function optionTexture(suit: Suit, rank: Rank, title: string) {
  const face = drawFace(suit, rank)
  const g = face.getContext('2d')!
  g.setTransform(1, 0, 0, 1, 0, 0) // drawFace leaves a ×2 transform: draw in real pixels
  const W = face.width
  const H = face.height
  g.fillStyle = 'rgba(20,14,12,0.88)'
  g.fillRect(W * 0.08, H * 0.74, W * 0.84, H * 0.15)
  g.strokeStyle = PALETTE.bone
  g.lineWidth = W * 0.008
  g.strokeRect(W * 0.1, H * 0.75, W * 0.8, H * 0.13)
  g.fillStyle = PALETTE.bone
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.font = `${Math.round(W * 0.105)}px "IM Fell English SC", Georgia, serif`
  g.fillText(title, W / 2, H * 0.815)
  return toTexture(face)
}

export class MenuScene {
  private renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' })
  private scene = new THREE.Scene()
  private camera = new THREE.PerspectiveCamera(52, 1, 0.03, 30)
  private post = makePost(this.renderer, 720)
  private lamp = buildLamp(this.scene)
  private timer = new THREE.Timer()
  private resizeObs: ResizeObserver
  private roomGroup = new THREE.Group()
  private room: { setLabels(l: SeatLabel[]): void } | null = null
  private seats = 0
  private labels: SeatLabel[] = []
  private station: Station = 'entrada'
  private camPos = SHOTS.entrada.pos.clone()
  private camTarget = SHOTS.entrada.target.clone()
  private mouse = new THREE.Vector2()
  private raycaster = new THREE.Raycaster()
  private options: Array<{ view: CardView; mesh: THREE.Mesh; lift: number }> = []
  private aces: Array<{ view: CardView; flip: number; on: boolean }> = []
  private avatars: Array<{ av: Avatar; rise: number; name: string }> = []
  private hovered = -1
  private focusIndex = -1
  private disposed = false
  onHover: (i: number) => void = () => undefined
  onPick: (id: 'crear' | 'unirse' | 'reglas') => void = () => undefined

  constructor(private container: HTMLElement) {
    this.renderer.setPixelRatio(1)
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFShadowMap
    this.renderer.domElement.style.cssText = 'display:block;width:100%;height:100%;image-rendering:pixelated'
    container.appendChild(this.renderer.domElement)
    this.scene.add(this.camera, this.roomGroup)
    this.setSeatCount(8)
    this.buildOptions()
    this.buildAces()
    this.bindInput()
    this.resizeObs = new ResizeObserver(() => this.resize())
    this.resizeObs.observe(container)
    this.resize()
    this.renderer.setAnimationLoop((t) => {
      this.timer.update(t)
      this.frame(this.timer.getElapsed(), this.timer.getDelta())
    })
  }

  // ------------------------------------------------------------------ public API

  setStation(s: Station) {
    this.station = s
  }

  /** Your name, chalked at your place while you type it. */
  setMyName(name: string) {
    if (this.station === 'sala') return
    this.labels = Array.from({ length: this.seats }, (_, i) => (i === 0 ? { name: name || '…', team: 'random' as const } : { name: '', team: 'random' as const }))
    this.room?.setLabels(this.labels)
  }

  setSeatCount(n: number) {
    if (n === this.seats) return
    this.seats = n
    this.roomGroup.clear()
    const tmp = new THREE.Scene()
    this.room = buildRoom(tmp, n, this.labels)
    ;[...tmp.children].forEach((c) => this.roomGroup.add(c))
    this.scene.background = tmp.background
    this.scene.fog = tmp.fog
    this.avatars.forEach((a) => this.scene.remove(a.av.root))
    this.avatars = []
  }

  /** The waiting room: everyone who joined appears seated (masks, hands), names chalked. */
  setPlayers(players: MenuPlayer[], capacity: number) {
    this.setSeatCount(Math.max(capacity, players.length, 2))
    const n = this.seats
    // add / remove avatars to match the list (by seat index = join order)
    while (this.avatars.length > players.length) {
      const a = this.avatars.pop()!
      this.scene.remove(a.av.root)
    }
    players.forEach((p, i) => {
      if (!this.avatars[i] || this.avatars[i].name !== p.name) {
        if (this.avatars[i]) this.scene.remove(this.avatars[i].av.root)
        const av = makeAvatar(i, n, i === 0) // seat 0 is you, the camera: only your arms
        av.setHandCount(0)
        this.scene.add(av.root)
        this.avatars[i] = { av, rise: 0, name: p.name }
      }
    })
    this.labels = Array.from({ length: n }, (_, i) => ({ name: players[i]?.name ?? '', team: players[i]?.team ?? 'random' }))
    this.room?.setLabels(this.labels)
  }

  /** Config: each powered ace lies face up; switching a power off turns it face down. */
  setAces(p: AcePowers) {
    ACE_SUITS.forEach((suit, i) => (this.aces[i].on = p[suit]))
  }

  /** Keyboard focus on a DOM option mirrors the 3D hover. */
  focusOption(i: number) {
    this.focusIndex = i
  }

  dispose() {
    this.disposed = true
    this.renderer.setAnimationLoop(null)
    this.resizeObs.disconnect()
    this.handlers.forEach(([t, type, h]) => t.removeEventListener(type, h))
    this.renderer.dispose()
    this.renderer.domElement.remove()
  }

  // ------------------------------------------------------------------ objects

  private buildOptions() {
    MENU_OPTIONS.forEach((o, i) => {
      const view = makeCard()
      const tex = optionTexture(o.suit, o.rank, o.title)
      const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.22 })
      const face = view.root.children[0] as THREE.Mesh
      face.material = mat
      view.root.scale.setScalar(OPTION_SCALE)
      view.root.userData.option = i
      this.scene.add(view.root)
      this.options.push({ view, mesh: face, lift: 0 })
    })
  }

  private buildAces() {
    ACE_SUITS.forEach((suit) => {
      const view = makeCard()
      view.setIdentity(suit as Suit, 1)
      view.root.scale.setScalar(1.25)
      this.scene.add(view.root)
      this.aces.push({ view, flip: 1, on: true })
    })
  }

  // ------------------------------------------------------------------ input

  private handlers: Array<[EventTarget, string, EventListener]> = []
  private on(target: EventTarget, type: string, fn: (e: never) => void) {
    const h = fn as unknown as EventListener
    target.addEventListener(type, h)
    this.handlers.push([target, type, h])
  }

  private bindInput() {
    this.on(window, 'pointermove', (e: PointerEvent) => {
      const r = this.renderer.domElement.getBoundingClientRect()
      this.mouse.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
    })
    this.on(window, 'pointerdown', (e: PointerEvent) => {
      // only clicks that land on the canvas itself (not on the DOM panels above it)
      if (e.target !== this.renderer.domElement && !(e.target as HTMLElement)?.dataset?.menuPassthrough) return
      if (this.station === 'lobby' && this.hovered >= 0) this.onPick(MENU_OPTIONS[this.hovered].id)
    })
  }

  private updateHover() {
    if (this.station !== 'lobby') {
      if (this.hovered !== -1) this.onHover((this.hovered = -1))
      return
    }
    this.raycaster.setFromCamera(this.mouse, this.camera)
    const hit = this.raycaster.intersectObjects(this.options.map((o) => o.view.root), true)[0]
    let idx = -1
    if (hit) {
      let o: THREE.Object3D | null = hit.object
      while (o && o.userData.option === undefined) o = o.parent
      idx = o ? (o.userData.option as number) : -1
    }
    if (idx !== this.hovered) {
      this.hovered = idx
      this.onHover(idx)
    }
    this.renderer.domElement.style.cursor = idx >= 0 ? 'pointer' : 'default'
  }

  // ------------------------------------------------------------------ frame

  private resize() {
    const w = Math.max(1, this.container.clientWidth)
    const h = Math.max(1, this.container.clientHeight)
    this.renderer.setSize(w, h, false)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    this.post.resize(w, h)
  }

  private frame(time: number, dt: number) {
    if (this.disposed) return
    this.lamp.update(time)
    const calm = reduced()
    const k = 1 - Math.exp(-Math.min(dt, 0.1) * (calm ? 8 : 2.2))

    // camera: ease toward the station; the entrance slowly circles the empty table
    const shot = SHOTS[this.station]
    const goal = shot.pos.clone()
    if (this.station === 'entrada' && !calm) {
      const a = time * 0.05
      goal.set(Math.sin(a) * 2.1, 2.35 + Math.sin(time * 0.3) * 0.05, Math.cos(a) * 2.1)
    }
    if (!calm) goal.add(new THREE.Vector3(this.mouse.x * 0.08, this.mouse.y * 0.04, 0))
    this.camPos.lerp(goal, k)
    this.camTarget.lerp(shot.target, k)
    this.camera.position.copy(this.camPos)
    this.camera.lookAt(this.camTarget)
    this.camera.fov += (shot.fov - this.camera.fov) * k
    this.camera.updateProjectionMatrix()

    this.updateHover()

    // lobby cards: lying on the felt in front of your place; hovered one lifts and turns to you
    const showOptions = this.station === 'lobby' || this.station === 'entrada'
    this.options.forEach((o, i) => {
      const active = this.station === 'lobby' && (i === this.hovered || i === this.focusIndex)
      o.lift += ((active ? 1 : 0) - o.lift) * k * 2.5
      const x = (i - 1) * 0.36
      // the card tilts around its centre: raise it by half its tilted height (+ a hover gap) so the
      // lower edge never sinks into the felt
      const tilt = o.lift * 0.75
      const halfH = (CARD_H * OPTION_SCALE) / 2
      const y = TABLE_Y + 0.004 + Math.sin(tilt) * halfH + o.lift * 0.04 + (showOptions ? 0 : -0.5)
      o.view.root.position.set(x, y, 0.42 - o.lift * 0.06)
      o.view.root.rotation.set(FACE_UP + tilt, (1 - i) * 0.12, 0, 'YXZ')
      o.view.root.visible = showOptions
    })

    // config aces: flip smoothly between face up (power on) and face down (off)
    const showAces = this.station === 'config'
    this.aces.forEach((a, i) => {
      a.flip += ((a.on ? 1 : 0) - a.flip) * k * 2
      a.view.root.visible = showAces
      a.view.root.position.set((i - 1) * 0.2, TABLE_Y + 0.004 + Math.sin(a.flip * Math.PI) * 0.06, 0.2)
      a.view.root.rotation.set(THREE.MathUtils.lerp(FACE_DOWN, FACE_UP + Math.PI * 2, a.flip), (1 - i) * 0.08, 0, 'YXZ')
    })

    // waiting room: players rise out of the dark into their chairs, then idle
    const ts = Math.floor(time * 15) / 15
    const showPeople = this.station === 'sala' || this.station === 'config'
    this.avatars.forEach(({ av }, i) => {
      const a = this.avatars[i]
      a.rise += ((showPeople ? 1 : 0) - a.rise) * k
      av.root.visible = i !== 0 && a.rise > 0.02 // seat 0 is you (the camera)
      av.root.position.y = (1 - ease(a.rise)) * -1.2
      av.pose({
        lean: 0.1 + Math.sin(ts * 0.8 + i) * 0.05,
        headYaw: Math.sin(ts * 0.25 + i * 1.7) * 0.6,
        headPitch: -0.2 + Math.sin(ts * 0.4 + i) * 0.1,
      })
    })

    this.post.render(this.scene, this.camera, time)
  }
}

function ease(x: number) {
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2
}

