// A game on a phone: layout in landscape, then the touch gestures (tap, drag, two-finger swipe,
// three-finger tap zoom, gyroscope). Usage: node e2e/mobile.game.mjs <out-prefix> (vite 5174, test server 3100)
import puppeteer from 'puppeteer-core'
import { io } from 'socket.io-client'
const out = process.argv[2] ?? '/tmp/mobg'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const b = await puppeteer.launch({ executablePath: '/usr/bin/chromium', headless: 'new', args: ['--use-angle=vulkan', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/126 Mobile Safari/537.36'
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
    if (st.phase === 'bidding' && st.currentBidPlayerId === sock.id) { await sleep(400); const max = st.structureSequence[st.roundIndex]; await emit('bid:declare', { roomCode: room, bidValue: [1, 0].find((x) => x <= max && (st.bids.length === 0 || st.bids[0].value + x !== max)), isKamikaze: false }) }
    if (st.phase === 'playing' && st.currentTurnPlayerId === sock.id && me.hand.length) { await sleep(300); await emit('card:play', { roomCode: room, card: me.hand[0], copasDirection: 'mantener' }) }
    if (st.pendingOrosChoice?.chooserPlayerId === sock.id) await emit('ace:oros:choose', { roomCode: room, playerId: st.pendingOrosChoice.options[0] })
  })
  return me
}
const host = await auto(); const room = (await host.emit('room:create', { playerName: 'Host', playerCount: 4 })).roomCode; host.room = room
const others = []; for (let i = 0; i < 2; i++) { const o = await auto(room); await o.emit('room:join', { roomCode: room, playerName: `P${i}` }); others.push(o) }
const p = await b.newPage()
await p.emulate({ viewport: { width: 844, height: 390, deviceScaleFactor: 1, isMobile: true, hasTouch: true, isLandscape: true }, userAgent: UA })
const errs = []; p.on('pageerror', (e) => errs.push(e.message))
await p.goto('http://localhost:5174/?debug=1', { waitUntil: 'domcontentloaded' }); await sleep(1500)
await p.evaluate(() => { localStorage.clear(); localStorage.setItem('guestName', 'Vos') }); await p.reload({ waitUntil: 'domcontentloaded' }); await sleep(2500)
const tap = (t) => p.evaluate((t) => { const x = [...document.querySelectorAll('button')].find((e) => e.textContent.trim().toLowerCase().startsWith(t) && !e.disabled); x?.click(); return !!x }, t)
await tap('sentarse'); await sleep(1200); await p.keyboard.type(room); await tap('sentarse'); await sleep(1500)
await host.emit('game:config', { roomCode: room, structure: 'clasica', acePowers: { espadas: true, copas: true, oros: true }, kamikazesPerTeam: 0, bidClockMs: 300_000 })
await host.emit('game:start', { roomCode: room })
let me = null
for (let i = 0; i < 400; i++) {
  await sleep(250)
  me ??= await p.evaluate(() => window.__table?.myId ?? null)
  const t = await p.evaluate(() => ({ s: window.__table?.debugState(), ph: document.querySelector('.phase-line')?.textContent?.toLowerCase() ?? '' }))
  if (t.ph.includes('mazo del centro')) { const d = await p.evaluate(() => window.__table.deckScreen()); await p.touchscreen.tap(d.x, d.y) }
  if (host.state?.phase === 'bidding' && host.state.currentBidPlayerId === me) { await p.evaluate(() => [...document.querySelectorAll('.tally-num')].filter((x) => !x.disabled)[0]?.click()); await sleep(200); await tap('pedir') }
  await p.evaluate(() => document.querySelector('.gate-panel button:not([disabled])')?.click())
  if (host.state?.phase === 'playing' && t.s?.canPlay && t.s.queued === 0) break
}
await sleep(1500)
await p.screenshot({ path: `${out}-1-game.png` })
const state = () => p.evaluate(() => ({ hand: window.__table.handOffsetT, peek: Boolean(window.__table.peek), yawT: window.__table.yawT, pitchT: window.__table.pitchT, gyro: window.__table.gyroActive }))
const cdp = await p.createCDPSession()
const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y], i) => ({ x, y, id: i + 1 })) })
console.log('start', JSON.stringify(await state()))
// two-finger swipe up: the hand rises; down: it lowers
const y0 = 250
await touch('touchStart', [[300, y0], [360, y0]])
for (let i = 1; i <= 10; i++) { await touch('touchMove', [[300, y0 + i * 12], [360, y0 + i * 12]]); await sleep(16) }
await touch('touchEnd', []); await sleep(300)
const down = await state(); console.log('after swipe down', JSON.stringify(down))
await touch('touchStart', [[300, 250], [360, 250]])
for (let i = 1; i <= 16; i++) { await touch('touchMove', [[300, 250 - i * 12], [360, 250 - i * 12]]); await sleep(16) }
await touch('touchEnd', []); await sleep(300)
console.log('after swipe up', JSON.stringify(await state()))
// three-finger tap: zoom on, again: off
for (const tag of ['on', 'off']) {
  await touch('touchStart', [[380, 180], [420, 180], [460, 180]]); await sleep(80); await touch('touchEnd', []); await sleep(1200)
  console.log('3-finger tap ->', tag, JSON.stringify(await state()))
  if (tag === 'on') await p.screenshot({ path: `${out}-2-zoom.png` })
}
// one finger drag on empty felt: the view moves like a mouse drag
const before = await state()
await touch('touchStart', [[420, 120]]); for (let i = 1; i <= 8; i++) { await touch('touchMove', [[420 - i * 15, 120]]); await sleep(16) } await touch('touchEnd', []); await sleep(300)
const after = await state(); console.log('one-finger drag yaw', before.yawT.toFixed(3), '->', after.yawT.toFixed(3))
// gyroscope: a rotation of the phone turns the view
await cdp.send('DeviceOrientation.setDeviceOrientationOverride', { alpha: 0, beta: 90, gamma: 0 }).catch(() => {})
await p.evaluate(() => window.__table.enableGyro()); await sleep(300)
const g0 = await state()
for (let a = 0; a <= 20; a += 4) { await cdp.send('DeviceOrientation.setDeviceOrientationOverride', { alpha: a, beta: 90, gamma: 0 }).catch(() => {}); await sleep(60) }
const g1 = await state(); console.log('gyro on:', g1.gyro, 'yaw', g0.yawT.toFixed(3), '->', g1.yawT.toFixed(3))
await p.screenshot({ path: `${out}-3-after.png` })
// a tap on a card plays it (like a click); holding and dragging carries it (like the mouse)
await p.evaluate(() => { window.__table.recenter?.() }).catch(() => {})
await p.keyboard.press('Escape')
const canPlay = () => p.evaluate(() => { const s = window.__table.debugState(); return s.canPlay && s.queued === 0 })
for (let i = 0; i < 80 && !(await canPlay()); i++) { await p.evaluate(() => document.querySelector('.gate-panel button:not([disabled])')?.click()); await sleep(250) }
const c = await p.evaluate(() => window.__table.vmScreen(0))
const beforeHand = (await p.evaluate(() => window.__table.debugState())).hand ?? null
await touch('touchStart', [[c.x, c.y]]); await sleep(60); await touch('touchEnd', [])
for (let i = 0; i < 20; i++) { await sleep(250); if ((await p.evaluate(() => window.__table.debugState())).canPlay === false) break }
console.log('tap on a card: canPlay now', (await p.evaluate(() => window.__table.debugState())).canPlay, JSON.stringify(beforeHand))
for (let i = 0; i < 120 && !(await canPlay()); i++) { await p.evaluate(() => document.querySelector('.gate-panel button:not([disabled])')?.click()); await sleep(250) }
if (await canPlay()) {
  const c2 = await p.evaluate(() => window.__table.vmScreen(0))
  await touch('touchStart', [[c2.x, c2.y]]); await sleep(450)
  for (let i = 1; i <= 6; i++) { await touch('touchMove', [[c2.x, c2.y - i * 12]]); await sleep(30) }
  console.log('holding and dragging a card: dragging =', (await p.evaluate(() => window.__table.debugState())).dragging)
  await p.screenshot({ path: `${out}-4-drag.png` })
  await touch('touchEnd', [])
}
console.log(errs.join('|') || 'no errors')
;[host, ...others].forEach((o) => o.sock.disconnect()); await b.close()
