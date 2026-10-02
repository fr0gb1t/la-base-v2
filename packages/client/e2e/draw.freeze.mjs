// The initial draw ("sorteo") as the host plays it from the UI: create the table, add bots, start,
// click the deck. The table must keep rendering (frames advance) and the page must stay responsive.
// Usage: node e2e/draw.freeze.mjs [players=4]
import puppeteer from 'puppeteer-core'
const N = Number(process.argv[2] ?? 4)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const b = await puppeteer.launch({ executablePath: '/usr/bin/chromium', headless: 'new', args: ['--use-angle=vulkan', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'], defaultViewport: { width: 1280, height: 720 } })
const p = await b.newPage()
const errors = []
p.on('pageerror', (e) => errors.push(`PAGEERR ${e.message}\n${e.stack ?? ''}`.slice(0, 900)))
p.on('console', (m) => (m.type() === 'error' || m.type() === 'warn') && errors.push(`${m.type()} ${m.text()}`.slice(0, 400)))
await p.goto('http://localhost:5174/?debug=1', { waitUntil: 'domcontentloaded' }); await sleep(2000)
await p.evaluate(() => { localStorage.clear(); localStorage.setItem('guestName', 'Fede') })
await p.reload({ waitUntil: 'domcontentloaded' }); await sleep(2500)
const click = (t) => p.evaluate((t) => { const x = [...document.querySelectorAll('button')].find((e) => e.textContent.trim().toLowerCase().startsWith(t) && !e.disabled); x?.click(); return !!x }, t)
await click('armar mesa'); await sleep(1200)
await click(String(N)); await sleep(400)
await click('abrir la mesa'); await sleep(2000)
for (let i = 0; i < N - 1; i++) { await click('+ bot'); await sleep(700) }
await click('configurar y empezar'); await sleep(1500)
await click('iniciar partida'); await sleep(3000)
// a frame counter running inside the page
await p.evaluate(() => { window.__frames = 0; const tick = () => { window.__frames++; requestAnimationFrame(tick) }; requestAnimationFrame(tick) })
const responsive = async () => Promise.race([p.evaluate(() => ({ frames: window.__frames, three: window.__table?.debugState?.() ? true : false, phase: document.querySelector('.phase-line')?.textContent })), sleep(4000).then(() => null)])
const r = []
for (let i = 0; i < 40; i++) {
  await sleep(500)
  const st = await responsive()
  if (!st) { r.push('PAGE NOT RESPONDING'); break }
  if (/mazo del centro/i.test(st.phase ?? '')) {
    const d = await p.evaluate(() => window.__table.deckScreen())
    r.push(`click deck at ${Math.round(d.x)},${Math.round(d.y)} (frames ${st.frames})`)
    await p.mouse.click(d.x, d.y)
    for (let k = 0; k < 6; k++) {
      await sleep(700)
      const s2 = await responsive()
      r.push(s2 ? `+${(k + 1) * 0.7}s frames ${s2.frames} phase "${s2.phase}"` : 'PAGE NOT RESPONDING')
      if (!s2) break
    }
    break
  }
}
// three.js own frame counter: does the table still render?
const renders = await Promise.race([p.evaluate(() => window.__table?.renderer?.info?.render?.frame ?? null), sleep(3000).then(() => 'timeout')])
const renders2 = await Promise.race([(async () => { await sleep(1000); return p.evaluate(() => window.__table?.renderer?.info?.render?.frame ?? null) })(), sleep(5000).then(() => 'timeout')])
console.log(r.join('\n'))
console.log('audio listener:', await p.evaluate(() => { const c = window.__table?.camera; const l = c?.children.find((x) => x.type === 'AudioListener'); return l ? l.context.state : 'none' }))
console.log('three frames', renders, '→', renders2)
await sleep(6000)
const { dealAnimationMs } = await import('@la-base/shared')
const deals = await p.evaluate(() => window.__table.dealTimes)
console.log('deals (real vs estimate):', JSON.stringify(deals.map((d) => ({ ...d, estimate: dealAnimationMs(d.players, d.cards) }))))
console.log(errors.length ? errors.join('\n---\n') : 'no browser errors')
await b.close(); process.exit(0)
