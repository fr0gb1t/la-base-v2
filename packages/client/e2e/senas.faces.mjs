// Every seña on the opposite player's mask, zoomed in. Usage: node e2e/senas.faces.mjs <out-prefix>
import puppeteer from 'puppeteer-core'
import { io } from 'socket.io-client'
const out = process.argv[2] ?? '/tmp/sena'
const SENAS = ['ancho-espada', 'ancho-basto', 'ancho-copa', 'ancho-oro', 'figuras', 'tres', 'dos', 'porno', 'nada']
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const host = io('http://localhost:3100', { transports: ['websocket'] })
await new Promise((r) => host.on('connect', r))
const emit = (ev, p) => new Promise((r) => host.emit(ev, p, r))
const room = (await emit('room:create', { playerName: 'Host', playerCount: 4 })).roomCode
const b = await puppeteer.launch({ executablePath: '/usr/bin/chromium', headless: 'new', args: ['--use-angle=vulkan', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'], defaultViewport: { width: 1280, height: 720 } })
const p = await b.newPage()
await p.goto('http://localhost:5174/?debug=1', { waitUntil: 'domcontentloaded' }); await sleep(2000)
await p.evaluate(() => { localStorage.clear(); localStorage.setItem('guestName', 'Vos') })
await p.reload({ waitUntil: 'domcontentloaded' }); await sleep(2500)
const click = (t) => p.evaluate((t) => { const x = [...document.querySelectorAll('button')].find((e) => e.textContent.trim().toLowerCase().startsWith(t) && !e.disabled); x?.click(); return !!x }, t)
await click('sentarse'); await sleep(1200); await p.keyboard.type(room); await click('sentarse'); await sleep(1000)
await emit('room:addBot', { roomCode: room }); await emit('room:addBot', { roomCode: room }); await sleep(800)
await emit('game:start', { roomCode: room })
for (let i = 0; i < 30 && !(await p.evaluate(() => !!window.__table)); i++) await sleep(300)
await sleep(2500)
await p.evaluate(() => { window.__table.debugPeekHead(2); document.querySelectorAll('.hud,.phase-line,.gate-panel,.hud-tabs').forEach((e) => (e.style.visibility = 'hidden')) })
for (const s of ['rest', ...SENAS]) {
  await p.evaluate((s) => (s === 'rest' ? window.__table.debugSena(2, null) : window.__table.debugSena(2, s)), s)
  await sleep(700)
  await p.screenshot({ path: `${out}-${s}.png`, clip: { x: 440, y: 120, width: 400, height: 330 } })
}
await b.close(); host.disconnect(); process.exit(0)
