import { PALETTE, SUIT_INK } from './look'

// Court cards after the Spanish (Fournier / Augusto Rius, 1889) pattern: one full-length figure
// standing on a small ground shadow, holding its suit symbol.
//   Sota (10): a young page in hose, doublet, puffed trunk-hose, feathered cap, cape on a shoulder.
//   Caballo (11): a rider on a walking horse seen in profile, suit symbol raised.
//   Rey (12): an old bearded king, crown, ermine collar, robe to the floor, mantle.
// Drawn in the game's print language: thick ink outline, flat suit colour, stipple shading,
// pale faces with hollow eyes (a little wrong, never cartoonish). Card space: 160 × 250 units.

type Suit = keyof typeof SUIT_INK
type Pt = [number, number]
type PipFn = (g: CanvasRenderingContext2D, suit: Suit, x: number, y: number, s: number) => void

const INK = PALETTE.ink
const BONE = PALETTE.bone
const SOOT = PALETTE.soot
const BLOOD = PALETTE.oxblood
const GOLD = SUIT_INK.oros

function rng(seed: number) {
  let s = seed >>> 0
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296)
}

/** Smooth closed shape through points (quadratic midpoints), filled and inked. */
function blob(g: CanvasRenderingContext2D, pts: Pt[], fill: string, line = 2) {
  g.beginPath()
  const mid = (a: Pt, b: Pt): Pt => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
  const start = mid(pts[pts.length - 1], pts[0])
  g.moveTo(start[0], start[1])
  pts.forEach((p, i) => {
    const m = mid(p, pts[(i + 1) % pts.length])
    g.quadraticCurveTo(p[0], p[1], m[0], m[1])
  })
  g.closePath()
  g.fillStyle = fill
  g.fill()
  g.lineWidth = line
  g.strokeStyle = INK
  g.lineJoin = 'round'
  g.stroke()
}

/** Straight-edged shape (cloth folds, crowns, blades). */
function poly(g: CanvasRenderingContext2D, pts: Pt[], fill: string, line = 2) {
  g.beginPath()
  g.moveTo(pts[0][0], pts[0][1])
  pts.slice(1).forEach((p) => g.lineTo(p[0], p[1]))
  g.closePath()
  g.fillStyle = fill
  g.fill()
  g.lineWidth = line
  g.strokeStyle = INK
  g.lineJoin = 'round'
  g.stroke()
}

function line(g: CanvasRenderingContext2D, pts: Pt[], w = 1.4, color: string = INK) {
  g.beginPath()
  g.moveTo(pts[0][0], pts[0][1])
  pts.slice(1).forEach((p) => g.lineTo(p[0], p[1]))
  g.lineWidth = w
  g.strokeStyle = color
  g.lineCap = 'round'
  g.stroke()
}

/** Stipple shading inside a shape, denser on the shadow side (light comes from the left). */
function stipple(g: CanvasRenderingContext2D, pts: Pt[], seed: number, density = 0.35) {
  const r = rng(seed)
  const xs = pts.map((p) => p[0])
  const ys = pts.map((p) => p[1])
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]
  g.save()
  g.beginPath()
  g.moveTo(pts[0][0], pts[0][1])
  pts.slice(1).forEach((p) => g.lineTo(p[0], p[1]))
  g.closePath()
  g.clip()
  g.fillStyle = 'rgba(20,14,12,0.55)'
  const n = Math.round((x1 - x0) * (y1 - y0) * density * 0.08)
  for (let i = 0; i < n; i++) {
    const x = x0 + r() * (x1 - x0)
    const y = y0 + r() * (y1 - y0)
    const shade = (x - x0) / Math.max(1, x1 - x0) // 0 lit … 1 shadow
    if (r() < shade * shade) g.fillRect(x, y, 0.9, 0.9)
  }
  g.restore()
}

function ground(g: CanvasRenderingContext2D, cx: number, w: number) {
  g.fillStyle = 'rgba(96,34,23,0.28)'
  g.beginPath()
  g.ellipse(cx, 224, w, 5, 0, 0, Math.PI * 2)
  g.fill()
}

/** Pale face, hollow almond eyes, thin mouth: human, slightly wrong. */
function face(g: CanvasRenderingContext2D, x: number, y: number, s: number, lookLeft = true) {
  blob(g, [[x - 7 * s, y - 9 * s], [x + 7 * s, y - 9 * s], [x + 8 * s, y + 3 * s], [x + 2 * s, y + 11 * s], [x - 3 * s, y + 11 * s], [x - 8 * s, y + 2 * s]], BONE, 1.6)
  const d = lookLeft ? -1.2 : 1.2
  g.fillStyle = INK
  for (const ex of [-3.2, 3.2]) {
    g.beginPath()
    g.ellipse(x + ex * s + d, y - 1 * s, 2 * s, 1.1 * s, 0, 0, Math.PI * 2)
    g.fill()
  }
  line(g, [[x + d - 0.5, y + 1 * s], [x + d - 1.5, y + 4 * s], [x + d + 0.5, y + 4.5 * s]], 1) // nose
  line(g, [[x + d - 2.5 * s, y + 7 * s], [x + d + 2.5 * s, y + 7 * s]], 1.1) // mouth
}

function hold(g: CanvasRenderingContext2D, pip: PipFn, suit: Suit, x: number, y: number, s: number, angle = 0) {
  g.save()
  g.translate(x, y)
  g.rotate(angle)
  pip(g, suit, 0, 0, s)
  g.restore()
}

function hand(g: CanvasRenderingContext2D, x: number, y: number) {
  blob(g, [[x - 4, y - 3], [x + 4, y - 3], [x + 4, y + 4], [x - 4, y + 4]], BONE, 1.4)
}

// ------------------------------------------------------------------ Sota

export function sota(g: CanvasRenderingContext2D, suit: Suit, pip: PipFn) {
  const c = SUIT_INK[suit]
  ground(g, 82, 24)
  // cape falling from the left shoulder, behind the body
  blob(g, [[62, 92], [72, 88], [70, 140], [60, 176], [48, 170], [54, 130]], BLOOD, 2)
  stipple(g, [[48, 92], [72, 92], [70, 176], [48, 176]], 11)
  // legs in hose + shoes
  poly(g, [[72, 150], [80, 150], [79, 212], [73, 212]], c)
  poly(g, [[84, 150], [92, 150], [91, 212], [85, 212]], c)
  stipple(g, [[84, 150], [92, 150], [91, 212], [85, 212]], 12, 0.6)
  blob(g, [[66, 212], [80, 210], [80, 218], [64, 218]], INK, 1)
  blob(g, [[84, 212], [98, 210], [99, 218], [84, 218]], INK, 1)
  // puffed trunk-hose with vertical slashes (stripes in suit colour / oxblood)
  blob(g, [[64, 132], [98, 132], [102, 146], [96, 158], [66, 158], [60, 146]], c, 2)
  g.save()
  g.beginPath()
  g.rect(60, 132, 42, 26)
  g.clip()
  for (let x = 64; x < 100; x += 7) {
    g.fillStyle = BLOOD
    g.fillRect(x, 132, 3, 26)
  }
  g.restore()
  blob(g, [[64, 132], [98, 132], [102, 146], [96, 158], [66, 158], [60, 146]], 'rgba(0,0,0,0)', 2)
  // doublet
  blob(g, [[68, 92], [94, 92], [98, 110], [96, 134], [66, 134], [64, 110]], SOOT, 2)
  stipple(g, [[68, 92], [94, 92], [96, 134], [66, 134]], 13, 0.25)
  line(g, [[81, 94], [81, 132]], 1, 'rgba(216,199,160,0.5)') // button line
  g.fillStyle = BONE
  for (let y = 98; y < 130; y += 6) g.fillRect(80, y, 2, 2)
  poly(g, [[66, 126], [96, 126], [96, 131], [66, 131]], c, 1.4) // belt
  // ruff collar
  blob(g, [[70, 86], [92, 86], [94, 93], [68, 93]], BONE, 1.6)
  // arms: left (viewer's) arm raised to the symbol, right arm on the hip
  const raise = suit === 'espadas' ? [58, 134] : suit === 'bastos' ? [60, 100] : [52, 74]
  blob(g, [[68, 96], [74, 100], raise.map((v, i) => v + (i ? 2 : 4)) as Pt, raise.map((v, i) => v - (i ? 2 : 2)) as Pt], SOOT, 1.8)
  hand(g, raise[0], raise[1])
  blob(g, [[94, 96], [100, 104], [104, 122], [98, 126], [94, 116]], SOOT, 1.8)
  hand(g, 99, 126)
  // head: hair, face, feathered cap
  blob(g, [[70, 58], [92, 58], [94, 76], [88, 82], [72, 82], [68, 74]], SOOT, 1.6)
  face(g, 81, 70, 1)
  blob(g, [[66, 58], [94, 52], [98, 58], [70, 62]], c, 1.8) // cap
  line(g, [[92, 54], [104, 40], [108, 44], [96, 56]], 1.4) // feather
  blob(g, [[94, 54], [106, 38], [110, 42], [98, 56]], BONE, 1.2)
  // suit symbol
  if (suit === 'espadas') hold(g, pip, suit, raise[0] - 6, raise[1] + 36, 17, Math.PI) // point down, beside the leg
  else if (suit === 'bastos') hold(g, pip, suit, raise[0] - 4, raise[1] - 22, 15, -0.35)
  else hold(g, pip, suit, raise[0] - 4, raise[1] - 18, 13)
}

// ------------------------------------------------------------------ Caballo

export function caballo(g: CanvasRenderingContext2D, suit: Suit, pip: PipFn) {
  const c = SUIT_INK[suit]
  ground(g, 84, 40)
  // horse, walking left: far legs first (darker), body, near legs
  const leg = (pts: Pt[], fill: string) => poly(g, pts, fill, 1.6)
  leg([[58, 172], [64, 172], [60, 218], [55, 218]], '#2a221c')
  leg([[108, 176], [114, 176], [118, 218], [112, 218]], '#2a221c')
  // tail
  blob(g, [[122, 160], [132, 170], [132, 200], [126, 204], [124, 176]], SOOT, 1.6)
  // body
  blob(g, [[50, 160], [66, 146], [106, 146], [124, 156], [124, 178], [106, 188], [62, 188], [48, 176]], SOOT, 2)
  stipple(g, [[48, 146], [124, 146], [124, 188], [48, 188]], 21, 0.2)
  // neck + head (left)
  blob(g, [[54, 170], [58, 142], [52, 120], [44, 108], [36, 108], [26, 120], [16, 132], [16, 140], [26, 142], [38, 132], [46, 150], [44, 170]], SOOT, 2)
  poly(g, [[38, 108], [41, 98], [45, 109]], SOOT, 1.4) // ear
  for (let i = 0; i < 6; i++) line(g, [[48 + i * 1.6, 112 + i * 7], [55 + i * 1.6, 114 + i * 7]], 1.3, BLOOD) // mane
  g.fillStyle = BONE
  g.beginPath()
  g.arc(34, 118, 1.8, 0, Math.PI * 2) // eye
  g.fill()
  g.fillStyle = INK
  g.beginPath()
  g.arc(19, 136, 1.2, 0, Math.PI * 2) // nostril
  g.fill()
  // caparison (saddle cloth) in suit colour with a hem band
  blob(g, [[66, 148], [110, 148], [116, 176], [104, 196], [70, 196], [60, 176]], c, 2)
  stipple(g, [[60, 148], [116, 148], [116, 196], [60, 196]], 22, 0.35)
  line(g, [[64, 190], [110, 190]], 2.2, BLOOD)
  // near legs: front one lifted (walking)
  leg([[66, 186], [73, 186], [62, 206], [56, 204]], SOOT)
  leg([[56, 204], [62, 206], [66, 218], [60, 218]], SOOT)
  leg([[98, 186], [105, 186], [104, 218], [98, 218]], SOOT)
  // rider: leg in hose along the flank, boot
  poly(g, [[88, 150], [96, 150], [96, 186], [88, 186]], c)
  blob(g, [[84, 184], [98, 184], [98, 194], [82, 192]], INK, 1)
  // torso
  blob(g, [[82, 110], [104, 110], [106, 134], [100, 152], [84, 152], [80, 132]], BLOOD, 2)
  stipple(g, [[80, 110], [106, 110], [106, 152], [80, 152]], 23, 0.3)
  poly(g, [[82, 142], [104, 142], [104, 147], [82, 147]], c, 1.4)
  // raised arm with the suit symbol, other hand on the reins
  blob(g, [[84, 114], [90, 116], [74, 90], [68, 92]], BLOOD, 1.8)
  hand(g, 70, 88)
  blob(g, [[100, 116], [106, 122], [92, 140], [86, 136]], BLOOD, 1.8)
  hand(g, 86, 138)
  line(g, [[86, 138], [56, 140], [30, 134]], 1) // reins
  // head, hair, plumed hat
  blob(g, [[84, 84], [102, 84], [104, 102], [84, 104]], SOOT, 1.4)
  face(g, 93, 96, 0.9)
  blob(g, [[80, 84], [106, 80], [110, 86], [82, 90]], c, 1.8)
  blob(g, [[100, 80], [116, 64], [120, 68], [104, 84]], BONE, 1.2)
  hold(g, pip, suit, 66, 70, 12, suit === 'espadas' || suit === 'bastos' ? -0.3 : 0)
}

// ------------------------------------------------------------------ Rey

export function rey(g: CanvasRenderingContext2D, suit: Suit, pip: PipFn) {
  const c = SUIT_INK[suit]
  ground(g, 82, 32)
  // mantle behind, falling to the floor on the right
  blob(g, [[62, 100], [102, 100], [118, 150], [120, 220], [96, 222], [100, 150]], BLOOD, 2)
  stipple(g, [[96, 100], [120, 100], [120, 222], [96, 222]], 31, 0.45)
  // robe to the floor
  poly(g, [[64, 112], [100, 112], [110, 220], [54, 220]], c, 2)
  stipple(g, [[54, 112], [110, 112], [110, 220], [54, 220]], 32, 0.35)
  // front band with small gold crosses
  poly(g, [[76, 118], [88, 118], [92, 220], [72, 220]], BLOOD, 1.6)
  g.fillStyle = GOLD
  for (let y = 128; y < 214; y += 14) {
    g.fillRect(80, y, 4, 8)
    g.fillRect(78, y + 2, 8, 4)
  }
  // shoes peeking out
  blob(g, [[62, 218], [74, 216], [74, 224], [60, 224]], INK, 1)
  blob(g, [[88, 218], [100, 216], [102, 224], [88, 224]], INK, 1)
  // ermine capelet: bone with ink specks
  blob(g, [[58, 100], [106, 100], [110, 118], [82, 126], [54, 118]], BONE, 2)
  const r = rng(33)
  g.fillStyle = INK
  for (let i = 0; i < 16; i++) {
    const x = 60 + r() * 46
    const y = 104 + r() * 16
    g.fillRect(x, y, 1.6, 3)
  }
  // arms: one holding the symbol, one across the robe
  const holdAt: Pt = suit === 'espadas' ? [56, 134] : suit === 'bastos' ? [58, 128] : [60, 124]
  blob(g, [[62, 110], [68, 116], [holdAt[0] + 4, holdAt[1] + 2], [holdAt[0] - 4, holdAt[1] - 2]], c, 1.8)
  hand(g, holdAt[0], holdAt[1])
  blob(g, [[98, 112], [104, 120], [92, 142], [84, 140]], c, 1.8)
  hand(g, 88, 142)
  // head: long white beard, face, hair, crown
  blob(g, [[68, 64], [96, 64], [98, 84], [92, 108], [82, 114], [72, 108], [66, 84]], BONE, 1.8)
  for (let x = 72; x <= 92; x += 4) line(g, [[x, 88], [x + 1, 104]], 0.9, 'rgba(20,14,12,0.55)')
  face(g, 82, 74, 0.95)
  poly(g, [[68, 60], [70, 46], [75, 54], [79, 42], [83, 54], [88, 42], [91, 54], [96, 46], [96, 60]], GOLD, 1.8)
  poly(g, [[67, 58], [97, 58], [97, 64], [67, 64]], GOLD, 1.6)
  g.fillStyle = BLOOD
  for (const x of [72, 82, 92]) g.fillRect(x - 1.5, 59.5, 3, 3) // gems
  // suit symbol
  if (suit === 'espadas') hold(g, pip, suit, holdAt[0] - 2, holdAt[1] - 40, 18)
  else if (suit === 'bastos') hold(g, pip, suit, holdAt[0] - 4, holdAt[1] - 22, 15, -0.2)
  else if (suit === 'copas') hold(g, pip, suit, holdAt[0] - 4, holdAt[1] - 16, 13)
  else hold(g, pip, suit, holdAt[0] - 4, holdAt[1] - 18, 12)
}
