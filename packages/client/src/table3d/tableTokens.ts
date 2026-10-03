import { NUMERAL_FONT } from './cardFace'
import * as THREE from 'three'
import { PALETTE, SUIT_INK } from './look'
import { TABLE_Y, PLAY_R, CARD_H, CARD_W, seatAngle, polar } from './seats'

// Physical tokens on the felt that carry the game's state, so it reads on the table itself:
//  - dealer chip (rotates every round) and "pide" chip (who declares first this round)
//  - beside each bidder's card, level with its top edge: the bases asked chalked as a number, and
//    a little heap of beans (one per base won) dropped at random inside a circle no wider than a
//    card; beans past the bid are reddish
//  - a metal plane (Monopoly-token style) in front of whoever called each kamikaze
//  - a small pile of beans near the centre (decoration for now; later, grabbable)

export interface TokenState {
  n: number
  dealerSeat: number
  bidderSeat: number // the round's first declarer
  bids: Array<{ seat: number; value: number; won: number }>
  kamikazeSeats: number[] // one entry per call, in order
}

const right = (a: number) => new THREE.Vector3(Math.sin(a), 0, -Math.cos(a))
const BEAN = '#e9dcc2'

function chipTexture(label: string, ring: string, fill: string, ink: string) {
  const cv = document.createElement('canvas')
  cv.width = cv.height = 128
  const g = cv.getContext('2d')!
  g.fillStyle = fill
  g.fillRect(0, 0, 128, 128)
  g.strokeStyle = ring
  g.lineWidth = 10
  g.beginPath()
  g.arc(64, 64, 56, 0, Math.PI * 2)
  g.stroke()
  g.lineWidth = 2
  g.beginPath()
  g.arc(64, 64, 44, 0, Math.PI * 2)
  g.stroke()
  // notches around the rim, like a casino/club chip
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2
    g.save()
    g.translate(64 + Math.cos(a) * 56, 64 + Math.sin(a) * 56)
    g.rotate(a)
    g.fillStyle = PALETTE.bone
    g.fillRect(-3, -6, 6, 12)
    g.restore()
  }
  g.fillStyle = ink
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.font = `${label.length > 2 ? 30 : 52}px "IM Fell English SC", Georgia, serif`
  g.fillText(label, 64, 68)
  const t = new THREE.CanvasTexture(cv)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

function chip(label: string, ring: string, fill: string, ink: string) {
  const top = new THREE.MeshStandardMaterial({ map: chipTexture(label, ring, fill, ink), roughness: 0.6, emissive: 0xffffff, emissiveMap: undefined, emissiveIntensity: 0 })
  const side = new THREE.MeshStandardMaterial({ color: ring, roughness: 0.5 })
  const m = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.009, 40), [side, top, side])
  m.castShadow = true
  return m
}

/** A small die-cast plane, nose toward the table centre. */
function metalPlane() {
  const S = 1.7 // token scale
  const metal = new THREE.MeshStandardMaterial({ color: 0xbfb6a4, metalness: 0.75, roughness: 0.32 })
  const g = new THREE.Group()
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.0055, 0.034, 6, 12), metal)
  body.rotation.x = Math.PI / 2
  const wing = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.0025, 0.011), metal)
  wing.position.set(0, 0.001, -0.004)
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.002, 0.007), metal)
  tail.position.set(0, 0.002, 0.019)
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.0018, 0.01, 0.008), metal)
  fin.position.set(0, 0.006, 0.019)
  const prop = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.0015, 0.0015), metal)
  prop.position.set(0, 0, -0.024)
  g.add(body, wing, tail, fin, prop)
  g.traverse((o) => (o.castShadow = true))
  g.scale.setScalar(S)
  return g
}

function bean(seed: number) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(0.0125, 12, 8), new THREE.MeshStandardMaterial({ color: BEAN, roughness: 0.55 }))
  m.scale.set(1.45, 0.72, 1)
  m.rotation.y = seed * 2.39
  m.castShadow = true
  return m
}

const HEAP_R = CARD_W * 0.62 // radius of the circle the beans fall in (half a card's width: a tight heap)
const ASKED_SIZE = 0.085 // the chalked number of bases asked (big enough to read across the table)
const BEAN_GAP = 0.026 // beans don't land on top of each other

/** The bases asked, chalked on the felt: the number in a rough circle. */
const askedTex = new Map<number, THREE.Texture>()
function askedTexture(value: number) {
  const hit = askedTex.get(value)
  if (hit) return hit
  const cv = document.createElement('canvas')
  cv.width = cv.height = 96
  const g = cv.getContext('2d')!
  g.strokeStyle = g.fillStyle = PALETTE.chalk
  g.lineWidth = 5
  g.beginPath()
  g.arc(48, 48, 38, 0.3, Math.PI * 2 + 0.1) // not quite closed: drawn by hand
  g.stroke()
  g.font = `bold 52px ${NUMERAL_FONT}`
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillText(String(value), 48, 52)
  const t = new THREE.CanvasTexture(cv)
  t.colorSpace = THREE.SRGBColorSpace
  askedTex.set(value, t)
  return t
}

/** A random spot inside the heap circle, clear of the beans already there (best effort). */
function dropSpot(taken: Array<{ x: number; z: number }>) {
  let best = { x: 0, z: 0 }
  let bestGap = -1
  for (let k = 0; k < 24; k++) {
    const r = Math.sqrt(Math.random()) * (HEAP_R - 0.01)
    const t = Math.random() * Math.PI * 2
    const c = { x: Math.cos(t) * r, z: Math.sin(t) * r }
    const gap = Math.min(Infinity, ...taken.map((o) => Math.hypot(o.x - c.x, o.z - c.z)))
    if (gap >= BEAN_GAP) return c
    if (gap > bestGap) [best, bestGap] = [c, gap]
  }
  return best
}

export class TableTokens {
  group = new THREE.Group()
  private key = ''
  private dealer = chip('D', SUIT_INK.oros, PALETTE.bone, PALETTE.ink)
  private bidder = chip('pide', PALETTE.oxblood, PALETTE.oxblood, PALETTE.bone)
  private dynamic = new THREE.Group()
  // where each seat's beans fell (offsets inside the heap circle): kept so they never jump, and
  // drawn afresh at random for every new round
  private heaps = new Map<number, Array<{ x: number; z: number; spin: number }>>()
  // the chalked number of bases asked: always shown with the table guides on; with them off,
  // only while the pointer is over that bean heap
  private marks: Array<{ mesh: THREE.Mesh; centre: THREE.Vector3 }> = []
  private guides = true

  constructor() {
    this.group.add(this.dealer, this.bidder, this.dynamic)
    // the pile of beans near the centre (seeded, so it never jumps)
    let seed = 11
    const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296)
    for (let i = 0; i < 34; i++) {
      const b = bean(i)
      const r = Math.sqrt(rnd()) * 0.045
      const a = rnd() * Math.PI * 2
      const h = Math.max(0, 0.045 - r) * 0.35 // a little mound
      b.position.set(0.17 + Math.cos(a) * r, TABLE_Y + 0.004 + h * rnd(), -0.12 + Math.sin(a) * r)
      this.group.add(b)
    }
    this.dealer.visible = this.bidder.visible = false
  }

  /** The chalked numbers: where each heap is and whether its number shows (tests). */
  marksState() {
    return this.marks.map((m) => ({ centre: m.centre.clone(), shown: m.mesh.visible && (m.mesh.material as THREE.MeshBasicMaterial).opacity > 0.5 }))
  }

  setGuides(on: boolean) {
    this.guides = on
  }

  /** Per frame: where the pointer meets the felt (null: nowhere). Fades the asked numbers in/out. */
  hoverAt(point: THREE.Vector3 | null) {
    for (const m of this.marks) {
      const near = point !== null && Math.hypot(point.x - m.centre.x, point.z - m.centre.z) < HEAP_R + 0.06
      const mat = m.mesh.material as THREE.MeshBasicMaterial
      mat.opacity += ((this.guides || near ? 0.9 : 0) - mat.opacity) * 0.2
      m.mesh.visible = mat.opacity > 0.02
    }
  }

  /** This seat's beans: keep the ones already on the felt, drop new ones at random. */
  private heapFor(seat: number, won: number) {
    let heap = this.heaps.get(seat) ?? []
    if (won < heap.length) heap = [] // a new round: the heap starts over
    while (heap.length < won) heap = [...heap, { ...dropSpot(heap), spin: Math.random() * Math.PI * 2 }]
    this.heaps.set(seat, heap)
    return heap
  }

  update(s: TokenState | null) {
    if (!s) {
      this.dealer.visible = this.bidder.visible = false
      this.dynamic.clear()
      this.key = ''
      return
    }
    const key = JSON.stringify(s)
    if (key === this.key) return
    this.key = key
    const place = (m: THREE.Object3D, seat: number, r: number, side: number) => {
      const a = seatAngle(seat, s.n)
      m.position.copy(polar(r, a, TABLE_Y + 0.0045)).addScaledVector(right(a), side)
      m.rotation.y = Math.PI / 2 - a
    }
    this.dealer.visible = s.dealerSeat >= 0
    if (s.dealerSeat >= 0) place(this.dealer, s.dealerSeat, 0.76, -0.21)
    this.bidder.visible = s.bidderSeat >= 0
    if (s.bidderSeat >= 0) place(this.bidder, s.bidderSeat, s.bidderSeat === s.dealerSeat ? 0.67 : 0.76, -0.21)

    this.dynamic.clear()
    this.marks = []
    // bases asked (chalked number) and won (a heap of beans), beside the card's top edge
    const live = new Set(s.bids.map((b) => b.seat))
    for (const seat of [...this.heaps.keys()]) if (!live.has(seat)) this.heaps.delete(seat)
    for (const b of s.bids) {
      const a = seatAngle(b.seat, s.n)
      // centred level with the card's top edge and kept clear of the won-card piles, which lie
      // further out on the same side (from r ≈ 0.66): beans must never sit on top of cards
      const centre = polar(PLAY_R - CARD_H / 2 - 0.01, a, TABLE_Y).addScaledVector(right(a), CARD_W / 2 + 0.03 + HEAP_R)
      const asked = new THREE.Mesh(new THREE.PlaneGeometry(ASKED_SIZE, ASKED_SIZE), new THREE.MeshBasicMaterial({ map: askedTexture(b.value), transparent: true, opacity: this.guides ? 0.9 : 0, depthWrite: false }))
      // on the asker's side of the heap (further sideways it would reach the neighbour's card with 8)
      asked.position.copy(centre).addScaledVector(polar(1, a, 0), HEAP_R + ASKED_SIZE / 2 + 0.005).setY(TABLE_Y + 0.0025)
      asked.rotation.set(-Math.PI / 2, 0, 0) // flat, upright for you (seat 0, at +Z): you are the one reading it
      this.dynamic.add(asked)
      // the heap and its number count as one hover zone
      this.marks.push({ mesh: asked, centre: centre.clone().addScaledVector(polar(1, a, 0), 0.04) })
      this.heapFor(b.seat, b.won).forEach((p, i) => {
        const bn = bean(0)
        bn.position.set(centre.x + p.x, TABLE_Y + 0.004, centre.z + p.z)
        bn.rotation.y = p.spin
        if (i >= b.value) (bn.material as THREE.MeshStandardMaterial).color.set('#c46a5c') // over the bid
        this.dynamic.add(bn)
      })
    }
    // kamikaze planes, beside the card of whoever called each one (on its left, the beans go on
    // its right), one behind the other toward the caller
    const perSeat = new Map<number, number>()
    for (const seat of s.kamikazeSeats) {
      const i = perSeat.get(seat) ?? 0
      perSeat.set(seat, i + 1)
      const plane = metalPlane()
      const a = seatAngle(seat, s.n)
      plane.position.copy(polar(PLAY_R - 0.03 + i * 0.085, a, TABLE_Y + 0.013)).addScaledVector(right(a), -(CARD_W / 2 + 0.06))
      plane.rotation.y = Math.PI / 2 - a + Math.PI // nose to the centre
      this.dynamic.add(plane)
    }
  }
}
