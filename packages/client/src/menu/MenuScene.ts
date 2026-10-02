import { attachAudio } from '../table3d/audio'
import * as THREE from 'three'
import { buildLamp, buildRoom } from '../table3d/table'
import { TABLE_Y, TABLE_R, CARD_H, CARD_W, seatAngle, polar } from '../table3d/seats'
import { NameTag, TAG_Y, TAG_R_OFFSET } from '../table3d/nameTags'
import { getViewSettings, onViewSettings } from '../settings/viewSettings'
import { makeAvatar, type Avatar } from '../table3d/avatar'
import { makeCard, type CardView } from '../table3d/cards'
import { drawFace, toTexture, type Rank, type Suit } from '../table3d/cardFace'
import { makePost } from '../table3d/post'
import { PALETTE } from '../table3d/look'
import { FloatingItems, type FloatItem } from './floating'
import { InputCard, type InputCardState } from './inputCard'

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
// every screen is a seated view over your side of the table: the choices are things on the felt
const SEATED = { pos: new THREE.Vector3(0, 1.5, 1.34), target: new THREE.Vector3(0, 0.74, 0.3), fov: 50 }
const SHOTS: Record<Station, Shot> = {
  entrada: SEATED,
  lobby: { pos: new THREE.Vector3(0, 1.45, 1.32), target: new THREE.Vector3(0, 0.72, 0.28), fov: 50 },
  crear: SEATED,
  unirse: SEATED,
  reglas: { pos: new THREE.Vector3(-0.4, 1.25, 1.2), target: new THREE.Vector3(0.3, 0.85, -0.6), fov: 52 },
  // the room: see the whole table (who sat down) plus your controls at the near edge
  sala: { pos: new THREE.Vector3(0, 1.62, 1.4), target: new THREE.Vector3(0, 0.78, 0.18), fov: 54 },
  config: { pos: new THREE.Vector3(0, 1.55, 1.36), target: new THREE.Vector3(0, 0.74, 0.26), fov: 50 },
}

export const MENU_OPTIONS: Array<{ id: 'crear' | 'unirse' | 'reglas'; title: string; suit: Suit; rank: Rank }> = [
  { id: 'crear', title: 'Armar mesa', suit: 'oros', rank: 10 },
  { id: 'unirse', title: 'Sentarse', suit: 'copas', rank: 11 },
  { id: 'reglas', title: 'Reglamento', suit: 'espadas', rank: 12 },
]

const ACE_SUITS: Array<keyof AcePowers> = ['espadas', 'copas', 'oros']
const ACE_HINTS: Record<keyof AcePowers, string> = {
  espadas: 'As de Espadas: mata al ancho de bastos si sale después · click para activar/apagar',
  copas: 'As de Copas: puede invertir el sentido de la ronda · click para activar/apagar',
  oros: 'As de Oros: si su equipo gana la base, elige quién abre · click para activar/apagar',
}
const FACE_UP = -Math.PI / 2
const MENU_EXPOSURE = 0.95
const OPTION_SCALE = 1.8 // cards are already 1.75x real size in the game
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
  private room: ReturnType<typeof buildRoom> | null = null
  private seats = 0
  // the menu lives for the whole session: the table guides follow the view setting live
  private offView = onViewSettings((v) => this.room?.setGuides(v.guides))
  private station: Station = 'entrada'
  private camPos = SHOTS.entrada.pos.clone()
  private camTarget = SHOTS.entrada.target.clone()
  private mouse = new THREE.Vector2()
  private raycaster = new THREE.Raycaster()
  // `hit`: invisible twin at the card's REST pose (flat on the felt); hover tests it, not the moving
  // card, so the lift animation can't flicker the hover
  private options: Array<{ view: CardView; mesh: THREE.Mesh; hit: THREE.Mesh; lift: number }> = []
  private aces: Array<{ view: CardView; flip: number; on: boolean }> = []
  private avatars: Array<{ av: Avatar; rise: number; name: string; tag: NameTag }> = []
  private hovered = -1
  private focusIndex = -1
  private floating = new FloatingItems()
  private inputCard = new InputCard()
  private inputAt: [number, number] = [0, 0.18]
  private inputHovered = false
  private aceHovered = -1
  private aceFeet: THREE.Mesh[] = []
  private aceHits: THREE.Mesh[] = []
  private floatHovered: string | null = null
  onInputClick: () => void = () => undefined
  onAcePick: (suit: keyof AcePowers) => void = () => undefined
  onCaption: (text: string | null) => void = () => undefined
  private disposed = false
  onHover: (i: number) => void = () => undefined
  onPick: (id: 'crear' | 'unirse' | 'reglas') => void = () => undefined

  constructor(private container: HTMLElement) {
    this.renderer.setPixelRatio(1)
    // the menu puts paper right under the lamp (cards, tags): expose lower than the game table so
    // bone surfaces stay paper-coloured instead of burning to white
    this.post.uniforms.uExposure.value = MENU_EXPOSURE
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFShadowMap
    this.renderer.domElement.style.cssText = 'display:block;width:100%;height:100%;image-rendering:pixelated'
    container.appendChild(this.renderer.domElement)
    this.scene.add(this.camera, this.roomGroup)
    attachAudio(this.camera) // the basement hums from the very first screen
    this.setSeatCount(8)
    this.scene.add(this.floating.group, this.inputCard.mesh, this.inputCard.hit)
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

  /** Your name while you type it: it lives on the writable card now (nothing is chalked on the felt). */
  setMyName(_name: string) {}

  setSeatCount(n: number) {
    if (n === this.seats) return
    this.seats = n
    this.roomGroup.clear()
    const tmp = new THREE.Scene()
    // no names chalked on the felt (they float over each player, as in the game); the guides
    // follow your view setting
    this.room = buildRoom(tmp, n, [], getViewSettings().guides)
    ;[...tmp.children].forEach((c) => this.roomGroup.add(c))
    this.scene.background = tmp.background
    this.scene.fog = tmp.fog
    this.avatars.forEach((a) => {
      this.scene.remove(a.av.root, a.tag.mesh)
      a.tag.dispose()
    })
    this.avatars = []
  }

  /** The waiting room: everyone who joined appears seated (masks, hands), names chalked. */
  setPlayers(players: MenuPlayer[], capacity: number) {
    this.setSeatCount(Math.max(capacity, players.length, 2))
    const n = this.seats
    // add / remove avatars to match the list (by seat index = join order)
    while (this.avatars.length > players.length) {
      const a = this.avatars.pop()!
      this.scene.remove(a.av.root, a.tag.mesh)
      a.tag.dispose()
    }
    // name colours from YOUR side (seat 0 is you): your team teal, the rivals rose
    const mine = players[0]?.team
    const rel = (t?: string) => (!t || t === 'random' || !mine || mine === 'random' ? 'random' : t === mine ? 'nosotros' : 'ellos')
    players.forEach((p, i) => {
      if (!this.avatars[i] || this.avatars[i].name !== p.name) {
        if (this.avatars[i]) {
          this.scene.remove(this.avatars[i].av.root, this.avatars[i].tag.mesh)
          this.avatars[i].tag.dispose()
        }
        const av = makeAvatar(i, n, i === 0) // seat 0 is you, the camera: only your arms
        av.setHandCount(0)
        this.scene.add(av.root)
        const tag = new NameTag()
        this.scene.add(tag.mesh)
        this.avatars[i] = { av, rise: 0, name: p.name, tag }
      }
      this.avatars[i].tag.set(p.name, rel(p.team), true)
    })
  }

  /** Config: each powered ace lies face up; switching a power off turns it face down. */
  setAces(p: AcePowers) {
    ACE_SUITS.forEach((suit, i) => (this.aces[i].on = p[suit]))
  }

  /** Floating buttons on the felt for the current screen (replaces the previous set). */
  setItems(items: FloatItem[]) {
    this.floating.set(items)
  }

  /** The writable card (name, room code); null hides it. */
  setInput(state: InputCardState | null, at: [number, number] = [0, 0.18]) {
    this.inputCard.set(state)
    this.inputAt = at
  }

  /** Keyboard focus on a DOM option mirrors the 3D hover. */
  focusOption(i: number) {
    this.focusIndex = i
  }

  dispose() {
    this.offView()
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
      const hit = new THREE.Mesh(face.geometry, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }))
      hit.visible = false
      hit.scale.setScalar(OPTION_SCALE)
      hit.userData.option = i
      this.scene.add(hit)
      this.options.push({ view, mesh: face, hit, lift: 0 })
    })
  }

  private buildAces() {
    ACE_SUITS.forEach((suit) => {
      const view = makeCard()
      view.setIdentity(suit as Suit, 1)
      view.root.scale.setScalar(1.25)
      view.root.traverse((o) => (o.castShadow = false)) // upright: its footprint casts instead
      // the back faces you when the power is off: light it a little, like the menu's buttons
      const back = view.root.children[1] as THREE.Mesh
      const lit = (back.material as THREE.MeshStandardMaterial).clone()
      lit.emissive = new THREE.Color(0xffffff)
      lit.emissiveMap = lit.map
      lit.emissiveIntensity = 0.35
      back.material = lit
      this.scene.add(view.root)
      // invisible footprint that only draws into the shadow map (same trick as the floating buttons)
      const foot = new THREE.Mesh(new THREE.PlaneGeometry(CARD_W * 1.25, CARD_H * 0.6), new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false, side: THREE.DoubleSide }))
      foot.geometry.rotateX(-Math.PI / 2)
      foot.castShadow = true
      this.scene.add(foot)
      this.aceFeet.push(foot)
      const hit = new THREE.Mesh((view.root.children[0] as THREE.Mesh).geometry, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }))
      hit.visible = false
      hit.scale.setScalar(1.25)
      this.scene.add(hit)
      this.aceHits.push(hit)
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
      if (this.floatHovered) return this.floating.pick(this.floatHovered)
      if (this.inputHovered) return this.onInputClick()
      if (this.station === 'config' && this.aceHovered >= 0) return this.onAcePick(ACE_SUITS[this.aceHovered])
      if (this.station === 'lobby' && this.hovered >= 0) this.onPick(MENU_OPTIONS[this.hovered].id)
    })
  }

  private lastCaption: string | null = null
  private updateHover(time: number) {
    this.raycaster.setFromCamera(this.mouse, this.camera)
    this.floatHovered = this.floating.update(time, this.camera, this.raycaster, reduced())
    this.inputHovered = !!this.inputCard.mesh.visible && this.raycaster.intersectObject(this.inputCard.hit, false).length > 0
    this.aceHovered = -1
    if (this.station === 'config') {
      const h = this.raycaster.intersectObjects(this.aceHits, false)[0]
      this.aceHovered = h ? this.aceHits.indexOf(h.object as THREE.Mesh) : -1
    }
    const caption = this.floating.hint(this.floatHovered) ?? (this.aceHovered >= 0 ? ACE_HINTS[ACE_SUITS[this.aceHovered]] : null)
    if (caption !== this.lastCaption) {
      this.lastCaption = caption
      this.onCaption(caption)
    }
    const pointer = !!this.floatHovered || this.inputHovered || this.aceHovered >= 0
    if (this.station !== 'lobby') {
      if (this.hovered !== -1) this.onHover((this.hovered = -1))
      this.renderer.domElement.style.cursor = pointer ? 'pointer' : 'default'
      return
    }
    const targets: THREE.Object3D[] = this.options.map((o) => o.hit)
    if (this.hovered >= 0) targets.push(this.options[this.hovered].view.root) // keep it while over the raised card
    const hit = this.raycaster.intersectObjects(targets, true)[0]
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
    this.renderer.domElement.style.cursor = idx >= 0 || pointer ? 'pointer' : 'default'
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
    if (!calm) goal.add(new THREE.Vector3(this.mouse.x * 0.05, this.mouse.y * 0.025, 0))
    this.camPos.lerp(goal, k)
    this.camTarget.lerp(shot.target, k)
    this.camera.position.copy(this.camPos)
    this.camera.lookAt(this.camTarget)
    this.camera.fov += (shot.fov - this.camera.fov) * k
    this.camera.updateProjectionMatrix()

    this.updateHover(time)
    this.inputCard.update(time, this.inputAt[0], this.inputAt[1], this.inputHovered)

    // lobby cards: lying on the felt in front of your place; hovered one lifts and turns to you
    const showOptions = this.station === 'lobby'
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
      o.hit.position.set(x, TABLE_Y + 0.004, 0.42)
      o.hit.rotation.set(FACE_UP, (1 - i) * 0.12, 0, 'YXZ')
      o.hit.updateMatrixWorld()
      o.view.root.visible = showOptions
    })

    // config aces: they float upright like the menu's buttons, facing you, and spin round their
    // vertical axis between face (power on) and back (off)
    const showAces = this.station === 'config'
    this.aces.forEach((a, i) => {
      a.flip += ((a.on ? 1 : 0) - a.flip) * k * 2
      a.view.root.visible = showAces
      this.aceFeet[i].visible = showAces
      const halfH = (CARD_H * 1.25) / 2
      const over = i === this.aceHovered ? 0.02 : 0
      const bob = calm ? 0 : Math.sin(time * 1.4 + i * 2.1) * 0.004
      const x = (i - 1) * 0.22
      const rest = new THREE.Vector3(x, TABLE_Y + 0.03 + halfH, 0.14)
      const facing = Math.atan2(this.camera.position.x - x, this.camera.position.z - rest.z)
      a.view.root.position.copy(rest).add(new THREE.Vector3(0, bob + over, 0))
      a.view.root.rotation.set(0, facing + (1 - a.flip) * Math.PI, 0, 'YXZ')
      this.aceFeet[i].position.copy(a.view.root.position)
      this.aceFeet[i].rotation.y = facing
      this.aceHits[i].position.copy(rest) // hover tested at the rest pose: no flicker from the bob
      this.aceHits[i].rotation.set(0, facing, 0, 'YXZ')
      this.aceHits[i].updateMatrixWorld()
    })

    // waiting room: players rise out of the dark into their chairs, then idle
    const ts = Math.floor(time * 15) / 15
    const showPeople = this.station === 'sala' || this.station === 'config'
    this.avatars.forEach(({ av }, i) => {
      const a = this.avatars[i]
      a.rise += ((showPeople ? 1 : 0) - a.rise) * k
      av.root.visible = i !== 0 && a.rise > 0.02 // seat 0 is you (the camera)
      av.root.position.y = (1 - ease(a.rise)) * -1.2
      // the name floats over the body, as at the game table
      a.tag.mesh.visible = av.root.visible
      const ang = seatAngle(i, this.seats)
      a.tag.place(polar(TABLE_R + TAG_R_OFFSET, ang, TAG_Y + av.root.position.y), Math.PI / 2 - ang, this.camera)
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

