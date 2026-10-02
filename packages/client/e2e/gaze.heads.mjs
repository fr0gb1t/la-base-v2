// Every head shows where its player's camera points. Two real players (A, B) in one browser:
// A turns / zooms; B measures A's head. Usage: node e2e/gaze.heads.mjs
import puppeteer from 'puppeteer-core'
import { io } from 'socket.io-client'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const host = io('http://localhost:3000', { transports: ['websocket'] })
await new Promise((r) => host.on('connect', r))
const emit = (ev, p) => new Promise((r) => host.emit(ev, p, r))
const room = (await emit('room:create', { playerName: 'Host', playerCount: 4 })).roomCode
host.on('game:state', async (st) => { if (st.phase === 'initial_draw' && st.initialDraw?.currentDrawerPlayerId === host.id) await emit('draw:initialCard', { roomCode: room }) })
const b = await puppeteer.launch({ executablePath: '/usr/bin/chromium', headless: 'new', args: ['--use-angle=vulkan', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'], defaultViewport: { width: 960, height: 540 } })
const join = async (name) => {
  const ctx = await b.createBrowserContext()
  const p = await ctx.newPage()
  await p.goto('http://localhost:5173/?debug=1', { waitUntil: 'domcontentloaded' }); await sleep(1500)
  await p.evaluate((n) => { localStorage.clear(); localStorage.setItem('guestName', n) }, name)
  await p.reload({ waitUntil: 'domcontentloaded' }); await sleep(2500)
  const click = (t) => p.evaluate((t) => { const x = [...document.querySelectorAll('button')].find((e) => e.textContent.trim().toLowerCase().startsWith(t) && !e.disabled); x?.click(); return !!x }, t)
  await click('sentarse'); await sleep(1200); await p.keyboard.type(room); await click('sentarse'); await sleep(1000)
  return p
}
const A = await join('Ana')
const B = await join('Beto')
await emit('room:addBot', { roomCode: room }); await sleep(600)
await emit('game:start', { roomCode: room })
for (let i = 0; i < 60; i++) {
  await sleep(400)
  for (const p of [A, B]) {
    const ph = await p.evaluate(() => document.querySelector('.phase-line')?.textContent?.toLowerCase() ?? '')
    if (ph.includes('mazo del centro')) { const d = await p.evaluate(() => window.__table.deckScreen()); await p.mouse.click(d.x, d.y) }
  }
  if (await A.evaluate(() => /declar|pide/.test(document.querySelector('.phase-line')?.textContent ?? ''))) break
}
const aId = await A.evaluate(() => window.__table.myId)
const diff = async () => {
  await sleep(1300)
  const g = await A.evaluate(() => window.__table.gaze())
  const h = await B.evaluate((id) => window.__table.debugHeadOf(id), aId)
  return { gaze: [+g.yaw.toFixed(2), +g.pitch.toFixed(2)], head: [+h.yaw.toFixed(2), +h.pitch.toFixed(2)], err: +Math.hypot(g.yaw - h.yaw, g.pitch - h.pitch).toFixed(3) }
}
const r = {}
r.still = await diff()
await A.evaluate(() => { const t = window.__table; t.yawT = 0.7; t.pitchT = -0.1 })
r.turned = await diff()
await sleep(2500) // A holds still past the old 1.5 s TTL: the head must not wander off
r.heldStill = await diff()
await A.evaluate(() => window.__table.debugPeekHead(2)) // right-click zoom on the player in front
r.zoomed = await diff()
console.log(JSON.stringify(r))
const ok = Object.values(r).every((x) => x.err < 0.05)
console.log(ok ? 'PASS' : 'FAIL')
await b.close(); host.disconnect(); process.exit(ok ? 0 : 1)
