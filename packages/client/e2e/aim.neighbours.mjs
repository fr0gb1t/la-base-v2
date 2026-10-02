// Turn the head with the mouse to each neighbour's face: the centre of the view must reach it.
// Usage: node e2e/aim.neighbours.mjs <out-prefix>
import puppeteer from 'puppeteer-core'
import { io } from 'socket.io-client'
// (out-prefix below)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const host = io('http://localhost:3100', { transports: ['websocket'] })
await new Promise((r) => host.on('connect', r))
const emit = (ev, p) => new Promise((r) => host.emit(ev, p, r))
const got = []
host.on('sena:made', (d) => got.push(d)) // filtered to mine below: bots sign too
const room = (await emit('room:create', { playerName: 'Host', playerCount: 4 })).roomCode
host.on('game:state', async (st) => {
  if (st.phase === 'initial_draw' && st.initialDraw?.currentDrawerPlayerId === host.id) await emit('draw:initialCard', { roomCode: room })
})
const b = await puppeteer.launch({ executablePath: '/usr/bin/chromium', headless: 'new', args: ['--use-angle=vulkan', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'], defaultViewport: { width: 1280, height: 720 } })
const p = await b.newPage()
await p.goto('http://localhost:5174/?debug=1', { waitUntil: 'domcontentloaded' }); await sleep(2000)
await p.evaluate(() => { localStorage.clear(); localStorage.setItem('guestName', 'Vos') })
await p.reload({ waitUntil: 'domcontentloaded' }); await sleep(2500)
const click = (t) => p.evaluate((t) => { const x = [...document.querySelectorAll('button')].find((e) => e.textContent.trim().toLowerCase().startsWith(t) && !e.disabled); x?.click(); return !!x }, t)
await click('sentarse'); await sleep(1200); await p.keyboard.type(room); await click('sentarse'); await sleep(1000)
await emit('room:addBot', { roomCode: room }); await emit('room:addBot', { roomCode: room }); await sleep(800)
await emit('game:start', { roomCode: room })
for (let i = 0; i < 80; i++) {
  await sleep(300)
  const ph = await p.evaluate(() => document.querySelector('.phase-line')?.textContent?.toLowerCase() ?? '')
  if (ph.includes('mazo del centro')) { const d = await p.evaluate(() => window.__table.deckScreen()); await p.mouse.click(d.x, d.y) }
  if (await p.evaluate(() => !!document.querySelector('.tally, .bid-dock') || /declar|turno|pide/.test(document.querySelector('.phase-line')?.textContent ?? ''))) break
}
await sleep(1000)
const out = process.argv[2] ?? '/tmp/aim'
const st = () => p.evaluate(() => { const t = window.__table; return { yaw: t.yaw, yawMax: t.yawMax, pitch: t.pitch, n: t.n, missR: t.debugAimMiss(t.n - 1), missL: t.debugAimMiss(1), aimed: t.debugState().aimedFace } })
const r = {}
for (const [side, dx] of [['left', -1], ['right', 1]]) {
  // drag the view as far as it goes toward that side (dragging right turns the head right)
  for (let k = 0; k < 4; k++) { await p.mouse.move(640, 360); await p.mouse.down(); await p.mouse.move(640 + dx * 500, 340, { steps: 15 }); await p.mouse.up(); await sleep(250) }
  await sleep(800)
  r[side] = await st()
  await p.screenshot({ path: `${out}-${side}.png` })
  await p.evaluate(() => { const t = window.__table; t.yawT = 0; t.pitchT = -0.34 }); await sleep(800)
}
for (const [side, seat] of [['face-right', 3], ['face-left', 1]]) {
  await p.evaluate((s) => window.__table.debugAimHead(s), seat); await sleep(1200)
  r[side] = await st()
  await p.screenshot({ path: `${out}-${side}.png` })
}
// one drag from the centre to the right edge, held there: the view keeps turning to the limit
await p.evaluate(() => { const t = window.__table; t.yawT = 0; t.pitchT = -0.02 }); await sleep(800)
await p.mouse.move(640, 360); await p.mouse.down(); await p.mouse.move(1279, 360, { steps: 20 }); await sleep(1800)
r.edgeRight = await st()
await p.mouse.up(); await sleep(500)
await p.screenshot({ path: `${out}-edge-right.png` })
const need = 0.8048 // yaw to the right neighbour's face (from the precise aim above)
const ok = r.edgeRight.yaw <= -need && r.edgeRight.aimed === 3
console.log(ok ? 'PASS: one drag against the right edge reaches the right neighbour' : 'FAIL')
console.log(JSON.stringify(r, null, 1))
await b.close(); host.disconnect(); process.exit(0)
