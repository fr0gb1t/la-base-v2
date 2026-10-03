// The anotador: the notepad on the table, and the sheet that opens when it is clicked. Usage: node e2e/anotador.shots.mjs <out-prefix>
import puppeteer from 'puppeteer-core'
import { io } from 'socket.io-client'
const out = process.argv[2] ?? '/tmp/ano'
const N = Number(process.argv[3] ?? 4)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const b = await puppeteer.launch({ executablePath: '/usr/bin/chromium', headless: 'new', args: ['--use-angle=vulkan', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'], defaultViewport: { width: 1280, height: 720 } })
async function auto() {
  const sock = io('http://localhost:3100', { transports: ['websocket'], forceNew: true })
  await new Promise((res) => sock.on('connect', res))
  const emit = (ev, p) => new Promise((res) => sock.emit(ev, p, res))
  const me = { sock, emit, hand: [], state: null }
  sock.on('player:hand', (d) => (me.hand = d.hand))
  sock.on('game:state', async (st) => {
    me.state = st; const room = me.room
    if (st.readyGate && !st.readyGate.readyPlayerIds.includes(sock.id)) await emit('game:ready', { roomCode: room })
    if (st.phase === 'initial_draw' && st.initialDraw?.currentDrawerPlayerId === sock.id) await emit('draw:initialCard', { roomCode: room })
    if (st.phase === 'bidding' && st.currentBidPlayerId === sock.id) { await sleep(400); const max = st.structureSequence[st.roundIndex]; await emit('bid:declare', { roomCode: room, bidValue: [1, 0, 0, 1, 2, 3, 4, 5, 6].find((x) => x <= max && (st.bids.length === 0 || [max - 1, max + 1].includes(st.bids[0].value + x))), isKamikaze: false }) }
    if (st.phase === 'playing' && st.currentTurnPlayerId === sock.id && me.hand.length) { await sleep(300); await emit('card:play', { roomCode: room, card: me.hand[0], copasDirection: 'mantener' }) }
    if (st.pendingOrosChoice?.chooserPlayerId === sock.id) await emit('ace:oros:choose', { roomCode: room, playerId: st.pendingOrosChoice.options[0] })
  })
  return me
}
const host = await auto(); const room = (await host.emit('room:create', { playerName: 'Host', playerCount: N })).roomCode; host.room = room
const others = []; for (let i = 0; i < N - 2; i++) { const o = await auto(); o.room = room; await o.emit('room:join', { roomCode: room, playerName: `P${i}` }); others.push(o) }
const p = await b.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message))
await p.goto('http://localhost:5174/?debug=1', { waitUntil: 'domcontentloaded' }); await sleep(1500)
await p.evaluate(() => { localStorage.clear(); localStorage.setItem('guestName', 'Vos') }); await p.reload({ waitUntil: 'domcontentloaded' }); await sleep(2500)
const click = (t) => p.evaluate((t) => { const x = [...document.querySelectorAll('button')].find((e) => e.textContent.trim().toLowerCase().startsWith(t) && !e.disabled); x?.click() }, t)
await click('sentarse'); await sleep(1200); await p.keyboard.type(room); await click('sentarse'); await sleep(1500)
await host.emit('game:config', { roomCode: room, structure: 'clasica', acePowers: { espadas: true, copas: true, oros: true }, kamikazesPerTeam: 2, bidClockMs: 0 })
await host.emit('game:start', { roomCode: room })
let me = null
for (let i = 0; i < 300; i++) {
  await sleep(250); me ??= await p.evaluate(() => window.__table?.myId ?? null)
  const t = await p.evaluate(() => ({ s: window.__table?.debugState(), ph: document.querySelector('.phase-line')?.textContent?.toLowerCase() ?? '' }))
  if (t.ph.includes('mazo del centro')) { const d = await p.evaluate(() => window.__table.deckScreen()); await p.mouse.click(d.x, d.y) }
  if (host.state?.phase === 'bidding' && host.state.currentBidPlayerId === me) { await p.evaluate(() => [...document.querySelectorAll('.tally-num')].filter((x) => !x.disabled)[0]?.click()); await sleep(200); await click('pedir') }
  await p.evaluate(() => document.querySelector('.gate-panel button:not([disabled])')?.click())
  if (host.state?.phase === 'playing' && host.state.roundIndex >= 1) break
}
await sleep(1500)
const np = await p.evaluate(() => window.__table.notepadScreen())
await p.mouse.move(np.x, np.y); await sleep(500)
await p.screenshot({ path: `${out}-1-table.png` })
await p.mouse.down({ button: 'right' }); await sleep(1300)
await p.screenshot({ path: `${out}-1b-zoom.png` })
await p.mouse.up({ button: 'right' }); await sleep(1000)
await p.mouse.down(); await sleep(50); await p.mouse.up(); await sleep(300)
await p.screenshot({ path: `${out}-3-open.png` })
const fits = await p.evaluate(() => { const e = document.querySelector('.anotador-sheet'); return e ? { scroll: e.scrollHeight, client: e.clientHeight, cut: e.scrollHeight > e.clientHeight + 1 } : null })
console.log('fits without scrolling:', JSON.stringify(fits))
await p.evaluate(() => document.querySelector('.anotador-mode')?.click()); await sleep(250)
await p.screenshot({ path: `${out}-4-short.png` })
console.log('sheet open:', await p.evaluate(() => Boolean(document.querySelector('.anotador-sheet'))))
await p.keyboard.press('Escape'); await sleep(400)
console.log('closed with Esc:', await p.evaluate(() => !document.querySelector('.anotador-sheet')))
await p.keyboard.press('h'); await sleep(400)
console.log('H opens it:', await p.evaluate(() => Boolean(document.querySelector('.anotador-sheet'))), errs.join('|') || 'no errors')
;[host, ...others].forEach((o) => o.sock.disconnect()); await b.close()
