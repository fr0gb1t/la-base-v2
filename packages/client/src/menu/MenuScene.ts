import { isTouch } from '../lib/device'
import { KamikazeDial } from './kamikazeDial'
import { attachAudio, uiSound } from '../table3d/audio'
import * as THREE from 'three'
import { buildLamp, buildRoom } from '../table3d/table'
import { TABLE_Y, TABLE_R, CHAIR_R, CARD_H, CARD_W, seatAngle, polar } from '../table3d/seats'
import { NameTag, TAG_Y, TAG_R_OFFSET } from '../table3d/nameTags'
import { getViewSettings, onViewSettings } from '../settings/viewSettings'
import { makeAvatar, type Avatar } from '../table3d/avatar'
import { makeCard, type CardView } from '../table3d/cards'
import { drawFace, toTexture, type Rank, type Suit } from '../table3d/cardFace'
import { makePost } from '../table3d/post'
import { PALETTE } from '../table3d/look'
import { PROPS_LAYER, PropColors, toProps } from '../table3d/propsLayer'
import { FloatingItems, type FloatItem } from './floating'
import { InputCard, type InputCardState } from './inputCard'
import { HudBoard, HUD_SET_H, type HudItem } from '../table3d/hudBoard'
import { buildSideTable, SIDE_TABLE_H } from './sideTable'

// ---------------------------------------------------------------------------------------------
// The menu is the same basement as the game, before anyone sits down. The camera moves between
// "stations" (one per menu screen) and the options are physical things on the felt: three big
// cards in the lobby, the three powered aces in the config, the players' masks in the room.
// DOM stays the source of truth (forms, buttons, a11y); this only paints and reports hovers.
// ---------------------------------------------------------------------------------------------

// the menu's two televisions (novedades, ajustes) stand side by side on one small table off to the
// right of the felt, turned to face the camera (the camera of every menu screen sees that corner)
export const TV_TABLE = { x: 1.3, z: -0.85, yaw: -0.52 }
// the sets are small: just enough to find and read at a glance
const SIDE_TV_SCALE = 0.55
const TV_TABLE_R = CHAIR_R + 0.65 // where it stands in the room: well behind the chairs
// how far the television table's centre keeps from a chair's: the table (0.3) + half a chair (0.225) + a hand's breadth
const TV_CHAIR_GAP = 0.62
const TV_CHAIR_HARD = 0.5 // never closer than this to a chair on the way (a chair is ~0.45 square, the table 0.3 across)
const TV_GAP = 0.125 // half the distance between the two sets

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

const ACE_Z = -0.1 // how far toward the far side of the table the powered aces stand (room for the form below)
const ACE_TILT = 0.42 // radians the powered aces lean back toward the lamp
const ACE_SUITS: Array<keyof AcePowers> = ['espadas', 'copas', 'oros']
const ACE_HINTS: Record<keyof AcePowers, string> = {
  espadas: 'As de Espadas: mata al ancho de bastos si sale después · click para activar/apagar',
  copas: 'As de Copas: puede invertir el sentido de la ronda · click para activar/apagar',
  oros: 'As de Oros: si su equipo gana la base, elige quién abre · click para activar/apagar',
}
const FACE_UP = -Math.PI / 2
const MENU_EXPOSURE = 0.95
const MENU_NAME_H = 0.032 // metres of name text in the menus (the table uses 0.07)
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
  private avatars: Array<{ av: Avatar; rise: number; name: string; tag: NameTag; tagFade: number }> = []
  private hovered = -1
  private focusIndex = -1
  private floating = new FloatingItems()
  private kamikaze = new KamikazeDial()
  private inputCard = new InputCard()
  // ajustes / novedades, one set on each side table
  private decks = [0, 1].map(() => ({ board: new HudBoard(true) }))
  private tvTable = new THREE.Group()
  private tvHovered: string | null = null
  private tvHint: string | null = null
  private lastTvTime = 0
  private inputAt: [number, number] = [0, 0.18]
  private inputHovered = false
  private inputTap = false // a finger went down on the writing card: its click opens the keyboard
  private aceHovered = -1
  private aceFeet: THREE.Mesh[] = []
  private aceHits: THREE.Mesh[] = []
  private floatHovered: string | null = null
  onInputClick: () => void = () => undefined
  onHud: (id: string) => void = () => undefined
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
    this.renderer.domElement.style.cssText = 'display:block;width:100%;height:100%;image-rendering:pixelated;touch-action:none'
    container.appendChild(this.renderer.domElement)
    this.scene.add(this.camera, this.roomGroup)
    attachAudio(this.camera) // the basement hums from the very first screen
    this.setSeatCount(8)
    this.scene.add(this.floating.group, this.inputCard.mesh, this.inputCard.hit, this.kamikaze.group)
    this.buildOptions()
    this.buildAces()
    this.buildTvDeck()
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

  /** The sets on the side table (ajustes, novedades); `attention` makes one call for a look. */
  setHud(items: HudItem[]) {
    this.decks.forEach((d, i) => d.board.set(items[i] ? [items[i]] : []))
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
    // add / remove avatars to match the list (by seat index = join order); a chair creaks when
    // someone sits down while you're there (not for the ones already seated when you arrive)
    const arrived = this.avatars.length > 0
    while (this.avatars.length > players.length) {
      uiSound('leave')
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
        if (arrived && i > 0) uiSound('sit')
        const av = makeAvatar(i, n, i === 0) // seat 0 is you, the camera: only your arms
        av.setHandCount(0)
        this.scene.add(av.root)
        const tag = new NameTag(MENU_NAME_H) // small: the waiting room must not look crowded
        this.scene.add(tag.mesh)
        this.avatars[i] = { av, rise: 0, name: p.name, tag, tagFade: 0 }
      }
      this.avatars[i].tag.set(p.name, rel(p.team), true)
    })
  }

  /** Config: each powered ace lies face up; switching a power off turns it face down. */
  setAces(p: AcePowers) {
    ACE_SUITS.forEach((suit, i) => (this.aces[i].on = p[suit]))
  }

  /** Config: the kamikaze counter hanging over the plane button at table spot `at`. */
  setKamikaze(value: number, at: [number, number]) {
    this.kamikaze.set(value, at)
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
    this.decks.forEach((d) => d.board.dispose())
    this.tvTable.traverse((o) => (o.userData.dispose as (() => void) | undefined)?.())
    this.kamikaze.dispose()
    this.offView()
    this.disposed = true
    this.renderer.setAnimationLoop(null)
    this.resizeObs.disconnect()
    this.handlers.forEach(([t, type, h]) => t.removeEventListener(type, h))
    this.renderer.dispose()
    this.renderer.domElement.remove()
  }

  // ------------------------------------------------------------------ objects

  private buildTvDeck() {
    const lamp = new THREE.PointLight(0xe8e4dc, 1.6, 2.4, 1.6) // the basement is dark: a little light on the sets
    lamp.position.set(0, SIDE_TABLE_H + 0.7, 0.35)
    this.tvTable.add(buildSideTable(), lamp)
    this.decks.forEach((d, i) => {
      d.board.group.scale.setScalar(SIDE_TV_SCALE)
      d.board.group.position.set((i === 0 ? -1 : 1) * TV_GAP, SIDE_TABLE_H + (HUD_SET_H * SIDE_TV_SCALE) / 2 + 0.02, 0)
      this.tvTable.add(d.board.group)
    })
    this.tvTable.position.set(TV_TABLE.x, 0, TV_TABLE.z)
    this.tvTable.rotation.y = TV_TABLE.yaw
    this.scene.add(this.tvTable)
    if (new URLSearchParams(location.search).has('debug')) Object.assign(window, { __tvDecks: this.decks })
  }

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
    this.on(window, 'click', () => {
      if (!this.inputTap) return
      this.inputTap = false
      uiSound('write')
      this.onInputClick() // inside the tap itself, so the keyboard opens
    })
    this.on(window, 'pointerdown', (e: PointerEvent) => {
      // only clicks that land on the canvas itself (not on the DOM panels above it)
      if (e.target !== this.renderer.domElement && !(e.target as HTMLElement)?.dataset?.menuPassthrough) return
      if (e.pointerType === 'touch') {
        // a finger has no hover: aim at what it touches before acting on it
        const r = this.renderer.domElement.getBoundingClientRect()
        this.mouse.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
        this.updateHover(performance.now() / 1000)
      }
      if (this.tvHovered) {
        uiSound('chain')
        return this.onHud(this.tvHovered)
      }
      if (this.floatHovered) {
        const kind = this.floating.kindOf(this.floatHovered)
        uiSound(kind === 'stamp' ? 'stamp' : kind === 'chip' ? 'chip' : 'chain')
        return this.floating.pick(this.floatHovered)
      }
      if (this.inputHovered) {
        // a phone only opens the keyboard from a real tap: the click that follows this touch does it
        if (e.pointerType === 'touch') {
          this.inputTap = true
          return
        }
        uiSound('write')
        return this.onInputClick()
      }
      if (this.station === 'config' && this.aceHovered >= 0) {
        uiSound('flip')
        return this.onAcePick(ACE_SUITS[this.aceHovered])
      }
      if (this.station === 'lobby' && this.hovered >= 0) {
        uiSound('chain')
        this.onPick(MENU_OPTIONS[this.hovered].id)
      }
    })
  }

  private lastCaption: string | null = null
  private lastOver: string | null = null
  private updateHover(time: number) {
    this.raycaster.setFromCamera(this.mouse, this.camera)
    this.floatHovered = this.floating.update(time, this.camera, this.raycaster, reduced())
    const dtTv = Math.min(0.1, Math.max(0, time - this.lastTvTime))
    this.lastTvTime = time
    this.tvHovered = null
    this.tvHint = null
    for (const d of this.decks) {
      const id = d.board.update(dtTv, this.raycaster, true)
      if (id) {
        this.tvHovered = id
        this.tvHint = d.board.hint(id)
      }
    }
    this.inputHovered = !!this.inputCard.mesh.visible && this.raycaster.intersectObject(this.inputCard.hit, false).length > 0
    this.aceHovered = -1
    if (this.station === 'config') {
      const h = this.raycaster.intersectObjects(this.aceHits, false)[0]
      this.aceHovered = h ? this.aceHits.indexOf(h.object as THREE.Mesh) : -1
    }
    const caption = this.floating.hint(this.floatHovered) ?? this.tvHint ?? (this.aceHovered >= 0 ? ACE_HINTS[ACE_SUITS[this.aceHovered]] : null)
    if (caption !== this.lastCaption) {
      this.lastCaption = caption
      this.onCaption(caption)
    }
    const pointer = !!this.floatHovered || !!this.tvHovered || this.inputHovered || this.aceHovered >= 0
    if (this.station !== 'lobby') {
      if (this.hovered !== -1) this.onHover((this.hovered = -1))
      this.renderer.domElement.style.cursor = pointer ? 'pointer' : 'default'
      this.tickOver(pointer)
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
    this.tickOver(idx >= 0 || pointer)
  }

  /** A soft tick whenever the pointer arrives on something you can pick. */
  private tickOver(pointer: boolean) {
    const over = `${this.floatHovered}|${this.tvHovered}|${this.inputHovered}|${this.aceHovered}|${this.hovered}`
    if (over === this.lastOver) return
    if (pointer && this.lastOver !== null) uiSound('hover')
    this.lastOver = over
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

  /** A phone held upright is narrow: widen the view so the table (laid out for 16:9) still fits across. */
  private fovFor(fov: number) {
    const aspect = this.camera.aspect
    if (!isTouch || aspect >= 16 / 9) return fov
    // upright: crop the table's sides a little rather than shrink everything to a sliver
    const ref = aspect < 1 ? 1.1 : 16 / 9
    const half = Math.atan(Math.tan(THREE.MathUtils.degToRad(fov / 2)) * (ref / aspect))
    return Math.min(105, THREE.MathUtils.radToDeg(half * 2))
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
    this.camera.fov += (this.fovFor(shot.fov) - this.camera.fov) * k
    this.camera.updateProjectionMatrix()

    this.updateHover(time)
    this.kamikaze.update(dt, this.camera, this.station === 'config')
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
      const rest = new THREE.Vector3(x, TABLE_Y + 0.03 + halfH, ACE_Z)
      const facing = Math.atan2(this.camera.position.x - x, this.camera.position.z - rest.z)
      a.view.root.position.copy(rest).add(new THREE.Vector3(0, bob + over, 0))
      // leaning back so the lamp falls squarely on whichever side faces you (the back leans the
      // other way once turned: the sign follows the flip)
      const lean = -ACE_TILT * Math.cos((1 - a.flip) * Math.PI)
      a.view.root.rotation.set(lean, facing + (1 - a.flip) * Math.PI, 0, 'YXZ')
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
      // they rise slowly out of the dark, but leaving they sink fast (the same ease as arriving would
      // keep them half visible for seconds)
      const kRise = showPeople ? k : 1 - Math.exp(-Math.min(dt, 0.1) * (calm ? 14 : 9))
      a.rise += ((showPeople ? 1 : 0) - a.rise) * kRise
      if (!showPeople && a.rise < 0.12) a.rise = 0
      av.root.visible = i !== 0 && a.rise > 0.02 // seat 0 is you (the camera)
      av.root.position.y = (1 - ease(a.rise)) * -1.2
      // the name floats over the body, as at the game table; it goes quickly when you leave (the
      // body sinks into the dark slowly, but a name left hanging there looks like a bug)
      const rate = showPeople ? 0.2 : 0.6
      a.tagFade += ((showPeople ? 1 : 0) - a.tagFade) * Math.min(1, rate * dt * 60 / 4)
      if (!showPeople && a.tagFade < 0.04) a.tagFade = 0
      a.tag.mesh.visible = av.root.visible && a.tagFade > 0
      ;(a.tag.mesh.material as THREE.Material).opacity = a.tagFade
      const ang = seatAngle(i, this.seats)
      a.tag.place(polar(TABLE_R + TAG_R_OFFSET, ang, TAG_Y + av.root.position.y), Math.PI / 2 - ang, this.camera)
      av.pose({
        lean: 0.1 + Math.sin(ts * 0.8 + i) * 0.05,
        headYaw: Math.sin(ts * 0.25 + i * 1.7) * 0.6,
        headPitch: -0.2 + Math.sin(ts * 0.4 + i) * 0.1,
      })
    })

    this.placeTvTable(dt)
    this.syncPropLayers(time)
    this.post.render(this.scene, this.camera, time, getViewSettings().smoothProps, (on) => (on ? this.propColors.on() : this.propColors.off(this.scene)))
  }

  /** Where the room's 8 chairs stand (as table.ts builds them): the occupied ones at the table, the empty ones pushed back in the dark. */
  private chairSpots(): Array<{ x: number; z: number }> {
    return Array.from({ length: 8 }, (_, k) => {
      const occupied = k < this.seats
      const a = occupied ? seatAngle(k, this.seats) : seatAngle(k, 8) + Math.PI / 8
      const r = occupied ? CHAIR_R : CHAIR_R + 0.9
      return { x: Math.cos(a) * r, z: Math.sin(a) * r }
    })
  }

  private tvSpotKey = ''
  private tvSpotAt = { x: TV_TABLE.x, z: TV_TABLE.z }

  /**
   * Where the television table stands. Off to the right of the felt, as always, except where chairs or people
   * would be under it: in the room and the config (people sit around the table) and in «Armar mesa» (chairs
   * appear as the player count grows). There it goes to the nearest spot, back-right, that clears every
   * chair, so nothing is under it or through it.
   */
  private tvSpot(): { x: number; z: number } {
    const home = { x: TV_TABLE.x, z: TV_TABLE.z }
    const room = this.station === 'sala' || this.station === 'config'
    if (!room && this.station !== 'crear') return home
    const key = `${this.station}|${this.seats}|${this.camera.aspect.toFixed(2)}`
    if (key === this.tvSpotKey) return this.tvSpotAt
    const chairs = this.chairSpots()
    const clear = (c: { x: number; z: number }) => Math.min(...chairs.map((k) => Math.hypot(c.x - k.x, c.z - k.z)))
    const a0 = (-62 * Math.PI) / 180
    const pref = room ? { x: Math.cos(a0) * TV_TABLE_R, z: Math.sin(a0) * TV_TABLE_R } : home // where it likes to be
    const NEED = TV_CHAIR_GAP
    const candidates = [home, pref]
    for (let deg = -85; deg <= -5; deg += 2.5) for (const r of [1.5, 1.6, 1.7, 1.8, 1.95, 2.1]) candidates.push({ x: Math.cos((deg * Math.PI) / 180) * r, z: Math.sin((deg * Math.PI) / 180) * r })
    // it has to be on screen (with room to spare) from this screen's camera: not cut by an edge, nor under the header
    const shot = SHOTS[this.station]
    const cam = new THREE.PerspectiveCamera(shot.fov, this.camera.aspect, 0.05, 40)
    cam.position.copy(shot.pos)
    cam.lookAt(shot.target)
    cam.updateMatrixWorld()
    // 0 = well in view, 1 = on screen but close to an edge, 2 = out of frame
    const framing = (c: { x: number; z: number }) => {
      const v = new THREE.Vector3(c.x, 0.8, c.z).project(cam)
      if (v.z >= 1) return 2
      if (Math.abs(v.x) < 0.7 && v.y < 0.72 && v.y > -0.4) return 0 // (the pair is about 0.4 m wide: leave room at the sides)
      return Math.abs(v.x) < 0.8 && v.y < 0.86 && v.y > -0.5 ? 1 : 2
    }
    let best = pref
    let bestScore = -Infinity
    for (const c of candidates) {
      const f = framing(c)
      // roomy enough counts the same; then the nearest to its place. An edge costs a little, out of frame a lot, and in the
      // menus too far back is hidden by the rim of the table
      const behindRim = room ? 0 : Math.max(0, Math.hypot(c.x, c.z) - 1.65) * 45
      const score = Math.min(clear(c), NEED) * 70 - Math.hypot(c.x - pref.x, c.z - pref.z) * 10 - (f === 0 ? 0 : f === 1 ? 6 : 1000) - behindRim
      if (score > bestScore) {
        bestScore = score
        best = c
      }
    }
    this.tvSpotKey = key
    this.tvSpotAt = best
    return best
  }

  private placeTvTable(dt: number) {
    const to = this.tvSpot()
    const k = reduced() ? 1 : 1 - Math.exp(-Math.min(dt, 0.1) * 4)
    const t = this.tvTable
    t.position.x += (to.x - t.position.x) * k
    t.position.z += (to.z - t.position.z) * k
    // on its way it must not cross a chair either (they appear all at once, wherever the new count puts them, and a
    // straight slide can pass through one): whatever it overlaps pushes it out, so it goes around. The push is eased,
    // not a jump, when a chair appears right under it
    const ease = reduced() ? 1 : 1 - Math.exp(-Math.min(dt, 0.1) * 22)
    for (let pass = 0; pass < 3; pass++) {
      for (const c of this.chairSpots()) {
        const dx = t.position.x - c.x
        const dz = t.position.z - c.z
        const d = Math.hypot(dx, dz)
        if (d >= TV_CHAIR_HARD) continue
        const u = d > 1e-4 ? { x: dx / d, z: dz / d } : { x: 1, z: 0 }
        const push = (TV_CHAIR_HARD - d) * ease
        t.position.x += u.x * push
        t.position.z += u.z * push
      }
    }
    t.rotation.y = Math.atan2(-t.position.x, this.camera.position.z - t.position.z) // always facing the camera
  }

  // ---- the televisions drawn smooth: their own layer, lit by the same lights (as the game table's props)
  private lightsAt = -1
  private syncPropLayers(time: number) {
    // every frame: the sets, the buttons and the cards are built (and rebuilt) whenever the screen's items change
    for (const d of this.decks) toProps(d.board.group)
    toProps(this.floating.group)
    toProps(this.inputCard.mesh)
    toProps(this.kamikaze.group)
    this.raycaster.layers.enable(PROPS_LAYER) // …and still pointable
    // every light of the world also lights them (and casts their shadows)
    if (Math.floor(time) !== this.lightsAt) {
      this.lightsAt = Math.floor(time)
      this.scene.traverse((o) => {
        if (!(o instanceof THREE.Light) || (o.layers.isEnabled(PROPS_LAYER) && o.layers.isEnabled(0))) return
        if (o.layers.mask === 1 << PROPS_LAYER) return // their own lights (inside the boards)
        o.layers.enable(PROPS_LAYER)
        const sh = (o as THREE.SpotLight).shadow
        if (sh) sh.camera.layers.enable(PROPS_LAYER)
      })
    }
  }
  private propColors = new PropColors()
}

function ease(x: number) {
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2
}

