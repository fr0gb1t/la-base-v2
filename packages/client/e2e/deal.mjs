// The deal: cards face down on the table in front of each player, then all picked up at once; the clock starts a second later. Usage: node e2e/deal.mjs <out-prefix> [players]
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
await host.emit('game:config', { roomCode: room, structure: 'clasica', acePowers: { espadas: true, copas: true, oros: true }, kamikazesPerTeam: 2, bidClockMs: 300_000 })
await host.emit('game:start', { roomCode: room })
let me = null
let t0 = null
let sawBusy = false
let tEnd = null
const shots = []
for (let i = 0; i < 400; i++) {
  await sleep(40); me ??= await p.evaluate(() => window.__table?.myId ?? null)
  const t = await p.evaluate(() => ({ ph: document.querySelector('.phase-line')?.textContent?.toLowerCase() ?? '', s: window.__table?.debugState() }))
  if (t.ph.includes('mazo del centro')) { const d = await p.evaluate(() => window.__table.deckScreen()); await p.mouse.click(d.x, d.y) }
  if (host.state?.phase === 'bidding' && t0 === null) t0 = Date.now()
  if (t0 !== null && t.s) { if (t.s.queued > 0) sawBusy = true; if (sawBusy && t.s.queued === 0 && tEnd === null) tEnd = Date.now() }
  if (t0 !== null) {
    const dt = (Date.now() - t0) / 1000
    for (const mark of [2.0, 3.2, 4.2, 5.2, 6.2]) if (dt >= mark && !shots.includes(mark)) { shots.push(mark); await p.screenshot({ path: `${out}-t${mark}.png` }); console.log('t+' + mark, 'clock running:', host.state?.bidClock?.running ?? null, 'queued', t.s?.queued, 'running', t.s?.running) }
    if (dt > 8) break
  }
}
const dt = await p.evaluate(() => window.__table.dealTimes)
console.log('animation ended at t+', tEnd ? (tEnd - t0) / 1000 : null, ' clock started at t+', host.state?.bidClock?.since ? (host.state.bidClock.since - t0) / 1000 : null)
console.log('client deal ms:', JSON.stringify(dt), 'server clock started:', host.state?.bidClock?.running, errs.join('|') || 'no errors')
;[host, ...others].forEach((o) => o.sock.disconnect()); await b.close()
