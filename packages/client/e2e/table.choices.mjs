// As de Copas / As de Oros asked on the table (3D), answered with real clicks: a tag, and a face.
// Usage: node e2e/table.choices.mjs <out-prefix>
import puppeteer from 'puppeteer-core'
import { io } from 'socket.io-client'
const out = process.argv[2] ?? '/tmp/choices'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const host = io('http://localhost:3000', { transports: ['websocket'] })
await new Promise((r) => host.on('connect', r))
const emit = (ev, p) => new Promise((r) => host.emit(ev, p, r))
const room = (await emit('room:create', { playerName: 'Host', playerCount: 4 })).roomCode
host.on('game:state', async (st) => { if (st.phase === 'initial_draw' && st.initialDraw?.currentDrawerPlayerId === host.id) await emit('draw:initialCard', { roomCode: room }) })
const b = await puppeteer.launch({ executablePath: '/usr/bin/chromium', headless: 'new', args: ['--use-angle=vulkan', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'], defaultViewport: { width: 1280, height: 720 } })
const p = await b.newPage()
p.on('pageerror', (e) => console.log('PAGEERR', e.message))
await p.goto('http://localhost:5173/?debug=1', { waitUntil: 'domcontentloaded' }); await sleep(2000)
await p.evaluate(() => { localStorage.clear(); localStorage.setItem('guestName', 'Vos') })
await p.reload({ waitUntil: 'domcontentloaded' }); await sleep(2500)
const click = (t) => p.evaluate((t) => { const x = [...document.querySelectorAll('button')].find((e) => e.textContent.trim().toLowerCase().startsWith(t) && !e.disabled); x?.click(); return !!x }, t)
await click('sentarse'); await sleep(1200); await p.keyboard.type(room); await click('sentarse'); await sleep(1000)
await emit('room:addBot', { roomCode: room }); await emit('room:addBot', { roomCode: room }); await sleep(800)
await emit('game:start', { roomCode: room })
for (let i = 0; i < 80; i++) {
  await sleep(300)
  const ph = await p.evaluate(() => document.querySelector('.phase-line')?.textContent?.toLowerCase() ?? '')
  if (ph.includes('mazo del centro')) { const d = await p.evaluate(() => window.__table.deckScreen()); await p.mouse.click(d.x, d.y) }
  if (/declar|pide/.test(ph)) break
}
await sleep(1000)
const r = {}
// ---- As de Copas
await p.evaluate(() => { window.__choice = undefined; window.__table.pitchT = -0.5; void window.__table.askDirection('horario').then((c) => (window.__choice = c)) })
await sleep(1500)
await p.screenshot({ path: `${out}-copas.png` })
const inv = await p.evaluate(() => window.__table.choiceScreen('invertir'))
await p.mouse.move(inv.x, inv.y, { steps: 5 }); await sleep(1200)
await p.screenshot({ path: `${out}-copas-invertir.png` })
r.hintOnHover = await p.evaluate(() => document.querySelector('.phase-line')?.textContent)
await p.mouse.click(inv.x, inv.y); await sleep(400)
r.copas = await p.evaluate(() => window.__choice)
// ---- As de Oros: a tag for one teammate, the face for the other
const ids = await p.evaluate(() => { const t = window.__table; const all = t.players.map((x) => x.id); const me = all.indexOf(t.myId); return [all[(me + 1) % 4], all[(me + 2) % 4]] })
await p.evaluate((ids) => { window.__choice = undefined; window.__table.pitchT = -0.2; void window.__table.askOpener(ids.map((id) => ({ id, name: window.__table.players.find((x) => x.id === id).name }))).then((c) => (window.__choice = c)) }, ids)
await sleep(1500)
await p.screenshot({ path: `${out}-oros.png` })
const face = await p.evaluate(() => window.__table.headScreen(2))
await p.mouse.move(face.x, face.y, { steps: 5 }); await sleep(800)
await p.mouse.click(face.x, face.y); await sleep(400)
r.orosByFace = (await p.evaluate(() => window.__choice)) === ids[1]
await p.evaluate((ids) => { window.__choice = undefined; void window.__table.askOpener(ids.map((id) => ({ id, name: 'x' }))).then((c) => (window.__choice = c)) }, ids)
await sleep(1200)
const tag = await p.evaluate((id) => window.__table.choiceScreen(id), ids[0])
await p.mouse.move(tag.x, tag.y, { steps: 5 }); await sleep(600)
await p.mouse.click(tag.x, tag.y); await sleep(400)
r.orosByTag = (await p.evaluate(() => window.__choice)) === ids[0]
console.log(JSON.stringify(r, null, 1))
const ok = r.copas === 'invertir' && r.orosByFace && r.orosByTag
console.log(ok ? 'PASS' : 'FAIL')
await b.close(); host.disconnect(); process.exit(ok ? 0 : 1)
