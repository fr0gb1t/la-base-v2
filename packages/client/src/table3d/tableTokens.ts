import * as THREE from 'three'
import { PALETTE, SUIT_INK } from './look'
import { TABLE_Y, seatAngle, polar } from './seats'

// Physical tokens on the felt that carry the game's state, so it reads on the table itself:
//  - dealer chip (rotates every round) and "pide" chip (who declares first this round)
//  - chalk circles beside each bidder's place, one per base asked, filled with beans as their
//    team wins bases (extra beans spill past the circles)
//  - a metal plane (Monopoly-token style) in front of whoever called each kamikaze
//  - a small pile of beans near the centre (decoration for now; later, grabbable)

export interface TokenState {
  n: number
  dealerSeat: number
  bidderSeat: number // the round's first declarer
  bids: Array<{ seat: number; value: number; won: number }>
  kamikazeSeats: number[] // one entry per call, in order
}

const out = (a: number) => new THREE.Vector3(Math.cos(a), 0, Math.sin(a))
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
  const m = new THREE.Mesh(new THREE.SphereGeometry(0.0085, 10, 6), new THREE.MeshStandardMaterial({ color: BEAN, roughness: 0.55 }))
  m.scale.set(1.45, 0.72, 1)
  m.rotation.y = seed * 2.39
  m.castShadow = true
  return m
}

const ringGeo = new THREE.RingGeometry(0.016, 0.0205, 32)
const ringMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(PALETTE.chalk), transparent: true, opacity: 0.9, depthWrite: false })

export class TableTokens {
  group = new THREE.Group()
  private key = ''
  private dealer = chip('D', SUIT_INK.oros, PALETTE.bone, PALETTE.ink)
  private bidder = chip('pide', PALETTE.oxblood, PALETTE.oxblood, PALETTE.bone)
  private dynamic = new THREE.Group()

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

  /** Chalk circles are placement guides: the beans stay, the circles can be hidden. */
  setGuides(on: boolean) {
    ringMat.visible = on
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
    if (s.dealerSeat >= 0) place(this.dealer, s.dealerSeat, 0.7, -0.17)
    this.bidder.visible = s.bidderSeat >= 0
    if (s.bidderSeat >= 0) place(this.bidder, s.bidderSeat, s.bidderSeat === s.dealerSeat ? 0.6 : 0.7, -0.17)

    this.dynamic.clear()
    // bases asked: chalk circles in a row from the place toward the centre, beans as they're won
    for (const b of s.bids) {
      const a = seatAngle(b.seat, s.n)
      const start = polar(0.72, a, TABLE_Y + 0.0025).addScaledVector(right(a), 0.16)
      const step = out(a).multiplyScalar(-0.048)
      const total = Math.max(b.value, b.won)
      for (let i = 0; i < total; i++) {
        const p = start.clone().addScaledVector(step, i)
        if (i < b.value) {
          const ring = new THREE.Mesh(ringGeo, ringMat)
          ring.rotation.x = -Math.PI / 2
          ring.position.copy(p)
          this.dynamic.add(ring)
        }
        if (i < b.won) {
          const bn = bean(i + b.seat * 7)
          bn.position.copy(p).setY(TABLE_Y + 0.004)
          if (i >= b.value) (bn.material as THREE.MeshStandardMaterial).color.set('#c46a5c') // over the bid
          this.dynamic.add(bn)
        }
      }
      if (b.value === 0) {
        // asked zero: one crossed-out circle
        const ring = new THREE.Mesh(ringGeo, ringMat)
        ring.rotation.x = -Math.PI / 2
        ring.position.copy(start)
        const bar = new THREE.Mesh(new THREE.PlaneGeometry(0.046, 0.004), ringMat)
        bar.rotation.set(-Math.PI / 2, 0, Math.PI / 4)
        bar.position.copy(start).setY(TABLE_Y + 0.0027)
        this.dynamic.add(ring, bar)
      }
    }
    // kamikaze planes, in front of whoever called each one, lined up along the edge
    const perSeat = new Map<number, number>()
    for (const seat of s.kamikazeSeats) {
      const i = perSeat.get(seat) ?? 0
      perSeat.set(seat, i + 1)
      const plane = metalPlane()
      const a = seatAngle(seat, s.n)
      plane.position.copy(polar(0.5, a, TABLE_Y + 0.013)).addScaledVector(right(a), -0.15 + i * 0.1)
      plane.rotation.y = Math.PI / 2 - a + Math.PI // nose to the centre
      this.dynamic.add(plane)
    }
  }
}
