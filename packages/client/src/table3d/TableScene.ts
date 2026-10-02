import * as THREE from 'three'
import { FACE_AIM_RADIUS, FACE_BACK_DOT, isHeadSena, type Card, type Sena } from '@la-base/shared'
import { buildLamp, buildRoom } from './table'
import { EYE_R, EYE_Y, TABLE_Y, TABLE_R, CARD_W, CARD_H, SHOULDER_R, SHOULDER_Y, seatAngle, polar, playSlot } from './seats'
import { makeAvatar, MAX_HAND, FAN_Y, type Avatar, type AvatarPose } from './avatar'
import { makeCard, type CardView } from './cards'
import { drawFace, toTexture } from './cardFace'
import { backTexture } from './cardBacks'
import { playPose, PLAY_DURATION } from './play'
import { makePost } from './post'
import { schedule, tickJobs, wait } from './jobs'
import { attachAudio, sfx, lampBuzz, toggleMute } from './audio'
import { PALETTE, hex, DUOTONES } from './look'
import { getViewSettings, onViewSettings } from '../settings/viewSettings'
import { NameTag, TAG_Y, TAG_R_OFFSET } from './nameTags'
import { TableTokens } from './tableTokens'
import { TableChoices, type CopasChoice, type Direction } from './tableChoices'

// ---------------------------------------------------------------------------------------------
// The 3D table, driven by real game events. Seats follow the server's turn order with the local
// player at seat 0; seat+1 is to your left (antihorario). Everything that happens to cards is
// queued so the table shows events in order even when the server moves faster than the gestures.
// ---------------------------------------------------------------------------------------------

export interface TablePlayer {
  id: string
  name: string
  team: 'nosotros' | 'ellos' | 'random'
  handCount: number
  isConnected: boolean
}

export interface TableCallbacks {
  /** Local player committed a card. Resolve true once the server accepted it (false = back to hand). */
  requestPlay(card: Card): Promise<boolean>
  look(yaw: number, pitch: number): void
  arm(slot: number, fwd: number, lat: number, holding: boolean): void
  hover(slot: number): void
  status(text: string): void
  /** short click on the deck in the middle of the table (initial draw) */
  deckClick?(): void
  /** something broke inside the table (a frame, the WebGL context): report it */
  error?(message: string, stack?: string): void
  /** the centre of your view moved onto (playerId) or off (null) someone's face */
  faceAim?(playerId: string | null): void
}

type Moment = keyof typeof DUOTONES

interface HeldPose { pos: THREE.Vector3; quat: THREE.Quaternion }
// refCam: the camera frozen at grab time. With a free cursor the card goes where the cursor points
// on the table (projected through refCam, so camera lean/follow can't drift it); pointer-locked uses
// relative mouse motion instead.
interface Drag { k: number; fwd: number; lat: number; from: HeldPose; t0: number; lastSound: THREE.Vector3 | null; view: CardView; refCam: THREE.PerspectiveCamera | null }
interface RemoteArm { slot: number; fwd: number; lat: number; holding: boolean; t: number; view: CardView | null; from: HeldPose | null; t0: number }

const FACE_DOWN = Math.PI / 2
const CARD_T = 0.0009
const HOLD_FWD = -0.35
const REACH = 0.78
const HOVER_Y = TABLE_Y + 0.025
const LOOK_SENS = 0.0012
const EDGE_PX = 28 // a cursor this close to the side of the table counts as pinned there
const EDGE_TURN = 1.1 // rad/s the view keeps turning while dragging against an edge
const ARM_SENS = 0.0009
const PEEK_SENS = 0.0005
const PITCH_MIN = -0.8
const FACE_MARGIN = 0.01 // rad: the turn stops with the neighbour's face right at the centre of the view
const PITCH_MAX = 0.25
const HOLD_SEC = 0.18
const HOLD_PX = 6
const FELT = new THREE.Plane(new THREE.Vector3(0, 1, 0), -TABLE_Y)
const LOOK_HEARTBEAT = 1 // s: resend where you look even when still
const HEAD_YAW_MAX = 1.5 // rad: a mask turns as far as any camera can (78° at 8 players) and a bit more
const PRESENCE_TTL = 1.5 // s: remote look/arm older than this is ignored
const ease = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2)
const seg = (t: number, a: number, b: number) => THREE.MathUtils.clamp((t - a) / (b - a), 0, 1)
const quatOf = (rx: number, yaw: number, roll = 0) => new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, yaw, roll, 'YXZ'))
const now = () => performance.now() / 1000

// Your play zone: a dashed chalk outline where the card must land.
let zoneTex: THREE.Texture | null = null
function zoneTexture() {
  if (zoneTex) return zoneTex
  const cv = document.createElement('canvas')
  cv.width = 128
  cv.height = 192
  const g = cv.getContext('2d')!
  g.strokeStyle = '#fff'
  g.lineWidth = 6
  g.setLineDash([14, 10])
  g.strokeRect(6, 6, 116, 180)
  zoneTex = new THREE.CanvasTexture(cv)
  return zoneTex
}
const ASK_DUR = 0.9 // s: two knocks on the table to ask for señas
const NOD_HZ = 2.2 // nods / shakes per second for sí and no
const SENA_HOLD = 1.6 // s a seña stays on the face
/** How far into a seña the face is (0 rest … 1 full) at `t` seconds since it started. */
function senaAmount(s: Sena, t: number) {
  if (t < 0) return 0
  if (s === 'nada') return t < 0.2 ? t / 0.2 : t < 0.75 ? 1 : Math.max(0, 1 - (t - 0.75) / 0.2) // close, hold, reopen
  if (t >= SENA_HOLD) return 0
  return Math.min(1, t / 0.15, (SENA_HOLD - t) / 0.3)
}
const DEFAULT_PITCH = -0.34
const CHAIR_R_TAG = TABLE_R + TAG_R_OFFSET // in front of the coat, over the table edge (never inside the body)
const HAND_MIN = -0.2 // fully lowered: out of the frame
const HAND_MAX = 0.04
const HAND_WHEEL = 0.0003 // metres per wheel delta unit (~7 notches from resting to hidden)
const HAND_Y = -0.205 // your fan's grip height in camera space
const CARD_Y_REST = TABLE_Y + 0.004
const CARD_Y_WIN = TABLE_Y + 0.014

export class TableScene {
  private renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' })
  private scene = new THREE.Scene()
  private camera = new THREE.PerspectiveCamera(58, 1, 0.03, 30)
  private baseCam = new THREE.PerspectiveCamera(58, 1, 0.03, 30)
  private post = makePost(this.renderer, 720)
  private lamp = buildLamp(this.scene)
  private timer = new THREE.Timer()
  private resizeObs: ResizeObserver
  private disposed = false

  // seats
  private n = 0
  private players: TablePlayer[] = []
  private myId = ''
  private avatars: Avatar[] = []
  private nameTags: NameTag[] = []
  private tokens = new TableTokens()
  private choices = new TableChoices()
  private lastChoiceHint = ''
  private roomGroup = new THREE.Group()
  private handCounts: number[] = []
  private dealing = false

  // cards
  private pool: CardView[] = []
  private onTable = new Map<number, CardView>() // seat → card of the current base
  private wonStacks: CardView[][] = [] // one small face-down stack per base won, in front of the winner
  private wonBy: number[] = []
  private drawn: CardView[] = [] // initial draw cards
  private centerDeck: THREE.Mesh
  private queue: Promise<void> = Promise.resolve()
  private queued = 0

  // local player
  private viewmodel = new THREE.Group()
  // `hit` is an invisible twin of each card that stays at the REST pose: hover is tested against it,
  // so the lift animation can't pull the card out from under the cursor (hover flicker)
  private vm: Array<{ mesh: THREE.Mesh; hit: THREE.Mesh; mat: THREE.MeshStandardMaterial; lift: number; base: { x: number; y: number; z: number; rz: number } }> = []
  private hand: Card[] = []
  private canPlay = false
  private busy = false
  private drag: Drag | null = null
  private pending: { k: number; t0: number; moved: number } | null = null
  // press-and-drag on the table looks around; a press without movement is a click on the table
  private lookDrag: { moved: number } | null = null
  private deckHint = false
  // your hand's height, set with the mouse wheel: 0 = resting, negative = lowered out of the view
  private handOffset = 0
  private handOffsetT = 0
  private hovered = -1
  private lastHoverSent = -2

  // camera
  private yaw = 0
  private pitch = DEFAULT_PITCH
  private yawT = 0
  private pitchT = DEFAULT_PITCH
  private aim = 0
  private aimT = 0
  private lowered = 0
  private stand = 0
  private peek: { target: THREE.Vector3; standing: boolean } | null = null
  private mouse = new THREE.Vector2()
  private lastLookSent = { t: 0, yaw: 9, pitch: 9 }

  // avatars
  private poses: AvatarPose[] = []
  private senas = new Map<number, { s: Sena; t0: number; frozen?: boolean; gaze?: { yaw: number; pitch: number } }>()
  private aimedFace = -1
  private asks = new Map<number, { t0: number; knocks: number }>() // seat → knocking for señas
  private faceShown: Array<Sena | null> = [] // per seat, for tests
  dealTimes: Array<{ cards: number; players: number; ms: number }> = [] // hand arrived → dealt, for tests // seat → seña on their face
  private focus: THREE.Vector3 | null = null
  private stareAtYou = 0
  private remoteLook = new Map<number, { yaw: number; pitch: number; t: number }>()
  private remoteArm = new Map<number, RemoteArm>()
  private remoteHover = new Map<number, { slot: number; t: number }>()
  private duo: { name: Moment; t0: number } | null = null

  private zoneFx: THREE.Mesh[] = []
  private felt: ReturnType<typeof buildRoom> | null = null
  private guides = getViewSettings().guides
  private offView = onViewSettings((v) => {
    if (v.guides === this.guides) return
    this.guides = v.guides
    this.felt?.setGuides(v.guides)
    this.tokens.setGuides(v.guides)
  })
  private turnSeat = -1
  private winnerSeat = -1 // base resolved, waiting for everyone to confirm: the winning card glows
  private raycaster = new THREE.Raycaster()
  private backTex = backTexture() // shared and live: the settings can change the design

  constructor(private container: HTMLElement, private cb: TableCallbacks) {
    this.renderer.setPixelRatio(1)
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFShadowMap
    this.renderer.domElement.style.cssText = 'display:block;width:100%;height:100%;image-rendering:pixelated;cursor:crosshair'
    container.appendChild(this.renderer.domElement)
    this.scene.add(this.camera)
    this.detachAudio = attachAudio(this.camera) // you hear the room from your seat
    this.scene.add(this.tokens.group)
    this.tokens.setGuides(this.guides)
    this.scene.add(this.choices.group)
    this.scene.add(this.roomGroup)
    this.camera.add(this.viewmodel)

    this.centerDeck = new THREE.Mesh(
      new THREE.BoxGeometry(CARD_W, 40 * CARD_T, CARD_H),
      [0, 1, 2, 3, 4, 5].map((i) =>
        i === 2 ? new THREE.MeshStandardMaterial({ map: this.backTex, roughness: 0.85 }) : new THREE.MeshStandardMaterial({ color: hex(PALETTE.bone), roughness: 0.9 }),
      ),
    )
    this.centerDeck.position.set(0, TABLE_Y + 20 * CARD_T, 0)
    this.centerDeck.castShadow = true
    this.centerDeck.visible = false
    this.scene.add(this.centerDeck)

    for (let k = 0; k < MAX_HAND; k++) {
      const mat = new THREE.MeshStandardMaterial({ map: this.backTex, roughness: 0.8, emissive: 0xffffff, emissiveMap: this.backTex, emissiveIntensity: 0.25 })
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(CARD_W, CARD_H), mat)
      mesh.geometry.translate(0, CARD_H * 0.45, 0) // pivot near the bottom: fan from the grip
      mesh.visible = false
      const hit = new THREE.Mesh(mesh.geometry, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }))
      hit.visible = false // never drawn; raycasts still hit invisible meshes
      this.viewmodel.add(mesh, hit)
      this.vm.push({ mesh, hit, mat, lift: 0, base: { x: 0, y: -0.25, z: -0.36, rz: 0 } })
    }

    this.bindInput()
    this.resizeObs = new ResizeObserver(() => this.resize())
    this.resizeObs.observe(container)
    this.resize()
    this.renderer.setAnimationLoop((t) => {
      this.timer.update(t)
      // a frame that throws must not stop the table: three.js would never ask for the next one
      // and the 3D view would freeze while the rest of the page carries on
      try {
        this.frame(this.timer.getElapsed(), this.timer.getDelta())
      } catch (err) {
        this.reportError(err)
      }
    })
    const canvas = this.renderer.domElement
    canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault() // lets the browser restore it
      this.reportError(new Error('WebGL context lost'))
      this.cb.status('se perdió el contexto gráfico; intentando recuperarlo…')
    })
    canvas.addEventListener('webglcontextrestored', () => {
      this.reportError(new Error('WebGL context restored'))
      this.cb.status('')
    })
  }

  // ------------------------------------------------------------------ public API

  setPlayers(players: TablePlayer[], myId: string) {
    const order = players.map((p) => p.id).join('|')
    const prevOrder = this.players.map((p) => p.id).join('|')
    this.players = players
    this.myId = myId
    if (order !== prevOrder || this.n !== players.length) this.rebuildSeats()
    this.seatPlayers().forEach((p, s) => this.nameTags[s]?.set(p.name, this.relTeam(p.team), p.isConnected))
    if (!this.dealing) this.seatPlayers().forEach((p, s) => (this.handCounts[s] = p.handCount))
  }

  /** Your own cards (private). Rebuilds the fan unless a deal is revealing it card by card. */
  setHand(cards: Card[]) {
    this.hand = cards
    if (!this.dealing) this.layoutHand(cards.length)
  }

  setTurn(playerId: string | null, myTurn: boolean) {
    this.turnSeat = playerId ? this.seatOf(playerId) : -1
    // your turn starts: the hand you lowered (or raised) with the wheel comes back into view
    if (myTurn && !this.canPlay && getViewSettings().handResetOnTurn) this.handOffsetT = 0
    this.canPlay = myTurn
  }

  /** Your hand is still being dealt (no señas about it yet). */
  get isDealing() {
    return this.dealing
  }

  get isAnimating() {
    return this.queued > 0
  }

  /** New round: every player receives `perPlayer` cards from the dealer. */
  deal(dealerId: string | null, perPlayer: number, myHand: Card[]) {
    this.hand = myHand
    this.dealing = true // your fan fills card by card, not before the cards arrive
    this.vm.forEach((v) => (v.mesh.visible = false))
    const dealtAt = now()
    this.enqueue(async () => {
      await this.animateDeal(dealerId ? this.seatOf(dealerId) : this.n - 1, perPlayer)
      this.dealTimes.push({ cards: perPlayer, players: this.n, ms: Math.round((now() - dealtAt) * 1000) }) // tests
    })
  }

  cardPlayed(playerId: string, card: Card) {
    if (playerId === this.myId) return // already animated by your own arm
    const s = this.seatOf(playerId)
    if (s < 0) return
    this.enqueue(() => this.animateRemotePlay(s, card))
  }

  /** Highlight the winning card while the table waits for everyone to confirm (null = clear). */
  markWinner(playerId: string | null) {
    this.winnerSeat = playerId ? this.seatOf(playerId) : -1
  }

  baseResolved(winnerId: string) {
    const w = this.seatOf(winnerId)
    if (w < 0) return
    this.enqueue(async () => {
      await wait(0.7)
      await this.animateCollect(w)
    })
  }

  /** Round over: the won stacks go back to the dealer before the next deal. */
  clearRound(dealerId: string | null) {
    this.enqueue(() => this.animateSweep(dealerId ? this.seatOf(dealerId) : 0))
  }

  initialDraw(drawn: Array<{ playerId: string; card: Card }>, done: boolean) {
    this.centerDeck.visible = !done || drawn.length > 0
    for (let i = this.drawn.length; i < drawn.length; i++) {
      const s = this.seatOf(drawn[i].playerId)
      const card = drawn[i].card
      const view = this.take()
      this.drawn.push(view)
      this.enqueue(() => this.animateDraw(view, s, card))
    }
  }

  clearInitialDraw() {
    if (!this.drawn.length && !this.centerDeck.visible) return
    const views = this.drawn
    this.drawn = []
    this.enqueue(async () => {
      await wait(0.6)
      await Promise.all(views.map((v, i) => this.flyTo(v, new THREE.Vector3(0, TABLE_Y + 0.03, 0), quatOf(FACE_DOWN, 0), 0.4, i * 0.06, false)))
      views.forEach((v) => this.give(v))
      this.centerDeck.visible = false
    })
  }

  /**
   * A player makes a seña: it plays on their mask (facing `gaze`) for a moment. The server only
   * sends it here if you can see it — a partner's always, a rival's while you look at their face —
   * so everything that arrives shows. `elapsedMs`: you caught it that far into it.
   */
  sena(playerId: string, s: Sena, gaze?: { yaw: number; pitch: number }, elapsedMs = 0) {
    const seat = this.seatOf(playerId)
    if (seat <= 0) return
    this.senas.set(seat, { s, t0: now() - elapsedMs / 1000, gaze })
  }

  /**
   * Where you are looking right now, as a head turn from your seat (yaw + = left): the real camera
   * direction, so a right-click zoom counts too. A seña is made facing this way.
   */
  gaze() {
    const d = this.camera.getWorldDirection(new THREE.Vector3())
    let yaw = Math.atan2(-d.x, -d.z) - this.baseYaw
    yaw = Math.atan2(Math.sin(yaw), Math.cos(yaw))
    return { yaw, pitch: Math.asin(THREE.MathUtils.clamp(d.y, -1, 1)) }
  }

  /** As de Copas, on the table: keep or invert the direction (null: the card goes back). */
  askDirection(current: Direction): Promise<CopasChoice | null> {
    return this.choices.askDirection(current)
  }

  /** As de Oros, on the table: who of your team opens the next base (tag over their spot or their face). */
  askOpener(options: Array<{ id: string; name: string }>): Promise<string> {
    const seated = options.map((o) => ({ ...o, seat: this.seatOf(o.id) })).filter((o) => o.seat >= 0)
    return this.choices.askOpener(seated.map((o) => ({ ...o, head: this.avatars[o.seat].head })), this.n)
  }

  /** Answer / drop the open table question (keyboard, screen readers, tests). */
  chooseOnTable(id: string | null) {
    this.choices.choose(id)
  }

  cancelTableChoice() {
    this.choices.cancel()
  }

  private reported = new Set<string>()
  /** Log a table error once per message and hand it to the page (which forwards it to the server). */
  private reportError(err: unknown) {
    const e = err instanceof Error ? err : new Error(String(err))
    if (this.reported.has(e.message)) return
    this.reported.add(e.message)
    console.error('[table3d]', e)
    this.cb.error?.(e.message, e.stack)
  }

  /** A player asks their partners for señas: two knocks on the table with the right hand. */
  askSenas(playerId: string) {
    const seat = this.seatOf(playerId)
    if (seat >= 0) this.asks.set(seat, { t0: now(), knocks: 0 })
  }

  /** Asking for señas: the resting right hand lifts and knocks twice (only while it is free). */
  private knock(seat: number, p: AvatarPose, t: number) {
    const ask = this.asks.get(seat)
    if (!ask) return
    const u = (t - ask.t0) / ASK_DUR
    if (u >= 1) return void this.asks.delete(seat)
    const free = seat === 0 ? !this.drag && !this.pending && !this.busy : !p.rightWrist
    if (!free) return
    const lift = Math.abs(Math.sin(u * Math.PI * 2)) * 0.06 // two arcs, each ending on the felt
    p.rightWrist = this.restWrist(seat).add(new THREE.Vector3(0, lift, 0))
    const hits = Math.floor(u * 2 + 0.02)
    if (hits > ask.knocks && hits <= 2) {
      ask.knocks = hits
      sfx('knock', this.restWrist(seat), 0.8)
    }
  }

  /** Where a seat's right hand rests on the table (world). */
  private restWrist(seat: number) {
    return polar(TABLE_R - 0.04, seatAngle(seat, this.n), TABLE_Y + 0.03).addScaledVector(this.rightOf(seat), 0.2)
  }

  /** The seat whose face you can read at the centre of your view (same rule as the server). */
  private faceUnderCentre() {
    const origin = this.camera.getWorldPosition(new THREE.Vector3())
    const dir = this.camera.getWorldDirection(new THREE.Vector3())
    const head = new THREE.Vector3()
    const facing = new THREE.Vector3()
    let best = -1
    let bestD = Infinity
    for (const av of this.avatars) {
      if (av.seat === 0) continue
      av.head.getWorldPosition(head)
      // a mask turned practically away shows nothing: its face (-z) must not point away from you
      av.head.getWorldDirection(facing).negate()
      if (facing.dot(origin.clone().sub(head).normalize()) < FACE_BACK_DOT) continue
      const along = head.sub(origin).dot(dir)
      if (along <= 0) continue
      const off = head.addScaledVector(dir, -along).length() // distance from the ray
      if (off < FACE_AIM_RADIUS && along < bestD) {
        best = av.seat
        bestD = along
      }
    }
    return best
  }

  presence(kind: 'look' | 'arm' | 'hover', playerId: string, data: Record<string, unknown>) {
    const s = this.seatOf(playerId)
    if (s <= 0) return
    const t = now()
    if (kind === 'look') this.remoteLook.set(s, { yaw: Number(data.yaw), pitch: Number(data.pitch), t })
    if (kind === 'hover') this.remoteHover.set(s, { slot: Number(data.slot), t })
    if (kind === 'arm') {
      const prev = this.remoteArm.get(s)
      const holding = data.holding === true
      this.remoteArm.set(s, {
        slot: Number(data.slot),
        fwd: Number(data.fwd),
        lat: Number(data.lat),
        holding,
        t,
        view: prev?.view ?? null,
        from: prev?.from ?? null,
        t0: prev?.t0 ?? t,
      })
    }
  }

  /** A dramatic beat: duotone flash, a knock on the table and everyone stares at you. */
  moment(name: Moment) {
    this.duo = { name, t0: now() }
    this.stareAtYou = 1.6
    sfx('knock', polar(TABLE_R - 0.1, seatAngle(0, this.n), TABLE_Y), 1)
  }

  toggleMute() {
    return toggleMute()
  }

  private detachAudio: () => void = () => undefined

  dispose() {
    this.detachAudio()
    this.offView()
    this.disposed = true
    this.renderer.setAnimationLoop(null)
    this.resizeObs.disconnect()
    this.unbindInput()
    this.renderer.dispose()
    this.renderer.domElement.remove()
  }

  // ------------------------------------------------------------------ seats

  /** In game, colours are relative to you (same as the anotador): teal = your team, rose = rivals. */
  private relTeam(team: TablePlayer['team']): 'nosotros' | 'ellos' | 'random' {
    const mine = this.players.find((p) => p.id === this.myId)?.team
    if (team === 'random' || !mine || mine === 'random') return 'random'
    return team === mine ? 'nosotros' : 'ellos' // NameTag maps nosotros→teal, ellos→rose
  }

  private seatPlayers() {
    const me = Math.max(0, this.players.findIndex((p) => p.id === this.myId))
    return this.players.map((_, i) => this.players[(me + i) % this.players.length])
  }

  private playerAt(seat: number) {
    const me = this.players.findIndex((p) => p.id === this.myId)
    return this.players[(me + seat) % this.n]?.id ?? ''
  }

  private seatOf(playerId: string) {
    const me = this.players.findIndex((p) => p.id === this.myId)
    const i = this.players.findIndex((p) => p.id === playerId)
    if (i < 0 || me < 0) return -1
    return (i - me + this.n) % this.n
  }

  private rebuildSeats() {
    this.n = Math.max(2, this.players.length)
    this.avatars.forEach((a) => this.scene.remove(a.root))
    this.roomGroup.clear()
    this.zoneFx.forEach((z) => this.scene.remove(z))
    // names are no longer chalked on the felt: they float at each player's belly (NameTag)
    const labels = this.seatPlayers().map(() => ({ name: '', team: 'random' as const }))
    const tmp = new THREE.Scene()
    this.felt = buildRoom(tmp, this.n, labels, getViewSettings().guides)
    ;[...tmp.children].forEach((c) => this.roomGroup.add(c))
    this.scene.background = tmp.background
    this.scene.fog = tmp.fog
    this.nameTags.forEach((t) => {
      this.scene.remove(t.mesh)
      t.dispose()
    })
    this.nameTags = Array.from({ length: this.n }, (_, s) => {
      const t = new NameTag()
      const p = this.seatPlayers()[s]
      if (p) t.set(p.name, this.relTeam(p.team), p.isConnected)
      t.mesh.visible = s !== 0 // you don't need your own name
      this.scene.add(t.mesh)
      return t
    })
    this.avatars = Array.from({ length: this.n }, (_, s) => {
      const av = makeAvatar(s, this.n, s === 0)
      this.scene.add(av.root)
      return av
    })
    this.handCounts = Array(this.n).fill(0)
    this.zoneFx = Array.from({ length: this.n }, (_, s) => this.makeZoneFx(s))
    // camera frame for this table size
    const a0 = seatAngle(0, this.n)
    this.eye = polar(EYE_R, a0, EYE_Y)
    this.baseYaw = Math.PI / 2 - a0
    this.forward0 = new THREE.Vector3(-Math.cos(a0), 0, -Math.sin(a0))
    this.shoulder0 = polar(SHOULDER_R, a0, SHOULDER_Y).addScaledVector(this.rightOf(0), 0.19)
    this.edge0 = polar(TABLE_R, a0, 0)
    // you can turn just far enough to put any player's whole face in the centre of your view
    // (measured to the real heads: they sit further out than your eye, so the inscribed angle
    // to their seat falls short)
    const head = new THREE.Vector3()
    let need = 0.35
    for (const av of this.avatars) {
      if (av.seat === 0) continue
      av.root.updateMatrixWorld(true)
      const d = av.head.getWorldPosition(head).sub(this.eye)
      const yaw = Math.atan2(-d.x, -d.z) - this.baseYaw
      need = Math.max(need, Math.abs(Math.atan2(Math.sin(yaw), Math.cos(yaw))))
    }
    this.yawMax = need + FACE_MARGIN
  }

  private eye = new THREE.Vector3()
  private pointerEdge: -1 | 0 | 1 = 0 // the cursor pinned to the left / right edge of the table
  private baseYaw = 0
  private forward0 = new THREE.Vector3()
  private shoulder0 = new THREE.Vector3()
  private edge0 = new THREE.Vector3()
  private yawMax = 1

  private yawOf = (s: number) => Math.PI / 2 - seatAngle(s, this.n)
  private outOf = (s: number) => new THREE.Vector3(Math.cos(seatAngle(s, this.n)), 0, Math.sin(seatAngle(s, this.n)))
  private rightOf = (s: number) => new THREE.Vector3(Math.sin(seatAngle(s, this.n)), 0, -Math.cos(seatAngle(s, this.n)))
  private clampYaw = (v: number) => THREE.MathUtils.clamp(v, -this.yawMax, this.yawMax)
  private clampPitch = (v: number) => THREE.MathUtils.clamp(v, PITCH_MIN, PITCH_MAX)

  private makeZoneFx(s: number) {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(CARD_W + 0.06, CARD_H + 0.1),
      new THREE.MeshBasicMaterial({ map: zoneTexture(), color: new THREE.Color(hex(PALETTE.chalk)).multiplyScalar(1.6), transparent: true, depthWrite: false }),
    )
    m.position.copy(playSlot(s, this.n).pos).setY(TABLE_Y + 0.002)
    m.quaternion.copy(quatOf(-Math.PI / 2, this.yawOf(s)))
    m.visible = false
    this.scene.add(m)
    return m
  }

  // ------------------------------------------------------------------ cards

  private take(): CardView {
    const v = this.pool.pop() ?? makeCard()
    v.forget()
    v.root.visible = true
    if (!v.root.parent) this.scene.add(v.root)
    return v
  }

  private give(v: CardView) {
    v.root.visible = false
    v.forget()
    this.pool.push(v)
  }

  private enqueue(fn: () => Promise<void>) {
    this.queued++
    this.queue = this.queue.then(fn).catch((err) => this.reportError(err)).finally(() => this.queued--)
  }

  private heldPose(s: number, k: number): HeldPose {
    const o = s === 0 ? this.vm[Math.min(k, MAX_HAND - 1)].mesh : this.avatars[s].hand[Math.min(k, MAX_HAND - 1)].root
    o.updateWorldMatrix(true, false)
    return { pos: o.getWorldPosition(new THREE.Vector3()), quat: o.getWorldQuaternion(new THREE.Quaternion()) }
  }

  private layoutHand(count: number) {
    const c = Math.min(count, MAX_HAND)
    this.vm.forEach((v, k) => {
      // held in the LEFT hand, off to the side: your own play zone must stay visible
      const off = k - (c - 1) / 2
      // height tuned for a 50° field of view (wider settings only show more around it): the whole card face stays on screen (at -0.25 its lower half
      // fell below the frame and grabbing it failed near the edge)
      v.base = { x: -0.15 + off * 0.026, y: HAND_Y - Math.abs(off) * 0.004, z: -0.36 + k * 0.002, rz: -0.04 - off * 0.14 }
      v.mesh.visible = k < c
      if (k < c) this.setVmFace(k, this.hand[k])
    })
  }

  private setVmFace(k: number, card: Card | undefined) {
    const tex = card ? toTexture(drawFace(card.suit, card.value)) : this.backTex
    this.vm[k].mat.map = tex
    this.vm[k].mat.emissiveMap = tex
    this.vm[k].mat.needsUpdate = true
  }

  /** Move a card view to a pose with a toss arc. */
  private flyTo(v: CardView, to: THREE.Vector3, quat: THREE.Quaternion, dur: number, delay: number, stepped: boolean, arc = 0.12) {
    let from: HeldPose | null = null
    return schedule({
      delay,
      dur,
      stepped,
      update: (u) => {
        if (!from) from = { pos: v.root.position.clone(), quat: v.root.quaternion.clone() }
        const e = ease(u)
        v.root.position.copy(from.pos).lerp(to, e)
        v.root.position.y += Math.sin(u * Math.PI) * arc
        v.root.quaternion.copy(from.quat).slerp(quat, e)
      },
    })
  }

  // One gesture on the shared play timeline (see play.ts). Real play: t→t; feint: out and back.
  private gesture(s: number, view: CardView, hold: HeldPose, o: { dur: number; map: (t: number) => number; reveal?: Card; from?: HeldPose; blend?: number }) {
    const start = o.from ?? hold
    view.root.visible = true
    view.root.position.copy(start.pos)
    view.root.quaternion.copy(start.quat)
    let lastPt = o.map(0)
    let revealed = false
    return schedule({
      dur: o.dur,
      stepped: s !== 0,
      update: (_u, t) => {
        const pt = o.map(t)
        const pose = playPose(s, this.n, 0, pt, hold.pos)
        const b = ease(seg(t, 0, o.blend ?? 0.3))
        view.root.position.copy(start.pos).lerp(pose.cardPos, b)
        view.root.quaternion.copy(start.quat).slerp(new THREE.Quaternion().setFromEuler(pose.cardRot), b)
        this.poses[s].rightWrist = pose.wrist
        this.poses[s].lean = pose.lean
        this.poses[s].headPitch = pose.headPitch
        this.focus = view.root.position
        if (o.reveal && pose.faceVisible && !revealed) {
          view.setIdentity(o.reveal.suit, o.reveal.value)
          revealed = true
        }
        const at = view.root.position
        const crossed = (edge: number) => lastPt < edge && pt >= edge
        if (crossed(0.02)) sfx('pick', at)
        if (crossed(0.6)) sfx('slide', at, 0.8)
        if (o.reveal && crossed(1.12)) sfx('place', at)
        if (o.reveal && crossed(1.32)) sfx('flip', at)
        lastPt = pt
      },
    })
  }

  // ------------------------------------------------------------------ animations

  // timings mirrored by dealAnimationMs (@la-base/shared): bots wait for the deal to end
  private async animateDeal(dealer: number, perPlayer: number) {
    this.dealing = true
    const shown = Array(this.n).fill(0)
    this.avatars.forEach((a) => a.setHandCount(0))
    this.vm.forEach((v) => (v.mesh.visible = false))
    this.layoutHand(0)
    const base = polar(0.58, seatAngle(dealer, this.n), TABLE_Y + 0.002).addScaledVector(this.rightOf(dealer), 0.12)
    const total = perPlayer * this.n
    const stack = Array.from({ length: total }, (_, i) => {
      const v = this.take()
      v.root.position.copy(base).add(new THREE.Vector3(0, i * CARD_T, 0))
      v.root.quaternion.copy(quatOf(FACE_DOWN, this.yawOf(dealer) + (Math.random() - 0.5) * 0.2))
      return v
    })
    sfx('shuffle', base, 0.8)
    await wait(0.5)
    const jobs: Promise<void>[] = []
    let step = 0
    for (let round = 0; round < perPlayer; round++)
      for (let j = 1; j <= this.n; j++) {
        const s = (dealer + j) % this.n
        const k = round
        const v = stack[total - 1 - step]
        let from: HeldPose | null = null
        jobs.push(
          schedule({
            delay: step * 0.11,
            dur: 0.42,
            stepped: dealer !== 0,
            update: (u) => {
              if (!from) {
                from = { pos: v.root.position.clone(), quat: v.root.quaternion.clone() }
                sfx('toss', from.pos, 0.6)
              }
              const to = this.heldPose(s, k)
              v.root.position.copy(from.pos).lerp(to.pos, ease(u))
              v.root.position.y += Math.sin(u * Math.PI) * (0.16 + from.pos.distanceTo(to.pos) * 0.1)
              const spin = quatOf(FACE_DOWN, this.yawOf(dealer) + u * Math.PI * 1.5)
              v.root.quaternion.copy(from.quat).slerp(spin, Math.min(1, u * 3)).slerp(to.quat, ease(seg(u, 0.7, 1)))
              const dir = to.pos.clone().sub(from.pos).setY(0).normalize()
              this.poses[dealer].rightWrist = from.pos.clone().addScaledVector(dir, 0.06 + Math.sin(u * Math.PI) * 0.08).add(new THREE.Vector3(0, 0.06, 0))
              this.poses[dealer].lean = 0.4
              this.focus = from.pos
            },
            done: () => {
              this.give(v)
              shown[s]++
              if (s === 0) {
                this.layoutHand(Math.min(shown[0], this.hand.length))
              } else this.avatars[s].setHandCount(shown[s])
              sfx('toHand', this.heldPose(s, k).pos, 0.8)
            },
          }),
        )
        step++
      }
    await Promise.all(jobs)
    this.dealing = false
    this.seatPlayers().forEach((p, s) => (this.handCounts[s] = p.handCount))
    this.layoutHand(this.hand.length)
  }

  private async animateRemotePlay(s: number, card: Card) {
    const count = Math.max(1, this.handCounts[s] || 1)
    const k = Math.min(count, MAX_HAND) - 1
    const arm = this.remoteArm.get(s)
    const hold = this.heldPose(s, k)
    let view: CardView
    let from: HeldPose | undefined
    let map = (t: number) => t
    let dur = PLAY_DURATION
    if (arm?.view && arm.holding) {
      // they were moving the card by hand: continue from where it is (touch down + reveal)
      view = arm.view
      arm.view = null
      from = { pos: view.root.position.clone(), quat: view.root.quaternion.clone() }
      map = (t) => 1.1 + t
      dur = PLAY_DURATION - 1.1
    } else view = this.take()
    this.avatars[s].setHandCount(count - 1)
    this.handCounts[s] = count - 1
    await this.gesture(s, view, hold, { dur, map, reveal: card, from, blend: from ? 0.12 : 0.3 })
    this.onTable.get(s) && this.give(this.onTable.get(s)!)
    this.onTable.set(s, view)
  }

  private async animateCollect(w: number) {
    this.winnerSeat = -1
    const cards = [...this.onTable.values()]
    this.onTable.clear()
    const stackAt = playSlot(w, this.n).pos
    const idx = this.wonBy.filter((x) => x === w).length
    const pileAt = polar(TABLE_R - 0.16, seatAngle(w, this.n), TABLE_Y + 0.002).addScaledVector(this.rightOf(w), 0.14 + idx * 0.035)
    // the cards slide to the winner's zone and flip face-down into one stack…
    await Promise.all(
      cards.map((v, i) =>
        this.flyTo(v, stackAt.clone().add(new THREE.Vector3(0, i * CARD_T + 0.001, 0)), quatOf(FACE_DOWN + Math.PI * 2, this.yawOf(w)), 0.55, i * 0.08, w !== 0, 0.05),
      ),
    )
    sfx('slide', stackAt, 0.7)
    // …and the winner pulls the stack to their side (one small stack per base won)
    await schedule({
      dur: 0.6,
      stepped: w !== 0,
      update: (u) => {
        const e = ease(u)
        cards.forEach((v, i) => {
          v.root.position.copy(stackAt).lerp(pileAt, e).add(new THREE.Vector3(0, i * CARD_T + 0.001, 0))
          v.root.quaternion.copy(quatOf(FACE_DOWN, this.yawOf(w) + e * 0.25))
        })
        this.poses[w].rightWrist = cards[0]?.root.position.clone().addScaledVector(this.outOf(w), 0.07).add(new THREE.Vector3(0, 0.03, 0))
        this.poses[w].lean = Math.sin(u * Math.PI) * 0.7
        this.focus = cards[0]?.root.position ?? null
      },
    })
    sfx('place', pileAt, 0.6)
    this.wonStacks.push(cards)
    this.wonBy.push(w)
  }

  private async animateSweep(dealer: number) {
    const stacks = this.wonStacks.flat().concat([...this.onTable.values()])
    this.wonStacks = []
    this.wonBy = []
    this.onTable.clear()
    if (!stacks.length) return
    const at = polar(0.58, seatAngle(dealer, this.n), TABLE_Y + 0.002).addScaledVector(this.rightOf(dealer), 0.12)
    await Promise.all(stacks.map((v, i) => this.flyTo(v, at.clone().add(new THREE.Vector3(0, i * CARD_T, 0)), quatOf(FACE_DOWN, this.yawOf(dealer)), 0.5, (i % 12) * 0.05, dealer !== 0, 0.18)))
    sfx('place', at, 0.8)
    stacks.forEach((v) => this.give(v))
  }

  private async animateDraw(view: CardView, s: number, card: Card) {
    view.root.position.copy(this.centerDeck.position).add(new THREE.Vector3(0, 0.03, 0))
    view.root.quaternion.copy(quatOf(FACE_DOWN, this.yawOf(s)))
    sfx('pick', view.root.position)
    this.focus = view.root.position
    const slot = playSlot(s, this.n).pos
    view.setIdentity(card.suit, card.value) // the draw is public: it turns face-up in the air
    await this.flyTo(view, slot, quatOf(FACE_DOWN + Math.PI, this.yawOf(s)), 0.7, 0, s !== 0, 0.2)
    sfx('flip', slot)
  }

  // ------------------------------------------------------------------ local arm

  private dragPose(d: { k: number; fwd: number; lat: number }): HeldPose {
    const hold = this.heldPose(0, d.k)
    const R = this.rightOf(0)
    const inward = this.outOf(0).negate()
    const over = this.edge0.clone().addScaledVector(inward, Math.max(0, d.fwd)).addScaledVector(R, d.lat).setY(HOVER_Y)
    const v = over.clone().sub(this.shoulder0)
    const maxH = Math.sqrt(Math.max(REACH * REACH - v.y * v.y, 0))
    const h = Math.hypot(v.x, v.z)
    if (h > maxH) {
      over.set(this.shoulder0.x + (v.x * maxH) / h, HOVER_Y, this.shoulder0.z + (v.z * maxH) / h)
      const rel = over.clone().sub(this.edge0)
      d.fwd = rel.dot(inward)
      d.lat = rel.dot(R)
    }
    const down = quatOf(FACE_DOWN, this.yawOf(0), THREE.MathUtils.clamp(-d.lat * 0.4, -0.2, 0.2))
    if (d.fwd >= 0) return { pos: over, quat: down }
    const u = ease(THREE.MathUtils.clamp(d.fwd / HOLD_FWD, 0, 1))
    return { pos: over.lerp(hold.pos, u), quat: down.slerp(hold.quat, u) }
  }

  /** Same idea for a remote player's arm (from their presence stream). */
  private remoteDragPose(s: number, slot: number, fwd: number, lat: number): HeldPose {
    const a = seatAngle(s, this.n)
    const edge = polar(TABLE_R, a, 0)
    const inward = this.outOf(s).negate()
    const over = edge.clone().addScaledVector(inward, Math.max(0, fwd)).addScaledVector(this.rightOf(s), lat).setY(HOVER_Y)
    const down = quatOf(FACE_DOWN, this.yawOf(s))
    if (fwd >= 0) return { pos: over, quat: down }
    const hold = this.heldPose(s, slot)
    const u = ease(THREE.MathUtils.clamp(fwd / HOLD_FWD, 0, 1))
    return { pos: over.lerp(hold.pos, u), quat: down.slerp(hold.quat, u) }
  }

  private inZone(pos: THREE.Vector3) {
    const d = pos.clone().sub(playSlot(0, this.n).pos)
    return Math.abs(d.dot(this.rightOf(0))) < CARD_W / 2 + 0.03 && Math.abs(d.dot(this.outOf(0))) < CARD_H / 2 + 0.05 && pos.y < TABLE_Y + 0.06
  }

  private localReady() {
    return this.canPlay && !this.busy && this.queued === 0
  }

  private startDrag(k: number) {
    if (this.drag || this.busy || !this.vm[k].mesh.visible) return
    const from = this.heldPose(0, k)
    this.vm[k].mesh.visible = false
    const view = this.take()
    view.root.position.copy(from.pos)
    view.root.quaternion.copy(from.quat)
    const locked = false // the arm always follows the free cursor now (no pointer lock)
    this.drag = { k, fwd: HOLD_FWD, lat: 0, from, t0: now(), lastSound: null, view, refCam: locked ? null : this.camera.clone() }
    if (!locked) this.cursorToDrag()
    sfx('pick', from.pos)
  }

  /** Free cursor: the point under the cursor on the card-hover plane becomes the card's target. */
  private cursorToDrag() {
    const d = this.drag
    if (!d?.refCam) return
    d.refCam.updateMatrixWorld()
    const ray = new THREE.Raycaster()
    ray.setFromCamera(this.mouse, d.refCam)
    const hit = ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -HOVER_Y), new THREE.Vector3())
    let fwd: number
    let lat: number
    if (hit) {
      const rel = hit.sub(this.edge0)
      fwd = rel.dot(this.outOf(0).negate())
      lat = rel.dot(this.rightOf(0))
    } else {
      fwd = HOLD_FWD // cursor above the horizon: keep it in the hand
      lat = d.lat
    }
    d.fwd = THREE.MathUtils.clamp(fwd, HOLD_FWD, 0.8)
    d.lat = THREE.MathUtils.clamp(lat, -0.35, 0.35)
  }

  /** Local commit: animate out to the zone while the server confirms, then reveal (or return). */
  private async commitLocal(k: number, view: CardView, from: HeldPose | null) {
    const card = this.hand[k]
    if (!card) return
    this.busy = true
    const hold = from ?? this.heldPose(0, k)
    this.vm[k].mesh.visible = false
    const accepted = this.cb.requestPlay(card)
    if (!from) await this.gesture(0, view, hold, { dur: 1.1, map: (t) => t }) // quick click: reach the zone
    const ok = await accepted
    if (ok) {
      const at = { pos: view.root.position.clone(), quat: view.root.quaternion.clone() }
      await this.gesture(0, view, hold, { dur: PLAY_DURATION - 1.1, map: (t) => 1.1 + t, reveal: card, from: at, blend: 0.12 })
      this.onTable.get(0) && this.give(this.onTable.get(0)!)
      this.onTable.set(0, view)
    } else {
      await this.returnToHand(view, k)
    }
    this.busy = false
  }

  private async returnToHand(view: CardView, k: number) {
    const start = { pos: view.root.position.clone(), quat: view.root.quaternion.clone() }
    await schedule({
      dur: 0.32,
      stepped: false,
      update: (u) => {
        const hold = this.heldPose(0, k)
        view.root.position.copy(start.pos).lerp(hold.pos, ease(u))
        view.root.quaternion.copy(start.quat).slerp(hold.quat, ease(u))
        this.poses[0].rightWrist = view.root.position.clone().add(new THREE.Vector3(0, -0.05, 0))
      },
    })
    this.give(view)
    if (k < this.hand.length) this.vm[k].mesh.visible = true
    sfx('toHand', this.heldPose(0, k).pos)
  }

  private releaseDrag() {
    const d = this.drag
    if (!d) return
    this.drag = null
    this.cb.arm(d.k, d.fwd, d.lat, false)
    const pos = d.view.root.position.clone()
    if (this.localReady() && this.inZone(pos)) {
      void this.commitLocal(d.k, d.view, { pos, quat: d.view.root.quaternion.clone() })
      return
    }
    if (pos.y < TABLE_Y + 0.06) this.cb.status(this.canPlay ? 'esperá a que termine la jugada' : 'no es tu turno')
    this.busy = true
    void this.returnToHand(d.view, d.k).then(() => (this.busy = false))
  }

  private quickPlay(k: number) {
    if (!this.localReady() || !this.vm[k].mesh.visible) return false
    void this.commitLocal(k, this.take(), null)
    return true
  }

  private updateDrag() {
    const d = this.drag
    if (!d) return
    const target = this.dragPose(d)
    const b = ease(THREE.MathUtils.clamp((now() - d.t0) / 0.15, 0, 1))
    const c = d.view.root
    c.position.copy(d.from.pos).lerp(target.pos, b)
    c.quaternion.copy(d.from.quat).slerp(target.quat, b)
    this.poses[0].rightWrist =
      d.fwd > -0.15 ? c.position.clone().addScaledVector(this.outOf(0), 0.075).add(new THREE.Vector3(0, 0.03, 0)) : c.position.clone().add(new THREE.Vector3(0, -0.06, 0))
    this.poses[0].lean = THREE.MathUtils.clamp(d.fwd / 0.55, 0, 1) * (d.refCam ? 0.35 : 0.9) // small lean: the view barely moves under a free cursor
    this.focus = c.position
    if (d.fwd >= 0) {
      if (!d.lastSound || d.lastSound.distanceTo(c.position) > 0.09) {
        if (d.lastSound) sfx('slide', c.position, 0.45)
        d.lastSound = c.position.clone()
      }
    } else d.lastSound = null
  }

  private updateRemoteArms() {
    const t = now()
    for (const [s, arm] of this.remoteArm) {
      const live = arm.holding && t - arm.t < PRESENCE_TTL
      if (live) {
        const slot = Math.min(Math.max(0, arm.slot), Math.max(0, (this.handCounts[s] || 1) - 1))
        if (!arm.view) {
          arm.view = this.take()
          arm.from = this.heldPose(s, slot)
          arm.t0 = t
          this.avatars[s].hand[slot].root.visible = false
          sfx('pick', arm.from.pos, 0.6)
        }
        const pose = this.remoteDragPose(s, slot, arm.fwd, arm.lat)
        const b = ease(THREE.MathUtils.clamp((t - arm.t0) / 0.2, 0, 1))
        arm.view.root.position.copy(arm.from!.pos).lerp(pose.pos, b)
        arm.view.root.quaternion.copy(arm.from!.quat).slerp(pose.quat, b)
        this.poses[s].rightWrist = arm.view.root.position.clone().addScaledVector(this.outOf(s), 0.075).add(new THREE.Vector3(0, 0.03, 0))
        this.poses[s].lean = THREE.MathUtils.clamp(arm.fwd / 0.55, 0, 1) * 0.9
        this.focus = arm.view.root.position
      } else if (arm.view) {
        // they let go without playing: the card goes back to their hand
        const view = arm.view
        arm.view = null
        const slot = Math.min(Math.max(0, arm.slot), Math.max(0, (this.handCounts[s] || 1) - 1))
        void this.flyTo(view, this.heldPose(s, slot).pos, this.heldPose(s, slot).quat, 0.3, 0, true, 0.02).then(() => {
          this.give(view)
          this.avatars[s].setHandCount(this.handCounts[s])
        })
      }
    }
  }

  // ------------------------------------------------------------------ input

  private handlers: Array<[EventTarget, string, EventListener]> = []
  private on(target: EventTarget, type: string, fn: (e: never) => void) {
    const h = fn as unknown as EventListener
    target.addEventListener(type, h)
    this.handlers.push([target, type, h])
  }
  private unbindInput() {
    this.handlers.forEach(([t, type, h]) => t.removeEventListener(type, h))
    this.handlers = []
  }

  private bindInput() {
    const el = this.renderer.domElement
    this.on(window, 'pointermove', (e: PointerEvent) => {
      const r = el.getBoundingClientRect()
      this.pointerEdge = e.clientX <= r.left + EDGE_PX ? -1 : e.clientX >= r.right - EDGE_PX ? 1 : 0
      this.mouse.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
      if (this.pending) {
        this.pending.moved += Math.abs(e.movementX) + Math.abs(e.movementY)
        this.updatePending() // start the arm right away, don't wait for the next frame (low FPS)
      }
      if (this.drag) {
        if (this.drag.refCam) this.cursorToDrag()
        else {
          this.drag.fwd = THREE.MathUtils.clamp(this.drag.fwd - e.movementY * ARM_SENS, HOLD_FWD, 0.8)
          this.drag.lat = THREE.MathUtils.clamp(this.drag.lat + e.movementX * ARM_SENS, -0.35, 0.35)
        }
        this.cb.arm(this.drag.k, this.drag.fwd, this.drag.lat, true)
      } else if (this.peek) this.panPeek(e.movementX, e.movementY)
      else if (this.lookDrag) {
        this.lookDrag.moved += Math.abs(e.movementX) + Math.abs(e.movementY)
        const v = getViewSettings()
        const k = (v.invertLook ? -1 : 1) * v.lookSensitivity * LOOK_SENS // inverted: you drag the table, not your head
        this.yawT = this.clampYaw(this.yawT - e.movementX * k)
        this.pitchT = this.clampPitch(this.pitchT - e.movementY * k)
      }
    })
    this.on(el, 'contextmenu', (e: Event) => e.preventDefault())
    el.addEventListener(
      'wheel',
      (e: WheelEvent) => {
        e.preventDefault()
        // wheel down lowers the hand, wheel up raises it (continuous, clamped)
        const step = Math.sign(e.deltaY) * Math.min(Math.abs(e.deltaY), 120) * HAND_WHEEL
        this.handOffsetT = THREE.MathUtils.clamp(this.handOffsetT - step, HAND_MIN, HAND_MAX)
      },
      { passive: false },
    )
    this.on(el, 'pointerdown', (e: PointerEvent) => {
      if (e.button === 2) {
        if (!this.drag) this.beginPeek()
        return
      }
      if (e.button !== 0) return
      if (this.choices.hovered && this.choices.click()) return // a decision on the table
      el.setPointerCapture(e.pointerId)
      if (this.hovered >= 0) this.pending = { k: this.hovered, t0: now(), moved: 0 }
      else {
        this.lookDrag = { moved: 0 }
        el.style.cursor = 'grabbing'
      }
    })
    const endLeft = () => {
      el.style.cursor = 'crosshair'
      if (this.lookDrag) {
        const clicked = this.lookDrag.moved < HOLD_PX
        this.lookDrag = null
        if (clicked) this.tableClick()
        else if (getViewSettings().cameraReturn) this.recenter()
        return
      }
      this.updatePending() // a long hold is a drag even if no frame ran in between
      if (this.pending) {
        const k = this.pending.k
        this.pending = null
        if (!this.quickPlay(k)) {
          this.cb.status(this.canPlay ? 'esperá a que termine la jugada' : 'no es tu turno')
          this.vm[k].lift = 1.6
        }
        return
      }
      this.releaseDrag()
    }
    this.on(el, 'pointerup', (e: PointerEvent) => {
      if (e.button === 0) endLeft()
      if (e.button === 2) this.endPeek()
    })
    this.on(el, 'pointercancel', endLeft)
  }

  /** Physical tokens on the felt (dealer, who asks, asked bases + beans, kamikaze planes). */
  setTokens(t: { dealerId: string | null; bidderId: string | null; bids: Array<{ playerId: string; value: number; won: number }>; kamikazeIds: string[] } | null) {
    if (!t || !this.n) return this.tokens.update(null)
    this.tokens.update({
      n: this.n,
      dealerSeat: t.dealerId ? this.seatOf(t.dealerId) : -1,
      bidderSeat: t.bidderId ? this.seatOf(t.bidderId) : -1,
      bids: t.bids.map((b) => ({ seat: this.seatOf(b.playerId), value: b.value, won: b.won })).filter((b) => b.seat >= 0),
      kamikazeSeats: t.kamikazeIds.map((id) => this.seatOf(id)).filter((s) => s >= 0),
    })
  }

  /** Your turn to draw: the deck in the middle glows and pulses (click it). */
  setDeckHint(on: boolean) {
    this.deckHint = on
  }

  /** Screen position of the centre deck (tests). */
  deckScreen() {
    const p = this.centerDeck.getWorldPosition(new THREE.Vector3()).project(this.camera)
    const r = this.renderer.domElement.getBoundingClientRect()
    return { x: r.left + ((p.x + 1) / 2) * r.width, y: r.top + ((1 - p.y) / 2) * r.height, visible: this.centerDeck.visible }
  }

  /** Ease the head back to the seated default (camera-return setting). */
  private recenter() {
    this.yawT = 0
    this.pitchT = DEFAULT_PITCH
  }

  /** A click (no drag) on the table: the deck in the middle draws during the initial draw. */
  private tableClick() {
    if (!this.centerDeck.visible || !this.cb.deckClick) return
    this.raycaster.setFromCamera(this.mouse, this.camera)
    if (this.raycaster.intersectObject(this.centerDeck, false).length) this.cb.deckClick()
  }

  private updatePending() {
    if (this.pending && (now() - this.pending.t0 > HOLD_SEC || this.pending.moved > HOLD_PX)) {
      const k = this.pending.k
      this.pending = null
      this.renderer.domElement.style.cursor = 'none'
      this.startDrag(k)
    }
  }

  private updateHover(time: number, dt: number) {
    this.raycaster.setFromCamera(this.mouse, this.camera)
    // the felt under the pointer (bean heaps reveal their chalked number there)
    const felt = this.raycaster.ray.intersectPlane(FELT, new THREE.Vector3())
    this.tokens.hoverAt(felt && felt.clone().setY(0).length() < TABLE_R ? felt : null)
    // an open question on the table (As de Copas / Oros) takes the pointer before your cards
    const choice = this.choices.update(time, dt, this.camera, this.raycaster)
    this.renderer.domElement.style.cursor = choice ? 'pointer' : this.lookDrag ? 'grabbing' : 'crosshair'
    if (choice || this.choices.active) {
      this.hovered = -1
      const hint = this.choices.hint() ?? ''
      if (hint !== this.lastChoiceHint) this.cb.status((this.lastChoiceHint = hint))
      return
    }
    // targets: every card's rest-pose twin, plus the lifted card itself while it's hovered (so you
    // can move along the raised card without losing it)
    const targets = this.vm.filter((v) => v.mesh.visible).map((v) => v.hit)
    if (this.hovered >= 0 && this.vm[this.hovered]?.mesh.visible) targets.push(this.vm[this.hovered].mesh)
    const hit = this.drag || this.busy || this.peek ? undefined : this.raycaster.intersectObjects(targets, false)[0]
    this.hovered = hit ? this.vm.findIndex((v) => v.hit === hit.object || v.mesh === hit.object) : -1
    if (this.hovered !== this.lastHoverSent) {
      this.lastHoverSent = this.hovered
      this.cb.hover(this.hovered)
    }
  }

  // ------------------------------------------------------------------ camera

  private beginPeek() {
    const ray = new THREE.Raycaster()
    ray.setFromCamera(this.mouse, this.baseCam)
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -TABLE_Y)
    const hit = ray.ray.intersectPlane(plane, new THREE.Vector3())
    const target = hit && hit.clone().setY(0).length() < TABLE_R ? hit.setY(TABLE_Y) : ray.ray.at(2.5, new THREE.Vector3())
    this.peek = { target, standing: false }
    this.aimT = 1
  }

  private panPeek(dx: number, dy: number) {
    if (!this.peek) return
    const dist = this.camera.position.distanceTo(this.peek.target)
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion).setY(0).normalize()
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion).setY(0).normalize()
    const k = PEEK_SENS * dist * getViewSettings().lookSensitivity
    this.peek.target.addScaledVector(right, dx * k).addScaledVector(fwd, -dy * k)
    if (this.peek.target.y <= TABLE_Y + 0.01) {
      const flat = this.peek.target.clone().setY(0)
      if (flat.length() > 0.95) flat.setLength(0.95)
      this.peek.target.set(flat.x, TABLE_Y, flat.z)
    }
  }

  private endPeek() {
    // the zoom eases back to exactly where you were looking before it (the head turn is never
    // touched while zooming): not to the seat's default, not to where you aimed
    this.aimT = 0
    this.peek = null
  }

  private lookTarget = new THREE.Vector3()
  private updateCamera() {
    const p = this.peek
    if (p) {
      this.lookTarget.copy(p.target)
      const onTable = p.target.y <= TABLE_Y + 0.01
      const far = p.target.clone().setY(0).dot(this.forward0)
      // stand up for anything past your own side of the table (with 4 players the neighbours'
      // cards lie on the centre line, so the threshold sits well before the middle)
      if (!p.standing && onTable && far > -0.28) p.standing = true
      else if (p.standing && (far < -0.4 || !onTable)) p.standing = false
    }
    this.stand += ((p?.standing ? 1 : 0) - this.stand) * 0.08
    const st = ease(THREE.MathUtils.clamp(this.stand, 0, 1))
    const lean = this.poses[0]?.lean ?? 0
    const seated = this.eye.clone().addScaledVector(this.outOf(0), -lean * 0.06)
    seated.y -= lean * 0.03
    this.baseCam.position.copy(seated)
    this.baseCam.rotation.set(this.pitch, this.baseYaw + this.yaw, 0, 'YXZ')
    this.baseCam.aspect = this.camera.aspect
    this.baseCam.fov = getViewSettings().fov // the unzoomed view: aiming the zoom uses its rays
    this.baseCam.updateProjectionMatrix()
    this.baseCam.updateMatrixWorld()
    const standing = this.eye.clone().addScaledVector(this.forward0, 0.34).add(new THREE.Vector3(0, 0.62, 0))
    this.camera.position.copy(seated).lerp(standing, st)
    const look = Math.max(this.aim, st)
    this.camera.quaternion.copy(this.baseCam.quaternion)
    if (look > 0.001) {
      const m = new THREE.Matrix4().lookAt(this.camera.position, this.lookTarget, new THREE.Vector3(0, 1, 0))
      this.camera.quaternion.slerp(new THREE.Quaternion().setFromRotationMatrix(m), look)
    }
    // the field of view is a setting: wide enough by default to see your neighbours' heads (and
    // where they look) without turning
    const fov = getViewSettings().fov
    this.camera.fov = THREE.MathUtils.lerp(THREE.MathUtils.lerp(fov, 24, this.aim), 20, st)
    this.camera.updateProjectionMatrix()
  }

  private resize() {
    const w = Math.max(1, this.container.clientWidth)
    const h = Math.max(1, this.container.clientHeight)
    this.renderer.setSize(w, h, false)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    this.post.resize(w, h)
  }

  // ------------------------------------------------------------------ frame

  private frame(time: number, dt: number) {
    if (this.disposed || !this.n) return
    this.poses = this.avatars.map(() => ({ lean: 0, headYaw: 0, headPitch: -0.15 }))
    this.poses[0].leftWrist = this.viewmodel.localToWorld(new THREE.Vector3(-0.16, HAND_Y - 0.04, -0.33))
    this.poses[0].rightWrist = this.restWrist(0)
    this.focus = null
    tickJobs(time)
    this.updatePending()
    this.updateDrag()
    this.updateRemoteArms()
    if (this.lamp.update(time)) lampBuzz(new THREE.Vector3(0, 1.67, 0))
    // the deck glows and breathes when it's your turn to draw from it
    for (const m of this.centerDeck.material as THREE.MeshStandardMaterial[]) {
      m.emissive.set(this.deckHint ? 0xffc58a : 0x000000)
      m.emissiveIntensity = this.deckHint ? 0.25 + 0.2 * Math.sin(time * 4) : 0
    }
    this.centerDeck.scale.setScalar(this.deckHint ? 1 + 0.04 * Math.sin(time * 4) : 1)

    // turn: the dotted zone of whoever must play glows; yours pulses and brightens under your card.
    // After a base, the winner's zone burns amber and their card lifts until everyone confirms.
    const ready = this.localReady()
    this.zoneFx.forEach((z, s) => {
      const mat = z.material as THREE.MeshBasicMaterial
      const card = this.onTable.get(s)
      if (s === this.winnerSeat) {
        // the winner's box burns amber — a guide, so not with the guides off (the card still lifts)
        z.visible = this.guides
        mat.color.set(hex(PALETTE.amber)).multiplyScalar(2.2)
        mat.opacity = 0.7 + 0.3 * Math.sin(time * 5)
        if (card) card.root.position.y = CARD_Y_WIN + Math.sin(time * 3) * 0.003
        return
      }
      if (card && card.root.position.y > CARD_Y_REST + 0.001) card.root.position.y = CARD_Y_REST
      mat.color.set(hex(PALETTE.chalk)).multiplyScalar(1.6)
      const mine = s === 0 && ready
      // without guides the felt has no boxes painted, but your own spot is still chalked in on
      // your turn (dashed, pulsing; brighter under the card) so you know where to let go
      z.visible = this.guides ? mine || (s === this.turnSeat && s !== 0) : mine
      const over = mine && this.drag && this.inZone(this.drag.view.root.position)
      mat.opacity = over ? 1 : mine ? 0.25 + 0.15 * Math.sin(time * 4) : 0.18
    })

    const ts = Math.floor(time * 15) / 15
    const camWorld = this.camera.getWorldPosition(new THREE.Vector3())
    const tmp = new THREE.Vector3()
    this.stareAtYou = Math.max(0, this.stareAtYou - dt)
    const t = now()
    const aimed = this.faceUnderCentre()
    if (aimed !== this.aimedFace) {
      this.aimedFace = aimed
      this.cb.faceAim?.(aimed > 0 ? this.playerAt(aimed) : null)
    }
    for (const av of this.avatars) {
      const p = this.poses[av.seat]
      if (av.seat === 0) {
        this.knock(0, p, t)
        av.pose(p)
        continue
      }
      const look = this.remoteLook.get(av.seat)
      if (look) {
        // their head always shows where their camera points: a truthful reference for everyone
        // (no dramatic stares or idle wandering on top of it)
        p.headYaw = THREE.MathUtils.clamp(look.yaw, -HEAD_YAW_MAX, HEAD_YAW_MAX)
        p.headPitch = look.pitch
      } else {
        const target = this.stareAtYou > 0 ? camWorld : this.focus
        if (target) {
          av.head.getWorldPosition(tmp)
          const d = av.root.worldToLocal(target.clone()).sub(av.root.worldToLocal(tmp.clone()))
          p.headYaw = THREE.MathUtils.clamp(Math.atan2(-d.x, -d.z), -1.3, 1.3)
          p.headPitch = Math.atan2(d.y, Math.hypot(d.x, d.z))
        } else p.headYaw = Math.sin(ts * 0.3 + av.seat) * 0.35
      }
      this.knock(av.seat, p, t)
      const sg = this.senas.get(av.seat)
      if (sg?.gaze && t - sg.t0 < SENA_HOLD + 0.3) {
        // the seña is made toward where they were looking when they made it
        p.headYaw = THREE.MathUtils.clamp(sg.gaze.yaw, -HEAD_YAW_MAX, HEAD_YAW_MAX)
        p.headPitch = sg.gaze.pitch
      }
      const amount = sg?.frozen ? 1 : sg ? senaAmount(sg.s, Math.floor((t - sg.t0) * 15) / 15) : 0 // stop-motion like the rest of the body
      if (sg && amount > 0 && isHeadSena(sg.s)) {
        // sí / no are made with the whole head: two nods, or two shakes
        const swing = Math.sin(Math.floor((t - sg.t0) * 15) / 15 * Math.PI * 2 * NOD_HZ) * amount
        if (sg.s === 'si') p.headPitch += swing * 0.22
        else p.headYaw += swing * 0.32
      }
      av.pose(p)
      if (sg && amount <= 0 && t - sg.t0 > 0.5) this.senas.delete(av.seat)
      av.sena(sg && !isHeadSena(sg.s) ? sg.s : null, amount)
      this.faceShown[av.seat] = sg && amount > 0 ? sg.s : null
      // fingering a card in their hand
      const hv = this.remoteHover.get(av.seat)
      av.hand.forEach((c, i) => {
        const up = hv && t - hv.t < PRESENCE_TTL && hv.slot === i ? 0.018 : 0
        c.root.position.y += (FAN_Y - Math.abs(i - (this.handCounts[av.seat] - 1) / 2) * 0.004 + up - c.root.position.y) * 0.3
      })
    }

    // names at belly height (in front of the coat, below the held cards), turned to your camera
    this.nameTags.forEach((t, s) => {
      if (s === 0) return
      const a = seatAngle(s, this.n)
      t.place(polar(CHAIR_R_TAG, a, TAG_Y), Math.PI / 2 - a, this.camera)
    })

    // camera
    // dragging the view with the cursor stuck at a screen edge: keep turning that way (the cursor
    // can't go further, so a neighbour's face could be out of reach of a single drag)
    if (this.lookDrag && this.pointerEdge) {
      const v = getViewSettings()
      const dir = (v.invertLook ? -1 : 1) * this.pointerEdge // right edge: look right (yaw down)
      this.yawT = this.clampYaw(this.yawT - dir * EDGE_TURN * v.lookSensitivity * dt)
    }
    this.yaw += (this.yawT - this.yaw) * 0.15
    // eyes follow the card only when steering with a captured mouse; with a free cursor the view
    // stays put so the card stays under the pointer
    if (this.drag && !this.drag.refCam && this.drag.fwd > -0.05) {
      const c = this.drag.view.root.getWorldPosition(new THREE.Vector3()).sub(this.eye)
      this.pitchT += (this.clampPitch(Math.atan2(c.y, Math.hypot(c.x, c.z)) + 0.14) - this.pitchT) * 0.08
    }
    this.pitch += (this.pitchT - this.pitch) * 0.15
    this.aim += (this.aimT - this.aim) * 0.12
    this.updateCamera()
    // your head, as the others see it, points exactly where your camera points (zoom included);
    // a heartbeat keeps it fresh when you hold still
    const g = this.gaze()
    const moved = Math.abs(g.yaw - this.lastLookSent.yaw) > 0.01 || Math.abs(g.pitch - this.lastLookSent.pitch) > 0.01
    if ((moved && t - this.lastLookSent.t > 0.1) || t - this.lastLookSent.t > LOOK_HEARTBEAT) {
      this.lastLookSent = { t, yaw: g.yaw, pitch: g.pitch }
      this.cb.look(g.yaw, g.pitch)
    }

    this.updateHover(time, dt)
    this.vm.forEach((v, k) => {
      v.lift += ((k === this.hovered ? 1 : 0) - v.lift) * 0.25
      v.mesh.position.set(v.base.x, v.base.y + v.lift * 0.02, v.base.z + v.lift * 0.02)
      v.mesh.rotation.set(-0.35, 0, v.base.rz * (1 - v.lift * 0.6))
      v.hit.position.set(v.base.x, v.base.y, v.base.z)
      v.hit.rotation.set(-0.35, 0, v.base.rz)
    })
    this.lowered += ((this.drag || this.busy || this.stand > 0.1 ? 1 : 0) - this.lowered) * 0.12
    this.handOffset += (this.handOffsetT - this.handOffset) * 0.2
    this.viewmodel.position.set(Math.sin(time * 1.3) * 0.003 - 0.04 * this.lowered, Math.sin(time * 2.1) * 0.002 - 0.12 * this.aim - 0.09 * this.lowered + this.handOffset, 0)

    if (this.duo) {
      const u = (now() - this.duo.t0) / 1.6
      this.post.duotone(this.duo.name, u < 1 ? Math.sin(Math.min(u * 4, 1) * Math.PI * 0.5) * (1 - Math.max(0, (u - 0.6) / 0.4)) : 0)
      if (u >= 1) this.duo = null
    } else this.post.duotone(null, 0)

    this.post.render(this.scene, this.camera, time)
  }

  // ------------------------------------------------------------------ test hooks

  debugState() {
    return {
      seats: this.n,
      queued: this.queued,
      busy: this.busy,
      canPlay: this.canPlay,
      dragging: !!this.drag,
      onTable: this.onTable.size,
      wonStacks: this.wonStacks.length,
      handShown: this.vm.filter((v) => v.mesh.visible).length,
      hovered: this.hovered,
      yaw: this.yaw,
      pitch: this.pitch,
      aim: this.aim,
      aimedFace: this.aimedFace,
      faces: this.faceShown.map((f, seat) => (f ? { seat, id: this.playerAt(seat), sena: f } : null)).filter(Boolean),
    }
  }

  /** Hold a seña on a seat's mask and look at it (preview/screenshots). */
  debugSena(seat: number, s: Sena | null) {
    if (s) this.senas.set(seat, { s, t0: now(), frozen: true })
    else this.senas.delete(seat)
  }

  /** Turn your head (within the limits) toward a seat's face; returns the limits used. */
  debugAimHead(seat: number) {
    const d = this.avatars[seat].head.getWorldPosition(new THREE.Vector3()).sub(this.eye)
    this.yawT = this.clampYaw(Math.atan2(-d.x, -d.z) - this.baseYaw)
    this.pitchT = this.clampPitch(Math.atan2(d.y, Math.hypot(d.x, d.z)))
    return { yawMax: this.yawMax, yawT: this.yawT }
  }

  /** A remote player's head turn as drawn here (yaw/pitch in their seat's frame). */
  debugHeadOf(playerId: string) {
    const av = this.avatars[this.seatOf(playerId)]
    const d = av.head.getWorldDirection(new THREE.Vector3()).negate()
    const q = av.root.getWorldQuaternion(new THREE.Quaternion()).invert()
    d.applyQuaternion(q)
    return { yaw: Math.atan2(-d.x, -d.z), pitch: Math.asin(THREE.MathUtils.clamp(d.y, -1, 1)) }
  }

  /** Distance (m) from the centre of your view to a seat's head. */
  debugAimMiss(seat: number) {
    const o = this.camera.getWorldPosition(new THREE.Vector3())
    const dir = this.camera.getWorldDirection(new THREE.Vector3())
    const h = this.avatars[seat].head.getWorldPosition(new THREE.Vector3()).sub(o)
    return h.addScaledVector(dir, -h.dot(dir)).length()
  }

  /** Zoom onto a seat's face, like a right-click on it. */
  /** Let go of the right-click zoom (tests). */
  debugEndPeek() {
    this.endPeek()
  }

  debugPeekHead(seat: number, dy = 0) {
    this.peek = { target: this.avatars[seat].head.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, dy, 0)), standing: false }
    this.aimT = 1
  }

  /** Screen position of a tag of the open table question (tests). */
  choiceScreen(id: string) {
    const w = this.choices.positionOf(id)
    if (!w) return null
    const p = w.project(this.camera)
    const r = this.renderer.domElement.getBoundingClientRect()
    return { x: r.left + ((p.x + 1) / 2) * r.width, y: r.top + ((1 - p.y) / 2) * r.height }
  }

  /** Bean heaps on screen and whether their asked number shows (tests). */
  heapsScreen() {
    const r = this.renderer.domElement.getBoundingClientRect()
    return this.tokens.marksState().map((m) => {
      const p = m.centre.project(this.camera)
      return { x: r.left + ((p.x + 1) / 2) * r.width, y: r.top + ((1 - p.y) / 2) * r.height, shown: m.shown }
    })
  }

  /** Screen position of a seat's face (tests). */
  headScreen(seat: number) {
    const p = this.avatars[seat].head.getWorldPosition(new THREE.Vector3()).project(this.camera)
    const r = this.renderer.domElement.getBoundingClientRect()
    return { x: r.left + ((p.x + 1) / 2) * r.width, y: r.top + ((1 - p.y) / 2) * r.height }
  }

  /** Screen position of the card you're dragging (null if none). */
  dragScreen() {
    if (!this.drag) return null
    const p = this.drag.view.root.getWorldPosition(new THREE.Vector3()).project(this.camera)
    const r = this.renderer.domElement.getBoundingClientRect()
    return { x: r.left + ((p.x + 1) / 2) * r.width, y: r.top + ((1 - p.y) / 2) * r.height }
  }

  /** Screen position of a seat's play zone (seat 0 = you, 1 = your left neighbour). */
  zoneScreen(seat: number) {
    const p = playSlot(seat, this.n).pos.clone().project(this.camera)
    const r = this.renderer.domElement.getBoundingClientRect()
    return { x: r.left + ((p.x + 1) / 2) * r.width, y: r.top + ((1 - p.y) / 2) * r.height }
  }

  vmScreen(k: number) {
    const p = this.vm[k].mesh.localToWorld(new THREE.Vector3(0, CARD_H * 0.45, 0)).project(this.camera)
    const r = this.renderer.domElement.getBoundingClientRect()
    return { x: r.left + ((p.x + 1) / 2) * r.width, y: r.top + ((1 - p.y) / 2) * r.height, visible: this.vm[k].mesh.visible }
  }
}
