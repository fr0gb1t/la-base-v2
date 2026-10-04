// Señas lab (development only: open /senas-lab.html on the dev server). The real table, with everybody
// signing all the time and no server: the partners' señas always show, a rival's only when the reading rule
// says you are looking at them, exactly the rule the server applies (shared/tableGeometry + the server's
// dwell and "catch it halfway"). The panel turns the knobs of that rule and shows, seat by seat, what
// is being read, so a change can be felt in seconds instead of in a whole game.
import * as THREE from 'three'
import { SEAT_AIM_RADIUS, SENAS, eyePosition, gazeDirection, gazeToward, headPosition, seatSpot, seatUnderAim, seesFace, type AimOptions, type Sena } from '@la-base/shared'
import { TableScene } from '../table3d/TableScene'

const WINDOW_MS = 1600 // how long a seña stays on a face (the server's SENA_WINDOW_MS)

interface Active {
  s: Sena
  t0: number
  gaze: { yaw: number; pitch: number }
  shown: boolean // reached you
  aimedSince: number | null // since when the rule has been satisfied (for the dwell)
}

const state = {
  n: 4,
  radius: SEAT_AIM_RADIUS,
  exclusive: true,
  dwell: 150, // ms your aim must rest on a rival's face to read it (the server's DWELL_MS)
  every: 1.8, // s between a player's señas
  zones: true,
  paused: false,
}

const reticle = document.getElementById('reticle')!
const scene = new TableScene(document.getElementById('table')!, {
  requestPlay: async () => false,
  look: () => undefined,
  arm: () => undefined,
  hover: () => undefined,
  status: () => undefined,
  faceAim: (id) => reticle.classList.toggle('on-face', Boolean(id)),
})
const { scene: three } = scene.labHandles()

// ---- the players: me (seat 0) and the rest, teams alternating by seat as at the real table
const ids = () => Array.from({ length: state.n }, (_, i) => `p${i}`)
const teamOf = (i: number) => (i % 2 === 0 ? 'nosotros' : 'ellos')
const nameOf = (i: number) => (i === 0 ? 'Vos' : `${teamOf(i) === 'nosotros' ? 'Compa' : 'Rival'} ${i}`)
function seatThePlayers() {
  scene.setPlayers(ids().map((id, i) => ({ id, name: nameOf(i), team: teamOf(i), handCount: 0, isConnected: true })), 'p0')
}
seatThePlayers()

// ---- the señas going on: one per other player at a time, a new one every `every` seconds each
const active = new Map<number, Active>()
const nextAt = new Map<number, number>()
const stats = new Map<number, { made: number; read: number }>()
const opts = (): AimOptions => ({ radius: state.radius, exclusive: state.exclusive })
const now = () => performance.now()

function deliver(seat: number, a: Active) {
  a.shown = true
  scene.sena(`p${seat}`, a.s, a.gaze, Math.max(0, now() - a.t0))
  const st = stats.get(seat)
  if (st) st.read++
}

function step() {
  const t = now()
  const n = state.n
  scene.aimOptions = opts()
  const viewerGaze = scene.gaze()
  const eye = eyePosition(0, n)
  const dir = gazeDirection(0, n, viewerGaze)
  for (let seat = 1; seat < n; seat++) {
    const a = active.get(seat)
    if (a && t - a.t0 > WINDOW_MS) active.delete(seat)
    if (!state.paused && !active.has(seat) && t >= (nextAt.get(seat) ?? 0)) {
      const s = SENAS[Math.floor(Math.random() * SENAS.length)].id
      const fresh: Active = { s, t0: t, gaze: gazeToward(seat, 0, n), shown: false, aimedSince: null }
      active.set(seat, fresh)
      nextAt.set(seat, t + WINDOW_MS + state.every * 1000 * (0.5 + Math.random()))
      const st = stats.get(seat) ?? { made: 0, read: 0 }
      st.made++
      stats.set(seat, st)
      if (teamOf(seat) === teamOf(0)) deliver(seat, fresh) // partners always get it
    }
    const cur = active.get(seat)
    if (cur && !cur.shown && teamOf(seat) !== teamOf(0)) {
      // a rival's: you read it once your aim has rested on them for the dwell time (also halfway through)
      if (seesFace(0, viewerGaze, seat, cur.gaze, n, opts())) {
        cur.aimedSince ??= t
        if (t - cur.aimedSince >= state.dwell) deliver(seat, cur)
      } else cur.aimedSince = null
    }
  }
  drawZones(seatUnderAim(eye, dir, n, 0, opts()))
  renderPanel(seatUnderAim(eye, dir, n, 0, opts()))
  requestAnimationFrame(step)
}

// ---- the zones, drawn on the table (a capsule from each head down to the player's place)
const zones = new THREE.Group()
three.add(zones)
let zoneKey = ''
const zoneMeshes: THREE.Mesh[] = []
function drawZones(aimed: number) {
  const key = `${state.n}|${state.radius}|${state.zones}`
  if (key !== zoneKey) {
    zoneKey = key
    zoneMeshes.splice(0).forEach((m) => {
      zones.remove(m)
      m.geometry.dispose()
    })
    if (state.zones) {
      for (let seat = 1; seat < state.n; seat++) {
        const a = headPosition(seat, state.n)
        const b = seatSpot(seat, state.n)
        const va = new THREE.Vector3(a.x, a.y, a.z)
        const vb = new THREE.Vector3(b.x, b.y, b.z)
        const m = new THREE.Mesh(
          new THREE.CapsuleGeometry(state.radius, va.distanceTo(vb), 8, 16),
          new THREE.MeshBasicMaterial({ color: teamOf(seat) === teamOf(0) ? 0x5ea2b0 : 0xb76d6e, transparent: true, opacity: 0.16, depthWrite: false }),
        )
        m.position.copy(va).add(vb).multiplyScalar(0.5)
        m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), vb.clone().sub(va).normalize())
        m.userData.seat = seat
        zones.add(m)
        zoneMeshes.push(m)
      }
    }
  }
  for (const m of zoneMeshes) (m.material as THREE.MeshBasicMaterial).opacity = m.userData.seat === aimed ? 0.42 : 0.14
}

// ---- the panel
const panel = document.getElementById('panel')!
panel.innerHTML = `
  <h1>Laboratorio de señas</h1>
  <div class="row"><span>Jugadores</span><span class="seg" id="count"></span></div>
  <div class="row"><label>Radio de la zona <input type="range" id="radius" min="0.05" max="0.7" step="0.01"></label><span class="val" id="radiusV"></span></div>
  <div class="row"><label>Tiempo apuntando para leer <input type="range" id="dwell" min="0" max="500" step="10"></label><span class="val" id="dwellV"></span></div>
  <div class="row"><label>Cada cuánto hace una seña cada uno <input type="range" id="every" min="0.2" max="5" step="0.1"></label><span class="val" id="everyV"></span></div>
  <div class="row"><label><span><input type="checkbox" id="exclusive"> Lectura exclusiva (solo el asiento más centrado)</span></label><span></span></div>
  <div class="row"><label><span><input type="checkbox" id="zones"> Mostrar las zonas en la mesa</span></label><span></span></div>
  <div class="row"><label><span><input type="checkbox" id="paused"> Pausa (nadie hace señas)</span></label><span></span></div>
  <table id="seats"><thead><tr><th>Asiento</th><th>Seña</th><th>Lo ves</th><th>Leídas</th></tr></thead><tbody></tbody></table>
  <p id="help">Arrastrá sobre la mesa para mirar. Los compañeros (celeste) siempre se leen; los rivales (rosa) solo cuando la zona
  está bajo el centro de tu vista. El anillo se agranda cuando estás sobre una zona. «Leídas» cuenta, por asiento, cuántas señas te llegaron.</p>`
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T
const range = (id: string, key: 'radius' | 'dwell' | 'every', fmt: (v: number) => string) => {
  const el = $<HTMLInputElement>(id)
  el.value = String(state[key])
  const upd = () => {
    state[key] = Number(el.value)
    $(id + 'V').textContent = fmt(state[key])
  }
  el.addEventListener('input', upd)
  upd()
}
range('radius', 'radius', (v) => `${Math.round(v * 100)} cm`)
range('dwell', 'dwell', (v) => `${v} ms`)
range('every', 'every', (v) => `${v.toFixed(1)} s`)
for (const [id, key] of [['exclusive', 'exclusive'], ['zones', 'zones'], ['paused', 'paused']] as const) {
  const el = $<HTMLInputElement>(id)
  el.checked = state[key]
  el.addEventListener('change', () => (state[key] = el.checked))
}
const count = $('count')
for (const n of [4, 6, 8]) {
  const b = document.createElement('button')
  b.textContent = String(n)
  b.className = n === state.n ? 'on' : ''
  b.onclick = () => {
    state.n = n
    count.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b))
    active.clear()
    nextAt.clear()
    stats.clear()
    seatThePlayers()
  }
  count.appendChild(b)
}
const body = panel.querySelector('tbody')!
let lastHtml = ''
function renderPanel(aimed: number) {
  let html = ''
  for (let seat = 1; seat < state.n; seat++) {
    const a = active.get(seat)
    const partner = teamOf(seat) === teamOf(0)
    const st = stats.get(seat) ?? { made: 0, read: 0 }
    const label = a ? SENAS.find((x) => x.id === a.s)!.label : '—'
    const seen = a ? (a.shown ? '<span class="shown">sí</span>' : '<span class="hidden">no</span>') : ''
    html += `<tr class="${aimed === seat ? 'aimed' : ''}"><td class="${partner ? 'partner' : 'rival'}">${seat} ${partner ? 'compañero' : 'rival'}</td><td>${label}</td><td>${seen}</td><td>${st.read}/${st.made}</td></tr>`
  }
  if (html !== lastHtml) body.innerHTML = lastHtml = html
}

Object.assign(window, { __lab: { scene, state } }) // (for the tests)
requestAnimationFrame(step)
