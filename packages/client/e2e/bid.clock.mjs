// The bidding clock on the table: it counts down for the team that has to bid, you confirm your
// bid by pressing it, and played without time it reads "- / -".
// Needs the test server (3100, LABASE_TEST=1) and vite (5174). Usage: node e2e/bid.clock.mjs <out-prefix>
import puppeteer from 'puppeteer-core'
import { io } from 'socket.io-client'
const out = process.argv[2] ?? '/tmp/clock'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const b = await puppeteer.launch({ executablePath: '/usr/bin/chromium', headless: 'new', args: ['--use-angle=vulkan', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'], defaultViewport: { width: 1280, height: 720 } })
const r = {}

async function game(bidClockMs, tag) {
  // three quick players (no bot delays): they draw, bid, play and confirm at once
  const auto = async () => {
    const sock = io('http://localhost:3100', { transports: ['websocket'], forceNew: true })
    await new Promise((res) => sock.on('connect', res))
    const emit = (ev, p) => new Promise((res) => sock.emit(ev, p, res))
    const me = { sock, emit, hand: [], state: null }
    sock.on('player:hand', (d) => (me.hand = d.hand))
    sock.on('game:state', async (st) => {
      me.state = st
      const room = me.room
      if (st.readyGate && !st.readyGate.readyPlayerIds.includes(sock.id)) await emit('game:ready', { roomCode: room })
      if (st.phase === 'initial_draw' && st.initialDraw?.currentDrawerPlayerId === sock.id) await emit('draw:initialCard', { roomCode: room })
      if (st.phase === 'bidding' && st.currentBidPlayerId === sock.id) {
        const max = st.structureSequence[st.roundIndex]
        await emit('bid:declare', { roomCode: room, bidValue: [0, 1, 0, 1, 2, 3, 4, 5, 6].find((x) => x <= max && (st.bids.length === 0 || [max - 1, max + 1].includes(st.bids[0].value + x))), isKamikaze: false })
      }
      if (st.phase === 'playing' && st.currentTurnPlayerId === sock.id && me.hand.length) await emit('card:play', { roomCode: room, card: me.hand[0], copasDirection: 'mantener' })
      if (st.pendingOrosChoice?.chooserPlayerId === sock.id) await emit('ace:oros:choose', { roomCode: room, playerId: st.pendingOrosChoice.options[0] })
    })
    return me
  }
  const hostP = await auto()
  const host = hostP.sock
  const emit = hostP.emit
  const room = (await emit('room:create', { playerName: 'Host', playerCount: 4 })).roomCode
  hostP.room = room
  const others = [await auto(), await auto()]
  for (const [i, o] of others.entries()) {
    o.room = room
    await o.emit('room:join', { roomCode: room, playerName: ['Ana', 'Beto'][i] })
  }
  const state = () => hostP.state
  const p = await b.newPage()
  p.on('pageerror', (e) => console.log('PAGEERR', e.message))

  await p.goto('http://localhost:5174/?debug=1', { waitUntil: 'domcontentloaded' }); await sleep(1500)
  await p.evaluate(() => { localStorage.clear(); localStorage.setItem('guestName', 'Vos') })
  await p.reload({ waitUntil: 'domcontentloaded' }); await sleep(2500)
  const click = (t) => p.evaluate((t) => { const x = [...document.querySelectorAll('button')].find((e) => e.textContent.trim().toLowerCase().startsWith(t) && !e.disabled); x?.click(); return !!x }, t)
  await click('sentarse'); await sleep(1200); await p.keyboard.type(room); await click('sentarse'); await sleep(1000)
  await sleep(500)
  await emit('game:config', { roomCode: room, structure: 'clasica', acePowers: { espadas: true, copas: true, oros: true }, kamikazesPerTeam: 0, bidClockMs })
  await emit('game:start', { roomCode: room })
  for (let i = 0; i < 120; i++) {
    await sleep(300)
    const ph = await p.evaluate(() => document.querySelector('.phase-line')?.textContent?.toLowerCase() ?? '')
    if (ph.includes('mazo del centro')) { const d = await p.evaluate(() => window.__table.deckScreen()); await p.mouse.click(d.x, d.y) }
    if (state()?.phase === 'bidding' && state().bidClock?.running || (state()?.phase === 'bidding' && !bidClockMs && i > 20)) break
  }
  await sleep(1500)
  // look down at the clock in the middle
  await p.evaluate(() => { window.__table.pitchT = -0.62 })
  await sleep(900)
  await p.screenshot({ path: `${out}-${tag}.png` })
  return { host, emit, room, p, state, close: () => [hostP, ...others].forEach((o) => o.sock.disconnect()) }
}

// with 2 minutes each: it runs for whoever bids, and pressing it confirms the bid
{
  const g = await game(120_000, 'running')
  const me = await g.p.evaluate(() => window.__table.myId)
  r.running = g.state()?.bidClock?.running ?? null
  // play rounds (you play your card, confirm the gates) until it's your turn to bid
  for (let i = 0; i < 600 && !(g.state()?.phase === 'bidding' && g.state()?.currentBidPlayerId === me); i++) {
    await sleep(250)
    const t = await g.p.evaluate(() => ({ s: window.__table.debugState(), ph: document.querySelector('.phase-line')?.textContent?.toLowerCase() ?? '' }))
    if (t.s.canPlay && t.s.queued === 0 && t.ph.includes('tu turno')) { const c = await g.p.evaluate(() => window.__table.vmScreen(0)); await g.p.mouse.move(c.x, c.y); await sleep(150); await g.p.mouse.down(); await sleep(50); await g.p.mouse.up() }
    await g.p.evaluate(() => document.querySelector('.gate-panel button:not([disabled])')?.click())
  }
  r.myTurn = g.state()?.currentBidPlayerId === me
  if (!r.myTurn) r.stuck = { phase: g.state()?.phase, round: g.state()?.roundIndex, bidder: g.state()?.currentBidPlayerId === g.host.id ? 'host' : g.state()?.currentBidPlayerId, turn: g.state()?.currentTurnPlayerId === me ? 'me' : g.state()?.currentTurnPlayerId, gate: g.state()?.readyGate?.kind, ready: g.state()?.readyGate?.readyPlayerIds?.map((id) => id === me ? 'me' : id === g.host.id ? 'host' : 'bot'), btn: await g.p.evaluate(() => [...document.querySelectorAll('.gate-panel button')].map((b) => b.textContent + (b.disabled ? '(off)' : ''))), ui: await g.p.evaluate(() => ({ s: window.__table.debugState(), ph: document.querySelector('.phase-line')?.textContent })) }
  if (r.myTurn) {
    await sleep(800)
    await g.p.evaluate(() => [...document.querySelectorAll('.tally-num')].filter((x) => !x.disabled)[0]?.click())
    await sleep(300)
    await g.p.screenshot({ path: `${out}-mine.png` })
    const c = await g.p.evaluate(() => window.__table.clockScreen())
    await g.p.mouse.move(c.x, c.y); await sleep(250)
    r.hoverPress = await g.p.evaluate(() => ({ hovered: window.__table.clock.hovered, view: window.__table.clockView }))
    await g.p.mouse.down(); await sleep(60); await g.p.mouse.up()
    const mine = () => g.state().bids.some((b) => b.playerId === me) // the rival may answer at once
    for (let i = 0; i < 20 && !mine(); i++) await sleep(150)
    r.pressedBid = mine()
    if (!r.pressedBid) r.why = await g.p.evaluate(() => ({ err: document.querySelector('.tally-error')?.textContent, open: Boolean(document.querySelector('.tally')), nums: [...document.querySelectorAll('.tally-num')].map((b) => b.textContent + (b.disabled ? 'x' : '') + (b.classList.contains('on') ? '*' : '')) }))
  }
  await g.p.close(); g.close()
}
// without time: "- / -"
{
  const g = await game(0, 'off')
  r.offState = g.state()?.bidClock ?? null
  await g.p.close(); g.close()
}
console.log(JSON.stringify(r))
const ok = r.myTurn && r.pressedBid && r.offState === null
console.log(ok ? 'PASS' : 'FAIL')
await b.close(); process.exit(ok ? 0 : 1)
