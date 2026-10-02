// Every page of the illustrated rulebook, from the main menu (and R at the table works the same).
// Usage: node e2e/rulebook.shots.mjs <out-prefix>
import puppeteer from 'puppeteer-core'
const out = process.argv[2] ?? '/tmp/rb'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const b = await puppeteer.launch({ executablePath: '/usr/bin/chromium', headless: 'new', args: ['--use-angle=vulkan', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'], defaultViewport: { width: 1280, height: 720 } })
const p = await b.newPage()
const errors = []
p.on('pageerror', (e) => errors.push(e.message))
p.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
await p.goto('http://localhost:5174/?debug=1', { waitUntil: 'domcontentloaded' }); await sleep(2000)
await p.evaluate(() => { localStorage.clear(); localStorage.setItem('guestName', 'Vos') })
await p.reload({ waitUntil: 'domcontentloaded' }); await sleep(2500)
await p.evaluate(() => [...document.querySelectorAll('button')].find((e) => /reglas|reglamento/i.test(e.textContent))?.click()); await p.waitForFunction(() => window.__book?.debug().page === 0 && !window.__book.debug().turning, { timeout: 10000 }) // the cover opens
await sleep(600)
const pages = await p.evaluate(() => document.querySelectorAll('.rb-tab').length)
for (let i = 0; i < pages; i++) {
  await p.screenshot({ path: `${out}-${String(i).padStart(2, '0')}.png` })
  await p.keyboard.press('ArrowRight')
  if (i < pages - 1) await p.waitForFunction((n) => window.__book.debug().page === n && !window.__book.debug().turning, { timeout: 5000 }, i + 1)
  await sleep(400) // the next pages' pictures
}
console.log('pages', pages, errors.length ? `errors: ${errors.join(' | ')}` : 'no browser errors')
await b.close(); process.exit(pages > 0 && !errors.length ? 0 : 1)
