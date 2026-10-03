// Frames of the rulebook opening, every ~90 ms from the click. Usage: node e2e/rulebook.frames.mjs <out-prefix> [n]
import puppeteer from 'puppeteer-core'
const out = process.argv[2] ?? '/tmp/rbf'
const N = Number(process.argv[3] ?? 16)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const b = await puppeteer.launch({ executablePath: '/usr/bin/chromium', headless: 'new', args: ['--use-angle=vulkan', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'], defaultViewport: { width: 1280, height: 720 } })
const p = await b.newPage()
await p.goto('http://localhost:5174/?debug=1', { waitUntil: 'domcontentloaded' }); await sleep(2000)
await p.evaluate(() => { localStorage.clear(); localStorage.setItem('guestName', 'Vos') })
await p.reload({ waitUntil: 'domcontentloaded' }); await sleep(5000)
await p.evaluate(() => [...document.querySelectorAll('button')].find((e) => /reglas|reglamento/i.test(e.textContent))?.click())
for (let i = 0; i < N; i++) { await p.screenshot({ path: `${out}-${String(i).padStart(2, '0')}.png` }); await sleep(60) }
await b.close()
