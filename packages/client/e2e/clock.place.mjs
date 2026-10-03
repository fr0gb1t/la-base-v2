// Where the bidding clock sits (on your right, clear of beans and won piles), with 4 and 8 players,
// mid-round so the beans and won stacks are on the felt. Needs the test server (3100) + vite (5174).
// Usage: node e2e/clock.place.mjs <out-prefix>
import puppeteer from 'puppeteer-core'
import { io } from 'socket.io-client'
const out = process.argv[2] ?? '/tmp/clockplace'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const b = await puppeteer.launch({ executablePath: '/usr/bin/chromium', headless: 'new', args: ['--use-angle=vulkan', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'], defaultViewport: { width: 1280, height: 720, deviceScaleFactor: Number(process.env.DSF ?? 1) } })

async function auto(room) {
  const sock = io('http://localhost:3100', { transports: ['websocket'], forceNew: true })
  await new Promise((res) => sock.on('connect', res))
  const emit = (ev, p) => new Promise((res) => sock.emit(ev, p, res))
  const me = { sock, emit, hand: [], state: null, room }
  sock.on('player:hand', (d) => (me.hand = d.hand))
  sock.on('game:state', async (st) => {
    me.state = st
    const room = me.room
    if (st.readyGate && !st.readyGate.readyPlayerIds.includes(sock.id)) await emit('game:ready', { roomCode: room })
    if (st.phase === 'initial_draw' && st.initialDraw?.currentDrawerPlayerId === sock.id) await emit('draw:initialCard', { roomCode: room })
    if (st.phase === 'bidding' && st.currentBidPlayerId === sock.id) {
      await sleep(400)
      const max = st.structureSequence[st.roundIndex]
      await emit('bid:declare', { roomCode: room, bidValue: [1, 0, 0, 1, 2, 3, 4, 5, 6].find((x) => x <= max && (st.bids.length === 0 || [max - 1, max + 1].includes(st.bids[0].value + x))), isKamikaze: false })
    }
    if (st.phase === 'playing' && st.currentTurnPlayerId === sock.id && me.hand.length) { await sleep(300); await emit('card:play', { roomCode: room, card: me.hand[0], copasDirection: 'mantener' }) }
    if (st.pendingOrosChoice?.chooserPlayerId === sock.id) await emit('ace:oros:choose', { roomCode: room, playerId: st.pendingOrosChoice.options[0] })
  })
  return me
}

for (const n of (process.argv[3] ?? '4,8').split(',').map(Number)) {
  const host = await auto()
  const room = (await host.emit('room:create', { playerName: 'Host', playerCount: n })).roomCode
  host.room = room
  console.log('room', n, room)
  const others = []
  for (let i = 0; i < n - 2; i++) { const o = await auto(room); await o.emit('room:join', { roomCode: room, playerName: `P${i}` }); others.push(o) }
  const p = await b.newPage()
  p.on('pageerror', (e) => console.log('PAGEERR', e.message))
  p.on('console', (m) => m.text().startsWith('[hud]') && console.log(m.text()))
  await p.goto('http://localhost:5174/?debug=1', { waitUntil: 'domcontentloaded' }); await sleep(1500)
  await p.evaluate(() => { localStorage.clear(); localStorage.setItem('guestName', 'Vos') })
  await p.reload({ waitUntil: 'domcontentloaded' }); await sleep(2500)
  const click = (t) => p.evaluate((t) => { const x = [...document.querySelectorAll('button')].find((e) => e.textContent.trim().toLowerCase().startsWith(t) && !e.disabled); x?.click(); return !!x }, t)
  await click('sentarse'); await sleep(1200); await p.keyboard.type(room); await click('sentarse'); await sleep(1500)
  await host.emit('game:config', { roomCode: room, structure: 'clasica', acePowers: { espadas: true, copas: true, oros: true }, kamikazesPerTeam: 0, bidClockMs: 300_000 })
  await host.emit('game:start', { roomCode: room })
  let me = null
  let shotDraw = false
  // the initial draw (the clock must not cover those cards), then rounds until beans and won stacks lie on the felt
  for (let i = 0; i < 400; i++) {
    await sleep(250)
    const st = host.state
    me ??= await p.evaluate(() => window.__table?.myId ?? null)
    const t = await p.evaluate(() => ({ s: window.__table.debugState(), ph: document.querySelector('.phase-line')?.textContent?.toLowerCase() ?? '' }))
    if (t.ph.includes('mazo del centro')) { const d = await p.evaluate(() => window.__table.deckScreen()); await p.mouse.click(d.x, d.y) }
    if (!shotDraw && st?.phase === 'initial_draw' && (st.initialDraw?.drawn?.length ?? 0) >= n - 1) { await sleep(1200); await p.screenshot({ path: `${out}-${n}-draw.png` }); shotDraw = true }
    if (st?.phase === 'bidding' && st.currentBidPlayerId === me) { await p.evaluate(() => [...document.querySelectorAll('.tally-num')].filter((x) => !x.disabled)[0]?.click()); await sleep(200); await click('pedir') }
    if (t.s.canPlay && t.s.queued === 0 && t.ph.includes('tu turno')) { const c = await p.evaluate(() => window.__table.vmScreen(0)); await p.mouse.move(c.x, c.y); await sleep(150); await p.mouse.down(); await sleep(50); await p.mouse.up() }
    await p.evaluate(() => document.querySelector('.gate-panel button:not([disabled])')?.click())
    if (st?.phase === 'playing' && st.roundIndex >= 1 && t.s.queued === 0) break
  }
  console.log('state', host.state?.phase, host.state?.roundIndex, JSON.stringify(await p.evaluate(() => window.__table.clockScreen())))
  await sleep(1500)
  await p.screenshot({ path: `${out}-${n}-play.png` })
  const hb = await p.evaluate(() => window.__table.hudScreen('ajustes'))
  if (hb) { await p.mouse.move(hb.x, hb.y); await sleep(700); await p.screenshot({ path: `${out}-${n}-hud-hover.png` })
    await p.mouse.down(); await sleep(50); await p.mouse.up(); await sleep(600)
    console.log('slate click opens settings:', await p.evaluate(() => Boolean(document.querySelector('.settings-veil'))))
    await p.keyboard.press('Escape'); await sleep(300) }
  await p.evaluate(() => { window.__table.pitchT = -0.62 })
  await sleep(900)
  await p.screenshot({ path: `${out}-${n}-down.png` })
  await p.close()
  ;[host, ...others].forEach((o) => o.sock.disconnect())
}
await b.close()
