import { PALETTE, SUIT_INK } from './look'
import { v, shape, limb, fold, stroke, head, hand, type V } from './figure2d'

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
  const shL = v(67, 71)
  const shR = v(100, 74)

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
  limb(g, [shR, v(113, 97), v(101, 114)], [12, 8.5, 6.5], c, { bulges: [{ at: 0.2, amount: 2.2, side: 1 }], hatch: 1.5, hatchFrom: 0.4 })
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
  limb(g, [shL, elbow, wrist], [12, 8.5, 6.5], c, { bulges: [{ at: 0.2, amount: 2, side: -1 }], hatch: 1.5, hatchFrom: 0.5 })
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

const HORSE = '#e9ddc4' // an engraved white horse: form comes from the hatching

export function caballo(g: CanvasRenderingContext2D, suit: Suit, pip: PipFn) {
  const c = SUIT_INK[suit]
  ground(g, 86, 46)
  const leg = (pts: V[], w: number[], shade: string) =>
    limb(g, pts, w, shade, { line: 0.9, shadow: 1.6, hatch: 1.3, hatchFrom: 0.5 })
  const hoof = (x: number, y: number) => shape(g, [v(x - 4, y - 5), v(x + 3, y - 5), v(x + 4, y), v(x - 6, y)], SOOT, { line: 0.7, shadow: 1 })

  // far legs (behind the body, in shade)
  leg([v(76, 182), v(73, 202), v(71, 214), v(68, 219)], [9, 6, 4.5, 4.5], '#cbbd9f')
  hoof(67, 223)
  leg([v(116, 180), v(120, 199), v(116, 214), v(112, 219)], [11, 6, 4.5, 4.5], '#cbbd9f')
  hoof(111, 223)

  // tail, flowing
  shape(g, [v(134, 150), v(142, 158), v(146, 184), v(142, 206), v(136, 208), v(138, 184), v(134, 164)], SOOT, { line: 0.9, shadow: 1.5 })
  for (let i = 0; i < 4; i++) stroke(g, [v(137 + i, 158), v(141 + i, 182), v(139 + i * 0.5, 204)], 0.5, 'rgba(216,199,160,0.4)')

  // body: withers, dipped back, rounded croup, deep chest, belly rising to the stifle
  shape(g, [v(94, 144), v(111, 150), v(128, 144), v(140, 158), v(139, 176), v(127, 185), v(104, 189), v(80, 189), v(62, 181), v(55, 165), v(64, 150)], HORSE, { hatch: 1.4, hatchFrom: 0.5, hatchAngle: 1.25 })
  stroke(g, [v(64, 164), v(72, 178)], 0.6) // shoulder muscle
  stroke(g, [v(126, 158), v(132, 176)], 0.6) // haunch

  // near hind leg: stifle, gaskin sweeping back to the hock, cannon, sloped pastern
  leg([v(124, 176), v(131, 199), v(125, 213), v(120, 219)], [15, 6.5, 4.8, 4.8], HORSE)
  hoof(119, 223)

  // caparison: saddle cloth in the suit colour with a scalloped hem
  shape(g, [v(92, 146), v(118, 148), v(124, 170), v(119, 184), v(111, 180), v(103, 186), v(95, 181), v(87, 185), v(84, 168)], c, { hatch: 1.5, hatchFrom: 0.55 })
  stroke(g, [v(86, 176), v(95, 177), v(103, 178), v(112, 176), v(120, 174)], 1, GOLD)

  // neck (arched crest) and head as one wedge: forehead, long muzzle, bony cheek
  shape(g, [v(97, 147), v(86, 128), v(70, 112), v(54, 102), v(45, 104), v(33, 116), v(22, 128), v(19, 136), v(25, 141), v(36, 137), v(45, 128), v(54, 140), v(62, 157)], HORSE, { hatch: 1.4, hatchFrom: 0.6, hatchAngle: 1.2 })
  stroke(g, [v(44, 116), v(46, 126), v(40, 133)], 0.6) // cheekbone
  shape(g, [v(50, 104), v(52, 90), v(57, 102)], HORSE, { line: 0.8, shadow: 1.2 }) // ear
  // mane along the crest
  for (let i = 0; i < 9; i++) {
    const t = i / 8
    const x = 54 + t * 40
    const y = 101 + t * t * 40
    fold(g, [v(x, y), v(x + 4, y + 7), v(x + 3, y + 13)], 2.4, 0.2, SOOT)
  }
  // eye and nostril
  g.fillStyle = INK
  g.beginPath()
  g.ellipse(41, 113, 2.2, 1.4, -0.4, 0, Math.PI * 2)
  g.fill()
  stroke(g, [v(22, 129), v(25, 131)], 0.9)
  stroke(g, [v(20, 137), v(26, 138)], 0.6) // mouth
  // bridle
  stroke(g, [v(50, 104), v(38, 128), v(26, 134)], 0.9, BLOOD)
  stroke(g, [v(34, 118), v(44, 112)], 0.9, BLOOD)

  // near foreleg lifted mid-stride: forearm forward, knee bent, cannon folded back
  leg([v(66, 178), v(55, 196), v(62, 208), v(58, 214)], [11, 6.5, 4.8, 4.8], HORSE)
  shape(g, [v(54, 212), v(61, 212), v(62, 218), v(53, 218)], SOOT, { line: 0.7, shadow: 1 })

  // rider: near leg down the flank to the stirrup
  limb(g, [v(104, 148), v(92, 166), v(96, 188)], [11, 7, 5.5], BLOOD, { bulges: [{ at: 1.3, amount: 1.5, side: 1 }], hatch: 1.4, hatchFrom: 0.5 })
  shape(g, [v(92, 184), v(100, 184), v(100, 194), v(88, 195), v(88, 190)], SOOT, { line: 0.8, shadow: 1.3 }) // boot
  stroke(g, [v(98, 176), v(96, 195)], 0.8, GOLD) // stirrup leather

  // torso, upright, with a short skirt over the saddle
  shape(g, [v(96, 112), v(106, 112), v(110, 128), v(109, 146), v(98, 150), v(94, 132)], c, { hatch: 1.4, hatchFrom: 0.55 })
  shape(g, [v(94, 140), v(111, 140), v(114, 152), v(92, 152)], BLOOD, { line: 0.8, shadow: 1.2 })
  // rein arm
  limb(g, [v(106, 116), v(110, 132), v(98, 138)], [8, 6.5, 5], c, { hatch: 1.4, hatchFrom: 0.4 })
  hand(g, v(98, 138), Math.PI, 6, SKIN, true)
  stroke(g, [v(94, 138), v(60, 132), v(28, 132)], 0.8, BLOOD) // reins

  // head, plumed hat
  shape(g, [v(96, 92), v(108, 92), v(110, 104), v(104, 108), v(100, 100)], SOOT, { line: 0.8, shadow: 1.2 }) // hair
  head(g, 102, 101, 16, { skin: SKIN })
  shape(g, [v(92, 94), v(99, 89), v(110, 89), v(114, 93), v(104, 95)], BLOOD, { line: 0.9, shadow: 1.5 })
  fold(g, [v(108, 90), v(118, 80), v(126, 76)], 2.6, 0.5, WHITE)
  stroke(g, [v(108, 90), v(118, 80), v(126, 76)], 0.5)

  // raised arm with the suit symbol
  limb(g, [v(98, 114), v(86, 102), v(80, 86)], [8, 6.5, 5], c, { hatch: 1.4, hatchFrom: 0.5 })
  hand(g, v(80, 86), -Math.PI / 2 - 0.25, 6, SKIN, true)
  if (suit === 'espadas') hold(g, pip, suit, 77, 58, 14, -0.15)
  else if (suit === 'bastos') hold(g, pip, suit, 76, 66, 13, -0.2)
  else hold(g, pip, suit, 78, 72, 10)
}
