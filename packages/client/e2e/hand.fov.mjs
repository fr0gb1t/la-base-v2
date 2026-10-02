// Your hand looks the same at any field of view (the viewmodel is rescaled): the cards land on the
// same pixels at 50° and at 63°/80°. Needs LABASE_TEST=1 on the test server (test:rig).
// Usage: node e2e/hand.fov.mjs <out-prefix>
import puppeteer from 'puppeteer-core'
import { io } from 'socket.io-client'
const out = process.argv[2] ?? '/tmp/hand-fov'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const host = io('http://localhost:3100', { transports: ['websocket'] })
await new Promise((r) => host.on('connect', r))
const emit = (ev, p) => new Promise((r) => host.emit(ev, p, r))
const room = (await emit('room:create', { playerName: 'Host', playerCount: 4 })).roomCode
host.on('game:state', async (st) => { if (st.phase === 'initial_draw' && st.initialDraw?.currentDrawerPlayerId === host.id) await emit('draw:initialCard', { roomCode: room }) })
const b = await puppeteer.launch({ executablePath: '/usr/bin/chromium', headless: 'new', args: ['--use-angle=vulkan', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'], defaultViewport: { width: 1280, height: 720 } })
const p = await b.newPage()
p.on('pageerror', (e) => console.log('PAGEERR', e.message))
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
  if (/declar|pide/.test(ph)) break
}
await sleep(4000)
const meId = await p.evaluate(() => window.__table.myId)
await emit('test:rig', { roomCode: room, hands: { [meId]: [{ suit: 'oros', value: 12 }, { suit: 'copas', value: 4 }, { suit: 'espadas', value: 7 }] } })
await sleep(1200)
const at = {}
for (const fov of [63, 50, 80]) {
  await p.evaluate((fov) => window.__view.set({ fov }), fov)
  await sleep(1500)
  console.log(fov, 'camera fov', await p.evaluate(() => window.__table.camera.fov))
  at[fov] = await p.evaluate(() => [0, 1, 2].map((k) => window.__table.vmScreen(k)).map((q) => [Math.round(q.x), Math.round(q.y)]))
  await p.screenshot({ path: `${out}-${fov}.png` })
}
console.log(JSON.stringify(at))
const same = (a, c) => a.every((q, i) => Math.abs(q[0] - c[i][0]) <= 14 && Math.abs(q[1] - c[i][1]) <= 14) // the hand sways a little
const ok = same(at[50], at[63]) && same(at[50], at[80])
console.log(ok ? 'PASS' : 'FAIL')
await b.close(); host.disconnect(); process.exit(ok ? 0 : 1)
