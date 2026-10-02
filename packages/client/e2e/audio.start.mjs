// Sound starts with the app: the context exists from the first screen and runs after the first
// gesture anywhere (typing a name counts); at the table it is already on. Usage: node e2e/audio.start.mjs
import puppeteer from 'puppeteer-core'
import { io } from 'socket.io-client'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const b = await puppeteer.launch({ executablePath: '/usr/bin/chromium', headless: 'new', args: ['--use-angle=vulkan', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'], defaultViewport: { width: 1280, height: 720 } })
const p = await b.newPage()
const errors = []
p.on('pageerror', (e) => errors.push(e.message))
const state = () => p.evaluate(() => window.__audioState?.())
await p.goto('http://localhost:5174/?debug=1', { waitUntil: 'domcontentloaded' }); await sleep(2500)
await p.evaluate(() => localStorage.clear())
await p.reload({ waitUntil: 'domcontentloaded' }); await sleep(2500)
const r = { onLoad: await state() }
await p.keyboard.type('Fede', { delay: 60 }); await sleep(600)
r.afterTyping = await state()
// into a game: a host socket makes the room, we sit, two bots, start
const host = io('http://localhost:3100', { transports: ['websocket'] })
await new Promise((res) => host.on('connect', res))
const emit = (ev, pl) => new Promise((res) => host.emit(ev, pl, res))
const room = (await emit('room:create', { playerName: 'Host', playerCount: 4 })).roomCode
const click = (t) => p.evaluate((t) => { const x = [...document.querySelectorAll('button')].find((e) => e.textContent.trim().toLowerCase().startsWith(t) && !e.disabled); x?.click(); return !!x }, t)
await click('sentarse a la mesa'); await sleep(1500)
await click('sentarse'); await sleep(1200); await p.keyboard.type(room); await click('sentarse'); await sleep(1000)
await emit('room:addBot', { roomCode: room }); await emit('room:addBot', { roomCode: room }); await sleep(600)
await emit('game:start', { roomCode: room }); await sleep(3500)
r.atTable = await state()
r.earsOnTableCamera = await p.evaluate(() => Boolean(window.__table?.camera.children.some((c) => c.type === 'AudioListener')))
r.unlockButton = await p.evaluate(() => Boolean(document.querySelector('.sound-unlock')))
console.log(JSON.stringify(r), errors.length ? errors : 'no page errors')
const ok = r.afterTyping === 'running' && r.atTable === 'running' && r.earsOnTableCamera && !r.unlockButton
console.log(ok ? 'PASS' : 'FAIL')
await b.close(); host.disconnect(); process.exit(ok ? 0 : 1)
