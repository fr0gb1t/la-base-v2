import * as THREE from 'three'
import { PALETTE, hex } from './look'
import { TABLE_Y } from './seats'

// The bidding clock, a chess clock on the felt: a wooden case with a slanted face, one red
// seven-segment LED panel showing both teams' time ("yours / theirs") and two plungers on top
// (the running side's stands up). Every player sees it the same way: in front of the centre deck,
// facing them. Played without time it reads "- / -". Pressing it confirms your bid.

export interface ClockView {
  off: boolean // played without time
  mine: number // ms left, your team
  theirs: number
  running: 'mine' | 'theirs' | null
  canPress: boolean // your turn to bid: pressing confirms it
}

const W = 0.17 // case width
const D = 0.07 // depth
const H_FRONT = 0.035
const H_BACK = 0.065
const SIZE = 1.6
const LED_ON = '#ff2d1a'
const LED_OFF = '#2b0705'

// segments a–g of each digit (classic order: top, top-right, bottom-right, bottom, bottom-left,
// top-left, middle)
const DIGITS: Record<string, string> = {
  '0': 'abcdef', '1': 'bc', '2': 'abged', '3': 'abgcd', '4': 'fgbc', '5': 'afgcd',
  '6': 'afgedc', '7': 'abc', '8': 'abcdefg', '9': 'abcdfg', '-': 'g', ' ': '',
}

/** One seven-segment digit at (x, y), w × h, segments lit by `on`. */
function digit(g: CanvasRenderingContext2D, ch: string, x: number, y: number, w: number, h: number) {
  const t = w * 0.18 // segment thickness
  const lit = DIGITS[ch] ?? ''
  const seg = (name: string, sx: number, sy: number, horizontal: boolean, len: number) => {
    g.fillStyle = lit.includes(name) ? LED_ON : LED_OFF
    g.shadowColor = lit.includes(name) ? LED_ON : 'transparent'
    g.shadowBlur = lit.includes(name) ? 14 : 0
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
  const slant = w * 0.12 // italic, like real LED digits
  g.save()
  g.transform(1, 0, -slant / h, 1, slant / 2, 0)
  seg('a', x + t * 0.6, y, true, w - t * 1.2)
  seg('g', x + t * 0.6, y + half, true, w - t * 1.2)
  seg('d', x + t * 0.6, y + h, true, w - t * 1.2)
  seg('f', x, y + t * 0.6, false, half - t * 1.2)
  seg('b', x + w, y + t * 0.6, false, half - t * 1.2)
  seg('e', x, y + half + t * 0.6, false, half - t * 1.2)
  seg('c', x + w, y + half + t * 0.6, false, half - t * 1.2)
  g.restore()
}

function format(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export class ChessClock {
  readonly group = new THREE.Group()
  readonly hit: THREE.Mesh // the whole clock, for the pointer
  private cv = document.createElement('canvas')
  private tex: THREE.CanvasTexture
  private buttons: THREE.Mesh[] = []
  private press = [0, 0] // plunger heights (0 up, 1 down), eased
  private shown = ''
  private view: ClockView = { off: true, mine: 0, theirs: 0, running: null, canPress: false }
  private startedAt = 0 // performance.now() when the running time was last received
  hovered = false

  constructor() {
    const wood = new THREE.MeshStandardMaterial({ color: hex(PALETTE.soot), roughness: 0.55 })
    // the case: a side profile (slanted face toward you) extruded across the width
    const profile = new THREE.Shape()
    profile.moveTo(-D / 2, 0)
    profile.lineTo(D / 2, 0)
    profile.lineTo(D / 2 - 0.022, H_FRONT)
    profile.lineTo(-D / 2, H_BACK)
    profile.closePath()
    const caseGeo = new THREE.ExtrudeGeometry(profile, { depth: W, bevelEnabled: true, bevelSize: 0.003, bevelThickness: 0.003, bevelSegments: 2 })
    caseGeo.translate(0, 0, -W / 2)
    caseGeo.rotateY(-Math.PI / 2) // the profile's +x (front) faces +z
    const body = new THREE.Mesh(caseGeo, wood)
    body.castShadow = body.receiveShadow = true
    this.group.add(body)

    // the LED panel, on the slanted face
    this.cv.width = 512
    this.cv.height = 160
    this.tex = new THREE.CanvasTexture(this.cv)
    this.tex.colorSpace = THREE.SRGBColorSpace
    this.tex.anisotropy = 8
    // the slanted face runs from the front edge (z fz, y H_FRONT) up to the back edge (z -D/2, y H_BACK)
    const fz = D / 2 - 0.022
    const slope = Math.atan2(H_BACK - H_FRONT, fz + D / 2) // how far it leans back
    const panelW = W * 0.86
    const panel = new THREE.Mesh(
      new THREE.PlaneGeometry(panelW, (panelW * this.cv.height) / this.cv.width),
      new THREE.MeshBasicMaterial({ map: this.tex, toneMapped: false }),
    )
    const normal = new THREE.Vector3(0, Math.cos(slope), Math.sin(slope))
    panel.position.set(0, (H_FRONT + H_BACK) / 2, (fz - D / 2) / 2).addScaledVector(normal, 0.0035)
    panel.rotation.x = slope - Math.PI / 2 // facing up and toward you, along the face
    this.group.add(panel)

    // the plungers on top (the back, highest edge)
    const brass = new THREE.MeshStandardMaterial({ color: hex(PALETTE.oxblood), roughness: 0.4, metalness: 0.2 })
    for (const x of [-W * 0.3, W * 0.3]) {
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.012, 0.016, 16), brass)
      b.position.set(x, H_BACK + 0.008, -D / 2 + 0.012)
      b.castShadow = true
      this.buttons.push(b)
      this.group.add(b)
    }

    this.hit = new THREE.Mesh(new THREE.BoxGeometry(W + 0.02, H_BACK + 0.03, D + 0.02), new THREE.MeshBasicMaterial({ visible: false }))
    this.hit.position.y = (H_BACK + 0.03) / 2
    this.group.add(this.hit)

    // in front of the centre deck, toward you (seat 0 sits at +Z), facing you
    this.group.position.set(0, TABLE_Y, 0.18)
    this.group.scale.setScalar(SIZE) // big enough to read from your chair
    this.draw()
  }

  set(view: ClockView) {
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
    const text = v.off ? '-/-' : `${format(l.mine)}/${format(l.theirs)}`
    const blink = v.running && !v.off ? Math.floor(performance.now() / 500) % 2 : 0
    const key = `${text}|${blink}|${v.running}`
    if (key !== this.shown) {
      this.shown = key
      this.draw()
    }
    // the running side's plunger stands up; the other is pressed in. Yours lifts a hair more when
    // you can press it and the pointer is on the clock
    const goals = [v.running === 'mine' ? 0 : 1, v.running === 'theirs' ? 0 : 1]
    if (v.off || !v.running) goals.fill(0.5)
    goals[0] -= this.hovered && v.canPress ? 0.35 : 0
    this.buttons.forEach((b, i) => {
      this.press[i] += (goals[i] - this.press[i]) * Math.min(1, dt * 18)
      b.position.y = H_BACK + 0.008 - this.press[i] * 0.009
    })
  }

  private draw() {
    const g = this.cv.getContext('2d')!
    const { width: w, height: h } = this.cv
    g.shadowBlur = 0
    g.fillStyle = '#0b0302'
    g.fillRect(0, 0, w, h)
    const v = this.view
    const l = this.left()
    const blinkOff = v.running && !v.off ? Math.floor(performance.now() / 500) % 2 === 1 : false
    const side = (ms: number, x0: number, running: boolean) => {
      const chars = v.off ? [' ', ' ', '-', ' '] : (() => {
        const s = format(ms).padStart(5, ' ')
        return [s[0], s[1], s[3], s[4]] // m m : s s (the colon is drawn apart)
      })()
      const dw = 30
      const dh = 66
      const gap = 12
      chars.forEach((c, i) => digit(g, c, x0 + i * (dw + gap) + (i >= 2 ? 12 : 0), 26, dw, dh))
      if (!v.off) {
        // the colon: blinks on the side whose time is running
        const on = !running || !blinkOff
        g.fillStyle = on ? LED_ON : LED_OFF
        g.shadowColor = on ? LED_ON : 'transparent'
        g.shadowBlur = on ? 10 : 0
        const cx = x0 + 2 * (dw + gap) - 2
        g.fillRect(cx - 2, 26 + dh * 0.26, 10, 10)
        g.fillRect(cx - 2, 26 + dh * 0.64, 10, 10)
      }
    }
    side(l.mine, 34, v.running === 'mine')
    side(l.theirs, 296, v.running === 'theirs')
    // the slash between the two times
    g.shadowBlur = 8
    g.shadowColor = LED_ON
    g.strokeStyle = LED_ON
    g.lineWidth = 7
    g.beginPath()
    g.moveTo(270, 26)
    g.lineTo(242, 92)
    g.stroke()
    // whose is whose, in small dim letters under each side
    g.shadowBlur = 0
    g.fillStyle = '#7a1a10'
    g.font = 'bold 22px "VT323", monospace'
    g.textAlign = 'center'
    g.fillText('TU EQUIPO', 120, 140)
    g.fillText('RIVALES', 384, 140)
    // the running side gets a lit dot beside its label
    if (v.running && !v.off) {
      g.fillStyle = LED_ON
      g.shadowColor = LED_ON
      g.shadowBlur = 10
      g.beginPath()
      g.arc(v.running === 'mine' ? 40 : 304, 133, 6, 0, Math.PI * 2)
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
  }
}
