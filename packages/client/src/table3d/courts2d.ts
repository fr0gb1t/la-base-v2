import { PALETTE, SUIT_INK } from './look'
import { v, shape, limb, fold, stroke, head, hand, patch, type V } from './figure2d'

// Court cards after the Spanish pattern (Fournier / Augusto Rius, 1889), drawn with the
// `drawing-2d-figures` method: skeleton in head units → volumes → clothing → engraved line.
// Card space 160 × 250 units, light from the upper left, ground line at y = 224.

export type Suit = keyof typeof SUIT_INK
export type PipFn = (g: CanvasRenderingContext2D, suit: Suit, x: number, y: number, s: number) => void

export const INK = PALETTE.ink
export const SOOT = PALETTE.soot
export const BLOOD = PALETTE.oxblood
export const GOLD = SUIT_INK.oros
export const SKIN = '#ecdfc2' // a touch lighter than the card stock so faces separate from the paper
export const WHITE = '#f3eadb'

export function ground(g: CanvasRenderingContext2D, cx: number, w: number) {
  g.save()
  g.fillStyle = 'rgba(20,14,12,0.18)'
  g.beginPath()
  g.ellipse(cx, 224, w, 4.5, 0, 0, Math.PI * 2)
  g.fill()
  g.strokeStyle = 'rgba(20,14,12,0.5)'
  g.lineWidth = 0.6
  for (let i = -3; i <= 3; i++) {
    g.beginPath()
    g.moveTo(cx + i * w * 0.28 - 5, 225 + Math.abs(i) * 0.3)
    g.lineTo(cx + i * w * 0.28 + 5, 225 + Math.abs(i) * 0.3)
    g.stroke()
  }
  g.restore()
}

export function hold(g: CanvasRenderingContext2D, pip: PipFn, suit: Suit, x: number, y: number, s: number, angle = 0) {
  g.save()
  g.translate(x, y)
  g.rotate(angle)
  pip(g, suit, 0, 0, s)
  g.restore()
}

/** Vertical slashes on a puffed garment, bowing with the bulge. */
export function slashes(g: CanvasRenderingContext2D, top: [V, V], bottom: [V, V], bulge: number, count: number, color: string) {
  for (let i = 1; i < count; i++) {
    const t = i / count
    const a = v(top[0].x + (top[1].x - top[0].x) * t, top[0].y + (top[1].y - top[0].y) * t)
    const b = v(bottom[0].x + (bottom[1].x - bottom[0].x) * t, bottom[0].y + (bottom[1].y - bottom[0].y) * t)
    const mid = v((a.x + b.x) / 2 + (t - 0.5) * bulge, (a.y + b.y) / 2)
    fold(g, [a, mid, b], 2.6, 2.6, color)
    stroke(g, [a, mid, b], 0.5)
  }
}

// ------------------------------------------------------------------ Sota

export function sota(g: CanvasRenderingContext2D, suit: Suit, pip: PipFn) {
  const c = SUIT_INK[suit]
  ground(g, 84, 26)

  // pose: weight on the viewer-right leg (its hip higher, that shoulder lower)
  // arm roots sit inside the torso (the deltoid grows out of it, no seam)
  const shL = v(71, 76)
  const shR = v(97, 79)

  // cape hanging from the left shoulder, behind the body: pipe folds from the support point
  shape(g, [v(82, 66), v(64, 69), v(55, 92), v(50, 128), v(45, 166), v(58, 174), v(70, 168), v(78, 140), v(80, 100)], BLOOD, { hatch: 1.6, hatchFrom: 0.35, hatchAngle: 1.45 })
  fold(g, [v(60, 82), v(53, 120), v(50, 160)], 1.4, 0.2)
  fold(g, [v(66, 88), v(62, 130), v(60, 168)], 1.2, 0.2)

  // legs in hose: thigh bulges outward high, calf bulges at the back (right) in the upper third
  limb(g, [v(76, 131), v(70, 172), v(67, 214)], [15, 7.5, 4.4], c, { bulges: [{ at: 0.35, amount: 1.6, side: -1 }, { at: 1.3, amount: 1.8, side: 1 }], hatch: 1.5, hatchFrom: 0.5 })
  limb(g, [v(95, 128), v(96, 172), v(93, 215)], [15, 7.8, 4.4], c, { bulges: [{ at: 0.3, amount: 1.8, side: 1 }, { at: 1.3, amount: 2, side: 1 }], hatch: 1.5, hatchFrom: 0.45 })
  stroke(g, [v(68, 171), v(72, 173)], 0.6)
  stroke(g, [v(94, 172), v(98, 171)], 0.6)
  shape(g, [v(69, 211), v(66, 214), v(57, 219), v(56, 223), v(70, 223), v(72, 216)], SOOT, { line: 0.8, shadow: 1.4 })
  shape(g, [v(90, 212), v(90, 223), v(104, 223), v(103, 219), v(96, 214)], SOOT, { line: 0.8, shadow: 1.4 })

  // trunk-hose: a puffed garment from the waist to mid-thigh, slashed
  shape(g, [v(68, 120), v(84, 118), v(101, 118), v(107, 130), v(104, 147), v(93, 152), v(85, 147), v(76, 153), v(65, 148), v(61, 133)], SOOT, { line: 1, shadow: 2 })
  slashes(g, [v(68, 121), v(101, 119)], [v(66, 148), v(104, 146)], 12, 6, c)

  // doublet: padded chest, tight waist, short peplum
  shape(g, [v(78, 63), v(91, 63), v(101, 70), v(104, 84), v(100, 103), v(100, 121), v(85, 125), v(69, 123), v(68, 104), v(63, 85), v(66, 70)], c, { hatch: 1.6, hatchFrom: 0.58 })
  stroke(g, [v(84, 66), v(85, 92), v(85, 120)], 0.7)
  g.fillStyle = GOLD
  for (let y = 72; y < 118; y += 7) {
    g.beginPath()
    g.arc(85, y, 1.1, 0, Math.PI * 2)
    g.fill()
  }
  shape(g, [v(68, 117), v(100, 115), v(100, 118.5), v(68, 120.5)], BLOOD, { line: 0.7, shadow: 1 })
  fold(g, [v(75, 124), v(74, 130)], 1, 0.2)
  fold(g, [v(92, 123), v(93, 130)], 1, 0.2)

  // right arm on the hip (akimbo), sleeve puffed at the shoulder
  limb(g, [shR, v(113, 97), v(101, 114)], [11, 8.5, 6.5], c, { bulges: [{ at: 0.3, amount: 1.4, side: 1 }], hatch: 1.5, hatchFrom: 0.4 })
  fold(g, [v(108, 88), v(112, 96)], 0.9, 0.2)
  hand(g, v(101, 114), Math.PI * 0.85, 8, SKIN)

  // left arm: raised with the symbol (oros/copas), down with the sword, or shouldering the club
  let wrist: V
  let elbow: V
  if (suit === 'espadas') {
    elbow = v(58, 101)
    wrist = v(57, 129)
  } else if (suit === 'bastos') {
    elbow = v(56, 98)
    wrist = v(68, 86)
  } else {
    elbow = v(50, 90)
    wrist = v(46, 70)
  }
  limb(g, [shL, elbow, wrist], [11, 8.5, 6.5], c, { bulges: [{ at: 0.3, amount: 1.3, side: -1 }], hatch: 1.5, hatchFrom: 0.5 })
  const dir = Math.atan2(wrist.y - elbow.y, wrist.x - elbow.x)
  shape(g, [v(wrist.x - 4, wrist.y - 2), v(wrist.x + 4, wrist.y - 2), v(wrist.x + 4, wrist.y + 2), v(wrist.x - 4, wrist.y + 2)], WHITE, { line: 0.6, shadow: 0.9 })
  hand(g, wrist, dir, 8, SKIN, true)

  // neck, small ruff collar
  limb(g, [v(86, 58), v(85, 66)], [9, 10], SKIN, { line: 0.8, shadow: 1.2 })
  shape(g, [v(76, 62), v(81, 60), v(86, 62), v(91, 60), v(95, 63), v(92, 67), v(86, 66), v(80, 67)], WHITE, { line: 0.8, shadow: 1.2 })

  // head: hair mass (bob) behind, face, strands, cap with a long plume
  // hair: a mass behind the skull down to the jaw, then the face, then a fringe under the cap
  shape(g, [v(80, 36), v(98, 35), v(107, 45), v(107, 60), v(101, 66), v(94, 64), v(93, 50), v(84, 44)], SOOT, { line: 0.9, shadow: 1.6 })
  for (let i = 0; i < 4; i++) stroke(g, [v(99 + i * 2, 42), v(101 + i * 2, 54), v(100 + i * 1.6, 63)], 0.5, 'rgba(216,199,160,0.35)')
  head(g, 88, 49, 25, { skin: SKIN })
  shape(g, [v(74, 40), v(90, 38), v(97, 43), v(92, 45), v(84, 43), v(77, 45)], SOOT, { line: 0.7, shadow: 1 })
  shape(g, [v(70, 39), v(80, 32), v(95, 30), v(106, 34), v(104, 40), v(90, 41), v(76, 43)], BLOOD, { line: 1, shadow: 1.8, hatch: 1.4, hatchFrom: 0.6 })
  fold(g, [v(100, 33), v(112, 22), v(124, 18)], 3.2, 0.6, WHITE)
  stroke(g, [v(100, 33), v(112, 22), v(124, 18)], 0.6)
  for (let i = 0; i < 7; i++) stroke(g, [v(104 + i * 2.6, 29 - i * 1.6), v(106 + i * 2.6, 32 - i * 1.4)], 0.45)

  if (suit === 'espadas') hold(g, pip, suit, wrist.x - 3, wrist.y + 30, 16, Math.PI)
  else if (suit === 'bastos') hold(g, pip, suit, wrist.x - 14, wrist.y - 22, 15, -0.55)
  else hold(g, pip, suit, wrist.x - 3, wrist.y - 13, 11)
}

// ------------------------------------------------------------------ Rey

export function rey(g: CanvasRenderingContext2D, suit: Suit, pip: PipFn) {
  const c = SUIT_INK[suit]
  ground(g, 82, 36)

  // mantle behind: hangs from both shoulders to the floor, pipe folds and a pooled hem
  shape(g, [v(62, 80), v(82, 76), v(104, 80), v(116, 120), v(124, 176), v(126, 221), v(108, 224), v(58, 224), v(40, 221), v(42, 176), v(50, 120)], BLOOD, { hatch: 1.6, hatchFrom: 0.62, hatchAngle: 1.45 })
  fold(g, [v(112, 110), v(118, 160), v(120, 216)], 1.6, 0.2)
  fold(g, [v(52, 116), v(46, 170), v(46, 216)], 1.4, 0.2)

  // robe to the floor, flaring slightly, with pipe folds falling from the belt and a wavy hem
  shape(g, [v(66, 88), v(98, 88), v(104, 130), v(110, 180), v(113, 219), v(102, 222), v(90, 220), v(78, 222), v(64, 220), v(52, 222), v(54, 180), v(60, 130)], c, { hatch: 1.5, hatchFrom: 0.6 })
  for (const [x0, x1] of [[66, 60], [73, 70], [95, 99], [101, 107]] as const) fold(g, [v(x0, 136), v((x0 + x1) / 2 + 1, 176), v(x1, 216)], 1.5, 0.2)
  // embroidered front band following the robe
  shape(g, [v(77, 104), v(82.5, 104), v(88, 104), v(88.8, 140), v(89.6, 180), v(90.5, 218), v(83, 219.5), v(75.5, 219), v(76, 180), v(76.5, 140)], BLOOD, { line: 0.8, shadow: 1.2 })
  g.fillStyle = GOLD
  for (let y = 142; y < 214; y += 13) {
    const x = 82.5 + (y - 142) * 0.02
    g.fillRect(x - 1.2, y - 4, 2.4, 8)
    g.fillRect(x - 4, y - 1.2, 8, 2.4)
  }
  shape(g, [v(61, 130.5), v(82, 129.5), v(103, 129), v(103, 131.8), v(82, 132.3), v(61, 133.2)], GOLD, { line: 0.7, shadow: 1 }) // belt
  // shoes peeking under the hem
  shape(g, [v(66, 219), v(58, 222), v(58, 225), v(72, 225), v(73, 220)], SOOT, { line: 0.7, shadow: 1.1 })
  shape(g, [v(92, 219), v(92, 225), v(105, 225), v(104, 222)], SOOT, { line: 0.7, shadow: 1.1 })

  // right arm across the body in a wide bell sleeve, hand resting on the belt
  limb(g, [v(100, 90), v(110, 118), v(93, 128)], [14, 13, 15], c, { bulges: [{ at: 0.6, amount: 2, side: 1 }], hatch: 1.5, hatchFrom: 0.35 })
  fold(g, [v(106, 104), v(110, 116)], 1, 0.2)
  shape(g, [v(96, 122), v(92, 134), v(88, 132), v(90, 121)], BLOOD, { line: 0.6, shadow: 0.9 }) // sleeve lining
  hand(g, v(92, 128), Math.PI * 0.95, 8.5, SKIN)

  // long white hair behind, falling to the shoulders
  shape(g, [v(70, 44), v(96, 42), v(104, 56), v(104, 80), v(96, 86), v(92, 66), v(76, 58)], WHITE, { line: 0.9, shadow: 1.5 })
  for (let i = 0; i < 4; i++) stroke(g, [v(97 + i * 2, 50), v(99 + i * 2, 66), v(97 + i * 1.5, 82)], 0.5)

  // ermine capelet over the shoulders: white fur with black tails
  shape(g, [v(58, 84), v(82, 78), v(106, 84), v(111, 98), v(98, 106), v(82, 104), v(66, 106), v(53, 98)], WHITE, { line: 1, shadow: 1.8 })
  g.fillStyle = INK
  for (const [x, y] of [[60, 94], [70, 99], [80, 96], [92, 99], [102, 95], [66, 88], [96, 88], [86, 90]] as const) {
    g.beginPath()
    g.moveTo(x - 1, y - 2)
    g.lineTo(x + 1, y - 2)
    g.lineTo(x, y + 3)
    g.closePath()
    g.fill()
  }

  // head (old), then the long beard over the ermine, moustache, crown
  head(g, 83, 56, 26, { skin: SKIN, old: true })
  shape(g, [v(69, 62), v(76, 66), v(86, 64), v(95, 63), v(96, 76), v(91, 92), v(84, 104), v(78, 96), v(70, 82)], WHITE, { line: 0.9, shadow: 1.6 })
  for (let i = 0; i < 6; i++) stroke(g, [v(73 + i * 3.6, 68), v(74 + i * 3.2, 82), v(78 + i * 2, 98)], 0.5)
  shape(g, [v(70, 64), v(76, 62), v(82, 64), v(88, 62), v(92, 65), v(86, 67), v(80, 66), v(74, 67)], WHITE, { line: 0.7, shadow: 1 })
  // crown: a band on the brow with points and gems
  shape(g, [v(68, 44), v(70, 30), v(75, 38), v(80, 26), v(85, 37), v(90, 27), v(94, 37), v(99, 30), v(99, 44), v(84, 46)], GOLD, { line: 1, shadow: 1.8, hatch: 1.3, hatchFrom: 0.62 })
  g.fillStyle = BLOOD
  for (const [x, y] of [[74, 41], [84, 42], [94, 41]] as const) {
    g.beginPath()
    g.arc(x, y, 1.6, 0, Math.PI * 2)
    g.fill()
  }

  // left arm with the suit symbol, in a bell sleeve
  const upright = suit === 'espadas' || suit === 'bastos'
  const elbow = v(56, 118)
  const wrist = upright ? v(54, 124) : v(52, 104)
  limb(g, [v(64, 90), elbow, wrist], [14, 13, 15], c, { bulges: [{ at: 0.6, amount: 2, side: -1 }], hatch: 1.5, hatchFrom: 0.55 })
  shape(g, [v(wrist.x - 7, wrist.y - 1), v(wrist.x + 7, wrist.y - 3), v(wrist.x + 6, wrist.y + 3), v(wrist.x - 6, wrist.y + 4)], BLOOD, { line: 0.6, shadow: 0.9 })
  hand(g, v(wrist.x, wrist.y - 2), -Math.PI / 2, 8.5, SKIN, true)
  if (suit === 'espadas') hold(g, pip, suit, wrist.x, wrist.y - 40, 20)
  else if (suit === 'bastos') hold(g, pip, suit, wrist.x - 2, wrist.y - 26, 17, -0.15)
  else hold(g, pip, suit, wrist.x, wrist.y - 16, 12)
}

// ------------------------------------------------------------------ Caballo

// A dark bay: brown coat, black points (mane, tail, lower legs). On a dark mass ink hatching
// disappears, so its form is cut in with light lines on the lit side (white-line woodcut).
const HORSE = '#5a3421'
const HORSE_SHADE = '#3c2216'
const POINTS = '#1c1410' // black lower legs, mane, tail
const HL = { highlight: 1.5 }

/**
 * The knight: a big white horse in a collected parade walk (passage) — high arched neck, head
 * tucked, near foreleg lifted high — dressed in a caparison down to the knees (scalloped hem,
 * fringe, embroidered border, the suit on a medallion). The rider sits tall, cape blown back,
 * holding the suit up; the other hand keeps the reins.
 */
export function caballo(g: CanvasRenderingContext2D, suit: Suit, pip: PipFn) {
  const c = SUIT_INK[suit]
  ground(g, 90, 50)
  // legs: coat above the knee/hock, black below (the bay's points)
  const leg = (pts: V[], w: number[], shade: string) => {
    limb(g, pts, w, shade, { line: 0.9, shadow: 1.7, hatch: 1.3, hatchFrom: 0.6, ramp: 0.2, ...HL })
    limb(g, pts.slice(1), w.slice(1), POINTS, { line: 0.9, shadow: 1.7, ramp: 0.5, highlight: 1.8 })
  }
  const hoof = (x: number, y: number, dx = 0) => shape(g, [v(x - 4 + dx, y - 5), v(x + 3 + dx, y - 5), v(x + 4, y), v(x - 6, y)], SOOT, { line: 0.7, shadow: 1 })

  // far legs, in shade behind everything
  leg([v(72, 172), v(69, 196), v(68, 213), v(65, 219)], [11, 7.5, 5.8, 5.8], HORSE_SHADE)
  hoof(64, 223)
  leg([v(126, 172), v(134, 195), v(130, 213), v(126, 219)], [13, 7, 5.6, 5.6], HORSE_SHADE)
  hoof(125, 223)

  // tail: a long flowing mass with strands
  shape(g, [v(134, 146), v(142, 150), v(148, 168), v(150, 192), v(146, 208), v(140, 206), v(141, 186), v(137, 164)], POINTS, { line: 0.9, shadow: 1.5 })
  for (let i = 0; i < 5; i++) stroke(g, [v(137 + i * 1.6, 154), v(142 + i * 1.4, 178), v(142 + i, 204)], 0.5, 'rgba(216,199,160,0.35)')

  // body barrel (mostly under the caparison)
  shape(g, [v(92, 140), v(108, 144), v(124, 139), v(137, 151), v(137, 172), v(126, 182), v(100, 186), v(72, 184), v(55, 172), v(50, 156), v(58, 142)], HORSE, { hatch: 1.4, hatchFrom: 0.6, hatchAngle: 1.25, ...HL })

  // near hind leg under the body: gaskin, hock angled back, cannon, sloped pastern
  leg([v(114, 170), v(120, 195), v(114, 213), v(110, 219)], [15, 7.5, 5.8, 5.8], HORSE)
  hoof(109, 223)

  // neck (high, arched crest) and the tucked head, as one mass: poll, forehead, long face, muzzle,
  // round jowl, throat latch
  shape(g, [v(94, 142), v(86, 122), v(72, 103), v(59, 90), v(53, 85), v(46, 87), v(40, 99), v(35, 112), v(31, 123), v(33, 130), v(40, 131), v(47, 123), v(52, 111), v(57, 106), v(60, 122), v(58, 140), v(55, 154)], HORSE, { hatch: 1.3, hatchFrom: 0.62, hatchAngle: 1.2, ...HL })
  patch(g, [v(56, 156), v(60, 146), v(80, 140), v(94, 145), v(88, 158), v(66, 162)], HORSE)
  // white blaze down the face, jowl and neck muscle cut in light
  fold(g, [v(44, 90), v(40, 104), v(35, 118), v(33, 126)], 3.2, 2, '#ecdfc2')
  stroke(g, [v(46, 106), v(51, 115), v(46, 123)], 0.7, 'rgba(236,223,194,0.6)')
  stroke(g, [v(62, 110), v(66, 126)], 0.6, 'rgba(236,223,194,0.5)')
  // ears, forelock, eye, nostril, mouth
  shape(g, [v(52, 86), v(55, 72), v(59, 86)], HORSE, { line: 0.8, shadow: 1.2, highlight: 1.2 })
  shape(g, [v(47, 86), v(48, 74), v(52, 86)], HORSE_SHADE, { line: 0.7, shadow: 1 })
  for (let i = 0; i < 4; i++) fold(g, [v(50 + i, 86), v(46 + i * 1.5, 93), v(44 + i * 2, 99)], 1.6, 0.2, POINTS)
  // eye with a pale rim (so it reads on the dark head), nostril and mouth cut in light
  g.fillStyle = 'rgba(236,223,194,0.85)'
  g.beginPath()
  g.ellipse(46.5, 99, 3, 2.1, 0.9, 0, Math.PI * 2)
  g.fill()
  g.fillStyle = INK
  g.beginPath()
  g.ellipse(46.5, 99, 2, 1.4, 0.9, 0, Math.PI * 2)
  g.fill()
  stroke(g, [v(32, 121), v(35, 124)], 1, 'rgba(236,223,194,0.8)')
  stroke(g, [v(33, 128.5), v(38, 128)], 0.7, 'rgba(236,223,194,0.7)')
  // mane falling on the near side of the crest
  for (let i = 0; i < 11; i++) {
    const t = i / 10
    const x = 58 + t * 34
    const y = 90 + t * t * 44 + t * 4
    fold(g, [v(x, y), v(x + 5, y + 8), v(x + 3, y + 16)], 2.6, 0.2, POINTS)
  }
  // bridle with a rosette, bit
  stroke(g, [v(55, 88), v(46, 111), v(35, 125)], 1.2, GOLD)
  stroke(g, [v(40, 97), v(52, 94)], 1.2, GOLD)
  stroke(g, [v(43, 120), v(56, 104)], 1.1, GOLD)
  g.fillStyle = BLOOD
  g.beginPath()
  g.arc(47, 111, 2.4, 0, Math.PI * 2)
  g.fill()

  // caparison: a cloth over the body down to the knees, scalloped hem, embroidered border, fringe
  const hem: V[] = []
  for (let x = 139; x >= 52; x -= 7.25) hem.push(v(x, 181 + (Math.round((139 - x) / 7.25) % 2 ? 5 : 0)))
  const cap = shape(g, [v(56, 150), v(66, 142), v(84, 137), v(104, 139), v(122, 136), v(136, 144), v(140, 162), ...hem, v(52, 168)], c, { hatch: 1.5, hatchFrom: 0.6, hatchAngle: 1.3 })
  void cap
  // pipe folds hanging from the back
  for (const x of [70, 84, 100, 118, 130]) fold(g, [v(x, 146), v(x + 1, 164), v(x - 1, 180)], 1.3, 0.2)
  // embroidered border along the hem + gold stitches
  stroke(g, hem.map((p) => v(p.x, p.y - 5)), 3, BLOOD)
  g.fillStyle = GOLD
  hem.forEach((p) => {
    g.beginPath()
    g.arc(p.x, p.y - 5, 0.9, 0, Math.PI * 2)
    g.fill()
  })
  // fringe
  for (let x = 54; x < 139; x += 2.4) stroke(g, [v(x, 182 + (Math.round((139 - x) / 7.25) % 2 ? 4 : 0)), v(x, 187 + (Math.round((139 - x) / 7.25) % 2 ? 4 : 0))], 0.5, GOLD)
  // medallion with the suit on the flank
  g.save()
  g.beginPath()
  g.arc(118, 160, 11, 0, Math.PI * 2)
  g.fillStyle = WHITE
  g.fill()
  g.lineWidth = 1.6
  g.strokeStyle = INK
  g.stroke()
  g.restore()
  hold(g, pip, suit, 118, 160, suit === 'espadas' || suit === 'bastos' ? 7 : 6.5, suit === 'espadas' || suit === 'bastos' ? 0.6 : 0)
  // saddle
  shape(g, [v(86, 136), v(96, 131), v(112, 134), v(116, 140), v(90, 142)], SOOT, { line: 0.8, shadow: 1.3 })

  // near foreleg raised high (passage): forearm forward, knee bent, cannon hanging, hoof curled
  leg([v(62, 172), v(46, 186), v(47, 203), v(52, 209)], [12, 8, 5.8, 5.2], HORSE) // passage: raised
  shape(g, [v(49, 206), v(56, 206), v(57, 212), v(50, 213)], SOOT, { line: 0.7, shadow: 1 })

  // rider: cape blown back over the croup (diaper fold between the shoulders and the wind)
  shape(g, [v(100, 104), v(114, 104), v(132, 114), v(146, 128), v(140, 140), v(128, 136), v(112, 130)], BLOOD, { hatch: 1.5, hatchFrom: 0.4, hatchAngle: 1.5 })
  fold(g, [v(114, 108), v(130, 122), v(140, 134)], 1.3, 0.2)
  // near leg: thigh along the flank, knee, shin to the stirrup, boot
  limb(g, [v(102, 136), v(88, 152), v(92, 172)], [12, 8, 6.5], c, { bulges: [{ at: 1.3, amount: 1.5, side: 1 }], hatch: 1.4, hatchFrom: 0.5, ramp: 0.35 })
  shape(g, [v(86, 158), v(96, 158), v(98, 176), v(100, 180), v(86, 181), v(86, 172)], SOOT, { line: 0.8, shadow: 1.4 }) // boot
  stroke(g, [v(97, 142), v(95, 181)], 0.8, GOLD) // stirrup leather
  stroke(g, [v(86, 182), v(98, 182)], 1.4, GOLD) // stirrup
  // torso, sitting tall, doublet with a skirt over the saddle
  shape(g, [v(94, 102), v(108, 102), v(113, 113), v(111, 128), v(108, 140), v(94, 140), v(90, 126), v(90, 112)], BLOOD, { hatch: 1.4, hatchFrom: 0.55 })
  shape(g, [v(89, 130), v(112, 130), v(117, 142), v(87, 142)], c, { line: 0.9, shadow: 1.5 })
  for (const x of [95, 102, 109]) fold(g, [v(x, 131), v(x + 0.5, 141)], 0.9, 0.2)
  g.fillStyle = GOLD
  for (let y = 108; y < 128; y += 5) g.fillRect(98.5, y, 2, 2)
  // rein arm: the hand low in front of the saddle
  limb(g, [v(107, 108), v(113, 124), v(99, 131)], [9, 7, 5.5], c, { hatch: 1.4, hatchFrom: 0.4 })
  hand(g, v(99, 131), Math.PI * 1.02, 7, SKIN, true)
  stroke(g, [v(94, 132), v(70, 128), v(46, 120), v(36, 126)], 1, GOLD) // reins to the bit
  // neck, ruff, head, hair, broad hat with a plume
  limb(g, [v(101, 96), v(100, 104)], [7, 8], SKIN, { line: 0.7, shadow: 1 })
  shape(g, [v(94, 101), v(100, 99), v(106, 101), v(104, 105), v(96, 105)], WHITE, { line: 0.7, shadow: 1 })
  shape(g, [v(98, 78), v(110, 78), v(115, 88), v(113, 98), v(107, 97), v(105, 86)], SOOT, { line: 0.8, shadow: 1.2 })
  head(g, 102, 88, 17, { skin: SKIN })
  shape(g, [v(86, 81), v(96, 77), v(112, 76), v(121, 80), v(110, 83), v(92, 84)], c, { line: 1, shadow: 1.7, hatch: 1.3, hatchFrom: 0.6 }) // brim
  shape(g, [v(96, 78), v(98, 69), v(110, 68), v(113, 77)], c, { line: 1, shadow: 1.7, hatch: 1.3, hatchFrom: 0.6 }) // crown
  shape(g, [v(96, 76), v(113, 75), v(113, 78), v(96, 79)], BLOOD, { line: 0.6, shadow: 0.9 }) // hatband
  fold(g, [v(111, 72), v(124, 62), v(138, 60), v(146, 66)], 3.4, 0.6, WHITE) // plume blown back
  stroke(g, [v(111, 72), v(124, 62), v(138, 60), v(146, 66)], 0.6)
  for (let i = 0; i < 9; i++) stroke(g, [v(116 + i * 3.4, 66 - Math.sin(i / 3) * 3), v(118 + i * 3.4, 70 - Math.sin(i / 3) * 3)], 0.45)
  // raised arm with the suit
  const elbow = v(84, 96)
  const wrist = v(74, 80)
  limb(g, [v(96, 108), elbow, wrist], [9.5, 7.5, 5.5], c, { bulges: [{ at: 0.3, amount: 1.2, side: -1 }], hatch: 1.4, hatchFrom: 0.5 })
  shape(g, [v(wrist.x - 3.5, wrist.y - 1.5), v(wrist.x + 3.5, wrist.y - 2.5), v(wrist.x + 4, wrist.y + 1.5), v(wrist.x - 3, wrist.y + 2.5)], WHITE, { line: 0.6, shadow: 0.9 })
  hand(g, v(wrist.x - 1, wrist.y - 2), -Math.PI / 2 - 0.3, 7, SKIN, true)
  if (suit === 'espadas') hold(g, pip, suit, wrist.x - 7, wrist.y - 28, 17, -0.25)
  else if (suit === 'bastos') hold(g, pip, suit, wrist.x - 6, wrist.y - 20, 15, -0.3)
  else hold(g, pip, suit, wrist.x - 3, wrist.y - 14, 11)
}
