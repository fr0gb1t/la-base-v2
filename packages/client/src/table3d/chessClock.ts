import * as THREE from 'three'
import { PALETTE, hex } from './look'
import { TABLE_Y } from './seats'

// The bidding clock: a tournament chess clock (DGT-style) on the felt at your right hand — a walnut
// case whose front slants back, a black rocker on top (the running side's half stands up), a grey
// LCD with both teams' times ("tu equipo" left, "rivales" right) and a row of dark buttons under it.
// It sits squared to your edge of the table, so from your chair its left end is the nearer one.
// Played without time it reads "-:--" on both sides. Pressing it confirms your bid.

export interface ClockView {
  off: boolean // played without time
  mine: number // ms left, your team
  theirs: number
  running: 'mine' | 'theirs' | null
  canPress: boolean // your turn to bid: pressing confirms it
  seats: number // players at the table: with many, the neighbour's card and beans come closer
}

// the case (metres before SIZE): side profile in (depth toward the front, height)
const W = 0.19 // width
const D = 0.095 // depth at the base
const H = 0.066 // height at the back of the top
const FRONT_RUN = 0.04 // how far the front face leans back
const FRONT_H = 0.056 // where the front face meets the top
const BACK_RUN = 0.022
// on the felt, at your right (seat 0 sits at +Z): clear of your beans (x ≲ 0.25, z 0.33–0.53), of
// the stacks of bases you win (z ≳ 0.66) and of your right-hand neighbour's card (with 8 it lies at
// 45°, so the clock sits lower and smaller there)
const LAYOUT = {
  roomy: { at: new THREE.Vector3(0.31, 0, 0.58), size: 1.1 },
  tight: { at: new THREE.Vector3(0.32, 0, 0.63), size: 0.95 },
} as const
const TIGHT_FROM = 7 // seats
const YAW = -0.42 // turned a little toward you, the left end nearer (squared would be 0)
const ROCK = 0.07 // rocker tilt, radians

const INK = '#1d1c15' // LCD segments
const GHOST = 'rgba(29, 28, 21, 0.07)' // unlit segments, faintly there as on a real LCD

// segments a–g of each digit (top, top-right, bottom-right, bottom, bottom-left, top-left, middle)
const DIGITS: Record<string, string> = {
  '0': 'abcdef', '1': 'bc', '2': 'abged', '3': 'abgcd', '4': 'fgbc', '5': 'afgcd',
  '6': 'afgedc', '7': 'abc', '8': 'abcdefg', '9': 'abcdfg', '-': 'g', ' ': '',
}

/** One seven-segment LCD digit at (x, y), w × h (thin bevelled segments, a slight italic). */
function digit(g: CanvasRenderingContext2D, ch: string, x: number, y: number, w: number, h: number) {
  const t = w * 0.16
  const lit = DIGITS[ch] ?? ''
  const seg = (name: string, sx: number, sy: number, horizontal: boolean, len: number) => {
    g.fillStyle = lit.includes(name) ? INK : GHOST
    g.beginPath()
    if (horizontal) {
      g.moveTo(sx, sy)
      g.lineTo(sx + t / 2, sy - t / 2)
      g.lineTo(sx + len - t / 2, sy - t / 2)
      g.lineTo(sx + len, sy)
      g.lineTo(sx + len - t / 2, sy + t / 2)
      g.lineTo(sx + t / 2, sy + t / 2)
    } else {
      g.moveTo(sx, sy)
      g.lineTo(sx + t / 2, sy + t / 2)
      g.lineTo(sx + t / 2, sy + len - t / 2)
      g.lineTo(sx, sy + len)
      g.lineTo(sx - t / 2, sy + len - t / 2)
      g.lineTo(sx - t / 2, sy + t / 2)
    }
    g.closePath()
    g.fill()
  }
  const half = h / 2
  const gap = t * 0.7
  g.save()
  g.transform(1, 0, -0.08, 1, 0.08 * (y + h), 0)
  seg('a', x + gap, y, true, w - gap * 2)
  seg('g', x + gap, y + half, true, w - gap * 2)
  seg('d', x + gap, y + h, true, w - gap * 2)
  seg('f', x, y + gap, false, half - gap * 2)
  seg('b', x + w, y + gap, false, half - gap * 2)
  seg('e', x, y + half + gap, false, half - gap * 2)
  seg('c', x + w, y + half + gap, false, half - gap * 2)
  g.restore()
}

function format(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/** Walnut: dark streaks of grain across a warm brown, a few knots of darker figure. */
function walnutTexture() {
  const cv = document.createElement('canvas')
  cv.width = 512
  cv.height = 256
  const g = cv.getContext('2d')!
  g.fillStyle = PALETTE.walnut
  g.fillRect(0, 0, cv.width, cv.height)
  let seed = 7
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  for (let i = 0; i < 140; i++) {
    const y0 = rnd() * cv.height
    const amp = 2 + rnd() * 9
    const f = 0.006 + rnd() * 0.012
    const ph = rnd() * 6
    g.strokeStyle = rnd() < 0.55 ? `rgba(20, 8, 3, ${0.12 + rnd() * 0.3})` : `rgba(140, 78, 40, ${0.06 + rnd() * 0.12})`
    g.lineWidth = 0.6 + rnd() * 2.4
    g.beginPath()
    for (let x = 0; x <= cv.width; x += 8) {
      const y = y0 + Math.sin(x * f + ph) * amp + Math.sin(x * f * 3.1 + ph * 2) * amp * 0.25
      if (x === 0) g.moveTo(x, y)
      else g.lineTo(x, y)
    }
    g.stroke()
  }
  const tex = new THREE.CanvasTexture(cv)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(9, 14) // extrude UVs are in metres
  tex.anisotropy = 8
  return tex
}

/** The glyphs on the five buttons (◀ − ▶❙❙ + ▶), bone on transparent. */
function buttonGlyphs(n: number) {
  const cv = document.createElement('canvas')
  cv.width = 640
  cv.height = 64
  const g = cv.getContext('2d')!
  g.fillStyle = g.strokeStyle = PALETTE.bone
  g.lineWidth = 6
  const cell = cv.width / n
  const draw = [
    (cx: number) => { g.beginPath(); g.moveTo(cx + 9, 18); g.lineTo(cx - 9, 32); g.lineTo(cx + 9, 46); g.fill() },
    (cx: number) => g.fillRect(cx - 13, 29, 26, 6),
    (cx: number) => { g.beginPath(); g.moveTo(cx - 16, 18); g.lineTo(cx, 32); g.lineTo(cx - 16, 46); g.fill(); g.fillRect(cx + 4, 19, 5, 26); g.fillRect(cx + 13, 19, 5, 26) },
    (cx: number) => { g.fillRect(cx - 13, 29, 26, 6); g.fillRect(cx - 3, 19, 6, 26) },
    (cx: number) => { g.beginPath(); g.moveTo(cx - 9, 18); g.lineTo(cx + 9, 32); g.lineTo(cx - 9, 46); g.fill() },
  ]
  draw.forEach((f, i) => f(cell * (i + 0.5)))
  const tex = new THREE.CanvasTexture(cv)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  return tex
}

export class ChessClock {
  readonly group = new THREE.Group()
  readonly hit: THREE.Mesh // the whole clock, for the pointer
  private cv = document.createElement('canvas')
  private tex: THREE.CanvasTexture
  private rocker = new THREE.Group()
  private tilt = 0 // eased rocker angle
  private shown = ''
  private view: ClockView = { off: true, mine: 0, theirs: 0, running: null, canPress: false, seats: 4 }
  private startedAt = 0 // performance.now() when the running time was last received
  private disposables: Array<{ dispose(): void }> = []
  hovered = false

  constructor() {
    const grain = walnutTexture()
    const wood = new THREE.MeshStandardMaterial({ map: grain, roughness: 0.42, metalness: 0 })
    const plastic = new THREE.MeshStandardMaterial({ color: hex('#141210'), roughness: 0.35 })
    const bezelMat = new THREE.MeshStandardMaterial({ color: hex('#24211d'), roughness: 0.6 })
    this.disposables.push(grain)

    // the case: the side profile extruded across the width, its front (+x of the shape) toward +z
    const profile = new THREE.Shape()
    profile.moveTo(-D / 2, 0)
    profile.lineTo(D / 2, 0)
    profile.lineTo(D / 2 - FRONT_RUN, FRONT_H)
    profile.lineTo(-D / 2 + BACK_RUN, H)
    profile.closePath()
    const caseGeo = new THREE.ExtrudeGeometry(profile, { depth: W, bevelEnabled: true, bevelSize: 0.004, bevelThickness: 0.004, bevelSegments: 3 })
    caseGeo.translate(0, 0, -W / 2)
    caseGeo.rotateY(-Math.PI / 2)
    const body = new THREE.Mesh(caseGeo, wood)
    body.castShadow = body.receiveShadow = true
    this.group.add(body)

    // the front face, from its foot (F0) up to where it meets the top (F1)
    const f0 = new THREE.Vector2(D / 2 + 0.004, 0) // (z, y), past the bevel
    const f1 = new THREE.Vector2(D / 2 - FRONT_RUN + 0.004, FRONT_H)
    const faceLen = f0.distanceTo(f1)
    const lean = Math.asin(FRONT_RUN / faceLen)
    const normal = new THREE.Vector3(0, FRONT_RUN, FRONT_H).normalize()
    const onFace = (s: number, x: number, off: number) =>
      new THREE.Vector3(x, f0.y + (f1.y - f0.y) * s, f0.x + (f1.x - f0.x) * s).addScaledVector(normal, off)
    const flat = (mesh: THREE.Object3D, s: number, x: number, off: number) => {
      mesh.position.copy(onFace(s, x, off))
      mesh.rotation.x = -lean
      return mesh
    }

    // the dark bezel that frames display and buttons, wood showing round it
    const bezel = flat(new THREE.Mesh(new THREE.BoxGeometry(W * 0.93, faceLen * 0.84, 0.004), bezelMat), 0.55, 0, 0.001)
    this.group.add(bezel)

    // the LCD, recessed a hair in the bezel
    this.cv.width = 1024
    this.cv.height = 340
    this.tex = new THREE.CanvasTexture(this.cv)
    this.tex.colorSpace = THREE.SRGBColorSpace
    this.tex.anisotropy = 8
    const lcdW = W * 0.86
    const lcd = flat(
      new THREE.Mesh(
        new THREE.PlaneGeometry(lcdW, (lcdW * this.cv.height) / this.cv.width),
        // lit by the lamp like paper, plus a faint glow so it still reads in the dark
        new THREE.MeshStandardMaterial({ map: this.tex, roughness: 0.3, emissive: hex('#ffffff'), emissiveMap: this.tex, emissiveIntensity: 0.22 }),
      ),
      0.66, 0, 0.0036,
    )
    this.group.add(lcd)

    // five buttons under the display, with their glyphs
    const n = 5
    const bw = (W * 0.86) / n
    const btnGeo = new THREE.BoxGeometry(bw - 0.003, faceLen * 0.13, 0.006)
    for (let i = 0; i < n; i++) {
      const btn = flat(new THREE.Mesh(btnGeo, plastic), 0.2, -W * 0.43 + bw * (i + 0.5), 0.004)
      btn.castShadow = true
      this.group.add(btn)
    }
    const glyphs = buttonGlyphs(n)
    this.disposables.push(glyphs)
    this.group.add(flat(new THREE.Mesh(new THREE.PlaneGeometry(W * 0.86, faceLen * 0.086), new THREE.MeshBasicMaterial({ map: glyphs, transparent: true, opacity: 0.7, depthWrite: false })), 0.2, 0, 0.0072))

    // the rocker: a black cap over the whole top, pivoting on its middle (one half up, one down)
    const topLen = Math.hypot(D - FRONT_RUN - BACK_RUN, H - FRONT_H) + 0.01
    const topSlope = Math.atan2(H - FRONT_H, D - FRONT_RUN - BACK_RUN)
    const midZ = (D / 2 - FRONT_RUN + (-D / 2 + BACK_RUN)) / 2
    this.rocker.position.set(0, (FRONT_H + H) / 2 + 0.006, midZ)
    this.rocker.rotation.x = topSlope // follows the top, rising toward the back
    const halfGeo = new THREE.BoxGeometry(W / 2 - 0.002, 0.009, topLen)
    for (const side of [-1, 1]) {
      const half = new THREE.Mesh(halfGeo, plastic)
      half.position.x = side * (W / 4 + 0.001)
      half.castShadow = true
      this.rocker.add(half)
    }
    const pivot = new THREE.Group() // tilts; the halves hang off it
    pivot.add(...this.rocker.children)
    this.rocker.add(pivot)
    this.group.add(this.rocker)

    this.hit = new THREE.Mesh(new THREE.BoxGeometry(W + 0.02, H + 0.03, D + 0.02), new THREE.MeshBasicMaterial({ visible: false }))
    this.hit.position.y = (H + 0.03) / 2
    this.group.add(this.hit)

    this.group.rotation.y = YAW
    this.place(this.view.seats)
    this.draw()
  }

  private place(seats: number) {
    const l = seats >= TIGHT_FROM ? LAYOUT.tight : LAYOUT.roomy
    this.group.position.set(l.at.x, TABLE_Y, l.at.z)
    this.group.scale.setScalar(l.size)
  }

  set(view: ClockView) {
    if (view.seats !== this.view.seats) this.place(view.seats)
    const restarted = view.running !== this.view.running || view.mine !== this.view.mine || view.theirs !== this.view.theirs
    if (restarted) this.startedAt = performance.now()
    this.view = view
  }

  /** Time left now on each side (the running side keeps counting down locally). */
  left() {
    const v = this.view
    const spent = v.running ? performance.now() - this.startedAt : 0
    return {
      mine: Math.max(0, v.mine - (v.running === 'mine' ? spent : 0)),
      theirs: Math.max(0, v.theirs - (v.running === 'theirs' ? spent : 0)),
    }
  }

  update(dt: number) {
    const v = this.view
    const l = this.left()
    const blink = v.running && !v.off ? Math.floor(performance.now() / 500) % 2 : 0
    const key = v.off ? 'off' : `${format(l.mine)}|${format(l.theirs)}|${blink}|${v.running}`
    if (key !== this.shown) {
      this.shown = key
      this.draw()
    }
    // the running side's half of the rocker stands up (yours is the left one); with the pointer on
    // it when you can press, yours already gives a little under your hand
    let goal = v.off || !v.running ? 0 : v.running === 'mine' ? ROCK : -ROCK
    if (this.hovered && v.canPress) goal *= 0.4
    this.tilt += (goal - this.tilt) * Math.min(1, dt * 18)
    ;(this.rocker.children[0] as THREE.Object3D).rotation.z = -this.tilt
  }

  private draw() {
    const g = this.cv.getContext('2d')!
    const { width: w, height: h } = this.cv
    // the glass: pale grey-green, darker toward the edges like an unlit LCD
    const bg = g.createLinearGradient(0, 0, 0, h)
    bg.addColorStop(0, '#9c9a82')
    bg.addColorStop(0.5, PALETTE.lcd)
    bg.addColorStop(1, '#949279')
    g.fillStyle = bg
    g.fillRect(0, 0, w, h)
    g.strokeStyle = 'rgba(29, 28, 21, 0.35)'
    g.lineWidth = 6
    g.strokeRect(3, 3, w - 6, h - 6)

    const v = this.view
    const l = this.left()
    const blinkOff = v.running && !v.off ? Math.floor(performance.now() / 500) % 2 === 1 : false
    const dw = 66
    const dh = 150
    const top = 92
    // m:ss on each half; minutes up to two digits (the first blank under 10)
    const side = (ms: number, x0: number, running: boolean) => {
      const s = v.off ? ' -:--' : format(ms).padStart(5, ' ')
      const chars = [s[0], s[1], s[3], s[4]]
      chars.forEach((c, i) => digit(g, c, x0 + i * (dw + 26) + (i >= 2 ? 28 : 0), top, dw, dh))
      const on = v.off || !running || !blinkOff
      g.fillStyle = on ? INK : GHOST
      const cx = x0 + 2 * (dw + 26) - 2
      g.fillRect(cx, top + dh * 0.28, 13, 13)
      g.fillRect(cx - 6, top + dh * 0.66, 13, 13)
    }
    side(l.mine, 60, v.running === 'mine')
    side(l.theirs, 560, v.running === 'theirs')

    // the small print around the digits, as on a tournament clock
    g.fillStyle = INK
    g.font = '600 30px "VT323", "IBM Plex Mono", monospace'
    g.textBaseline = 'alphabetic'
    g.textAlign = 'left'
    g.fillText('TU EQUIPO', 64, 58)
    g.fillText('RIVALES', 564, 58)
    g.textAlign = 'right'
    g.fillText('BASES', w - 40, 58)
    g.fillRect(500, 30, 3, h - 60) // the divider
    g.font = '600 26px "VT323", "IBM Plex Mono", monospace'
    g.textAlign = 'left'
    g.fillText(v.off ? 'SIN TIEMPO' : 'DECLARACIÓN', 64, h - 28)
    // whose clock runs: a little triangle by that side's name
    if (v.running && !v.off) {
      const x = v.running === 'mine' ? 44 : 544
      g.beginPath()
      g.moveTo(x - 14, 38)
      g.lineTo(x, 48)
      g.lineTo(x - 14, 58)
      g.fill()
    }
    // a flag, as real clocks show, on a side whose time has run out
    for (const [ms, x] of [[l.mine, 420], [l.theirs, 920]] as const) {
      if (v.off || ms > 0) continue
      g.fillRect(x, h - 64, 4, 40)
      g.beginPath()
      g.moveTo(x + 4, h - 64)
      g.lineTo(x + 34, h - 54)
      g.lineTo(x + 4, h - 44)
      g.fill()
    }
    this.tex.needsUpdate = true
  }

  dispose() {
    this.group.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose()
        ;(o.material as THREE.Material).dispose()
      }
    })
    this.tex.dispose()
    this.disposables.forEach((d) => d.dispose())
  }
}
