// The bid announcement (title card + sound). Usage: node e2e/pie.auto.mjs <out-prefix> [players]
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
let clicked = 0
let result = null
for (let i = 0; i < 1500 && !result; i++) {
  await sleep(100); me ??= await p.evaluate(() => window.__table?.myId ?? null)
  const t = await p.evaluate(() => ({ ph: document.querySelector('.phase-line')?.textContent?.toLowerCase() ?? '', panel: Boolean(document.querySelector('.tally')) }))
  if (t.ph.includes('mazo del centro')) { const d = await p.evaluate(() => window.__table.deckScreen()); await p.mouse.click(d.x, d.y) }
  const st = host.state
  if (st?.phase === 'bidding' && st.currentBidPlayerId === me) {
    const iAmPie = st.bids.length === 1
    if (iAmPie) {
      // the only legal answer is declared for me: wait for it with my hands off, and see whether a panel shows
      let sawPanel = false
      for (let k = 0; k < 40 && host.state?.bids.length === 1; k++) { await sleep(100); sawPanel ||= await p.evaluate(() => Boolean(document.querySelector('.tally'))) }
      result = { iWasPie: true, bids: host.state?.bids.map((b) => b.value), automatic: (host.state?.bids.length ?? 0) >= 2, sawPanel, clicked }
    } else { clicked++; await p.evaluate(() => [...document.querySelectorAll('.tally-num')].filter((x) => !x.disabled)[0]?.click()); await sleep(200); await p.evaluate(() => [...document.querySelectorAll('button')].find((e) => /^pedir \d/i.test(e.textContent.trim()) && !e.disabled)?.click()) }
  }
  await p.evaluate(() => document.querySelector('.gate-panel button:not([disabled])')?.click())
  const ts = await p.evaluate(() => window.__table?.debugState())
  if (ts?.canPlay && ts.queued === 0) { const c = await p.evaluate(() => window.__table.vmScreen(0)); await p.mouse.move(c.x, c.y); await sleep(150); await p.mouse.down(); await sleep(50); await p.mouse.up() }
}
console.log(JSON.stringify(result ?? { phase: host.state?.phase, round: host.state?.roundIndex, bids: host.state?.bids?.length, me, cur: host.state?.currentBidPlayerId, clicked }), errs.join('|') || 'no errors')
;[host, ...others].forEach((o) => o.sock.disconnect()); await b.close()
