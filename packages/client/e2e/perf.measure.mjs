// PERFORMANCE harness: same flow as table.e2e.mjs (1 real browser + 3 socket.io bots) but it measures how smooth
// the game runs, split by game phase: frame times, long animation frames (with the function that caused them,
// resolved through the source map), renderer statistics, JS heap, the CPU cost of each renderer.render() pass
// (world / depth / smooth props / shadow maps) and, apart, the 6.5 s after each click on the ready gate («listo»,
// end of a hand / start of a base).
// Usage: [CPU=4] [SMOOTH=on|off] [PROFILE=1] node e2e/perf.measure.mjs <out-prefix> [seconds=90]
//   CPU     = CPU throttling factor, 1 = none (4-6 approximate a modest laptop or phone)
//   SMOOTH  = force the «Bordes suaves» setting (default on)
//   PROFILE = also sample the CPU; writes <out>-profile.json (see perf.callers.mjs for who calls what)
// Needs the same test server/client as table.e2e.mjs (ports 3100 / 5174, never 3000) and a PRODUCTION build with
// source maps: VITE_SERVER_URL=http://localhost:3100 vite build --sourcemap, then vite preview --port 5174. The dev
// server is not what players run.
// Original header: End-to-end: 1 real browser (seat "Vos") + 3 socket.io bots against the real server.
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

const CPU = Number(process.env.CPU || 1)
// "Bordes suaves" (viewSettings.smoothProps): force it so the run is comparable. SMOOTH=on|off (default on).
const SMOOTH = process.env.SMOOTH === 'off' ? 'off' : 'on'
await page.evaluateOnNewDocument((smooth) => {
  const KEY = 'laBase.view'
  const prev = JSON.parse(localStorage.getItem(KEY) || '{}')
  localStorage.setItem(KEY, JSON.stringify({ ...prev, smoothProps: smooth === 'on', smoothChosen: true }))
}, SMOOTH)
await page.evaluateOnNewDocument(() => {
  const P = (window.__perf = { frames: [], loaf: [], marks: [], rend: [], heap: [], longtasks: [] })
  let last = 0
  const tick = (t) => {
    if (last) P.frames.push([t, t - last])
    last = t
    const r = window.__table?.renderer ?? window.__menu?.renderer
    if (r) {
      if (r.info.autoReset) r.info.autoReset = false
      // read what the previous frame accumulated (every pass of the post pipeline), then reset
      P.rend.push([t, r.info.render.calls, r.info.render.triangles, r.info.memory.geometries, r.info.memory.textures, r.info.programs?.length ?? 0])
      r.info.reset()
    }
    requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
  setInterval(() => { if (performance.memory) P.heap.push([performance.now(), performance.memory.usedJSHeapSize]) }, 500)
  try {
    new PerformanceObserver((l) => l.getEntries().forEach((e) => P.loaf.push({
      start: e.startTime, dur: e.duration, block: e.blockingDuration,
      scripts: e.scripts.map((s) => ({ fn: s.sourceFunctionName || s.invoker || '(anon)', url: (s.sourceURL || '').split('/').pop(), pos: s.sourceCharPosition, dur: Math.round(s.duration), type: s.invokerType, forced: Math.round(s.forcedStyleAndLayoutDuration) })),
    }))).observe({ type: 'long-animation-frame', buffered: true })
  } catch {}
})

// Time every renderer.render() call of post.render(), classified by its camera layers / overrideMaterial.
await page.evaluateOnNewDocument(() => {
  window.__passes = {}
  const iv = setInterval(() => {
    const r = window.__table?.renderer
    if (!r || r.__patched) return
    r.__patched = true
    const rec = (name, ms, calls, tris) => { const p = (window.__passes[name] ??= { n: 0, ms: 0, max: 0, calls: 0, tris: 0, over8: 0 }); p.n++; p.ms += ms; p.max = Math.max(p.max, ms); p.calls += calls; p.tris += tris; if (ms > 8) p.over8++ }
    const orig = r.render.bind(r)
    r.render = (scene, cam) => {
      const name = !scene.isScene ? 'post-quad' : scene.overrideMaterial ? 'depth-prepass (overrideMaterial)' : cam.layers.mask === 4 ? 'props (smooth overlay)' : 'world'
      const c0 = r.info.render.calls, t0 = r.info.render.triangles, a = performance.now()
      orig(scene, cam)
      rec(name, performance.now() - a, r.info.render.calls - c0, r.info.render.triangles - t0)
    }
    const sm = r.shadowMap.render.bind(r.shadowMap)
    r.shadowMap.render = (...args) => { const a = performance.now(); sm(...args); rec('  of which shadow maps', performance.now() - a, 0, 0) }
    clearInterval(iv)
  }, 50)
})
const cdp = await page.createCDPSession()
if (CPU > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU })
const mark = (label) => page.evaluate((l) => window.__perf.marks.push([performance.now(), l]), label).catch(() => {})
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

// In the 3D lobby headless Chromium answers synthetic key events after tens of seconds (even for keys the app
// ignores: Shift, F13), because the CPU is busy drawing the table; typing a 6-letter code takes minutes. The
// card mirrors a hidden DOM <input>, so write into it directly: the same `input` event the keyboard would fire.
const writeIntoFocusedInput = (text) =>
  page.evaluate((text) => {
    const el = document.activeElement
    if (!(el instanceof HTMLInputElement)) return false
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, text)
    el.dispatchEvent(new Event('input', { bubbles: true }))
    return true
  }, text)

const host = bot('Ana')
await sleep(800)
const created = await emit(host, 'room:create', { playerName: 'Ana', playerCount: 4 })
host.room = created.roomCode
log('room', host.room)

await page.goto(CLIENT, { waitUntil: 'networkidle0' })
await sleep(1500)
// Headless Chromium leaves the very first key event unanswered on a page nobody has touched yet, and
// page.keyboard.type() then hangs for good (it only surfaces as "Target closed" when the run is killed).
// Any prior interaction wakes the page up.
let profStart = null
if (process.env.PROFILE) {
  await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 400 }); await cdp.send('Profiler.start')
  profStart = await page.evaluate(() => performance.now())
}
await mark('menu'); await sleep(8000)
await page.bringToFront()
await page.keyboard.type('Vos') // the name card has focus
await mark('lobby'); await clickText('sentarse a la mesa')
await sleep(1500)
await clickText('sentarse') // the lobby's "Sentarse" card
await sleep(1200)
log('code typed', await writeIntoFocusedInput(host.room)) // the code card has focus
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
await mark('game-start')
let lastPhase = ''
let postGateUntil = 0
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
  if (ui.phase !== lastPhase) { lastPhase = ui.phase; if (Date.now() >= postGateUntil) await mark(ui.phase || 'sin-fase') }
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
    await mark('ANTES del clic en listo (' + (kind.includes('Ronda') ? 'fin de mano' : 'inicio de base') + ')')
    await sleep(1500)
    await mark('TRAS el clic en listo (' + (kind.includes('Ronda') ? 'fin de mano' : 'inicio de base') + ')')
    postGateUntil = Date.now() + 6500
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

const raw = await page.evaluate(() => window.__perf)
// Resolve minified positions to original source files with the build's source map (vite build --sourcemap).
const fsm = await import('node:fs'); const pathm = await import('node:path'); const { SourceMap } = await import('node:module')
const distDir = pathm.join(import.meta.dirname, '../dist/assets')
const resolvers = new Map()
const resolveAt = (url, pos) => {
  try {
    if (!url || pos == null || pos < 0) return ''
    if (!resolvers.has(url)) {
      const js = fsm.readFileSync(pathm.join(distDir, url), 'utf8')
      const map = new SourceMap(JSON.parse(fsm.readFileSync(pathm.join(distDir, url + '.map'), 'utf8')))
      resolvers.set(url, { js, map })
    }
    const { js, map } = resolvers.get(url)
    const before = js.slice(0, pos)
    const line = before.split('\n').length - 1
    const col = pos - (before.lastIndexOf('\n') + 1)
    const e = map.findEntry(line, col)
    return e?.originalSource ? ` => ${e.originalSource.split('/src/').pop()}:${e.originalLine + 1}${e.name ? ' ' + e.name : ''}` : ''
  } catch { return '' }
}

const pct = (arr, p) => arr.length ? arr[Math.min(arr.length - 1, Math.floor((p / 100) * arr.length))] : 0
const stats = (frames) => {
  const d = frames.map((f) => f[1]).sort((x, y) => x - y)
  const total = frames.reduce((a, f) => a + f[1], 0)
  const over = (ms) => frames.filter((f) => f[1] > ms).length
  return { frames: d.length, fps: +(1000 * d.length / (total || 1)).toFixed(1), p50: +pct(d, 50).toFixed(1), p95: +pct(d, 95).toFixed(1), p99: +pct(d, 99).toFixed(1), max: +(d[d.length - 1] || 0).toFixed(1), over25: over(25), over34: over(34), over50: over(50), over100: over(100) }
}
const marks = raw.marks
const segments = marks.map(([t0, label], i) => ({ label, t0, t1: i + 1 < marks.length ? marks[i + 1][0] : Infinity }))
const inSeg = (seg, t) => t >= seg.t0 && t < seg.t1
const merged = new Map()
for (const seg of segments) {
  const key = seg.label.slice(0, 48)
  const fr = raw.frames.filter((f) => inSeg(seg, f[0]))
  const m = merged.get(key) ?? { frames: [], secs: 0 }
  m.frames.push(...fr); m.secs += (Math.min(seg.t1, raw.frames.at(-1)?.[0] ?? seg.t0) - seg.t0) / 1000
  merged.set(key, m)
}
console.log('\n=== CPU x' + CPU + ' · bordes suaves: ' + SMOOTH + ' — frames por fase (ms por cuadro; ideal < 16.7) ===')
console.log('fase'.padEnd(50), 'seg'.padStart(5), 'fps'.padStart(6), 'p50'.padStart(6), 'p95'.padStart(6), 'p99'.padStart(6), 'max'.padStart(7), '>25'.padStart(5), '>34'.padStart(5), '>50'.padStart(5), '>100'.padStart(5))
for (const [k, m] of merged) {
  if (m.frames.length < 5) continue
  const x = stats(m.frames)
  console.log(k.padEnd(50), m.secs.toFixed(0).padStart(5), String(x.fps).padStart(6), String(x.p50).padStart(6), String(x.p95).padStart(6), String(x.p99).padStart(6), String(x.max).padStart(7), String(x.over25).padStart(5), String(x.over34).padStart(5), String(x.over50).padStart(5), String(x.over100).padStart(5))
}
const all = stats(raw.frames)
console.log('TOTAL'.padEnd(50), '', String(all.fps).padStart(6), String(all.p50).padStart(6), String(all.p95).padStart(6), String(all.p99).padStart(6), String(all.max).padStart(7), String(all.over25).padStart(5), String(all.over34).padStart(5), String(all.over50).padStart(5), String(all.over100).padStart(5))
const phaseAt = (t) => segments.filter((s) => inSeg(s, t)).at(-1)?.label?.slice(0, 40) ?? '?'
console.log('\n=== 10 cuadros más lentos ===')
for (const f of [...raw.frames].sort((a, b) => b[1] - a[1]).slice(0, 10)) console.log(f[1].toFixed(0).padStart(5) + ' ms  en t=' + (f[0] / 1000).toFixed(1) + 's  fase: ' + phaseAt(f[0]))
console.log('\n=== Long animation frames (>50ms): quién los causa ===')
const loaf = [...raw.loaf].sort((a, b) => b.dur - a.dur)
console.log('total:', raw.loaf.length, ' con bloqueo >50ms:', raw.loaf.filter((l) => l.block > 50).length)
for (const l of loaf.slice(0, 8)) console.log(l.dur.toFixed(0).padStart(5) + ' ms (bloquea ' + l.block.toFixed(0) + ')  fase: ' + phaseAt(l.start) + '\n     ' + (l.scripts.slice(0, 3).map((x) => `${x.fn} ${x.dur}ms ${x.type}${x.forced ? ' layout-forzado ' + x.forced + 'ms' : ''}${resolveAt(x.url, x.pos)}`).join('\n     ') || '(sin script: render/layout/paint)'))
const passes = await page.evaluate(() => window.__passes)
console.log('\n=== CPU por pasada de render (ms de CPU por cuadro; la GPU trabaja aparte) ===')
console.log('pasada'.padEnd(36), 'veces'.padStart(6), 'ms/cuadro'.padStart(10), 'max ms'.padStart(8), '>8ms'.padStart(6), 'dibujos'.padStart(8), 'triáng.'.padStart(9))
for (const [k, p] of Object.entries(passes ?? {})) console.log(k.padEnd(36), String(p.n).padStart(6), (p.ms / p.n).toFixed(2).padStart(10), p.max.toFixed(0).padStart(8), String(p.over8).padStart(6), String(Math.round(p.calls / p.n)).padStart(8), String(Math.round(p.tris / p.n)).padStart(9))

const rs = raw.rend.slice(20)
const avg = (i) => rs.length ? Math.round(rs.reduce((a, r) => a + r[i], 0) / rs.length) : 0
console.log('\n=== Renderer (promedio por cuadro, todas las pasadas) ===')
console.log('draw calls:', avg(1), ' triángulos:', avg(2), ' | geometrías:', rs.at(-1)?.[3], ' texturas:', rs.at(-1)?.[4], ' programas(shaders):', rs.at(-1)?.[5])
const heap = raw.heap.map((h) => h[1] / 1048576)
console.log('Heap JS: inicio ' + (heap[2] ?? 0).toFixed(0) + ' MB → fin ' + (heap.at(-1) ?? 0).toFixed(0) + ' MB, pico ' + Math.max(0, ...heap).toFixed(0) + ' MB, caídas bruscas (GC) ' + heap.filter((h, i) => i && heap[i - 1] - h > 5).length)

if (process.env.PROFILE) {
  const { profile } = await cdp.send('Profiler.stop')
  ;(await import('node:fs')).writeFileSync(out + '-profile.json', JSON.stringify({ profile, profStart }))
  const byId = new Map(profile.nodes.map((n) => [n.id, n]))
  const t0 = profile.startTime
  let acc = t0
  const selfBy = new Map()
  const samples = profile.samples.map((id, i) => { acc += profile.timeDeltas[i]; return [(acc - t0) / 1000 + profStart, id, profile.timeDeltas[i] / 1000] })
  const nameOf = (n) => {
    const cf = n.callFrame
    const orig = cf.url ? resolveAt(cf.url.split('/').pop(), charPos(cf)) : ''
    return (cf.functionName || '(anon)') + (orig || (cf.url ? ' ' + cf.url.split('/').pop() + ':' + cf.lineNumber : ''))
  }
  const charPos = (cf) => {
    try {
      const url = cf.url.split('/').pop()
      if (!url.endsWith('.js')) return -1
      const js = fsm.readFileSync(pathm.join(distDir, url), 'utf8')
      if (!charPos.cache) charPos.cache = new Map()
      if (!charPos.cache.has(url)) { const lens = []; let o = 0; for (const l of js.split('\n')) { lens.push(o); o += l.length + 1 } charPos.cache.set(url, lens) }
      const lens = charPos.cache.get(url)
      return (lens[cf.lineNumber] ?? 0) + cf.columnNumber
    } catch { return -1 }
  }
  const top = (list, n) => [...list.reduce((m, [, id, dt]) => { const k = nameOf(byId.get(id)); m.set(k, (m.get(k) ?? 0) + dt); return m }, new Map())].sort((a, b) => b[1] - a[1]).slice(0, n)
  const total = samples.reduce((a, x) => a + x[2], 0)
  console.log('\n=== Perfil de CPU (tiempo propio por función, toda la sesión ' + (total / 1000).toFixed(0) + ' s) ===')
  for (const [k, v] of top(samples, 22)) console.log(v.toFixed(0).padStart(7) + ' ms  ' + k.slice(0, 150))
  const bySrc = new Map()
  for (const [, id, dt] of samples) { const f = nameOf(byId.get(id)).split(' => ')[1]?.split(':')[0] ?? '(sistema/otros)'; bySrc.set(f, (bySrc.get(f) ?? 0) + dt) }
  console.log('\n=== CPU por archivo de origen ===')
  for (const [k, v] of [...bySrc].sort((a, b) => b[1] - a[1]).slice(0, 14)) console.log(v.toFixed(0).padStart(7) + ' ms  ' + k.replace(/^(\.\.\/)+node_modules\/\.pnpm\//, 'npm:'))
  console.log('\n=== Dentro de cada tirón grande (funciones con más tiempo propio) ===')
  for (const l of loaf.slice(0, 6)) {
    const win = samples.filter(([t]) => t >= l.start && t <= l.start + l.dur)
    console.log('-- ' + l.dur.toFixed(0) + ' ms  fase: ' + phaseAt(l.start))
    for (const [k, v] of top(win, 5)) console.log('     ' + v.toFixed(0).padStart(5) + ' ms  ' + k.slice(0, 140))
  }
}

const fs = await import('node:fs')
fs.writeFileSync(out + '-perf.json', JSON.stringify({ cpu: CPU, all, segments: [...merged].map(([k, m]) => ({ phase: k, ...stats(m.frames) })), loaf: loaf.slice(0, 30).map((l) => ({ ...l, phase: phaseAt(l.start) })) }, null, 1))
console.log('\nJSON:', out + '-perf.json')
await browser.close()
process.exit(0)
