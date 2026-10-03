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
// hover at the pad's edge must not flicker: find the edge, then watch it
{
  await p.mouse.move(np.x, np.y); await sleep(400)
  let x = np.x
  for (; x > np.x - 200; x -= 1) { await p.mouse.move(x, np.y); await sleep(8); if (!(await p.evaluate(() => window.__table.notepad.hovered))) break }
  const flips = []
  let last = null
  for (let i = 0; i < 90; i++) { await p.mouse.move(x + 1.5, np.y); await sleep(16); const h = await p.evaluate(() => window.__table.notepad.hovered); if (h !== last) { flips.push(i); last = h } }
  console.log('hover changes at the edge over 90 frames:', flips.length, '(1 = steady)')
  await p.mouse.move(np.x, np.y + 200); await sleep(400)
}
// three finished reports (a base, a base, a round) are left in the pad as pages
await p.evaluate(() => {
  const mk = (kind, title, n) => ({ kind, title, lastBase: 'La gana Host (rivales) con rey de espadas', standings: [{ text: `Tu equipo lleva ${n} (pidió 1)`, mine: true }, { text: 'Rivales llevan 0 (pidieron 1)', mine: false }], totals: { mine: n, rival: -1 }, rows: kind === 'round' ? [{ label: 'Tu equipo', asked: '1', won: 1, met: true, pts: '+11', total: 11, mine: true }, { label: 'Rivales', asked: '1', won: 0, met: false, pts: '-1', total: -1, mine: false }] : [], players: [{ name: 'Host', ready: true, mine: true }, { name: 'P0', ready: true, mine: false }], ready: false })
  for (const r of [mk('base', 'Base 1 de 3', 1), mk('base', 'Base 2 de 3', 2), mk('round', 'Ronda 1 terminada', 3)]) { window.__table.notepad.setReport(r); window.__table.notepad.setReport(null) }
})
await sleep(400)
console.log('pages', JSON.stringify(await p.evaluate(() => window.__table.notepadPages())))
await p.mouse.move(np.x, np.y); await sleep(300)
await p.mouse.down()
for (let i = 1; i <= 8; i++) { await p.mouse.move(np.x, np.y - i * 12); await sleep(40); if (i === 3 || i === 5 || i === 7) await p.screenshot({ path: `${out}-1c-flipping${i}.png` }) }
await sleep(100)
await p.mouse.up(); await sleep(1200)
console.log('after the flip', JSON.stringify(await p.evaluate(() => window.__table.notepadPages())))
await p.screenshot({ path: `${out}-1d-flipped.png` })
const pile = await p.evaluate(() => { const t = window.__table; const v = t.notepad.pile.getWorldPosition(t.camera.position.clone()).project(t.camera); const r = t.renderer.domElement.getBoundingClientRect(); return { x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height } })
console.log('grabbing the turned leaves at', JSON.stringify(pile))
await p.mouse.move(pile.x, pile.y); await sleep(300)
await p.mouse.down()
for (let i = 1; i <= 8; i++) { await p.mouse.move(pile.x, pile.y + i * 12); await sleep(40); if (i === 4) await p.screenshot({ path: `${out}-1e-back.png` }) }
await p.mouse.up(); await sleep(1200)
console.log('flipped back', JSON.stringify(await p.evaluate(() => window.__table.notepadPages())))
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
