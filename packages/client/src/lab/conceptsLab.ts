// Character concepts for La Base (development only: open /conceptos-lab.html on the dev server). Six directions for
// the player at the table, all inventions of ours (not copies of anything): each one keeps what the game needs —
// a dark hood with the mask floating inside it, floating hands, a face that can make the señas — and changes the
// material and the story of the character. Rendered with the same PS1 chain the game would use.
import * as THREE from 'three/webgpu'
import { Fn, float, vec2, vec3, uniform, mix, dot, smoothstep, positionLocal, abs, fract, sin, texture, mx_noise_float, mx_fractal_noise_float, renderOutput, posterize } from 'three/tsl'
import { retroPass } from 'three/addons/tsl/display/RetroPassNode.js'
import { bayerDither } from 'three/addons/tsl/math/Bayer.js'
import { vignette } from 'three/addons/tsl/display/CRT.js'
import { film } from 'three/addons/tsl/display/FilmNode.js'
import { drawFace } from '../table3d/cardFace'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type N = any // (TSL's typings are stricter than its runtime; what matters is that it renders)

const canvas = document.getElementById('c') as HTMLCanvasElement
const label = document.getElementById('label')!
const params = new URLSearchParams(location.search)

// ------------------------------------------------------------------------------------------------ shared pieces
const FACE = { a: 0.122, b: 0.158, d: 0.075 } // the mask: an oval, a little domed (half-width, half-height, depth)

/** A canvas you paint on, as a texture. */
function paint(w: number, h: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void) {
  const cv = document.createElement('canvas')
  cv.width = w
  cv.height = h
  draw(cv.getContext('2d')!, w, h)
  const t = new THREE.CanvasTexture(cv)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

/** The front of the mask projected flat (x, y of the object), so a painting lands on the face as drawn. */
const faceUV = (): N => vec2(float(0.5).sub(positionLocal.x.div(FACE.a * 2)), positionLocal.y.div(FACE.b * 2).add(0.5))

function lit(colorNode: N, rough = 0.85, metal = 0) {
  const m = new THREE.MeshStandardNodeMaterial({ roughness: rough, metalness: metal })
  m.colorNode = colorNode
  return m
}

// the scale lives in the geometry, not the mesh: every pattern below is written in metres of the local space
function maskShell(mat: THREE.Material, squash = 1) {
  return new THREE.Mesh(new THREE.SphereGeometry(1, 64, 48).scale(FACE.a, FACE.b * squash, FACE.d), mat)
}

/** The hood: a hollow shell open at the front, its tip falling to one side, sloping into the shoulders. */
function hood(color = 0x1c1714, rough = 1) {
  const g = new THREE.Group()
  const cloth = new THREE.MeshStandardMaterial({ color, roughness: rough })
  const inside = new THREE.MeshBasicMaterial({ color: 0x030202, side: THREE.BackSide })
  const cut = 1.0
  const w = 0.19
  const h = 0.25
  const d = 0.24
  const sx = w / Math.sin(cut)
  const sy = h / Math.sin(cut)
  const sz = d / (1 + Math.cos(cut))
  const centre = Math.cos(cut) * sz
  const geo = new THREE.SphereGeometry(1, 56, 36, 0, Math.PI * 2, cut, Math.PI - cut)
  geo.rotateX(-Math.PI / 2)
  const p = geo.attributes.position
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i) * sx
    let y = p.getY(i) * sy
    const t = Math.max(0, y / sy - 0.35) / 0.65
    x += 0.09 * t * t
    y += 0.06 * t * t * t
    p.setXYZ(i, x, y, p.getZ(i) * sz + centre)
  }
  geo.computeVertexNormals()
  g.add(new THREE.Mesh(geo, cloth), new THREE.Mesh(geo, inside))
  const shoulders = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 24, 0, Math.PI * 2, 0, Math.PI / 2), cloth)
  shoulders.scale.set(0.42, 0.28, 0.27)
  shoulders.position.set(0, -0.2 - 0.28 * 0.55, centre * 0.55)
  g.add(shoulders)
  g.position.z = 0.03
  return g
}

// hands: palm faces −y, fingers point −z; style decides joints and cuffs
interface HandStyle { mat: THREE.Material; joints?: THREE.Material; cuff?: THREE.Material; wraps?: THREE.Material; thick?: number }
function hand(side: 1 | -1, st: HandStyle, curl: number[]) {
  const g = new THREE.Group()
  const R = 0.0105 * (st.thick ?? 1)
  const palm = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 18).scale(0.048, 0.019, 0.052), st.mat)
  palm.position.z = -0.016
  g.add(palm)
  if (st.cuff) {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.036, 0.04, 20, 1, true), st.cuff)
    c.rotation.x = Math.PI / 2
    c.position.z = 0.04
    g.add(c)
  } else {
    const w = new THREE.Mesh(new THREE.CapsuleGeometry(0.024, 0.012, 6, 14), st.mat)
    w.rotation.x = Math.PI / 2
    w.scale.set(1.25, 1, 0.75)
    w.position.z = 0.028
    g.add(w)
  }
  const FINGERS = [
    { x: 0.029, z: -0.05, len: [0.031, 0.023, 0.019] },
    { x: 0.01, z: -0.053, len: [0.034, 0.025, 0.02] },
    { x: -0.01, z: -0.05, len: [0.032, 0.023, 0.019] },
    { x: -0.028, z: -0.044, len: [0.025, 0.018, 0.016] },
  ]
  FINGERS.forEach((f, i) => {
    let parent: THREE.Object3D = new THREE.Group()
    parent.position.set(side * f.x, 0, f.z)
    g.add(parent)
    f.len.forEach((L, j) => {
      const joint = new THREE.Group()
      if (j > 0) joint.position.z = -f.len[j - 1]
      joint.rotation.x = -curl[i] * (j === 0 ? 1 : j === 1 ? 1.15 : 0.7)
      const seg = new THREE.Mesh(new THREE.CapsuleGeometry(R * (1 - j * 0.08), L * (st.joints ? 0.75 : 1), 6, 12), st.mat)
      seg.rotation.x = Math.PI / 2
      seg.position.z = -L / 2
      joint.add(seg)
      if (st.joints) {
        const ball = new THREE.Mesh(new THREE.SphereGeometry(R * 1.05, 12, 10), st.joints)
        joint.add(ball)
      }
      if (st.wraps && j < 2) {
        const r = new THREE.Mesh(new THREE.TorusGeometry(R * 1.02, R * 0.35, 6, 16), st.wraps)
        r.position.z = -L * 0.5
        joint.add(r)
      }
      parent.add(joint)
      parent = joint
    })
  })
  const t = new THREE.Group()
  t.position.set(side * 0.038, -0.004, -0.004)
  t.rotation.set(0, side * 0.75, side * 0.9)
  g.add(t)
  let tp: THREE.Object3D = t
  ;[0.026, 0.022, 0.019].forEach((L, j, all) => {
    const joint = new THREE.Group()
    if (j > 0) joint.position.z = -all[j - 1]
    joint.rotation.x = -(0.2 + curl[0] * 0.3)
    const seg = new THREE.Mesh(new THREE.CapsuleGeometry(R * 1.1, L, 6, 12), st.mat)
    seg.rotation.x = Math.PI / 2
    seg.position.z = -L / 2
    joint.add(seg)
    tp.add(joint)
    tp = joint
  })
  if (st.wraps) {
    for (let k = 0; k < 3; k++) {
      const r = new THREE.Mesh(new THREE.TorusGeometry(0.044, 0.004, 6, 24), st.wraps)
      r.scale.set(1.1, 0.5, 1)
      r.rotation.set(Math.PI / 2, 0, 0.3)
      r.position.set(0, 0, -0.03 + k * 0.022)
      g.add(r)
    }
  }
  return g
}

/** A fan of three cards held in a hand: the backs face us (the player hides them), as at the table. */
function fan(backColor: number) {
  const g = new THREE.Group()
  const back = paint(64, 100, (c, w, h) => {
    c.fillStyle = '#d8c7a0'
    c.fillRect(0, 0, w, h)
    c.fillStyle = '#' + backColor.toString(16).padStart(6, '0')
    c.fillRect(5, 5, w - 10, h - 10)
    c.strokeStyle = '#d8c7a0'
    c.lineWidth = 2
    for (let i = -h; i < w + h; i += 9) {
      c.beginPath()
      c.moveTo(i, 0)
      c.lineTo(i + h, h)
      c.stroke()
    }
  })
  const mat = new THREE.MeshStandardMaterial({ map: back, roughness: 0.8 })
  for (let i = 0; i < 3; i++) {
    const card = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 0.094), mat)
    card.position.set((i - 1) * 0.016, 0.03 + Math.abs(i - 1) * -0.004, i * 0.001)
    card.rotation.z = (i - 1) * -0.18
    g.add(card)
  }
  return g
}

// ------------------------------------------------------------------------------------------------ the six concepts
interface Concept { name: string; idea: string; build: () => { head: THREE.Group; hands: HandStyle; fanColor: number; hoodColor?: number; noHood?: boolean } }

const CONCEPTS: Concept[] = [
  {
    name: '1 · Naipe',
    idea: 'la máscara es la cara de una figura de la baraja española, pintada como en las cartas, con el palo en la frente; guantes blancos de crupier',
    build: () => {
      const tex = paint(512, 640, (c, w, h) => {
        c.fillStyle = '#e4d6b4'
        c.fillRect(0, 0, w, h)
        // a band across the forehead in the deck's red, with an oro (the coin) in the middle
        c.fillStyle = '#8e2a22'
        c.fillRect(0, 80, w, 95)
        c.fillStyle = '#c9a043'
        c.beginPath()
        c.arc(w / 2, 128, 40, 0, Math.PI * 2)
        c.fill()
        c.strokeStyle = '#140e0c'
        c.lineWidth = 6
        c.stroke()
        c.beginPath()
        c.arc(w / 2, 128, 22, 0, Math.PI * 2)
        c.stroke()
        // almond eyes outlined in ink, arched painted brows, rosy cheek dots, small red mouth
        c.lineWidth = 9
        for (const sx of [-1, 1]) {
          const cx = w / 2 + sx * 100
          c.fillStyle = '#140e0c'
          c.beginPath()
          c.ellipse(cx, 300, 52, 26, 0, 0, Math.PI * 2)
          c.fill()
          c.beginPath()
          c.arc(cx, 285, 70, Math.PI * 1.2, Math.PI * 1.8)
          c.stroke()
          c.fillStyle = '#b5443a'
          c.beginPath()
          c.arc(cx, 420, 30, 0, Math.PI * 2)
          c.fill()
        }
        c.fillStyle = '#8e2a22'
        c.beginPath()
        c.ellipse(w / 2, 500, 50, 20, 0, 0, Math.PI * 2)
        c.fill()
        c.strokeStyle = '#140e0c'
        c.lineWidth = 6
        c.beginPath()
        c.moveTo(w / 2 - 46, 500)
        c.lineTo(w / 2 + 46, 500)
        c.stroke()
        // the ink outline of a card figure, around the face
        c.lineWidth = 14
        c.beginPath()
        c.ellipse(w / 2, h / 2, w / 2 - 10, h / 2 - 10, 0, 0, Math.PI * 2)
        c.stroke()
      })
      const head = new THREE.Group()
      head.add(maskShell(lit(texture(tex, faceUV()).rgb, 0.7)))
      const glove = new THREE.MeshStandardMaterial({ color: 0xe8e2d4, roughness: 0.75 })
      return { head, hands: { mat: glove, cuff: new THREE.MeshStandardMaterial({ color: 0x8e2a22, roughness: 0.8 }), thick: 1.05 }, fanColor: 0x8e2a22 }
    },
  },
  {
    name: '2 · Títere de madera',
    idea: 'máscara tallada con mandíbula y párpados articulados (bisagras de bronce): las señas serían mecánicas; manos de madera con articulaciones de bolita',
    build: () => {
      // wood grain: rings along the face, stretched noise, two browns
      const p: N = positionLocal
      const grain = fract(p.y.mul(38).add(mx_noise_float(p.mul(vec3(9, 2, 9))).mul(1.6)))
      const wood: N = mix(vec3(0.26, 0.15, 0.08), vec3(0.52, 0.36, 0.21), smoothstep(0.2, 0.8, grain)).mul(mix(float(0.8), float(1.05), mx_noise_float(p.mul(40)).mul(0.5).add(0.5)))
      const woodMat = lit(wood, 0.6)
      const dark = new THREE.MeshBasicMaterial({ color: 0x050302 })
      const brass = new THREE.MeshStandardMaterial({ color: 0xa8823a, roughness: 0.35, metalness: 0.8 })
      const head = new THREE.Group()
      // the upper face, and the jaw as its own piece with a gap: the mouth opens by dropping it
      const upper = maskShell(woodMat, 0.82)
      upper.position.y = 0.022
      head.add(upper)
      const jaw = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 24, 0, Math.PI * 2, Math.PI * 0.55, Math.PI * 0.45).scale(FACE.a * 0.86, FACE.b * 0.62, FACE.d * 0.95), woodMat)
      jaw.position.y = -0.03
      head.add(jaw)
      for (const sx of [-1, 1]) {
        // round eye holes with a wooden lid half closed, a carved brow, and a brass pin at the jaw hinge
        const hole = new THREE.Mesh(new THREE.CircleGeometry(0.021, 20), dark)
        hole.position.set(sx * 0.045, 0.045, -0.072)
        hole.rotation.y = Math.PI
        head.add(hole)
        const lid = new THREE.Mesh(new THREE.SphereGeometry(0.024, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), woodMat)
        lid.position.set(sx * 0.045, 0.047, -0.066)
        lid.rotation.x = -1.1
        head.add(lid)
        const brow = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.012, 0.016), woodMat)
        brow.position.set(sx * 0.045, 0.085, -0.066)
        brow.rotation.z = sx * -0.15
        head.add(brow)
        const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.01, 12), brass)
        pin.rotation.z = Math.PI / 2
        pin.position.set(sx * 0.104, -0.025, -0.02)
        head.add(pin)
      }
      const mouth = new THREE.Mesh(new THREE.PlaneGeometry(0.07, 0.008), dark)
      mouth.position.set(0, -0.032, -0.0765)
      mouth.rotation.y = Math.PI
      head.add(mouth)
      return { head, hands: { mat: woodMat, joints: brass, thick: 1.0 }, fanColor: 0x4a2716 }
    },
  },
  {
    name: '3 · Porcelana rota',
    idea: 'muñeca de porcelana brillante, agrietada, con mejillas y labios pintados; manos de porcelana articuladas',
    build: () => {
      const p: N = positionLocal
      // cracks: the thin valleys of a noise field, only where a second noise says so (not all over)
      const ridge = abs(mx_noise_float(p.mul(22)))
      const where = smoothstep(0.05, 0.3, mx_noise_float(p.mul(5).add(3)))
      const crack = float(1).sub(smoothstep(0.0, 0.03, ridge)).mul(where)
      const paintTex = paint(256, 320, (c, w, h) => {
        c.fillStyle = '#f1ece4'
        c.fillRect(0, 0, w, h)
        const blush = (x: number, y: number) => {
          const gr = c.createRadialGradient(x, y, 2, x, y, 34)
          gr.addColorStop(0, 'rgba(196,96,100,0.75)')
          gr.addColorStop(1, 'rgba(196,96,100,0)')
          c.fillStyle = gr
          c.fillRect(x - 40, y - 40, 80, 80)
        }
        blush(w / 2 - 62, 205)
        blush(w / 2 + 62, 205)
        c.fillStyle = '#18100e'
        for (const sx of [-1, 1]) {
          c.beginPath()
          c.ellipse(w / 2 + sx * 50, 150, 24, 30, 0, 0, Math.PI * 2)
          c.fill()
          c.strokeStyle = '#3a2a24'
          c.lineWidth = 3
          c.beginPath()
          c.arc(w / 2 + sx * 50, 128, 34, Math.PI * 1.15, Math.PI * 1.85)
          c.stroke()
        }
        c.fillStyle = '#a0383c'
        c.beginPath()
        c.ellipse(w / 2, 252, 16, 10, 0, 0, Math.PI * 2)
        c.fill()
      })
      const face: N = texture(paintTex, faceUV()).rgb
      const porcelain = lit(mix(face, vec3(0.08, 0.06, 0.06), crack), 0.18)
      const head = new THREE.Group()
      head.add(maskShell(porcelain))
      const bisque = lit(mix(vec3(0.93, 0.9, 0.86), vec3(0.08, 0.06, 0.06), crack), 0.2)
      return { head, hands: { mat: bisque, joints: bisque, thick: 0.95 }, fanColor: 0x2c3a4a, hoodColor: 0x15121a }
    },
  },
  {
    name: '4 · Costal',
    idea: 'una bolsa de arpillera atada al cuello, ojos de botón y boca cosida, como un espantapájaros; guantes de trabajo gastados',
    build: () => {
      const p: N = positionLocal
      const weave = sin(p.x.mul(520)).mul(sin(p.y.mul(520))).mul(0.5).add(0.5)
      const blotch = mx_fractal_noise_float(p.mul(10), 3, 2, 0.5).mul(0.5).add(0.5)
      const burlap: N = mix(vec3(0.42, 0.33, 0.2), vec3(0.62, 0.5, 0.32), weave.mul(0.5).add(blotch.mul(0.5)))
      const sackMat = lit(burlap, 0.95)
      const head = new THREE.Group()
      // the sack: a lumpy, slumped bag where the hood would be (no hood: the sack is the hood)
      const geo = new THREE.SphereGeometry(1, 48, 36)
      const pp = geo.attributes.position
      for (let i = 0; i < pp.count; i++) {
        const x = pp.getX(i)
        const y = pp.getY(i)
        const z = pp.getZ(i)
        const lump = 1 + 0.05 * Math.sin(x * 7 + y * 5) * Math.sin(z * 6 - y * 4)
        const slump = y > 0.6 ? 1 - (y - 0.6) * 0.35 : 1
        const neck = 1 - 0.42 * Math.exp(-(((y + 0.78) / 0.09) ** 2)) // gathered where the rope ties it
        pp.setXYZ(i, x * 0.15 * lump * neck, y * 0.19 * lump * slump + (y > 0.7 ? (x + 0.4) * 0.03 : 0), z * 0.15 * lump * neck)
      }
      geo.computeVertexNormals()
      head.add(new THREE.Mesh(geo, sackMat))
      const rope = new THREE.Mesh(new THREE.TorusGeometry(0.056, 0.01, 8, 32), lit(vec3(0.5, 0.42, 0.28), 1))
      rope.rotation.x = Math.PI / 2
      rope.position.y = -0.148
      head.add(rope)
      const thread = new THREE.MeshBasicMaterial({ color: 0x1a120c })
      for (const sx of [-1, 1]) {
        const button = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.008, 20), new THREE.MeshStandardMaterial({ color: 0x14100e, roughness: 0.3 }))
        button.rotation.x = Math.PI / 2
        button.position.set(sx * 0.05, 0.03, -0.142)
        head.add(button)
        for (const [hx, hy] of [[-1, -1], [1, 1], [-1, 1], [1, -1]]) {
          const hole = new THREE.Mesh(new THREE.CircleGeometry(0.004, 8), new THREE.MeshBasicMaterial({ color: 0x8a7a5a }))
          hole.position.set(sx * 0.05 + hx * 0.007, 0.03 + hy * 0.007, -0.1465)
          hole.rotation.y = Math.PI
          head.add(hole)
        }
      }
      // the mouth: cross stitches along a line
      for (let k = -3; k <= 3; k++) {
        for (const r of [0.6, -0.6]) {
          const st = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.0035, 0.003), thread)
          st.position.set(k * 0.014, -0.06 + Math.abs(k) * 0.002, -0.146 + Math.abs(k) * 0.002)
          st.rotation.z = r
          head.add(st)
        }
      }
      const gloveTex: N = mix(vec3(0.36, 0.27, 0.17), vec3(0.5, 0.4, 0.27), mx_fractal_noise_float(p.mul(30), 2, 2, 0.5).mul(0.5).add(0.5))
      return { head, hands: { mat: lit(gloveTex, 0.95), cuff: lit(vec3(0.3, 0.22, 0.14), 1), thick: 1.15 }, fanColor: 0x4a4927, noHood: true }
    },
  },
  {
    name: '5 · Murga',
    idea: 'máscara de papel maché del carnaval rioplatense, colores gastados, rombos sobre los ojos y labios grandes; guantes blancos con puño a rayas',
    build: () => {
      const p: N = positionLocal
      const tex = paint(512, 640, (c, w, h) => {
        c.fillStyle = '#e8e0cc'
        c.fillRect(0, 0, w, h)
        // stripes on the forehead, faded carnival colours
        const cols = ['#5ea2b0', '#d8b04a', '#b76d6e', '#6f8a4a']
        cols.forEach((col, i) => {
          c.fillStyle = col
          c.beginPath()
          c.moveTo(0, 60 + i * 34)
          c.quadraticCurveTo(w / 2, 20 + i * 34, w, 60 + i * 34)
          c.lineTo(w, 92 + i * 34)
          c.quadraticCurveTo(w / 2, 52 + i * 34, 0, 92 + i * 34)
          c.fill()
        })
        // black diamonds over the eyes, a dark hole in each
        for (const sx of [-1, 1]) {
          const cx = w / 2 + sx * 100
          c.fillStyle = '#1a1414'
          c.beginPath()
          c.moveTo(cx, 220)
          c.lineTo(cx + 60, 310)
          c.lineTo(cx, 400)
          c.lineTo(cx - 60, 310)
          c.fill()
          c.fillStyle = '#e8e0cc'
          c.beginPath()
          c.ellipse(cx, 310, 22, 16, 0, 0, Math.PI * 2)
          c.fill()
          c.fillStyle = '#050303'
          c.beginPath()
          c.ellipse(cx, 310, 16, 11, 0, 0, Math.PI * 2)
          c.fill()
        }
        // big painted lips
        c.fillStyle = '#9e2f2c'
        c.beginPath()
        c.ellipse(w / 2, 505, 95, 34, 0, 0, Math.PI * 2)
        c.fill()
        c.strokeStyle = '#3a1210'
        c.lineWidth = 6
        c.beginPath()
        c.moveTo(w / 2 - 90, 505)
        c.quadraticCurveTo(w / 2, 520, w / 2 + 90, 505)
        c.stroke()
      })
      const paper = mx_fractal_noise_float(p.mul(50), 2, 2, 0.5).mul(0.5).add(0.5)
      const mache: N = texture(tex, faceUV()).rgb.mul(mix(float(0.78), float(1.02), paper))
      const head = new THREE.Group()
      head.add(maskShell(lit(mache, 0.8)))
      const stripes = sin(p.z.mul(200)).greaterThan(0).select(vec3(0.37, 0.64, 0.69), vec3(0.85, 0.69, 0.29))
      return { head, hands: { mat: new THREE.MeshStandardMaterial({ color: 0xe8e2d4, roughness: 0.8 }), cuff: lit(stripes, 0.8) }, fanColor: 0x5ea2b0, hoodColor: 0x1b1420 }
    },
  },
  {
    name: '6 · Vendado',
    idea: 'la cara envuelta en vendas, con los rasgos dibujados con marcador; las manos también vendadas',
    build: () => {
      const p: N = positionLocal
      // bandage: diagonal strips with a darker seam between them, and old stains
      const strip = fract(p.y.mul(28).add(p.x.mul(9)))
      const seam = smoothstep(0.0, 0.12, strip).mul(smoothstep(1.0, 0.88, strip))
      const stain = smoothstep(0.25, 0.7, mx_fractal_noise_float(p.mul(9), 3, 2, 0.5).mul(0.5).add(0.5))
      const cloth: N = mix(vec3(0.62, 0.55, 0.42), vec3(0.88, 0.85, 0.76), seam).mul(mix(float(1), float(0.7), stain))
      const marker = paint(512, 640, (c, w) => {
        c.strokeStyle = '#120c0a'
        c.lineCap = 'round'
        c.lineWidth = 14
        for (const sx of [-1, 1]) {
          // scribbled round eyes, gone over twice
          for (const r of [44, 40]) {
            c.beginPath()
            c.ellipse(w / 2 + sx * 98, 300, r, r * 1.1, 0.2, 0, Math.PI * 2)
            c.stroke()
          }
          c.beginPath()
          c.moveTo(w / 2 + sx * 60, 220)
          c.lineTo(w / 2 + sx * 140, 232)
          c.stroke()
        }
        c.beginPath()
        c.moveTo(w / 2 - 80, 495)
        c.quadraticCurveTo(w / 2, 470, w / 2 + 80, 500)
        c.stroke()
      })
      const ink = texture(marker, faceUV()).a
      const head = new THREE.Group()
      head.add(maskShell(lit(cloth.mul(float(1).sub(ink.mul(0.92))), 0.95)))
      // a loose end of bandage hanging off one side
      const tail = new THREE.Mesh(new THREE.PlaneGeometry(0.03, 0.12), lit(cloth, 0.95))
      tail.material.side = THREE.DoubleSide
      tail.position.set(0.1, -0.1, -0.03)
      tail.rotation.set(0.2, 0.6, 0.25)
      head.add(tail)
      const handCloth = lit(mix(vec3(0.62, 0.55, 0.42), vec3(0.86, 0.83, 0.74), smoothstep(0.0, 0.3, fract(p.z.mul(80)))), 0.95)
      return { head, hands: { mat: handCloth, wraps: lit(vec3(0.55, 0.48, 0.36), 1), thick: 1.08 }, fanColor: 0x602217 }
    },
  },
]

// ------------------------------------------------------------------------------------------------ one scene per concept
function sceneFor(c: Concept) {
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x070504)
  const built = c.build()
  const player = new THREE.Group()
  if (!built.noHood) player.add(hood(built.hoodColor ?? 0x1c1714))
  built.head.position.set(0, 0.005, built.noHood ? 0 : -0.02)
  player.add(built.head)
  // hands in front: the left holds a fan of cards (backs to us), the right rests near the table edge
  const left = hand(-1, built.hands, [1.0, 1.1, 1.2, 1.25])
  left.position.set(0.1, -0.24, -0.2)
  left.rotation.set(-1.1, 0.35, -0.25, 'YXZ')
  // the fan stands up out of the fist, backs towards whoever sits opposite
  const f = fan(built.fanColor)
  f.position.set(0.1, -0.2, -0.235)
  f.rotation.set(-0.25, Math.PI, 0)
  player.add(f)
  const right = hand(1, built.hands, [0.3, 0.38, 0.46, 0.55])
  right.position.set(-0.13, -0.3, -0.24)
  right.rotation.set(0.15, -0.35, 0.1, 'YXZ')
  player.add(left, right)
  scene.add(player)
  // the table edge, felt, with one card face up (ours: the Spanish deck)
  const felt = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 0.04, 48), new THREE.MeshStandardMaterial({ color: 0x4a4927, roughness: 1 }))
  felt.position.set(0, -0.36, -1.32)
  scene.add(felt)
  const cardTex = new THREE.CanvasTexture(drawFace('oros', 12))
  cardTex.colorSpace = THREE.SRGBColorSpace
  const card = new THREE.Mesh(new THREE.PlaneGeometry(0.075, 0.117), new THREE.MeshStandardMaterial({ map: cardTex, roughness: 0.8 }))
  card.rotation.set(-Math.PI / 2, 0, 0.3)
  card.position.set(0.03, -0.338, -0.33)
  scene.add(card)
  // the lamp over the table, warm; a little cold fill from behind
  scene.add(new THREE.AmbientLight(0xffe8d0, 0.1))
  const lamp = new THREE.SpotLight(0xffc58a, 11, 6, 0.75, 0.6, 1.5)
  lamp.position.set(0.15, 1.1, -0.9)
  lamp.target.position.set(0, -0.1, 0)
  scene.add(lamp, lamp.target)
  const back = new THREE.PointLight(0x5ea2b0, 0.5, 3, 1.5)
  back.position.set(-0.6, 0.4, 0.6)
  scene.add(back)
  return { scene, player, head: built.head }
}

// ------------------------------------------------------------------------------------------------ renderer and PS1 chain
const renderer = new THREE.WebGPURenderer({ canvas, antialias: false, forceWebGL: params.has('webgl') })
renderer.setPixelRatio(1)
await renderer.init()
renderer.toneMapping = THREE.AgXToneMapping
const isWebGPU = (renderer.backend as { isWebGPUBackend?: boolean }).isWebGPUBackend === true
Object.assign(window, { __renderer: renderer })

const camera = new THREE.PerspectiveCamera(36, 1, 0.02, 20)
const scenes = CONCEPTS.map(sceneFor)
const steps = uniform(30)
const pipelines = scenes.map(({ scene }) => {
  const grade = Fn(([c]: N[]) => {
    const col: N = vec3(c)
    const l = dot(col, vec3(0.299, 0.587, 0.114))
    return mix(col, vec3(l).mul(vec3(1.08, 0.98, 0.86)), 0.25) // a touch warm, a touch faded: the basement
  })
  let chain: N = renderOutput(retroPass(scene, camera))
  chain = grade(chain)
  chain = bayerDither(chain, steps)
  chain = posterize(chain, steps)
  chain = vignette(chain, float(0.4), float(0.55))
  chain = film(chain, float(0.25))
  const pl = new THREE.RenderPipeline(renderer)
  pl.outputColorTransform = false
  pl.outputNode = chain
  return pl
})

let current = Number(params.get('c') ?? 0) // which concept (0..5), or -1 for the overview of all six
let retroOn = true
let paused = false
let orbit = 0
function setCurrent(i: number) {
  current = i
  label.innerHTML = i < 0 ? '<b>Los seis conceptos</b> (sin filtro) · 1–6 para ver cada uno con el filtro PS1' : `<b>${CONCEPTS[i].name}</b><br>${CONCEPTS[i].idea}`
}
setCurrent(current)
addEventListener('keydown', (e) => {
  if (e.key >= '1' && e.key <= '6') setCurrent(Number(e.key) - 1)
  if (e.key === '0') setCurrent(-1)
  if (e.key === 'r' || e.key === 'R') retroOn = !retroOn
  if (e.key === ' ') paused = !paused
  if (e.key === 'ArrowLeft') setCurrent((current + 5) % 6)
  if (e.key === 'ArrowRight') setCurrent((current + 1) % 6)
})
let drag = false
let lastX = 0
addEventListener('pointerdown', (e) => { drag = true; lastX = e.clientX })
addEventListener('pointerup', () => (drag = false))
addEventListener('pointermove', (e) => { if (drag) { orbit += (e.clientX - lastX) * 0.006; lastX = e.clientX } })

const timer = new THREE.Timer()
let tFrozen = 0
renderer.setAnimationLoop((now) => {
  timer.update(now)
  const t = paused ? tFrozen : timer.getElapsed()
  tFrozen = t
  const ts = Math.floor(t * 15) / 15 // stop-motion
  const W = innerWidth
  const H = innerHeight
  renderer.setSize(W, H, false)
  scenes.forEach(({ player, head }, i) => {
    player.rotation.y = Math.sin(ts * 0.5 + i) * 0.12
    head.position.y = 0.005 + Math.sin(ts * 1.3 + i) * 0.004 // the mask hangs and drifts
  })
  const a = orbit
  camera.position.set(Math.sin(a) * 1.35, 0.1, -Math.cos(a) * 1.35)
  camera.lookAt(0, -0.08, 0)
  if (current < 0) {
    renderer.setScissorTest(true)
    scenes.forEach(({ scene }, i) => {
      const cw = W / 3
      const ch = H / 2
      const x = (i % 3) * cw
      const y = (i < 3 ? 0 : 1) * ch
      renderer.setViewport(x, y, cw, ch)
      renderer.setScissor(x, y, cw, ch)
      camera.aspect = cw / ch
      camera.updateProjectionMatrix()
      renderer.render(scene, camera)
    })
    renderer.setScissorTest(false)
    return
  }
  camera.aspect = W / H
  camera.updateProjectionMatrix()
  if (retroOn) pipelines[current].render()
  else renderer.render(scenes[current].scene, camera)
})
Object.assign(window, { __lab: { set: setCurrent, pause: (v: boolean) => (paused = v), retro: (v: boolean) => (retroOn = v), orbit: (v: number) => (orbit = v), backend: isWebGPU ? 'WebGPU' : 'WebGL2' } })
