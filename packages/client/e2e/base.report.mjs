// The BASE report on the notepad (read from your seat, narrower zoom), the tick pressed, the pencil writes it. Usage: node e2e/base.report.mjs <out-prefix> [players]
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
    if (st.readyGate && !st.readyGate.readyPlayerIds.includes(sock.id)) { if (st.readyGate.kind === 'base') await sleep(5000) } 
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
let seen = false
for (let i = 0; i < 400 && !seen; i++) {
  await sleep(250); me ??= await p.evaluate(() => window.__table?.myId ?? null)
  const t = await p.evaluate(() => ({ s: window.__table?.debugState(), ph: document.querySelector('.phase-line')?.textContent?.toLowerCase() ?? '' }))
  if (t.ph.includes('mazo del centro')) { const d = await p.evaluate(() => window.__table.deckScreen()); await p.mouse.click(d.x, d.y) }
  if (host.state?.phase === 'bidding' && host.state.currentBidPlayerId === me) { await p.evaluate(() => [...document.querySelectorAll('.tally-num')].filter((x) => !x.disabled)[0]?.click()); await sleep(200); await p.evaluate(() => [...document.querySelectorAll('button')].find((e) => /^pedir \d/i.test(e.textContent.trim()) && !e.disabled)?.click()) }
  if (host.state?.readyGate?.kind === 'round') await p.evaluate(() => document.querySelector('.gate-panel button:not([disabled])')?.click())
  if (t.s?.canPlay && t.s.queued === 0) { const c = await p.evaluate(() => window.__table.vmScreen(0)); await p.mouse.move(c.x, c.y); await sleep(150); await p.mouse.down(); await sleep(50); await p.mouse.up() }
  seen = host.state?.readyGate?.kind === 'base' && (await p.evaluate(() => Boolean(document.querySelector('.gate-panel.on-notepad'))))
  if (i % 20 === 0) console.log(i, host.state?.phase, host.state?.readyGate?.kind, host.state?.currentBidPlayerId === me ? 'my bid' : '', t.s?.canPlay)
}
console.log('base report gate:', seen)
for (let k = 0; k < 14; k++) { await sleep(300); console.log('t+' + (k + 1) * 0.3, JSON.stringify(await p.evaluate(() => ({ f: +window.__table.padFocus.toFixed(2), t: window.__table.padFocusT, q: window.__table.debugState().queued, busy: window.__table.debugState().busy, pend: Boolean(window.__table.pendingReport) })))) }
console.log('focus', JSON.stringify(await p.evaluate(() => ({ f: window.__table.padFocus, t: window.__table.padFocusT, dbg: (({ queued, busy, running }) => ({ queued, busy, running }))(window.__table.debugState()) }))))
await p.screenshot({ path: `${out}-1-report.png` })
const t0 = Date.now()
for (let k = 0; k < 100 && (await p.evaluate(() => window.__table.padFocus)) < 0.97; k++) await sleep(200)
console.log('focus reached after (s):', (Date.now() - t0) / 1000, 'pending:', await p.evaluate(() => Boolean(window.__table.pendingReport)), JSON.stringify(await p.evaluate(() => { const d = window.__table.debugState(); return { q: d.queued, busy: d.busy, run: d.running } })))
const tk = await p.evaluate(() => window.__table.tickScreen())
await p.mouse.move(tk.x, tk.y); await sleep(500)
console.log('before click', JSON.stringify({ tk, hov: await p.evaluate(() => ({ h: window.__table.notepad.tickHovered, f: window.__table.padFocus, r: window.__table.notepad.ready() })) }))
await p.screenshot({ path: `${out}-2-hover.png` })
await p.mouse.down(); await sleep(40); await p.mouse.up()
for (let k = 0; k < 4; k++) { await sleep(130); await p.screenshot({ path: `${out}-3-writing${k}.png` }) }
await sleep(800)
await p.screenshot({ path: `${out}-4-done.png` })
console.log('I am ready:', host.state?.readyGate?.readyPlayerIds?.includes(me))
for (let i = 0; i < 40 && host.state?.readyGate; i++) { await sleep(250) }
await sleep(2500)
await p.screenshot({ path: `${out}-5-after.png` })
console.log('gate gone:', !host.state?.readyGate, errs.join('|') || 'no errors')
;[host, ...others].forEach((o) => o.sock.disconnect()); await b.close()
