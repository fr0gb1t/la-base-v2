// Drag a card along your fan to rearrange it; the order survives the server re-sending the hand.
// Needs the server with LABASE_TEST=1 (test:rig sets the hands). Usage: node e2e/hand.rearrange.mjs <out-prefix>
import puppeteer from 'puppeteer-core'
import { io } from 'socket.io-client'
const out = process.argv[2] ?? '/tmp/rearrange'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const host = io('http://localhost:3100', { transports: ['websocket'] })
await new Promise((r) => host.on('connect', r))
const emit = (ev, p) => new Promise((r) => host.emit(ev, p, r))
const room = (await emit('room:create', { playerName: 'Host', playerCount: 4 })).roomCode
host.on('game:state', async (st) => { if (st.phase === 'initial_draw' && st.initialDraw?.currentDrawerPlayerId === host.id) await emit('draw:initialCard', { roomCode: room }) })
const b = await puppeteer.launch({ executablePath: '/usr/bin/chromium', headless: 'new', args: ['--use-angle=vulkan', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'], defaultViewport: { width: 1280, height: 720 } })
const p = await b.newPage()
p.on('pageerror', (e) => console.log('PAGEERR', e.message))
await p.goto('http://localhost:5174/?debug=1', { waitUntil: 'domcontentloaded' }); await sleep(2000)
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
await sleep(4000) // the deal animation
const meId = await p.evaluate(() => window.__table.myId)
const mine = [{ suit: 'oros', value: 12 }, { suit: 'copas', value: 4 }, { suit: 'espadas', value: 7 }]
await emit('test:rig', { roomCode: room, hands: { [meId]: mine } })
await sleep(1200)
const order = () => p.evaluate(() => window.__table.hand.map((c) => `${c.value}${c.suit[0]}`).join(' '))
const r = { before: await order() }
const from = await p.evaluate(() => window.__table.vmScreen(0))
const to = await p.evaluate(() => window.__table.vmScreen(2))
await p.mouse.move(from.x, from.y); await sleep(150); await p.mouse.down(); await sleep(300)
await p.mouse.move(to.x + 6, from.y, { steps: 14 }); await sleep(500)
await p.screenshot({ path: `${out}-dragging.png` })
// the card you move is one of your hand's, visible and under the cursor (not a dark copy behind)
const held = await p.evaluate(() => ({ vis: window.__table.vm[0].mesh.visible, x: window.__table.vmScreen(0).x }))
r.heldVisible = held.vis
r.heldNearCursor = Math.abs(held.x - (to.x + 6)) < 70
// up off the fan: it becomes the card you carry to the table; back over the cards: rearranging again
await p.mouse.move(to.x, from.y - 260, { steps: 10 }); await sleep(500)
r.carried = await p.evaluate(() => !window.__table.vm[0].mesh.visible && window.__table.drag?.insert === undefined)
await p.screenshot({ path: `${out}-carry.png` })
await p.mouse.move(to.x + 6, from.y + 10, { steps: 10 }); await sleep(500)
r.backOverFan = await p.evaluate(() => window.__table.drag?.insert !== undefined)
await p.mouse.up(); await sleep(900)
r.after = await order()
await emit('test:rig', { roomCode: room, hands: { [meId]: mine } }) // the server sends its order again
await sleep(900)
r.afterResend = await order()
console.log(JSON.stringify(r))
const ok = r.before === '12o 4c 7e' && r.after === '4c 7e 12o' && r.afterResend === '4c 7e 12o' && r.heldVisible && r.heldNearCursor && r.carried && r.backOverFan
console.log(ok ? 'PASS' : 'FAIL')
await b.close(); host.disconnect(); process.exit(ok ? 0 : 1)
