// With the table guides off: your spot is still chalked in on your turn. Usage: node e2e/zone.guides.mjs <out-prefix>
import puppeteer from 'puppeteer-core'
import { io } from 'socket.io-client'
const out = process.argv[2] ?? '/tmp/tokens'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const host = io('http://localhost:3100', { transports: ['websocket'] })
await new Promise((r) => host.on('connect', r))
const emit = (ev, p) => new Promise((r) => host.emit(ev, p, r))
const room = (await emit('room:create', { playerName: 'Host', playerCount: 4 })).roomCode
host.on('player:hand', (d) => (host.hand = d.hand))
host.on('game:state', async (st) => {
  if (st.readyGate && !st.readyGate.readyPlayerIds.includes(host.id)) await emit('game:ready', { roomCode: room })
  if (st.phase === 'initial_draw' && st.initialDraw?.currentDrawerPlayerId === host.id) await emit('draw:initialCard', { roomCode: room })
  if (st.phase === 'bidding' && st.currentBidPlayerId === host.id) {
    const max = st.structureSequence[st.roundIndex]
    const kami = st.bids.length === 0 && st.kamikazesRemaining && (st.kamikazeCalls ?? []).length === 0
    await emit('bid:declare', { roomCode: room, bidValue: kami ? max : [2, 1, 3, 0, 0, 1, 2, 3, 4, 5, 6].find((x) => x <= max && (st.bids.length === 0 || [max - 1, max + 1].includes(st.bids[0].value + x))), isKamikaze: Boolean(kami) })
  }
  if (st.phase === 'playing' && st.currentTurnPlayerId === host.id && host.hand?.length) await emit('card:play', { roomCode: room, card: host.hand[0] })
})
const b = await puppeteer.launch({ executablePath: '/usr/bin/chromium', headless: 'new', args: ['--use-angle=vulkan', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'], defaultViewport: { width: 1280, height: 720 } })
const p = await b.newPage()
await p.goto('http://localhost:5174/?debug=1', { waitUntil: 'domcontentloaded' }); await sleep(2000)
await p.evaluate(() => { localStorage.clear(); localStorage.setItem('guestName', 'Vos'); localStorage.setItem('laBase.view', JSON.stringify({ guides: false })) })
await p.reload({ waitUntil: 'domcontentloaded' }); await sleep(2500)
const click = (t) => p.evaluate((t) => { const x = [...document.querySelectorAll('button')].find((e) => e.textContent.trim().toLowerCase().startsWith(t) && !e.disabled); x?.click(); return !!x }, t)
await click('sentarse'); await sleep(1200); await p.keyboard.type(room); await click('sentarse'); await sleep(1000)
await emit('room:addBot', { roomCode: room }); await emit('room:addBot', { roomCode: room }); await sleep(800)
await emit('game:config', { roomCode: room, structure: 'clasica', acePowers: { espadas: true, copas: true, oros: true }, kamikazesPerTeam: 2 })
await emit('game:start', { roomCode: room })
let n = 0
for (let i = 0; i < 400; i++) {
  await sleep(400)
  const ui = await p.evaluate(() => ({ phase: document.querySelector('.phase-line')?.textContent?.toLowerCase() ?? '', t: window.__table?.debugState?.(), round: window.__table ? document.querySelector('.pad-head')?.textContent : '' }))
  if (ui.phase.includes('mazo del centro')) { const d = await p.evaluate(() => window.__table.deckScreen()); await p.mouse.click(d.x, d.y) }
  if (ui.phase.includes('te toca declarar')) await p.evaluate(() => { [...document.querySelectorAll('.tally-num')].filter((x) => !x.disabled).slice(-1)[0]?.click(); document.querySelector('.tally .stamp-btn')?.click() })
  if (await p.$('.gate-panel button:not([disabled])')) {
    if (false) {
      await p.evaluate(() => { const t = window.__table; t.pitchT = -0.78; t.handOffsetT = -0.2; document.querySelectorAll('.gate-panel,.hud,.phase-line,.announce').forEach((e) => (e.style.visibility = 'hidden')) })
      await sleep(1500)
      await p.screenshot({ path: `${out}-${n++}.png` })
      await p.evaluate(() => document.querySelectorAll('.gate-panel,.hud,.phase-line').forEach((e) => (e.style.visibility = '')))
    }
    await p.evaluate(() => document.querySelector('.gate-panel button:not([disabled])')?.click())
  }
  if (ui.t?.canPlay && ui.t.queued === 0 && ui.phase.includes('tu turno')) {
    await p.evaluate(() => { window.__table.pitchT = -0.6 }); await sleep(900)
    await p.screenshot({ path: `${out}-turn.png` })
    const c = await p.evaluate(() => window.__table.vmScreen(0)); const z = await p.evaluate(() => window.__table.zoneScreen(0))
    await p.mouse.move(c.x, c.y); await sleep(200); await p.mouse.down(); await sleep(400)
    await p.mouse.move(z.x, z.y, { steps: 12 }); await sleep(600)
    await p.screenshot({ path: `${out}-over.png` })
    await p.mouse.up(); n = 9; break
  }
  if (n >= 3) break
}
console.log('shots', n)
await b.close(); host.disconnect(); process.exit(0)
