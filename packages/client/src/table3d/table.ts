import * as THREE from 'three'
import { PALETTE, hex } from './look'
import { TABLE_R, TABLE_Y, CHAIR_R, PLAY_R, CARD_W, CARD_H, seatAngle, type PlayerCount } from './seats'

export interface SeatLabel { name: string; team: 'nosotros' | 'ellos' | 'random' }
const TEAM_CHALK = { nosotros: PALETTE.teal, ellos: PALETTE.rose, random: PALETTE.chalk } as const

// Chalk markings on the felt (Buckshot's taped/chalked table): outer ring, one play box per
// seat, a centre circle, and a tally square per team for the porotos (diegetic score).
function drawChalk(cv: HTMLCanvasElement, n: PlayerCount, labels: SeatLabel[], guides: boolean) {
  const S = cv.width
  const g = cv.getContext('2d')!
  g.globalAlpha = 1
  const grd = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2)
  grd.addColorStop(0, PALETTE.feltLit)
  grd.addColorStop(1, PALETTE.felt)
  g.fillStyle = grd
  g.fillRect(0, 0, S, S)
  // seeded speckle: redrawing the labels must not make the felt "boil"
  let seed = 7
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296)
  for (let i = 0; i < 6000; i++) {
    g.fillStyle = rnd() < 0.5 ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,220,0.05)'
    g.fillRect(rnd() * S, rnd() * S, 2, 2)
  }
  const m = S / 2 / TABLE_R // metres → px
  g.strokeStyle = PALETTE.chalk
  g.globalAlpha = 0.7
  g.lineWidth = 3
  g.beginPath(); g.arc(S / 2, S / 2, (TABLE_R - 0.06) * m, 0, Math.PI * 2); g.stroke()
  g.beginPath(); g.arc(S / 2, S / 2, 0.3 * m, 0, Math.PI * 2); g.stroke()
  for (let i = 0; i < n; i++) {
    const a = seatAngle(i, n)
    g.save()
    // Canvas is mapped onto the top with UV v flipped by CircleGeometry: canvas y = world z.
    g.translate(S / 2 + Math.cos(a) * PLAY_R * m, S / 2 + Math.sin(a) * PLAY_R * m)
    g.rotate(a + Math.PI / 2)
    if (guides) {
      // where your card goes (the 'guides' view setting can hide these)
      g.setLineDash([10, 8])
      g.strokeRect((-CARD_W / 2 - 0.02) * m, (-CARD_H / 2 - 0.05) * m, (CARD_W + 0.04) * m, (CARD_H + 0.1) * m)
      g.setLineDash([])
    }
    // name plate scratched in chalk between the zone and the table edge, in the team's colour;
    // upright for the players across the table (they are the ones who need to read it)
    const label = labels[i]
    if (label) {
      g.font = `${0.045 * m}px "IM Fell English SC", Georgia, serif`
      g.fillStyle = TEAM_CHALK[label.team]
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      g.fillText(label.name.slice(0, 14), 0, -(CARD_H / 2 + 0.085) * m)
    }
    g.restore()
  }
}

function chalkTexture(n: PlayerCount, labels: SeatLabel[], guides: boolean) {
  const cv = document.createElement('canvas')
  cv.width = cv.height = 1024
  drawChalk(cv, n, labels, guides)
  const t = new THREE.CanvasTexture(cv)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return {
    texture: t,
    redraw(labels: SeatLabel[], guides: boolean) {
      drawChalk(cv, n, labels, guides)
      t.needsUpdate = true
    },
  }
}

export function buildRoom(scene: THREE.Scene, n: PlayerCount, labels: SeatLabel[] = [], guides = true) {
  const chalk = chalkTexture(n, labels, guides)
  scene.background = new THREE.Color(hex(PALETTE.void))
  scene.fog = new THREE.FogExp2(hex(PALETTE.void), 0.22)

  const top = new THREE.Mesh(
    new THREE.CircleGeometry(TABLE_R, 96),
    new THREE.MeshStandardMaterial({ map: chalk.texture, roughness: 0.95 }),
  )
  top.rotation.x = -Math.PI / 2
  top.position.y = TABLE_Y
  top.receiveShadow = true
  scene.add(top)

  const wood = new THREE.MeshStandardMaterial({ color: hex(PALETTE.soot), roughness: 0.6 })
  const rim = new THREE.Mesh(new THREE.TorusGeometry(TABLE_R, 0.035, 10, 96), wood)
  rim.rotation.x = Math.PI / 2
  rim.position.y = TABLE_Y
  rim.castShadow = rim.receiveShadow = true
  scene.add(rim)
  // pedestal stops 2 cm under the top: a cap coplanar with the felt z-fights into a dark blob
  const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.3, TABLE_Y - 0.02, 16), wood)
  leg.position.y = (TABLE_Y - 0.02) / 2
  scene.add(leg)

  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(8, 48),
    new THREE.MeshStandardMaterial({ color: hex(PALETTE.soot), roughness: 1 }),
  )
  floor.rotation.x = -Math.PI / 2
  floor.receiveShadow = true
  scene.add(floor)

  // Always 8 chairs: the empty ones stay pushed back in the dark (they are part of the dread).
  const chairMat = new THREE.MeshStandardMaterial({ color: hex(PALETTE.soot), roughness: 0.8 })
  for (let k = 0; k < 8; k++) {
    const occupied = k < n
    const a = occupied ? seatAngle(k, n) : seatAngle(k, 8) + Math.PI / 8
    const r = occupied ? CHAIR_R : CHAIR_R + 0.9
    const chair = new THREE.Group()
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.05, 0.45), chairMat)
    seat.position.y = 0.46
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.6, 0.05), chairMat)
    back.position.set(0, 0.78, 0.2)
    chair.add(seat, back)
    chair.position.set(Math.cos(a) * r, 0, Math.sin(a) * r)
    chair.rotation.y = -a + Math.PI / 2
    chair.traverse((o) => (o.castShadow = true))
    scene.add(chair)
  }
  let cur = { labels, guides }
  return {
    setLabels: (l: SeatLabel[]) => chalk.redraw((cur = { ...cur, labels: l }).labels, cur.guides),
    setGuides: (on: boolean) => chalk.redraw(cur.labels, (cur = { ...cur, guides: on }).guides),
  }
}

// ONE key light: the hanging lamp. Everything else is near-black.
export function buildLamp(scene: THREE.Scene) {
  const lamp = new THREE.Group()
  lamp.position.set(0, 2.6, 0)
  scene.add(lamp)
  const pivot = new THREE.Group() // swings like a pendulum
  lamp.add(pivot)
  const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.8), new THREE.MeshBasicMaterial({ color: 0x000000 }))
  cord.position.y = -0.4
  const shade = new THREE.Mesh(
    new THREE.ConeGeometry(0.28, 0.2, 24, 1, true),
    new THREE.MeshStandardMaterial({ color: hex(PALETTE.soot), side: THREE.DoubleSide, roughness: 0.5 }),
  )
  shade.position.y = -0.85
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(hex(PALETTE.amber)).multiplyScalar(6) }))
  bulb.position.y = -0.93
  pivot.add(cord, shade, bulb)

  const key = new THREE.SpotLight(hex(PALETTE.amber), 11, 6, 0.8, 0.6, 2)
  key.position.y = -0.93
  key.castShadow = true
  key.shadow.mapSize.set(1024, 1024)
  key.shadow.bias = -0.0004
  key.shadow.camera.near = 0.2
  key.shadow.camera.far = 4
  const target = new THREE.Object3D()
  target.position.y = -3
  pivot.add(key, target)
  key.target = target

  // Bounce from the lit felt: uplights masks from below (horror uplight), no shadows.
  const bounce = new THREE.PointLight(hex(PALETTE.feltLit), 3.5, 3, 1.5)
  bounce.position.y = TABLE_Y + 0.1
  scene.add(bounce)
  scene.add(new THREE.AmbientLight(0xffffff, 0.015))

  return {
    update(t: number) {
      pivot.rotation.z = Math.sin(t * 1.7) * 0.012
      pivot.rotation.x = Math.sin(t * 1.1 + 1) * 0.008
      const flicker = Math.sin(t * 43) * Math.sin(t * 7.3) > 0.97 ? 0.75 : 1
      key.intensity = 11 * flicker
      return flicker < 1
    },
  }
}
