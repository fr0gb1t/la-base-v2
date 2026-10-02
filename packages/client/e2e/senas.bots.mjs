// Bots make señas facing their partner: your bot partner's reach you (turned to you); no rival's
// reach you while you never look at them. Usage: node e2e/senas.bots.mjs [players=6]
import puppeteer from 'puppeteer-core'
import { io } from 'socket.io-client'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const host = io('http://localhost:3100', { transports: ['websocket'] })
await new Promise((r) => host.on('connect', r))
const emit = (ev, p) => new Promise((r) => host.emit(ev, p, r))
const N = Number(process.argv[2] ?? 6) // with 6 you always have a bot partner (with 4 it may be the host)
const room = (await emit('room:create', { playerName: 'Host', playerCount: N })).roomCode
host.on('game:state', async (st) => { if (st.phase === 'initial_draw' && st.initialDraw?.currentDrawerPlayerId === host.id) await emit('draw:initialCard', { roomCode: room }) })
const b = await puppeteer.launch({ executablePath: '/usr/bin/chromium', headless: 'new', args: ['--use-angle=vulkan', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'], defaultViewport: { width: 1280, height: 720 } })
const p = await b.newPage()
await p.goto('http://localhost:5174/?debug=1', { waitUntil: 'domcontentloaded' }); await sleep(2000)
await p.evaluate(() => { localStorage.clear(); localStorage.setItem('guestName', 'Vos') })
await p.reload({ waitUntil: 'domcontentloaded' }); await sleep(2500)
const click = (t) => p.evaluate((t) => { const x = [...document.querySelectorAll('button')].find((e) => e.textContent.trim().toLowerCase().startsWith(t) && !e.disabled); x?.click(); return !!x }, t)
await click('sentarse'); await sleep(1200); await p.keyboard.type(room); await click('sentarse'); await sleep(1000)
for (let i = 0; i < N - 2; i++) await emit('room:addBot', { roomCode: room })
await sleep(800)
await emit('game:start', { roomCode: room })
// what this screen actually shows (the server decides what reaches it): sampled from the masks
const seen = []
const sample = setInterval(async () => {
  const r = await p.evaluate(() => {
    const t = window.__table
    if (!t?.debugState) return []
    const ps = t.players; const me = ps.findIndex((x) => x.id === t.myId)
    return t.debugState().faces.map((f) => {
      const h = t.avatars[f.seat].head
      const hp = h.getWorldPosition(t.camera.position.clone())
      const dir = h.getWorldDirection(t.camera.position.clone()).negate()
      const dot = dir.dot(t.camera.getWorldPosition(t.camera.position.clone()).sub(hp).normalize())
      return { id: f.id, sena: f.sena, seat: f.seat, partner: ps.find((x) => x.id === f.id)?.team === ps[me].team, dot: +dot.toFixed(2) }
    })
  }).catch(() => [])
  for (const f of r) if (!seen.some((x) => x.id === f.id && x.sena === f.sena)) seen.push(f)
}, 150)
for (let i = 0; i < 120 && !seen.some((x) => x.partner); i++) {
  await sleep(400)
  const ph = await p.evaluate(() => document.querySelector('.phase-line')?.textContent?.toLowerCase() ?? '')
  if (ph.includes('mazo del centro')) { const d = await p.evaluate(() => window.__table.deckScreen()); await p.mouse.click(d.x, d.y) }
}
await sleep(3000)
clearInterval(sample)
console.log(JSON.stringify(seen))
const fromPartner = seen.filter((s) => s.partner)
const fromRival = seen.filter((s) => !s.partner)
// with 4 players the partner sits across: they must be facing you
const ok = fromPartner.length > 0 && fromPartner.every((s) => N !== 4 || s.dot > 0.6) && fromRival.length === 0 // never aimed at a rival
console.log(fromPartner.length, 'from partner,', fromRival.length, 'from rivals', ok ? 'PASS' : 'FAIL')
await b.close(); host.disconnect(); process.exit(ok ? 0 : 1)
