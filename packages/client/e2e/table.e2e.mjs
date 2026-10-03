// End-to-end: 1 real browser (seat "Vos") + 3 socket.io bots against the real server.
// Needs: server on :3000 (guest mode is fine) and the client dev server on :5173.
// Usage: node e2e/table.e2e.mjs <out-prefix> [seconds=150]
import puppeteer from 'puppeteer-core'
import { io } from 'socket.io-client'

const [, , out = '/tmp/labase', secsArg = '150'] = process.argv
const SERVER = 'http://localhost:3100'
const CLIENT = 'http://localhost:5174/?debug=1'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a)

// ---------------- bots ----------------
function bot(name) {
  const s = io(SERVER, { transports: ['websocket'] })
  const b = { name, s, id: null, room: null, hand: [], state: null, busy: false, yaw: 0 }
  s.on('connect', () => (b.id = s.id))
  s.on('player:hand', ({ hand }) => (b.hand = hand))
  s.on('game:state', (st) => {
    b.state = st
    void act(b)
  })
  setInterval(() => {
    if (!b.room) return
    b.yaw = Math.max(-0.9, Math.min(0.9, b.yaw + (Math.random() - 0.5) * 0.4))
    s.emit('presence:look', { roomCode: b.room, yaw: b.yaw, pitch: -0.2 + Math.random() * 0.2 })
  }, 250)
  return b
}
const emit = (b, ev, payload) => new Promise((r) => b.s.emit(ev, payload, r))

async function act(b) {
  const st = b.state
  if (!st || b.busy || !b.room) return
  b.busy = true
  try {
    if (st.readyGate && !st.readyGate.readyPlayerIds.includes(b.id)) {
      await sleep(1200)
      await emit(b, 'game:ready', { roomCode: b.room })
    } else if (st.phase === 'initial_draw' && st.initialDraw?.currentDrawerPlayerId === b.id && !st.initialDraw.completed) {
      await sleep(700)
      await emit(b, 'draw:initialCard', { roomCode: b.room })
    } else if (st.phase === 'bidding' && st.currentBidPlayerId === b.id) {
      await sleep(900)
      const max = st.structureSequence[st.roundIndex]
      const options = Array.from({ length: max + 1 }, (_, v) => v).filter((v) => st.bids.length === 0 || [max - 1, max + 1].includes(st.bids[0].value + v))
      const v = options[Math.floor(Math.random() * options.length)]
      b.s.emit('bid:bidValueChanged', { roomCode: b.room, bidValue: v, playerId: b.id })
      await sleep(500)
      const res = await emit(b, 'bid:declare', { roomCode: b.room, bidValue: v, isKamikaze: false })
      log(b.name, 'bids', v, res.success ? '' : res.error)
    } else if (st.phase === 'playing' && st.currentTurnPlayerId === b.id && b.hand.length) {
      await sleep(600)
      const k = Math.floor(Math.random() * b.hand.length)
      const card = b.hand[k]
      // move the arm: a feint half the time, then out to the zone
      const feint = Math.random() < 0.5
      for (let i = 0; i <= 12; i++) {
        const fwd = -0.35 + (feint ? Math.sin((i / 12) * Math.PI) * 0.55 : (i / 12) * 0.59)
        b.s.emit('presence:arm', { roomCode: b.room, slot: k, fwd, lat: 0, holding: true })
        await sleep(60)
      }
      if (feint) {
        b.s.emit('presence:arm', { roomCode: b.room, slot: k, fwd: -0.35, lat: 0, holding: false })
        await sleep(700)
      }
      const copasDirection = card.suit === 'copas' && card.value === 1 ? (Math.random() < 0.5 ? 'invertir' : 'mantener') : undefined
      const res = await emit(b, 'card:play', { roomCode: b.room, card, copasDirection })
      if (!feint) b.s.emit('presence:arm', { roomCode: b.room, slot: k, fwd: 0.24, lat: 0, holding: false })
      log(b.name, 'plays', `${card.value}${card.suit}`, res.success ? '' : res.error)
    } else if (st.pendingOrosChoice?.chooserPlayerId === b.id) {
      await sleep(800)
      await emit(b, 'ace:oros:choose', { roomCode: b.room, playerId: st.pendingOrosChoice.options[0] })
    }
  } finally {
    b.busy = false
  }
  // state may have moved on while we were acting
  if (b.state !== st) void act(b)
}

// ---------------- browser ----------------
const browser = await puppeteer.launch({
  executablePath: '/usr/bin/chromium',
  headless: 'new',
  args: ['--use-angle=vulkan', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', '--window-size=1280,720', '--autoplay-policy=no-user-gesture-required'],
  defaultViewport: { width: 1280, height: 720 },
})
const page = await browser.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`) })
let shotN = 0
const shot = async (name) => {
  const file = `${out}-${String(shotN++).padStart(2, '0')}-${name}.png`
  await page.screenshot({ path: file })
  log('shot', file)
}
const clickText = async (text, tag = 'button') => {
  const ok = await page.evaluate((text, tag) => {
    const el = [...document.querySelectorAll(tag)].find((e) => e.textContent.trim().toLowerCase().includes(text.toLowerCase()) && !e.disabled)
    if (el) el.click()
    return Boolean(el)
  }, text, tag)
  return ok
}

const host = bot('Ana')
await sleep(800)
const created = await emit(host, 'room:create', { playerName: 'Ana', playerCount: 4 })
host.room = created.roomCode
log('room', host.room)

await page.goto(CLIENT, { waitUntil: 'networkidle0' })
await sleep(1500)
await page.keyboard.type('Vos') // the name card has focus
await clickText('sentarse a la mesa')
await sleep(1500)
await clickText('sentarse') // the lobby's "Sentarse" card
await sleep(1200)
await page.keyboard.type(host.room) // the code card has focus
await clickText('sentarse')
await sleep(1200)
await shot('room')

for (let i = 0; i < 2; i++) {
  const r = await emit(host, 'room:addBot', { roomCode: host.room })
  log('in-app bot', r.success, r.error ?? '')
  await sleep(400)
}
await sleep(800)
await emit(host, 'game:config', { roomCode: host.room, structure: 'postpandemia', acePowers: { espadas: true, copas: true, oros: true }, kamikazesPerTeam: 2 })
const started = await emit(host, 'game:start', { roomCode: host.room })
log('start', started.success, started.error ?? '')

// ---------------- browser plays by itself through the UI ----------------
const until = Date.now() + Number(secsArg) * 1000
const shots = { draw: 0, bid: 0, deal: 0, play: 0, collect: 0, round2: 0, ace: 0, gateBase: 0, gateRound: 0, announce: 0 }
let lastRound = -1
while (Date.now() < until) {
  await sleep(350)
  const ui = await page.evaluate(() => ({
    phase: document.querySelector('.phase-line')?.textContent ?? '',
    hud: document.querySelector('.hud-block')?.textContent ?? '',
    table: window.__table?.debugState?.() ?? null,
  }))
  const t = ui.table
  if (!t) continue
  const round = Number((ui.hud.match(/Ronda (\d+)/) || [])[1] || 0)
  if (ui.phase.toLowerCase().includes('mazo del centro')) {
    const d = await page.evaluate(() => window.__table.deckScreen())
    await page.mouse.click(d.x, d.y)
    await sleep(900)
    if (!shots.draw++) await shot('initial-draw')
    continue
  }
  if (await page.$('button') && ui.phase.toLowerCase().includes('te toca declarar')) {
    if (!shots.bid++) await shot('bidding-panel')
    // first enabled number button, then confirm
    const kami = await page.evaluate(() => {
      const k = document.querySelector('.tally-kami:not([disabled])')
      if (k && !window.__kamiDone) { k.click(); window.__kamiDone = true; return true }
      const nums = [...document.querySelectorAll('.tally-num')].filter((b) => !b.disabled)
      nums[0]?.click()
      return false
    })
    if (kami) log('browser declares KAMIKAZE')
    await sleep(300)
    await page.evaluate(() => document.querySelector('.tally .stamp-btn')?.click())
    await sleep(600)
    continue
  }
  // ready gate: read it (screenshot the first ones), then confirm
  if (await page.evaluate(() => Boolean(document.querySelector('.gate-panel button:not([disabled])')))) {
    const kind = await page.evaluate(() => document.querySelector('.gate-panel h2')?.textContent ?? '')
    if (kind.includes('Ronda') ? shots.gateRound++ < 2 : shots.gateBase++ < 2) await shot(kind.includes('Ronda') ? 'gate-round' : 'gate-base')
    await sleep(700)
    await page.evaluate(() => document.querySelector('.gate-panel button:not([disabled])')?.click())
    await sleep(500)
    continue
  }
  // ace choices: As de Copas (keep/invert) and As de Oros (who opens)
  if (await page.evaluate(() => Boolean(document.querySelector('.ritual-panel')))) {
    if (!shots.ace++) await shot('ace-choice')
    await page.evaluate(() => [...document.querySelectorAll('.ritual-panel .ritual-btn')][0]?.click())
    await sleep(500)
    continue
  }
  if (t.handShown > 0 && !shots.deal++) await shot('dealt')
  if (shots.announce < 2 && (await page.$('.announce'))) {
    shots.announce++
    await shot('bid-announce')
  }
  if (t.canPlay && t.queued === 0 && !t.busy && ui.phase.toLowerCase().includes('tu turno')) {
    const c = await page.evaluate(() => window.__table.vmScreen(0))
    if (c.visible) {
      await page.mouse.move(c.x, c.y)
      await sleep(250)
      await page.mouse.down()
      await sleep(60)
      await page.mouse.up()
      await sleep(900)
      if (shots.play++ < 2) await shot('my-play')
      continue
    }
  }
  if (t.onTable >= 3 && shots.collect < 2) {
    shots.collect++
    await shot('table-full')
    if (shots.collect === 1) {
      // zoom on the left neighbour's card: must stand up even with 4 players
      const z = await page.evaluate(() => window.__table.zoneScreen(1))
      await page.mouse.move(z.x, z.y)
      await page.mouse.down({ button: 'right' })
      await sleep(1400)
      await shot('zoom-neighbour')
      await page.mouse.up({ button: 'right' })
      await sleep(600)
    }
  }
  if (round >= 2 && round !== lastRound && shots.round2++ < 4) {
    await sleep(2500)
    await shot(`round-${round}`)
  }
  lastRound = round
}
await shot('end')
await page.keyboard.press('o')
await sleep(600)
await shot('settings')
await page.keyboard.press('Escape')
console.log(errors.length ? errors.join('\n') : 'no browser errors')
await browser.close()
process.exit(0)
