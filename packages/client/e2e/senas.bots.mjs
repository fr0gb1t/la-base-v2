// Bots make señas: facing their partner. Your partner's show (turned to you); a rival's don't
// unless you look at them. Usage: node e2e/senas.bots.mjs [players=4]
import puppeteer from 'puppeteer-core'
import { io } from 'socket.io-client'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const host = io('http://localhost:3000', { transports: ['websocket'] })
await new Promise((r) => host.on('connect', r))
const emit = (ev, p) => new Promise((r) => host.emit(ev, p, r))
const N = Number(process.argv[2] ?? 4)
const room = (await emit('room:create', { playerName: 'Host', playerCount: N })).roomCode
host.on('game:state', async (st) => { if (st.phase === 'initial_draw' && st.initialDraw?.currentDrawerPlayerId === host.id) await emit('draw:initialCard', { roomCode: room }) })
const b = await puppeteer.launch({ executablePath: '/usr/bin/chromium', headless: 'new', args: ['--use-angle=vulkan', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'], defaultViewport: { width: 1280, height: 720 } })
const p = await b.newPage()
await p.goto('http://localhost:5173/?debug=1', { waitUntil: 'domcontentloaded' }); await sleep(2000)
await p.evaluate(() => { localStorage.clear(); localStorage.setItem('guestName', 'Vos') })
await p.reload({ waitUntil: 'domcontentloaded' }); await sleep(2500)
const click = (t) => p.evaluate((t) => { const x = [...document.querySelectorAll('button')].find((e) => e.textContent.trim().toLowerCase().startsWith(t) && !e.disabled); x?.click(); return !!x }, t)
await click('sentarse'); await sleep(1200); await p.keyboard.type(room); await click('sentarse'); await sleep(1000)
for (let i = 0; i < N - 2; i++) await emit('room:addBot', { roomCode: room })
await sleep(800)
await emit('game:start', { roomCode: room })
const seen = [] // { from, sena, partner, shown, dot }
host.on('sena:made', async (d) => {
  await sleep(450) // mid-seña
  const r = await p.evaluate((id) => {
    const t = window.__table
    const ps = t.players; const me = ps.findIndex((x) => x.id === t.myId)
    const seat = (ps.findIndex((x) => x.id === id) - me + t.n) % t.n
    const partner = ps.find((x) => x.id === id)?.team === ps[me].team
    const h = t.avatars[seat].head
    const hp = h.getWorldPosition(t.camera.position.clone())
    const f = h.getWorldDirection(t.camera.position.clone()).negate()
    const dot = f.dot(t.camera.getWorldPosition(t.camera.position.clone()).sub(hp).normalize())
    return { seat, partner, shown: t.debugState().faces.some((x) => x.id === id), dot: +dot.toFixed(2) }
  }, d.playerId)
  seen.push({ sena: d.sena, ...r })
})
for (let i = 0; i < 120 && seen.length < N + 1; i++) {
  await sleep(400)
  const ph = await p.evaluate(() => document.querySelector('.phase-line')?.textContent?.toLowerCase() ?? '')
  if (ph.includes('mazo del centro')) { const d = await p.evaluate(() => window.__table.deckScreen()); await p.mouse.click(d.x, d.y) }
}
console.log(JSON.stringify(seen))
const fromPartner = seen.filter((s) => s.partner)
const fromRival = seen.filter((s) => !s.partner)
// with 4 players the partner sits across: they must be facing you
const ok = seen.length > 0 && fromPartner.every((s) => s.shown && (N !== 4 || s.dot > 0.6)) && fromRival.every((s) => !s.shown)
console.log(fromPartner.length, 'from partner,', fromRival.length, 'from rivals', ok ? 'PASS' : 'FAIL')
await b.close(); host.disconnect(); process.exit(ok ? 0 : 1)
