// The dragged card must follow the cursor (free mouse) and play when released on your zone.
// Usage: node e2e/drag.follow.mjs <out-prefix>
import puppeteer from 'puppeteer-core'
import { io } from 'socket.io-client'
const out = process.argv[2] ?? '/tmp/drag'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const host = io('http://localhost:3000', { transports: ['websocket'] })
await new Promise((r) => host.on('connect', r))
const emit = (ev, p) => new Promise((r) => host.emit(ev, p, r))
const room = (await emit('room:create', { playerName: 'Host', playerCount: 4 })).roomCode
host.on('player:hand', (d) => (host.hand = d.hand))
host.on('game:state', async (st) => {
  if (st.readyGate && !st.readyGate.readyPlayerIds.includes(host.id)) await emit('game:ready', { roomCode: room })
  if (st.phase === 'initial_draw' && st.initialDraw?.currentDrawerPlayerId === host.id) await emit('draw:initialCard', { roomCode: room })
  if (st.phase === 'bidding' && st.currentBidPlayerId === host.id) { const max = st.structureSequence[st.roundIndex]; const v = [0, 1, 2, 3].find((x) => x <= max && (st.bids.length === 0 || st.bids[0].value + x !== max)); await emit('bid:declare', { roomCode: room, bidValue: v }) }
  if (st.phase === 'playing' && st.currentTurnPlayerId === host.id && host.hand?.length) await emit('card:play', { roomCode: room, card: host.hand[0] })
})
const b = await puppeteer.launch({ executablePath: '/usr/bin/chromium', headless: 'new', args: ['--use-angle=vulkan', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'], defaultViewport: { width: 1280, height: 720 } })
const p = await b.newPage()
await p.goto('http://localhost:5173/?debug=1', { waitUntil: 'networkidle0' })
await p.evaluate(() => { localStorage.clear(); localStorage.setItem('guestName', 'Vos') })
await p.reload({ waitUntil: 'networkidle0' })
const click = (t) => p.evaluate((t) => { const x = [...document.querySelectorAll('button')].find((e) => e.textContent.trim().toLowerCase().startsWith(t) && !e.disabled); x?.click(); return !!x }, t)
await sleep(1500); await click('sentarse'); await sleep(1200)
await p.keyboard.type(room); await click('sentarse'); await sleep(1000)
await emit('room:addBot', { roomCode: room }); await emit('room:addBot', { roomCode: room }); await sleep(800)
await emit('game:config', { roomCode: room, structure: 'postpandemia', acePowers: { espadas: false, copas: false, oros: false }, kamikazesPerTeam: 2 })
await emit('game:start', { roomCode: room })
let result = 'FAIL: never got a turn'
for (let i = 0; i < 300; i++) {
  await sleep(400)
  const ui = await p.evaluate(() => ({ phase: document.querySelector('.phase-line')?.textContent?.toLowerCase() ?? '', t: window.__table?.debugState?.() }))
  if (ui.phase.includes('mazo del centro')) { const d = await p.evaluate(() => window.__table.deckScreen()); await p.mouse.click(d.x, d.y) }
  if (ui.phase.includes('te toca declarar')) await p.evaluate(() => document.querySelector('.tally .stamp-btn')?.click())
  if (await p.$('.gate-panel button:not([disabled])')) await p.evaluate(() => document.querySelector('.gate-panel button:not([disabled])')?.click())
  if (ui.t?.canPlay && ui.t.queued === 0 && ui.phase.includes('tu turno')) {
    // wait until the fan has settled (it lowers/raises after dealing and playing)
    let c = await p.evaluate(() => window.__table.vmScreen(0))
    for (let k = 0; k < 20; k++) {
      await sleep(150)
      const n = await p.evaluate(() => window.__table.vmScreen(0))
      const still = Math.hypot(n.x - c.x, n.y - c.y) < 1
      c = n
      if (still) break
    }
    const z = await p.evaluate(() => window.__table.zoneScreen(0))
    await p.mouse.move(c.x, c.y); await sleep(250)
    await p.mouse.down(); await sleep(260) // hold → your arm takes the card
    const post = await p.evaluate(() => window.__table.debugState())
    if (!post.dragging) console.log('NO DRAG after hold', JSON.stringify(post))
    const errs = []
    const steps = 24
    for (let s = 1; s <= steps; s++) {
      const x = c.x + (z.x - c.x) * (s / steps), y = c.y + (z.y - c.y) * (s / steps)
      await p.mouse.move(x, y); await sleep(40)
      if (s % 6 === 0) {
        await sleep(250)
        const d = await p.evaluate(() => window.__table.dragScreen())
        const e = d ? Math.round(Math.hypot(d.x - x, d.y - y)) : -1
        errs.push(e)
        if (s === steps) await p.screenshot({ path: `${out}-over-zone.png` })
      }
    }
    await p.mouse.up(); await sleep(1500)
    const played = await p.evaluate(() => window.__table.debugState().onTable)
    const follows = errs.slice(1).every((e) => e >= 0 && e < 45) // first sample may still be leaving the hand
    console.log('cursor→card distance (px) along the drag:', errs.join(', '), '| cards on table after release:', played)
    result = follows && played >= 1 ? 'PASS' : 'FAIL'
    break
  }
}
console.log(result)
await b.close(); host.disconnect(); process.exit(result === 'PASS' ? 0 : 1)
