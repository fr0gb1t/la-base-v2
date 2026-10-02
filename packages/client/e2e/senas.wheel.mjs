// Middle-click seña wheel: hold, aim, release → the others receive it. Usage: node e2e/senas.wheel.mjs <out-prefix>
import puppeteer from 'puppeteer-core'
import { io } from 'socket.io-client'
import { gazeToward } from '@la-base/shared'
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
// the host keeps looking at my face, so my señas reach them even if they are a rival
const roster = await p.evaluate(() => window.__table.players.map((x) => x.id))
const meId = await p.evaluate(() => window.__table.myId)
const hostLook = gazeToward(roster.indexOf(host.id), roster.indexOf(meId), roster.length)
const looking = setInterval(() => host.emit('presence:look', { roomCode: room, ...hostLook }), 200)
await sleep(600)
const results = {}
// 1) hold the middle button, aim at 'tres', release
await p.mouse.move(640, 360)
await p.mouse.down({ button: 'middle' })
await sleep(300)
const tresAt = (5 / 9) * Math.PI * 2 // 'tres' is the 6th of 9 items, clockwise from the top
await p.mouse.move(640 + Math.sin(tresAt) * 118, 360 - Math.cos(tresAt) * 118, { steps: 6 })
await sleep(300)
await p.screenshot({ path: `${out}-held.png` })
results.hubWhileHeld = await p.evaluate(() => document.querySelector('.sena-hub')?.textContent)
await p.mouse.up({ button: 'middle' })
await sleep(500)
results.closedAfterRelease = await p.evaluate(() => !document.querySelector('.sena-wheel'))
// 2) G key + digit
await sleep(800)
await p.keyboard.press('g'); await sleep(300)
results.openedWithG = await p.evaluate(() => !!document.querySelector('.sena-wheel'))
await p.screenshot({ path: `${out}-g.png` })
await p.keyboard.press('7'); await sleep(500) // 7 = dos
results.status = await p.evaluate(() => document.querySelector('.phase-line')?.textContent)
results.received = got.filter((d) => d.playerId === meId).map((d) => d.sena)
console.log(JSON.stringify(results, null, 1))
const ok = results.closedAfterRelease && results.openedWithG && results.received[0] === 'tres' && results.received[1] === 'dos'
clearInterval(looking)
console.log(ok ? 'PASS' : 'FAIL')
await b.close(); host.disconnect(); process.exit(ok ? 0 : 1)
