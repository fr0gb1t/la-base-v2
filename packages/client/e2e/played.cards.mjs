// A full base on the table, from your seat, at the default view: every played card in sight, and
// how tall (px) the card across the table shows. Usage: node e2e/played.cards.mjs <N> <out-prefix>
import puppeteer from 'puppeteer-core'
import { io } from 'socket.io-client'
const N = Number(process.argv[2] ?? 4)
const out = process.argv[3] ?? '/tmp/played'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const host = io('http://localhost:3100', { transports: ['websocket'] })
await new Promise((r) => host.on('connect', r))
const emit = (ev, p) => new Promise((r) => host.emit(ev, p, r))
const room = (await emit('room:create', { playerName: 'Host', playerCount: N })).roomCode
host.on('player:hand', (d) => (host.hand = d.hand))
host.on('game:state', async (st) => {
  if (st.readyGate && !st.readyGate.readyPlayerIds.includes(host.id)) await emit('game:ready', { roomCode: room })
  if (st.phase === 'initial_draw' && st.initialDraw?.currentDrawerPlayerId === host.id) await emit('draw:initialCard', { roomCode: room })
  if (st.phase === 'bidding' && st.currentBidPlayerId === host.id) {
    const max = st.structureSequence[st.roundIndex]
    await emit('bid:declare', { roomCode: room, bidValue: [0, 1, 2].find((x) => x <= max && (st.bids.length < N - 1 || st.bids.reduce((a, b) => a + b.value, 0) + x !== max)), isKamikaze: false })
  }
  if (st.phase === 'playing' && st.currentTurnPlayerId === host.id && host.hand?.length) await emit('card:play', { roomCode: room, card: host.hand[0] })
})
const b = await puppeteer.launch({ executablePath: '/usr/bin/chromium', headless: 'new', args: ['--use-angle=vulkan', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'], defaultViewport: { width: 1280, height: 720 } })
const p = await b.newPage()
p.on('pageerror', (e) => console.log('PAGEERR', e.message))
await p.goto('http://localhost:5174/?debug=1', { waitUntil: 'domcontentloaded' }); await sleep(2000)
await p.evaluate(() => { localStorage.clear(); localStorage.setItem('guestName', 'Vos') })
await p.reload({ waitUntil: 'domcontentloaded' }); await sleep(2500)
const click = (t) => p.evaluate((t) => { const x = [...document.querySelectorAll('button')].find((e) => e.textContent.trim().toLowerCase().startsWith(t) && !e.disabled); x?.click(); return !!x }, t)
await click('sentarse'); await sleep(1200); await p.keyboard.type(room); await click('sentarse'); await sleep(1000)
for (let i = 0; i < N - 2; i++) await emit('room:addBot', { roomCode: room })
await sleep(800)
await emit('game:start', { roomCode: room })
let shot = false
let reach = 0
for (let i = 0; i < 300 && !shot; i++) {
  await sleep(300)
  const ui = await p.evaluate(() => ({ phase: document.querySelector('.phase-line')?.textContent?.toLowerCase() ?? '', t: window.__table?.debugState?.() }))
  if (ui.phase.includes('mazo del centro')) { const d = await p.evaluate(() => window.__table.deckScreen()); await p.mouse.click(d.x, d.y) }
  if (ui.phase.includes('te toca declarar')) await p.evaluate(() => { [...document.querySelectorAll('.tally-num')].filter((x) => !x.disabled)[0]?.click(); document.querySelector('.tally .stamp-btn')?.click() })
  if (ui.t?.canPlay && ui.t.queued === 0 && ui.phase.includes('tu turno')) { const c = await p.evaluate(() => window.__table.vmScreen(0)); await p.mouse.move(c.x, c.y); await sleep(200); await p.mouse.down(); await sleep(50); await p.mouse.up() }
  // an arm reaching to the play ring (a bot playing): it must touch its card
  if (reach < 3 && ui.t?.queued > 0 && ui.t.onTable < N && ui.t.onTable > 0) { await sleep(500 + reach * 150); await p.screenshot({ path: `${out}-${N}-reach${reach++}.png` }) }
  if (ui.t?.onTable === N) {
    await p.mouse.move(640, 200)
    await p.evaluate(() => document.querySelectorAll('.gate-panel,.hud,.phase-line,.announce,.pad').forEach((e) => (e.style.visibility = 'hidden')))
    await sleep(300)
    const across = await p.evaluate((s) => window.__table.cardHeightPx(s), N / 2)
    await p.screenshot({ path: `${out}-${N}.png` })
    console.log(`N=${N} card across: ${across.toFixed(1)} px tall`)
    shot = true
  }
}
if (!shot) console.log('no full base seen')
await b.close(); host.disconnect(); process.exit(shot ? 0 : 1)
