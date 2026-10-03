// A game on a phone: aim with the gyroscope, tap = click at the reticle, double tap = zoom (and the gyroscope still moves it), the señas button toggles. Usage: node e2e/mobile.taps.mjs <out-prefix> (vite 5174, test server 3100)
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
    if (st.phase === 'bidding' && st.currentBidPlayerId === sock.id) { await sleep(400); const max = st.structureSequence[st.roundIndex]; await emit('bid:declare', { roomCode: room, bidValue: [1, 0, 0, 1, 2, 3, 4, 5, 6].find((x) => x <= max && (st.bids.length === 0 || [max - 1, max + 1].includes(st.bids[0].value + x))), isKamikaze: false }) }
    if (st.phase === 'playing' && st.currentTurnPlayerId === sock.id && me.hand.length) { await sleep(300); await emit('card:play', { roomCode: room, card: me.hand[0], copasDirection: 'mantener' }) }
    if (st.pendingOrosChoice?.chooserPlayerId === sock.id) await emit('ace:oros:choose', { roomCode: room, playerId: st.pendingOrosChoice.options[0] })
  })
  return me
}
const aimAt = (x, y, z) => p.evaluate(([x, y, z]) => { const t = window.__table; const eye = t.camera.position; const d = new eye.constructor(x, y, z).sub(eye); t.yawT = Math.atan2(-d.x, -d.z) - t.baseYaw; t.pitchT = Math.atan2(d.y, Math.hypot(d.x, d.z)); t.yaw = t.yawT; t.pitch = t.pitchT }, [x, y, z])
const host = await auto(); const room = (await host.emit('room:create', { playerName: 'Host', playerCount: 4 })).roomCode; host.room = room
const others = []; for (let i = 0; i < 2; i++) { const o = await auto(room); await o.emit('room:join', { roomCode: room, playerName: `P${i}` }); others.push(o) }
const p = await b.newPage()
await p.emulate({ viewport: { width: 844, height: 390, deviceScaleFactor: 1, isMobile: true, hasTouch: true, isLandscape: true }, userAgent: UA })
const errs = []; p.on('pageerror', (e) => errs.push(e.message))
await p.goto('http://localhost:5174/?debug=1', { waitUntil: 'domcontentloaded' }); await sleep(1500)
await p.evaluate(() => { localStorage.clear(); localStorage.setItem('guestName', 'Vos') }); await p.reload({ waitUntil: 'domcontentloaded' }); await sleep(2500)
const press = (t) => p.evaluate((t) => { const x = [...document.querySelectorAll('button')].find((e) => e.textContent.trim().toLowerCase().startsWith(t) && !e.disabled); x?.click(); return !!x }, t)
await press('sentarse'); await sleep(1200); await p.keyboard.type(room); await press('sentarse'); await sleep(1500)
await host.emit('game:config', { roomCode: room, structure: 'clasica', acePowers: { espadas: true, copas: true, oros: true }, kamikazesPerTeam: 0, bidClockMs: 300_000 })
await host.emit('game:start', { roomCode: room })
let me = null
for (let i = 0; i < 400; i++) {
  await sleep(250)
  me ??= await p.evaluate(() => window.__table?.myId ?? null)
  const t = await p.evaluate(() => ({ s: window.__table?.debugState(), ph: document.querySelector('.phase-line')?.textContent?.toLowerCase() ?? '' }))
  if (t.ph.includes('mazo del centro')) { await aimAt(0, 0.8, 0); await sleep(250); await p.touchscreen.tap(40, 40) } // aim the reticle at the deck, tap anywhere
  if (host.state?.phase === 'bidding' && host.state.currentBidPlayerId === me) { await p.evaluate(() => [...document.querySelectorAll('.tally-num')].filter((x) => !x.disabled)[0]?.click()); await sleep(200); await press('pedir') }
  await p.evaluate(() => document.querySelector('.gate-panel button:not([disabled])')?.click())
  if (host.state?.phase === 'playing' && t.s?.canPlay && t.s.queued === 0) break
}
await sleep(1500)
await p.screenshot({ path: `${out}-1-game.png` })
const cdp = await p.createCDPSession()
const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y], i) => ({ x, y, id: i + 1 })) })
const tapAt = async (x, y) => { await touch('touchStart', [[x, y]]); await sleep(50); await touch('touchEnd', []) }
await p.evaluate(() => window.__table.enableGyro())
// aim the view at the notepad (what the gyroscope would do)
const aim = () => p.evaluate(() => { const t = window.__table; const eye = t.camera.position; const n = t.notepad.group.getWorldPosition(eye.clone()); const d = n.sub(eye); t.yawT = Math.atan2(-d.x, -d.z) - t.baseYaw; t.pitchT = Math.atan2(d.y, Math.hypot(d.x, d.z)); t.yaw = t.yawT; t.pitch = t.pitchT })
await aim(); await sleep(1500)
const centre = await p.evaluate(() => { const t = window.__table; const np = t.notepadScreen(); return { np, w: innerWidth, h: innerHeight } })
console.log('notepad on screen', JSON.stringify(centre.np), 'screen centre', centre.w / 2, centre.h / 2)
// 1) a tap far from the notepad (on empty felt) clicks where the reticle is: the notepad opens
await tapAt(80, 60); await sleep(700)
console.log('tap far away opens the notepad:', await p.evaluate(() => Boolean(document.querySelector('.anotador-sheet'))))
await p.keyboard.press('Escape'); await sleep(300)
// 2) two quick taps: zoom at the reticle
await tapAt(150, 120); await sleep(90); await tapAt(150, 120); await sleep(900)
console.log('double tap zoom:', await p.evaluate(() => Boolean(window.__table.peek)), 'sheet opened by mistake:', await p.evaluate(() => Boolean(document.querySelector('.anotador-sheet'))))
// 3) zoomed, the gyroscope still moves the view
const t0 = await p.evaluate(() => window.__table.peek.target.toArray())
await cdp.send('DeviceOrientation.setDeviceOrientationOverride', { alpha: 0, beta: 90, gamma: 0 }).catch(() => {}); await sleep(200)
for (let a = 0; a <= 12; a += 3) { await cdp.send('DeviceOrientation.setDeviceOrientationOverride', { alpha: a, beta: 90, gamma: 0 }).catch(() => {}); await sleep(60) }
const t1 = await p.evaluate(() => window.__table.peek.target.toArray())
console.log('zoomed target moved with the gyroscope:', JSON.stringify(t0.map((x) => +x.toFixed(3))), '->', JSON.stringify(t1.map((x) => +x.toFixed(3))))
await p.screenshot({ path: `${out}-zoomed.png` })
await tapAt(150, 120); await sleep(90); await tapAt(150, 120); await sleep(900)
console.log('double tap again leaves the zoom:', !(await p.evaluate(() => Boolean(window.__table.peek))))
// 4) the señas button: a second tap closes the ring (it exists once the round is being played)
for (let i = 0; i < 400 && !['bidding', 'playing'].includes(host.state?.phase); i++) {
  await sleep(150)
  const ph = await p.evaluate(() => document.querySelector('.phase-line')?.textContent?.toLowerCase() ?? '')
  if (ph.includes('mazo del centro')) { await aimAt(0, 0.8, 0); await sleep(250); await p.touchscreen.tap(40, 40) } // aim the reticle at the deck, tap anywhere
}
await sleep(1500)
const btn = await p.evaluate(() => { const r = document.querySelector('.touch-senas').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 } })
await p.evaluate(() => { window.__clicks = 0; document.querySelector('.touch-senas').addEventListener('click', () => window.__clicks++) })
await tapAt(btn.x, btn.y)
console.log('button clicks seen:', await p.evaluate(() => window.__clicks), 'at', JSON.stringify(btn), 'element at point:', await p.evaluate(([x, y]) => document.elementFromPoint(x, y)?.className, [btn.x, btn.y]))
for (const ms of [60, 200, 500]) { await sleep(ms === 60 ? 60 : ms - (ms === 200 ? 60 : 200)); console.log(' wheel at +' + ms, host.state?.phase, await p.evaluate(() => ({ wheel: Boolean(document.querySelector('.sena-wheel')), phase: window.__table.debugState?.().canPlay, btn: Boolean(document.querySelector('.touch-senas')) }))) }
const open1 = await p.evaluate(() => Boolean(document.querySelector('.sena-wheel')))
await tapAt(btn.x, btn.y); await sleep(500)
console.log('señas ring: first tap opens', open1, ', second tap closes', !(await p.evaluate(() => Boolean(document.querySelector('.sena-wheel')))))
console.log(errs.join('|') || 'no errors')
;[host, ...others].forEach((o) => o.sock.disconnect()); await b.close()
