// Avatar hood lab (development only: open /avatar-lab.html on the dev server). A standalone page, nothing of
// the game in it: four proposals of the hood with the mask floating inside it, side by side, to pick the one
// that is closest to the sketch. The face is deliberately basic (black ovals, short brows, a small mouth):
// the kinds of face come later.
import * as THREE from 'three'

interface HoodSpec {
  name: string
  note: string
  cut: number // rad from the front pole where the opening is cut (bigger = wider opening)
  w: number // half-width of the opening (m)
  h: number // half-height of the opening (m)
  d: number // depth of the hood behind the opening (m)
  flop: number // how far the tip falls to the side (m)
  rise: number // how much taller the tip is (m)
  gap: number // how deep the mask hangs inside the opening (m): 0 = in the opening, bigger = further in
  shoulders: number // half-width of the shoulders (m)
}

const SPECS: HoodSpec[] = [
  { name: 'A · boceto', note: 'punta caída, máscara cerca de la abertura', cut: 1.0, w: 0.2, h: 0.27, d: 0.25, flop: 0.1, rise: 0.07, gap: 0.035, shoulders: 0.46 },
  { name: 'B · más adentro', note: 'igual, la máscara flota más hacia el fondo', cut: 1.08, w: 0.215, h: 0.285, d: 0.3, flop: 0.1, rise: 0.07, gap: 0.09, shoulders: 0.46 },
  { name: 'C · redonda', note: 'sin punta, capucha de lluvia redondeada', cut: 1.0, w: 0.2, h: 0.27, d: 0.25, flop: 0.0, rise: 0.0, gap: 0.05, shoulders: 0.46 },
  { name: 'D · picuda', note: 'punta alta y más caída', cut: 1.0, w: 0.2, h: 0.27, d: 0.26, flop: 0.17, rise: 0.15, gap: 0.05, shoulders: 0.5 },
]

const CLOTH = 0x1c1714 // the suit's black (PALETTE.soot)
const BONE = 0xd8c7a0
const INK = 0x0a0706

const cloths: THREE.MeshStandardMaterial[] = [] // (lifted in the bright view, so the forms can be read)

/** The hood: a closed shell, open at the front (−z), with its tip pulled up and over to one side. */
function hood(s: HoodSpec) {
  const g = new THREE.Group()
  const cloth = new THREE.MeshStandardMaterial({ color: CLOTH, roughness: 1 })
  cloths.push(cloth)
  const inside = new THREE.MeshBasicMaterial({ color: 0x030202, side: THREE.BackSide }) // nothing in there: just the dark
  const sin = Math.sin(s.cut)
  const geo = new THREE.SphereGeometry(1, 56, 36, 0, Math.PI * 2, s.cut, Math.PI - s.cut)
  geo.rotateX(-Math.PI / 2) // the opening toward −z
  const sx = s.w / sin
  const sy = s.h / sin
  const sz = s.d / (1 + Math.cos(s.cut)) // the shell reaches `d` behind the opening plane
  const centre = Math.cos(s.cut) * sz
  const p = geo.attributes.position
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i) * sx
    let y = p.getY(i) * sy
    const z = p.getZ(i) * sz
    // the tip: everything above the crown leans over to the side and up, smoothly
    const t = Math.max(0, y / sy - 0.35) / 0.65
    x += s.flop * t * t
    y += s.rise * t * t * t
    p.setXYZ(i, x, y, z + centre)
  }
  geo.computeVertexNormals()
  g.add(new THREE.Mesh(geo, cloth), new THREE.Mesh(geo, inside))
  // the shoulders: the cloth runs straight down from the hood into a wide, sloping poncho
  const poncho = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 24, 0, Math.PI * 2, 0, Math.PI / 2), cloth)
  poncho.scale.set(s.shoulders, 0.3, s.shoulders * 0.62)
  poncho.position.set(0, -0.215 - 0.3 * 0.55, centre * 0.55) // its crown sits just under the chin, the cloth sloping away to the sides
  g.add(poncho)
  // where the hood meets the shoulders: a soft fold, a collar
  const collar = new THREE.Mesh(new THREE.TorusGeometry(1, 0.1, 10, 40), cloth)
  collar.scale.set(s.w * 0.85, s.w * 0.85 * 0.8, s.w * 0.85)
  collar.rotation.x = Math.PI / 2
  collar.position.set(0, -0.225, centre * 0.55)
  g.add(collar)
  return g
}

/** The mask, floating: an oval with black ovals for eyes, short thick brows and a small mouth. */
function mask(s: HoodSpec) {
  const g = new THREE.Group()
  const a = 0.118 // half-width
  const b = 0.155 // half-height
  const dep = 0.05
  const body = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 28), new THREE.MeshStandardMaterial({ color: BONE, roughness: 0.55 }))
  body.scale.set(a, b, dep)
  g.add(body)
  const ink = new THREE.MeshBasicMaterial({ color: INK })
  const onFace = (x: number, y: number) => -dep * Math.sqrt(Math.max(0, 1 - (x / a) ** 2 - (y / b) ** 2)) - 0.006
  const disc = new THREE.CircleGeometry(1, 28)
  for (const sx of [-1, 1]) {
    const eye = new THREE.Mesh(disc, ink)
    eye.scale.set(0.024, 0.033, 1)
    eye.position.set(sx * 0.047, 0.012, onFace(sx * 0.047, 0.012))
    eye.rotation.y = Math.PI
    g.add(eye)
    // short thick brows, arched, high above the eyes
    const brow = new THREE.Mesh(new THREE.CapsuleGeometry(0.0055, 0.034, 3, 8), ink)
    brow.position.set(sx * 0.047, 0.07, onFace(sx * 0.047, 0.07))
    brow.rotation.set(0, Math.PI, Math.PI / 2 + sx * 0.12)
    g.add(brow)
  }
  const mouth = new THREE.Mesh(disc, ink)
  mouth.scale.set(0.017, 0.0105, 1)
  mouth.position.set(-0.004, -0.066, onFace(-0.004, -0.066))
  mouth.rotation.y = Math.PI
  g.add(mouth)
  g.userData.base = new THREE.Vector3(0, 0.006, -s.gap)
  return g
}

// ---- the page: four viewports, each with its own hood and its own floating mask
const canvas = document.getElementById('c') as HTMLCanvasElement
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
renderer.setClearColor(0x0f0b09)
renderer.setScissorTest(true)

const models = SPECS.map((s, i) => {
  const scene = new THREE.Scene()
  const root = new THREE.Group()
  const m = mask(s)
  m.position.copy(m.userData.base as THREE.Vector3)
  root.add(hood(s), m)
  scene.add(root)
  scene.add(new THREE.AmbientLight(0xffeedd, 0.4))
  const lamp = new THREE.SpotLight(0xffe2c0, 7, 10, 0.75, 0.6, 1.5)
  lamp.position.set(0.5, 0.95, -1.15)
  scene.add(lamp, lamp.target)
  const bright = new THREE.HemisphereLight(0xffeedd, 0x554433, 1.5)
  bright.visible = false
  scene.add(bright)
  const tag = document.createElement('div')
  tag.className = 'tag'
  tag.innerHTML = `<b>${s.name}</b><br>${s.note}`
  document.body.appendChild(tag)
  return { s, scene, root, mask: m, lamp, bright, tag, i }
})

let brightMode = false
let paused = false
let userYaw = 0
let yawMode = 1 // 1 front · 2 three-quarters · 3 profile
const YAWS: Record<number, number> = { 1: 0, 2: 0.65, 3: 1.45 }
let dragging = false
let lastX = 0
canvas.addEventListener('pointerdown', (e) => { dragging = true; lastX = e.clientX })
window.addEventListener('pointerup', () => (dragging = false))
window.addEventListener('pointermove', (e) => { if (dragging) { userYaw += (e.clientX - lastX) * 0.01; lastX = e.clientX } })
window.addEventListener('keydown', (e) => {
  if (e.key === 'l' || e.key === 'L') brightMode = !brightMode
  if (e.key === ' ') paused = !paused
  if (['1', '2', '3'].includes(e.key)) { yawMode = Number(e.key); userYaw = 0 }
})

const clock = new THREE.Clock()
let tPaused = 0
function frame() {
  const W = innerWidth
  const H = innerHeight
  renderer.setSize(W, H, false)
  const cols = 2
  const rows = 2
  const t = paused ? tPaused : clock.getElapsedTime()
  tPaused = t
  const ts = Math.floor(t * 15) / 15 // stop-motion, like the puppets
  for (const m of models) {
    const cw = W / cols
    const ch = H / rows
    const x = (m.i % cols) * cw
    const y = H - (Math.floor(m.i / cols) + 1) * ch
    renderer.setViewport(x, y, cw, ch)
    renderer.setScissor(x, y, cw, ch)
    // the head turns a little each way around the chosen view; the mask hangs and drifts inside the hood
    m.root.rotation.y = YAWS[yawMode] + userYaw + Math.sin(ts * 0.6) * 0.18
    const b = m.mask.userData.base as THREE.Vector3
    m.mask.position.set(b.x + Math.sin(ts * 0.7 + m.i) * 0.004, b.y + Math.sin(ts * 1.3 + m.i * 2) * 0.006, b.z)
    m.mask.rotation.z = Math.sin(ts * 0.9 + m.i) * 0.04
    for (const c of cloths) c.color.set(brightMode ? 0x6a5d52 : CLOTH)
    m.lamp.visible = !brightMode
    m.bright.visible = brightMode
    const cam = new THREE.PerspectiveCamera(32, cw / ch, 0.1, 10)
    cam.position.set(0, 0.06, -2.1)
    cam.lookAt(0, -0.05, 0)
    renderer.render(m.scene, cam)
    m.tag.style.left = `${x + 8}px`
    m.tag.style.top = `${H - y - ch + 8}px`
  }
  void rows
  requestAnimationFrame(frame)
}
Object.assign(window, { __lab: { setView: (n: number) => { yawMode = n; userYaw = 0 }, setBright: (v: boolean) => (brightMode = v), pause: (v: boolean) => (paused = v) } })
frame()
