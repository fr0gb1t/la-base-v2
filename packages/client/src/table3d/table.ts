import * as THREE from 'three'
import { PALETTE, hex } from './look'
import { TABLE_R, TABLE_Y, PLAY_R, CARD_W, CARD_H, seatAngle, type PlayerCount } from './seats'

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

  // (no chairs: nobody at this table has a body to sit on one, only a face and two hands floating over it)
  let cur = { labels, guides }
  return {
    setLabels: (l: SeatLabel[]) => chalk.redraw((cur = { ...cur, labels: l }).labels, cur.guides),
    setGuides: (on: boolean) => chalk.redraw(cur.labels, (cur = { ...cur, guides: on }).guides),
  }
}

/** A wall of old brick, drawn once (a canvas): mortar lines and uneven, dark bricks. */
function brickTexture() {
  const W = 256
  const H = 256
  const cv = document.createElement('canvas')
  cv.width = W
  cv.height = H
  const g = cv.getContext('2d')!
  g.fillStyle = '#2a2420'
  g.fillRect(0, 0, W, H)
  const bh = 32
  const bw = 64
  for (let row = 0; row < H / bh; row++) {
    const off = row % 2 ? bw / 2 : 0
    for (let x = -bw; x < W + bw; x += bw) {
      const v = 70 + Math.floor(Math.random() * 40)
      g.fillStyle = `rgb(${v + 20}, ${v - 5}, ${v - 20})`
      g.fillRect(x + off + 2, row * bh + 2, bw - 4, bh - 4)
    }
  }
  const tex = new THREE.CanvasTexture(cv)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(3, 2.4)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

/**
 * The basement's little window, high on a brick wall across the table: a dim blue glass with bars, and the storm's
 * lightning coming in through it (storm.ts). The flash lights the room in cold white, the bars' shadows fall across
 * the table, and for that instant the wall around it shows; then it is dark again. `place(angle)` puts it at that
 * angle round the table (across from you); `flash(level)` every frame.
 */
export function buildWindow(scene: THREE.Scene) {
  const group = new THREE.Group()
  scene.add(group)
  const R = 3.1 // from the middle of the table to the wall
  const Y = 1.52 // the window's middle: up high, at street level outside (just inside the top of your view)
  const WW = 0.62
  const WH = 0.34

  const wallMat = new THREE.MeshStandardMaterial({ map: brickTexture(), color: 0x6a5e56, roughness: 1 })
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 3.2), wallMat)
  wall.position.set(0, 1.4, 0)
  wall.receiveShadow = true // (it casts none: the window's light comes from behind it)
  group.add(wall)

  // the glass (the night outside, a faint blue; white when it flashes), pushed out through the fog
  const glassMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0x0d1626), fog: false })
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(WW, WH), glassMat)
  glass.position.set(0, Y, 0.002)
  group.add(glass)
  // frame and bars: they cast the shadows the flash throws across the room
  const iron = new THREE.MeshStandardMaterial({ color: 0x141210, roughness: 0.7 })
  const bars: THREE.Mesh[] = []
  const bar = (w: number, h: number, x: number, y: number) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.05), iron)
    m.position.set(x, Y + y, 0.03)
    m.castShadow = true
    bars.push(m)
    group.add(m)
  }
  bar(WW + 0.08, 0.05, 0, WH / 2 + 0.02)
  bar(WW + 0.08, 0.05, 0, -WH / 2 - 0.02)
  bar(0.05, WH + 0.08, WW / 2 + 0.02, 0)
  bar(0.05, WH + 0.08, -WW / 2 - 0.02, 0)
  for (const x of [-WW / 4, 0, WW / 4]) bar(0.018, WH, x, 0)
  bar(WW, 0.018, 0, 0)

  // the flash: a cold light from just outside the glass, falling across the table
  const light = new THREE.SpotLight(0xc8d8ff, 0, 9, 0.62, 0.45, 1.2)
  light.position.set(0, Y + 0.05, -0.35) // (behind the wall: the wall casts no shadow, the bars do)
  light.castShadow = true
  light.shadow.mapSize.set(512, 512)
  light.shadow.bias = -0.001
  light.shadow.camera.near = 0.2
  light.shadow.camera.far = 8
  light.shadow.autoUpdate = false // drawn only while it flashes
  group.add(light)
  const target = new THREE.Object3D()
  group.add(target)
  light.target = target
  // the wall round the window, lit from the glass
  const glow = new THREE.PointLight(0xc8d8ff, 0, 2.6, 1.5)
  glow.position.set(0, Y, 0.35)
  group.add(glow)
  // the whole room, for that instant: the void around the table shows its corners
  const fill = new THREE.AmbientLight(0x9fb4e0, 0)
  scene.add(fill)

  const night = new THREE.Color(0x0d1626)
  const white = new THREE.Color(0xdfe9ff).multiplyScalar(9)
  return {
    place(angle: number) {
      // facing the table, across it from `angle`'s opposite
      group.position.set(Math.cos(angle) * R, 0, Math.sin(angle) * R)
      group.lookAt(0, 0, 0)
      // aim at the table, a little short of its middle
      target.position.set(0, TABLE_Y - Y, R * 0.85)
    },
    flash(level: number) {
      light.intensity = level * 140
      glow.intensity = level * 9
      fill.intensity = level * 0.9
      glassMat.color.copy(night).lerp(white, Math.min(1, level))
      if (level > 0.01) light.shadow.needsUpdate = true
    },
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
  // soft penumbra: the bulb is a lamp, not a point (PCF with a wide Vogel-disk kernel)
  key.shadow.radius = 7
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
