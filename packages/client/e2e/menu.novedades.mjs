// The home screen with its side table and televisions (ajustes, novedades). Usage: node e2e/menu.novedades.mjs <out-prefix> [fresh|seen]
//   fresh: nothing seen yet (the Novedades set calls attention); seen: the newest entry is already seen
import puppeteer from 'puppeteer-core'
const out = process.argv[2] ?? '/tmp/menu'
const mode = process.argv[3] ?? 'fresh'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const b = await puppeteer.launch({ executablePath: '/usr/bin/chromium', headless: 'new', args: ['--use-angle=vulkan', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'], defaultViewport: { width: 1280, height: 720 } })
const p = await b.newPage()
const errors = []
p.on('pageerror', (e) => errors.push(e.message))
p.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
await p.goto('http://localhost:5174/?debug=1', { waitUntil: 'domcontentloaded' }); await sleep(1500)
await p.evaluate((mode) => {
  localStorage.clear()
  localStorage.setItem('guestName', 'Vos')
  if (mode === 'seen') localStorage.setItem('laBase.novedades', '2026-10-04-senas')
}, mode)
await p.reload({ waitUntil: 'domcontentloaded' }); await sleep(3500)
await p.screenshot({ path: `${out}-${mode}.png` })
if (mode === 'fresh') {
  // the Novedades set is on the left: hover it, open it (the list shows), close it (the set calms down)
  await p.mouse.move(165, 120); await sleep(900)
  await p.screenshot({ path: `${out}-hover.png` })
  // a real mouse click hangs the headless browser here (the original menu does too), so press the set through its handler
  await p.evaluate(() => window.__menu.onHud('novedades')); await sleep(900)
  await p.screenshot({ path: `${out}-panel.png` })
  console.log('seen after open:', await p.evaluate(() => localStorage.getItem('laBase.novedades')))
  await p.keyboard.press('Escape'); await sleep(900)
  await p.mouse.move(640, 600); await sleep(600)
  await p.screenshot({ path: `${out}-calm.png` })
}
console.log(errors.length ? `errors: ${errors.join(' | ')}` : 'no browser errors')
await b.close(); process.exit(errors.length ? 1 : 0)
