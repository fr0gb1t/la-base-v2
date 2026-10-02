// Game over panel, won and lost. Usage: node e2e/gameover.shot.mjs <out-prefix>
import puppeteer from 'puppeteer-core'
import { io } from 'socket.io-client'
const out = process.argv[2] ?? '/tmp/sena'
const SENAS = ['ancho-espada', 'ancho-basto', 'ancho-copa', 'ancho-oro', 'tres', 'dos', 'porno', 'nada']
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
await sleep(1500)
for (const [w, name] of [['nosotros', 'a'], ['ellos', 'b']]) {
  await p.evaluate((w) => window.__store.getState().setGameOver({ winner: w, reason: 'All rounds complete', finalScores: { nosotros: 132, ellos: 118 } }), w)
  await sleep(800)
  await p.screenshot({ path: `${out}-${name}.png` })
}
await b.close(); host.disconnect(); process.exit(0)
