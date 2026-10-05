// Hands lab (development only: open /manos-lab.html on the dev server). The real table with no server: the
// rivals and your partner play, drag, deal and collect at the press of a button, and a free camera can look at
// any hand from up close, in slow motion or frame by frame — to see every gesture and catch a card going
// through a finger.
import * as THREE from 'three'
import type { Card, CardValue, Suit } from '@la-base/shared'
import { TableScene } from '../table3d/TableScene'
import { CARD_H, CARD_W, CHAIR_R, TABLE_R, TABLE_Y, polar, seatAngle } from '../table3d/seats'
import { HAND_ORDER } from '../table3d/avatar'

const N = 4
const SUITS: Suit[] = ['oros', 'copas', 'espadas', 'bastos']
const VALUES: CardValue[] = [1, 2, 3, 4, 5, 6, 7, 10, 11, 12]
const randomCard = (): Card => ({ suit: SUITS[Math.floor(Math.random() * 4)], value: VALUES[Math.floor(Math.random() * 10)] })
const ids = Array.from({ length: N }, (_, i) => `p${i}`)
const names = ['Vos', 'Rival 1', 'Compa 2', 'Rival 3']
const counts = Array(N).fill(0)
let myHand: Card[] = []

const scene = new TableScene(document.getElementById('table')!, {
  requestPlay: async () => {
    await new Promise((r) => setTimeout(r, 250))
    counts[0]--
    return true
  },
  look: () => undefined,
  arm: () => undefined,
  hover: () => undefined,
  status: (s) => s && console.log('[mesa]', s),
})
const seat = () =>
  scene.setPlayers(
    ids.map((id, i) => ({ id, name: names[i], team: i % 2 === 0 ? 'nosotros' : 'ellos', handCount: counts[i], isConnected: true })),
    'p0',
  )
seat()

function deal(per = 5) {
  counts.fill(per)
  myHand = Array.from({ length: per }, randomCard)
  seat()
  scene.deal('p3', per, myHand)
  scene.setHand(myHand)
}

function play(i: number) {
  if (counts[i] <= 0) return
  counts[i]--
  seat()
  scene.cardPlayed(ids[i], randomCard())
}

function playMine() {
  scene.setTurn('p0', true)
  const sc = scene as unknown as { quickPlay(k: number): boolean }
  sc.quickPlay(0)
  setTimeout(() => {
    myHand = myHand.slice(1)
    scene.setHand(myHand)
    seat()
  }, 2600)
}

/** A rival carries a card out over the felt, hesitates and plays it (as their presence stream would show). */
async function dragAndPlay(i: number) {
  if (counts[i] <= 0) return
  const slot = counts[i] - 1
  const steps = 40
  for (let k = 0; k <= steps; k++) {
    const u = k / steps
    const fwd = -0.35 + u * 0.62 + Math.sin(u * Math.PI * 3) * 0.04 * (1 - u)
    scene.presence('arm', ids[i], { slot, fwd, lat: Math.sin(u * Math.PI * 2) * 0.06, holding: true })
    await new Promise((r) => setTimeout(r, 60 / Math.max(0.05, scene.lab.timeScale)))
  }
  play(i)
}

function collect(i: number) {
  scene.baseResolved(ids[i])
}

// ---- cameras: the game's own view, or close to somebody's hands
const cams: Record<string, () => { pos: THREE.Vector3; target: THREE.Vector3 } | null> = {
  juego: () => null,
  arriba: () => ({ pos: new THREE.Vector3(0.35, TABLE_Y + 0.75, 0.25), target: new THREE.Vector3(0, TABLE_Y, 0) }),
  ...Object.fromEntries(
    [1, 2, 3].flatMap((s) => {
      const a = seatAngle(s, N)
      // from the middle of the table, facing them; and from beside their right hand
      return [
        [`frente ${names[s]}`, () => ({ pos: polar(0.05, a, TABLE_Y + 0.42), target: polar(TABLE_R - 0.02, a, TABLE_Y + 0.16) })],
        [`jugada ${names[s]}`, () => ({ pos: polar(TABLE_R - 0.3, a + 0.42, TABLE_Y + 0.3), target: polar(TABLE_R - 0.36, a, TABLE_Y + 0.03) })],
        [`costado ${names[s]}`, () => ({ pos: polar(TABLE_R * 0.62, a - 0.42, TABLE_Y + 0.3), target: polar(TABLE_R - 0.08, a, TABLE_Y + 0.12) })],
      ]
    }),
  ),
  'abanico Rival 1': () => {
    const a = seatAngle(1, N)
    return { pos: polar(TABLE_R * 0.45, a - 0.35, TABLE_Y + 0.42), target: polar(CHAIR_R - 0.33, a, TABLE_Y + 0.3) }
  },
  'tus manos': () => {
    const a = seatAngle(0, N)
    return { pos: polar(TABLE_R * 0.3, a + 0.75, TABLE_Y + 0.4), target: polar(TABLE_R - 0.05, a, TABLE_Y + 0.15) }
  },
}

// ---- the panel
const panel = document.getElementById('panel')!
panel.innerHTML = `
  <h1>Laboratorio de manos</h1>
  <div class="row"><span>Cámara</span><span></span></div>
  <div class="seg" id="cams"></div>
  <div class="row"><label>Velocidad <input type="range" id="speed" min="0.05" max="1" step="0.05" value="1"></label><span class="val" id="speedV">1×</span></div>
  <div class="seg"><button id="pause">Pausa</button> <button id="step">Paso</button></div>
  <div class="row"><span>Gestos</span><span></span></div>
  <div class="seg" id="acts"></div>
  <p id="help">Repartí primero. «Juega» es la jugada directa; «arrastra» es una carta llevada a mano (la que el resto ve del arrastre de otro jugador). Las cámaras de cerca miran las manos de cada uno.</p>`
const $ = (id: string) => document.getElementById(id)!
const button = (parent: HTMLElement, label: string, fn: () => void) => {
  const b = document.createElement('button')
  b.textContent = label
  b.onclick = fn
  parent.append(b, ' ')
  return b
}
const camBar = $('cams')
let camName = 'juego'
for (const name of Object.keys(cams)) {
  const b = button(camBar, name, () => {
    camName = name
    camBar.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b))
    scene.lab.cam = cams[name]()
  })
  if (name === camName) b.classList.add('on')
}
const speed = $('speed') as HTMLInputElement
let paused = false
const setSpeed = () => {
  scene.lab.timeScale = paused ? 0 : Number(speed.value)
  $('speedV').textContent = paused ? 'pausa' : `${Number(speed.value).toFixed(2)}×`
}
speed.oninput = setSpeed
$('pause').onclick = () => {
  paused = !paused
  setSpeed()
}
$('step').onclick = () => {
  paused = true
  scene.lab.timeScale = 1
  setTimeout(setSpeed, 1000 / 30)
}
const acts = $('acts')
button(acts, 'Repartir', () => deal())
for (const s of [1, 2, 3]) button(acts, `${names[s]} juega`, () => play(s))
for (const s of [1, 3]) button(acts, `${names[s]} arrastra`, () => void dragAndPlay(s))
button(acts, 'Jugás vos', playMine)
for (const s of [0, 1]) button(acts, `Recoge ${names[s]}`, () => collect(s))
button(acts, 'Rival 1 pide señas', () => scene.askSenas('p1'))

Object.assign(window, { __lab: { scene, deal, play, playMine, dragAndPlay, collect, setCam: (n: string) => (scene.lab.cam = cams[n]()) } })

// ---- the clipping check: hand vertices inside a card (within 0.6 mm of its plane, inside its edges) or under the
// felt. A finger pinching a card rests about 1 mm off it; one going through it leaves vertices right on its plane.
function clip() {
  const { scene: three } = scene.labHandles()
  three.updateMatrixWorld(true)
  const hands: THREE.Mesh[] = []
  const cards: THREE.Mesh[] = []
  three.traverseVisible((o) => {
    if (!(o instanceof THREE.Mesh)) return
    if (o.renderOrder === HAND_ORDER && o.geometry.getAttribute('color')) hands.push(o)
    const prm = (o.geometry as THREE.PlaneGeometry).parameters
    if (prm && Math.abs(prm.width - CARD_W) < 1e-6 && Math.abs(prm.height - CARD_H) < 1e-6) cards.push(o)
  })
  const v = new THREE.Vector3()
  const local = new THREE.Vector3()
  let inCard = 0
  let inFelt = 0
  const who: Record<string, number> = {}
  const where: string[] = []
  const tag = (h: THREE.Mesh) => {
    const w = h.getWorldPosition(new THREE.Vector3())
    return `${w.x.toFixed(2)},${w.y.toFixed(2)},${w.z.toFixed(2)}`
  }
  const invs = cards.map((c) => {
    c.geometry.computeBoundingBox()
    return { inv: c.matrixWorld.clone().invert(), box: c.geometry.boundingBox! }
  })
  for (const h of hands) {
    const pos = h.geometry.getAttribute('position')
    for (let i = 0; i < pos.count; i += 2) {
      v.fromBufferAttribute(pos, i).applyMatrix4(h.matrixWorld)
      if (v.y < TABLE_Y - 0.002 && Math.hypot(v.x, v.z) < TABLE_R) {
        inFelt++
        who[`felt@${tag(h)}`] = (who[`felt@${tag(h)}`] ?? 0) + 1
      }
      invs.forEach(({ inv, box }, ci) => {
        local.copy(v).applyMatrix4(inv)
        if (Math.abs(local.z) < 0.0006 && local.x > box.min.x && local.x < box.max.x && local.y > box.min.y && local.y < box.max.y) {
          inCard++
          const k = `card${ci}${cards[ci].parent?.parent?.type === 'Camera' || cards[ci].parent?.type === 'Group' && cards[ci].parent?.parent?.type === 'PerspectiveCamera' ? '(vm)' : ''}@${tag(h)}`
          who[k] = (who[k] ?? 0) + 1
          where.push(`${(local.x * 100).toFixed(1)},${(local.y * 100).toFixed(1)}`)
        }
      })
    }
  }
  return { inCard, inFelt, hands: hands.length, cards: cards.length, who, where: where.filter((_, i) => i % 6 === 0) }
}
Object.assign((window as unknown as { __lab: object }).__lab, { clip })
