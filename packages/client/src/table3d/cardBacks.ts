import * as THREE from 'three'
import { getViewSettings, onViewSettings } from '../settings/viewSettings'
import type { BackDesign, DrawnBack } from './backDesigns'

// Card backs, after the classic two-way backs of Bicycle cards: a white border, a field of fine
// ornament and a central medallion, all symmetric under a half turn (an upside-down card looks
// the same, so a back never tells anything). Besides these drawn ones there are illustrated backs
// (pictures in ./backs). Every card shares ONE texture, repainted in place when the player picks
// another design in the settings.

export { BACK_DESIGNS, type BackDesign } from './backDesigns'

// the illustrated backs: pictures of the whole card, 320 × 500
const PICTURES = import.meta.glob('./backs/*.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>
/** The picture of an illustrated back, or null for a drawn one. */
export function backPicture(design: BackDesign): string | null {
  return PICTURES[`./backs/${design}.webp`] ?? null
}

const W = 160
const H = 250
const SCALE = 2
const CREAM = '#f1e7d2'
const BORDER = 9

/** Draw the field ornament for half the card (y < H/2) and mirror it with a half turn. */
function twoWay(g: CanvasRenderingContext2D, draw: () => void) {
  g.save()
  g.beginPath()
  g.rect(BORDER, BORDER, W - 2 * BORDER, H / 2 - BORDER)
  g.clip()
  draw()
  g.restore()
  g.save()
  g.translate(W, H)
  g.rotate(Math.PI)
  g.beginPath()
  g.rect(BORDER, BORDER, W - 2 * BORDER, H / 2 - BORDER)
  g.clip()
  draw()
  g.restore()
}

function frame(g: CanvasRenderingContext2D, field: string) {
  g.fillStyle = CREAM
  g.fillRect(0, 0, W, H)
  g.fillStyle = field
  g.fillRect(BORDER, BORDER, W - 2 * BORDER, H - 2 * BORDER)
}

/** The fine inner rule, drawn last so the ornament never covers it. */
function rule(g: CanvasRenderingContext2D, line: string) {
  g.strokeStyle = line
  g.lineWidth = 0.8
  g.strokeRect(BORDER + 3, BORDER + 3, W - 2 * BORDER - 6, H - 2 * BORDER - 6)
}

/** A cart wheel in a medallion: rim, spokes, hub. */
function wheel(g: CanvasRenderingContext2D, x: number, y: number, r: number, field: string) {
  g.fillStyle = CREAM
  g.beginPath()
  g.arc(x, y, r + 4, 0, Math.PI * 2)
  g.fill()
  g.fillStyle = field
  g.beginPath()
  g.arc(x, y, r + 1.5, 0, Math.PI * 2)
  g.fill()
  g.strokeStyle = CREAM
  g.lineWidth = 2
  g.beginPath()
  g.arc(x, y, r - 2, 0, Math.PI * 2)
  g.stroke()
  g.lineWidth = 1
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2
    g.beginPath()
    g.moveTo(x + Math.cos(a) * 4, y + Math.sin(a) * 4)
    g.lineTo(x + Math.cos(a) * (r - 2), y + Math.sin(a) * (r - 2))
    g.stroke()
  }
  g.fillStyle = CREAM
  g.beginPath()
  g.arc(x, y, 4, 0, Math.PI * 2)
  g.fill()
  // small petals round the rim
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 + Math.PI / 16
    g.beginPath()
    g.arc(x + Math.cos(a) * (r + 7.5), y + Math.sin(a) * (r + 7.5), 1.6, 0, Math.PI * 2)
    g.fill()
  }
}

/** An eight-petal flower in a small ring (four petals read as an X). */
function rosette(g: CanvasRenderingContext2D, x: number, y: number, r: number) {
  rosetteColor(g, x, y, r, CREAM)
  g.strokeStyle = CREAM
  g.lineWidth = 0.9
  g.beginPath()
  g.arc(x, y, r + 2.5, 0, Math.PI * 2)
  g.stroke()
  g.fillStyle = CREAM
  g.beginPath()
  g.arc(x, y, 1.8, 0, Math.PI * 2)
  g.fill()
}

/** Rider-style: a lattice of interlocking circles, a wheel medallion, rosettes top and bottom. */
function rueda(g: CanvasRenderingContext2D, field: string) {
  frame(g, field)
  twoWay(g, () => {
    g.strokeStyle = 'rgba(241,231,210,0.55)'
    g.lineWidth = 0.7
    const s = 13
    for (let y = BORDER - s; y < H / 2 + s; y += s)
      for (let x = BORDER - s; x < W + s; x += s) {
        for (const [dx, dy] of [[0, 0], [s / 2, s / 2]]) {
          g.beginPath()
          g.arc(x + dx, y + dy, s * 0.62, 0, Math.PI * 2)
          g.stroke()
        }
      }
    rosette(g, W / 2, 46, 12)
  })
  rule(g, CREAM)
  wheel(g, W / 2, H / 2, 24, field)
}

/** Fan back: rays and scalloped arcs fanning out from the centre. */
function abanico(g: CanvasRenderingContext2D) {
  const field = '#221a16'
  frame(g, field)
  twoWay(g, () => {
    g.strokeStyle = 'rgba(201,162,39,0.55)'
    g.lineWidth = 0.7
    for (let i = 0; i <= 36; i++) {
      const a = Math.PI + (i / 36) * Math.PI
      g.beginPath()
      g.moveTo(W / 2, H / 2)
      g.lineTo(W / 2 + Math.cos(a) * 220, H / 2 + Math.sin(a) * 220)
      g.stroke()
    }
    for (let r = 26; r < 200; r += 14) {
      g.beginPath()
      for (let i = 0; i <= 36; i++) {
        const a = Math.PI + (i / 36) * Math.PI
        const rr = r + (i % 2 ? 3 : 0) // scalloped
        const x = W / 2 + Math.cos(a) * rr
        const y = H / 2 + Math.sin(a) * rr
        if (i === 0) g.moveTo(x, y)
        else g.lineTo(x, y)
      }
      g.stroke()
    }
  })
  g.fillStyle = '#c9a227'
  g.beginPath()
  g.arc(W / 2, H / 2, 16, 0, Math.PI * 2)
  g.fill()
  g.fillStyle = field
  g.beginPath()
  g.arc(W / 2, H / 2, 12, 0, Math.PI * 2)
  g.fill()
  rosetteColor(g, W / 2, H / 2, 10, '#c9a227')
  rule(g, '#c9a227')
}

function rosetteColor(g: CanvasRenderingContext2D, x: number, y: number, r: number, c: string) {
  g.save()
  g.fillStyle = c
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2
    g.beginPath()
    g.ellipse(x + Math.cos(a) * r * 0.5, y + Math.sin(a) * r * 0.5, r * 0.45, r * 0.16, a, 0, Math.PI * 2)
    g.fill()
  }
  g.restore()
}

/** Diamond back: a lattice of small diamonds, an oval cartouche with a quatrefoil. */
function rombos(g: CanvasRenderingContext2D) {
  const field = '#7d2219'
  frame(g, field)
  twoWay(g, () => {
    const s = 10
    for (let y = BORDER; y < H / 2 + s; y += s)
      for (let x = BORDER; x < W; x += s) {
        const odd = Math.round((x - BORDER) / s + (y - BORDER) / s) % 2 === 0
        g.fillStyle = odd ? 'rgba(241,231,210,0.8)' : 'rgba(241,231,210,0.18)'
        g.beginPath()
        g.moveTo(x + s / 2, y)
        g.lineTo(x + s, y + s / 2)
        g.lineTo(x + s / 2, y + s)
        g.lineTo(x, y + s / 2)
        g.closePath()
        g.fill()
      }
  })
  g.fillStyle = CREAM
  g.beginPath()
  g.ellipse(W / 2, H / 2, 30, 42, 0, 0, Math.PI * 2)
  g.fill()
  g.fillStyle = field
  g.beginPath()
  g.ellipse(W / 2, H / 2, 26, 38, 0, 0, Math.PI * 2)
  g.fill()
  rosetteColor(g, W / 2, H / 2, 20, CREAM)
  rule(g, CREAM)
}

export function drawBackDesign(design: DrawnBack, size = 1): HTMLCanvasElement {
  const cv = document.createElement('canvas')
  cv.width = W * SCALE * size
  cv.height = H * SCALE * size
  const g = cv.getContext('2d')!
  g.scale(SCALE * size, SCALE * size)
  paint(g, design)
  return cv
}

function paint(g: CanvasRenderingContext2D, design: DrawnBack) {
  if (design === 'rueda-azul') rueda(g, '#234a6b')
  else if (design === 'abanico') abanico(g)
  else if (design === 'rombos') rombos(g)
  else rueda(g, '#8c2a1f')
}

// one shared, live texture for every card back
let shared: { tex: THREE.CanvasTexture; cv: HTMLCanvasElement; design: BackDesign } | null = null

/** Paints a design on the shared canvas (a picture once it has loaded). */
function show(design: BackDesign) {
  if (!shared) return
  shared.design = design
  const { cv, tex } = shared
  const g = cv.getContext('2d')!
  const url = backPicture(design)
  if (!url) {
    g.setTransform(SCALE, 0, 0, SCALE, 0, 0)
    paint(g, design as DrawnBack)
    tex.needsUpdate = true
    return
  }
  const img = new Image()
  img.onload = () => {
    if (shared?.design !== design) return // picked another one meanwhile
    g.setTransform(1, 0, 0, 1, 0, 0)
    g.drawImage(img, 0, 0, cv.width, cv.height)
    tex.needsUpdate = true
  }
  img.onerror = () => console.warn('[cards] could not load the card back', design)
  img.src = url
}

export function backTexture(): THREE.CanvasTexture {
  if (shared) return shared.tex
  const cv = document.createElement('canvas')
  cv.width = W * SCALE
  cv.height = H * SCALE
  const tex = new THREE.CanvasTexture(cv)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.minFilter = THREE.LinearMipmapLinearFilter
  tex.anisotropy = 4
  shared = { tex, cv, design: getViewSettings().cardBack }
  show(shared.design)
  onViewSettings((v) => {
    if (shared && v.cardBack !== shared.design) show(v.cardBack)
  })
  return tex
}
