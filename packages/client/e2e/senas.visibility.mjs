// Señas visibility: a partner's show always; a rival's only while the centre of your view is on
// their face. Usage: node e2e/senas.visibility.mjs <out-prefix>
import puppeteer from 'puppeteer-core'
import { io } from 'socket.io-client'
const out = process.argv[2] ?? '/tmp/vis'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const sock = async () => {
  const s = io('http://localhost:3000', { transports: ['websocket'], forceNew: true })
  await new Promise((r) => s.on('connect', r))
  return { s, emit: (ev, p) => new Promise((r) => s.emit(ev, p, r)) }
}
const host = await sock()
const p2 = await sock()
const room = (await host.emit('room:create', { playerName: 'Host', playerCount: 4 })).roomCode
await p2.emit('room:join', { roomCode: room, playerName: 'Dos' })
for (const c of [host, p2]) c.s.on('game:state', async (st) => { if (st.phase === 'initial_draw' && st.initialDraw?.currentDrawerPlayerId === c.s.id) await c.emit('draw:initialCard', { roomCode: room }) })
const b = await puppeteer.launch({ executablePath: '/usr/bin/chromium', headless: 'new', args: ['--use-angle=vulkan', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'], defaultViewport: { width: 1280, height: 720 } })
const p = await b.newPage()
p.on('pageerror', (e) => console.log('PAGEERR', e.message)); p.on('console', (m) => m.type() === 'error' && console.log('CONSOLE', m.text().slice(0, 300)))
await p.goto('http://localhost:5173/?debug=1', { waitUntil: 'domcontentloaded' }); await sleep(2000)
await p.evaluate(() => { localStorage.clear(); localStorage.setItem('guestName', 'Vos') })
await p.reload({ waitUntil: 'domcontentloaded' }); await sleep(2500)
const click = (t) => p.evaluate((t) => { const x = [...document.querySelectorAll('button')].find((e) => e.textContent.trim().toLowerCase().startsWith(t) && !e.disabled); x?.click(); return !!x }, t)
await click('sentarse'); await sleep(1200); await p.keyboard.type(room); await click('sentarse'); await sleep(1000)
await host.emit('room:addBot', { roomCode: room }); await sleep(800)
await host.emit('game:start', { roomCode: room })
let order
for (let i = 0; i < 80; i++) {
  await sleep(300)
  const ph = await p.evaluate(() => document.querySelector('.phase-line')?.textContent?.toLowerCase() ?? '')
  if (ph.includes('mazo del centro')) { const d = await p.evaluate(() => window.__table.deckScreen()); await p.mouse.click(d.x, d.y) }
  if (/declar|pide/.test(ph)) break
}
const teams = await p.evaluate(() => window.__table.players.map((x) => ({ id: x.id, name: x.name, team: x.team })))
const myTeam = teams.find((x) => x.name === 'Vos')?.team
const partner = [host, p2].find((c) => teams.find((x) => x.id === c.s.id)?.team === myTeam)
const rival = [host, p2].find((c) => c !== partner)
console.log('partner', partner ? (partner === host ? 'Host' : 'Dos') : 'none', 'rival', rival === host ? 'Host' : 'Dos')
const faces = () => p.evaluate(() => window.__table.debugState().faces)
const results = {}
const T = (m) => console.log('t', m)
T('a'); await p.evaluate(() => window.__table.recenter?.()); T('b')
await sleep(500)
if (partner) {
  await partner.emit('sena:make', { roomCode: room, sena: 'ancho-espada' }); await sleep(500)
  results.partnerShown = (await faces()).some((f) => f.id === partner.s.id && f.sena === 'ancho-espada')
}
await rival.emit('sena:make', { roomCode: room, sena: 'ancho-copa' }); await sleep(500)
T('c'); results.rivalHiddenWhenNotLooking = !(await faces()).some((f) => f.id === rival.s.id)
await sleep(1500)
// look straight at the rival's face
const seat = await p.evaluate((id) => { const t = window.__table; const ps = t.players; const me = ps.findIndex((x) => x.id === t.myId); return (ps.findIndex((x) => x.id === id) - me + t.n) % t.n }, rival.s.id)
await p.evaluate((s) => window.__table.debugPeekHead(s), seat); await sleep(1200)
results.rivalSeat = seat
// the rival turns one way (toward you) and the other (away, a profile): only the first shows the face
const aimedWith = {}
for (const yaw of [0.8, -0.8]) {
  for (let i = 0; i < 8; i++) { rival.s.emit('presence:look', { roomCode: room, yaw, pitch: -0.1 }); await sleep(100) }
  aimedWith[yaw] = (await p.evaluate(() => window.__table.debugState().aimedFace)) === seat
}
results.aimedWith = aimedWith
results.profileIgnored = Object.values(aimedWith).includes(false)
rival.yaw = aimedWith[0.8] ? 0.8 : -0.8
for (let i = 0; i < 5; i++) { rival.s.emit('presence:look', { roomCode: room, yaw: rival.yaw, pitch: -0.1 }); await sleep(100) }
const keepLooking = setInterval(() => rival.s.emit('presence:look', { roomCode: room, yaw: rival.yaw ?? 0, pitch: -0.1 }), 300)
results.aimed = (await p.evaluate(() => window.__table.debugState().aimedFace)) === seat
results.reticleOnFace = await p.evaluate(() => !!document.querySelector('.reticle.on-face'))
await rival.emit('sena:make', { roomCode: room, sena: 'ancho-copa' }); await sleep(450)
results.rivalShownWhenLooking = (await faces()).some((f) => f.id === rival.s.id && f.sena === 'ancho-copa')
await p.screenshot({ path: `${out}-caught.png` })
await sleep(600)
results.log = await p.evaluate(() => { document.querySelector('.hud-tabs button[title="Tecla J"]')?.click(); return null })
await sleep(300)
results.log = await p.evaluate(() => [...document.querySelectorAll('.log-list .log-sena')].map((l) => l.textContent))
console.log(JSON.stringify(results, null, 1))
clearInterval(keepLooking)
// the seña carries the signer's gaze: without any look stream, a seña made toward you shows,
// one made toward someone else doesn't
await sleep(2200) // > PRESENCE_TTL: their head is back on the table
await rival.emit('sena:make', { roomCode: room, sena: 'tres', yaw: rival.yaw, pitch: -0.05 }); await sleep(450)
results.gazeTowardYouShows = (await faces()).some((f) => f.id === rival.s.id && f.sena === 'tres')
await sleep(2200)
await rival.emit('sena:make', { roomCode: room, sena: 'dos', yaw: -rival.yaw, pitch: -0.05 }); await sleep(450)
results.gazeAwayHidden = !(await faces()).some((f) => f.id === rival.s.id)
const ok = results.gazeTowardYouShows && results.gazeAwayHidden && results.profileIgnored && (partner ? results.partnerShown : true) && results.rivalHiddenWhenNotLooking && results.aimed && results.rivalShownWhenLooking && results.reticleOnFace
console.log(ok ? 'PASS' : 'FAIL')
await b.close(); host.s.disconnect(); p2.s.disconnect(); process.exit(ok ? 0 : 1)
