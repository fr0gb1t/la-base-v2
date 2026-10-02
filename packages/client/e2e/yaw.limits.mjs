// The head turn reaches every player's face, and no further. Usage: node e2e/yaw.limits.mjs
import puppeteer from 'puppeteer-core'
import { io } from 'socket.io-client'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let ok = true
const b = await puppeteer.launch({ executablePath: '/usr/bin/chromium', headless: 'new', args: ['--use-angle=vulkan', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'], defaultViewport: { width: 1280, height: 720 } })
for (const N of [4, 6, 8]) {
  const host = io('http://localhost:3100', { transports: ['websocket'], forceNew: true })
  await new Promise((r) => host.on('connect', r))
  const emit = (ev, p) => new Promise((r) => host.emit(ev, p, r))
  const room = (await emit('room:create', { playerName: 'Host', playerCount: N })).roomCode
  const p = await b.newPage()
  await p.goto('http://localhost:5174/?debug=1', { waitUntil: 'domcontentloaded' }); await sleep(1500)
  await p.evaluate(() => { localStorage.clear(); localStorage.setItem('guestName', 'Vos') })
  await p.reload({ waitUntil: 'domcontentloaded' }); await sleep(2500)
  const click = (t) => p.evaluate((t) => { const x = [...document.querySelectorAll('button')].find((e) => e.textContent.trim().toLowerCase().startsWith(t) && !e.disabled); x?.click(); return !!x }, t)
  await click('sentarse'); await sleep(1200); await p.keyboard.type(room); await click('sentarse'); await sleep(1000)
  for (let i = 0; i < N - 2; i++) await emit('room:addBot', { roomCode: room })
  await sleep(800)
  await emit('game:start', { roomCode: room })
  for (let i = 0; i < 40 && !(await p.evaluate(() => !!window.__table?.debugState?.().seats)); i++) await sleep(300)
  await sleep(1500)
  const misses = []
  let yawMax
  for (let s = 1; s < N; s++) {
    yawMax = (await p.evaluate((s) => window.__table.debugAimHead(s), s)).yawMax
    await sleep(900)
    misses.push(+(await p.evaluate((s) => window.__table.debugAimMiss(s), s)).toFixed(3))
  }
  const pass = misses.every((m) => m < 0.06) && yawMax < 1.4
  console.log(`N=${N} yawMax=${yawMax.toFixed(2)} rad (${Math.round((yawMax * 180) / Math.PI)}°) miss per seat=${misses.join(' ')} ${pass ? 'PASS' : 'FAIL'}`)
  ok &&= pass
  await p.close(); host.disconnect()
}
await b.close(); process.exit(ok ? 0 : 1)
