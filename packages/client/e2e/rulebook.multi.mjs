// Several leaves in the air at once: ArrowRight x4 in quick succession, frames while they turn,
// then back with ArrowLeft x2. Usage: node e2e/rulebook.multi.mjs <out-prefix>
import puppeteer from 'puppeteer-core'
const out = process.argv[2] ?? '/tmp/rbm'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const b = await puppeteer.launch({ executablePath: '/usr/bin/chromium', headless: 'new', args: ['--use-angle=vulkan', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'], defaultViewport: { width: 1280, height: 720 } })
const p = await b.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => m.type() === 'error' && errs.push(m.text()))
await p.goto('http://localhost:5174/?debug=1', { waitUntil: 'domcontentloaded' }); await sleep(2000)
await p.evaluate(() => { localStorage.clear(); localStorage.setItem('guestName', 'Vos') })
await p.reload({ waitUntil: 'domcontentloaded' }); await sleep(8000)
await p.evaluate(() => [...document.querySelectorAll('button')].find((e) => /reglas|reglamento/i.test(e.textContent))?.click())
await p.waitForFunction(() => window.__book?.debug().page === 0 && !window.__book.debug().turning, { timeout: 10000 }); await sleep(800)
// chapters 1..4 are pre-photographed so the test measures the turning, not the photographs
await p.evaluate(() => window.__bookPages.want(['R1', 'L1', 'R2', 'L2', 'R3', 'L3', 'R4', 'L4'])); await sleep(2500)
let maxLeaves = 0
const watch = setInterval(async () => { try { maxLeaves = Math.max(maxLeaves, await p.evaluate(() => window.__book.debug().leaves)) } catch {} }, 30)
for (let i = 0; i < 4; i++) { await p.keyboard.press('ArrowRight'); await sleep(110) }
for (let i = 0; i < 6; i++) { await p.screenshot({ path: `${out}-fwd${i}.png` }); await sleep(70) }
await p.waitForFunction(() => window.__book.debug().page === 4 && !window.__book.debug().turning, { timeout: 8000 })
await sleep(500); await p.screenshot({ path: `${out}-at4.png` })
for (let i = 0; i < 2; i++) { await p.keyboard.press('ArrowLeft'); await sleep(110) }
await p.waitForFunction(() => window.__book.debug().page === 2 && !window.__book.debug().turning, { timeout: 8000 })
clearInterval(watch)
console.log(JSON.stringify({ maxLeaves, page: await p.evaluate(() => window.__book.debug().page), errors: errs }))
await b.close()
