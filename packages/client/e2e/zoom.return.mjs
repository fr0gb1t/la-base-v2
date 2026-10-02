// After a right-click zoom the view returns to where it was before the zoom (not the seat default,
// not where you aimed). Usage: node e2e/zoom.return.mjs
import puppeteer from 'puppeteer-core'
import { io } from 'socket.io-client'
const out = process.argv[2] ?? '/tmp/wheel'
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
const gaze = () => p.evaluate(() => window.__table.gaze())
const r = {}
// turn the head by dragging on the table (left button), away from the default
await p.mouse.move(500, 300); await p.mouse.down(); await p.mouse.move(250, 380, { steps: 12 }); await p.mouse.up()
await sleep(1500)
const before = await gaze()
r.before = before
// right-click zoom somewhere else, pan while held, let go
await p.mouse.move(900, 250); await p.mouse.down({ button: 'right' }); await sleep(900)
await p.mouse.move(980, 200, { steps: 8 }); await sleep(600)
const zoomed = await gaze()
await p.mouse.up({ button: 'right' }); await sleep(2200)
const after = await gaze()
r.zoomed = zoomed
r.after = after
r.err = Math.hypot(after.yaw - before.yaw, after.pitch - before.pitch)
r.zoomMoved = Math.hypot(zoomed.yaw - before.yaw, zoomed.pitch - before.pitch) > 0.05
console.log(JSON.stringify(r))
const ok = r.err < 0.01 && r.zoomMoved && Math.abs(before.yaw) > 0.05
console.log(ok ? 'PASS' : 'FAIL')
await b.close(); host.disconnect(); process.exit(ok ? 0 : 1)
