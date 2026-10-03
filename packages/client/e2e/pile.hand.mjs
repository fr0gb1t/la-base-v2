// A won pile and the resting hand: the hand must cover the cards, from any camera angle. Usage: node e2e/pile.hand.mjs <out-prefix>
import puppeteer from 'puppeteer-core'
import { io } from 'socket.io-client'
const out = process.argv[2] ?? '/tmp/pile'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const b = await puppeteer.launch({ executablePath: '/usr/bin/chromium', headless: 'new', args: ['--use-angle=vulkan', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'], defaultViewport: { width: 1280, height: 720 } })
const mk = async () => { const s = io('http://localhost:3100', { transports: ['websocket'], forceNew: true }); await new Promise((r) => s.on('connect', r)); return s }
const emit = (s, ev, p) => new Promise((r) => s.emit(ev, p, r))
const socks = [await mk(), await mk(), await mk()]
const room = (await emit(socks[0], 'room:create', { playerName: 'Host', playerCount: 4 })).roomCode
for (const [i, s] of socks.slice(1).entries()) await emit(s, 'room:join', { roomCode: room, playerName: `P${i}` })
const p = await b.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message))
await p.goto('http://localhost:5174/?debug=1', { waitUntil: 'domcontentloaded' }); await sleep(1500)
await p.evaluate(() => { localStorage.clear(); localStorage.setItem('guestName', 'Vos') }); await p.reload({ waitUntil: 'domcontentloaded' }); await sleep(2500)
const click = (t) => p.evaluate((t) => { const x = [...document.querySelectorAll('button')].find((e) => e.textContent.trim().toLowerCase().startsWith(t) && !e.disabled); x?.click() }, t)
await click('sentarse'); await sleep(1200); await p.keyboard.type(room); await click('sentarse'); await sleep(1500)
await emit(socks[0], 'game:config', { roomCode: room, structure: 'clasica', acePowers: { espadas: true, copas: true, oros: true }, kamikazesPerTeam: 0, bidClockMs: 0 })
await emit(socks[0], 'game:start', { roomCode: room })
for (let i = 0; i < 60 && !(await p.evaluate(() => window.__table?.myId)); i++) await sleep(250)
await sleep(2000)
// fake three won stacks for me (seat 0): cards on the table, then collected
await p.evaluate(async () => {
  const t = window.__table
  const me = t.myId
  const others = t.players.filter((x) => x.id !== me)
  for (let k = 0; k < 3; k++) {
    for (const [i, pl] of [t.players[0], ...others].entries()) t.cardPlayed(pl.id, { suit: ['oros', 'copas', 'espadas', 'bastos'][(i + k) % 4], value: 4 + k + i })
    await new Promise((r) => setTimeout(r, 1800))
    t.baseResolved(me)
    await new Promise((r) => setTimeout(r, 2600))
  }
})
await sleep(1500)
console.log('piles:', await p.evaluate(() => window.__table.wonStacks.length))
// the hand's lowest point over the piles vs the pile's top
console.log('clearance', JSON.stringify(await p.evaluate(async () => {
  const t = window.__table
  const THREE_Box = t.camera.constructor.prototype.constructor && null
  const av = t.avatars[0]
  const piles = t.wonStacks.flat()
  const pileTop = Math.max(...piles.map((v) => v.root.position.y)) + 0.002
  let low = Infinity
  av.root.traverse((o) => { if (o.isMesh && o.geometry) { o.geometry.computeBoundingBox(); const bb = o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld); const sz = bb.getSize(bb.min.clone()); if (Math.max(sz.x, sz.y, sz.z) < 0.12 && bb.min.y > 0.74 && bb.max.y < 0.85) low = Math.min(low, bb.min.y) } })
  return { pileTop: +pileTop.toFixed(4), handLowest: +low.toFixed(4), table: 0.76 }
})))
for (const [tag, yaw, pitch] of [['a', 0, -0.4], ['b', 0.35, -0.25], ['c', -0.3, -0.7]]) {
  await p.evaluate(([y, pi]) => { window.__table.yawT = y; window.__table.pitchT = pi }, [yaw, pitch]); await sleep(1300)
  await p.screenshot({ path: `${out}-${tag}.png` })
}
console.log(errs.join('|') || 'no errors'); socks.forEach((s) => s.disconnect()); await b.close()
