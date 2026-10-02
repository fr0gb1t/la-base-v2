// With the table guides off, the chalked number of bases asked shows only while the pointer is
// over that bean heap. Usage: node e2e/asked.hover.mjs <out-prefix>
import puppeteer from 'puppeteer-core'
import { io } from 'socket.io-client'
const out = process.argv[2] ?? '/tmp/wheel'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const host = io('http://localhost:3000', { transports: ['websocket'] })
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
await p.goto('http://localhost:5173/?debug=1', { waitUntil: 'domcontentloaded' }); await sleep(2000)
await p.evaluate(() => { localStorage.clear(); localStorage.setItem('guestName', 'Vos'); localStorage.setItem('laBase.view', JSON.stringify({ guides: false })) })
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
await p.evaluate(() => {
  const t = window.__table
  const ids = t.players.map((x) => x.id); const me = ids.indexOf(t.myId)
  const at = (k) => ids[(me + k) % ids.length]
  t.setTokens({ dealerId: at(1), bidderId: at(0), bids: [{ playerId: at(0), value: 3, won: 2 }], kamikazeIds: [] }) // I asked 3, hold 2 beans
  t.pitchT = -0.62
})
await sleep(1200)
await p.mouse.move(150, 150); await sleep(700)
const away = await p.evaluate(() => window.__table.heapsScreen())
await p.screenshot({ path: `${out}-away.png` })
const h = away[0]
await p.mouse.move(h.x, h.y, { steps: 6 }); await sleep(700)
const over = await p.evaluate(() => window.__table.heapsScreen())
await p.screenshot({ path: `${out}-over.png` })
await p.mouse.move(150, 150); await sleep(700)
const left = await p.evaluate(() => window.__table.heapsScreen())
const r = { hiddenAway: !away[0].shown, shownOver: over[0].shown, hiddenAgain: !left[0].shown }
console.log(JSON.stringify(r))
const ok = r.hiddenAway && r.shownOver && r.hiddenAgain
console.log(ok ? 'PASS' : 'FAIL')
await b.close(); host.disconnect(); process.exit(ok ? 0 : 1)
