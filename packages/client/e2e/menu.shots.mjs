// Screenshots of every menu screen (3D table menus). Usage: node e2e/menu.shots.mjs <out-prefix>
import puppeteer from 'puppeteer-core'
const [, , out = '/tmp/menu'] = process.argv
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const browser = await puppeteer.launch({
  executablePath: '/usr/bin/chromium', headless: 'new',
  args: ['--use-angle=vulkan', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', '--window-size=1280,720'],
  defaultViewport: { width: 1280, height: 720 },
})
const page = await browser.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
let n = 0
const shot = async (name, wait = 1800) => { await sleep(wait); await page.screenshot({ path: `${out}-${String(n++).padStart(2, '0')}-${name}.png` }); console.log('shot', name) }
const click = (text) => page.evaluate((t) => {
  const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim().toLowerCase().startsWith(t) && !x.disabled)
  b?.click(); return Boolean(b)
}, text)
await page.goto('http://localhost:5173/?debug=1', { waitUntil: 'networkidle0' })
await page.evaluate(() => localStorage.clear())
await page.reload({ waitUntil: 'networkidle0' })
await shot('entrada-vacia', 3000)
await page.keyboard.type('Fede', { delay: 80 })
await shot('entrada-nombre', 1200)
await click('sentarse a la mesa')
await shot('lobby', 2500)
await click('armar mesa')
await shot('armar-mesa', 2200)
await click('6')
await shot('armar-mesa-6', 1500)
await click('4')
await click('abrir la mesa')
await shot('sala-sola', 2800)
for (let i = 0; i < 3; i++) { await click('+ bot'); await sleep(700) }
await shot('sala-con-bots', 2500)
await click('configurar y empezar')
await shot('config', 2500)
await page.evaluate(() => window.__menu.onAcePick('copas'))
await shot('config-copas-off', 700)
await shot('config-copas-off-end', 1200)
// join screen: a fresh visitor (no saved room)
await page.evaluate(() => { localStorage.clear(); localStorage.setItem('guestName', 'Otro') })
await page.goto('http://localhost:5173/?debug=1', { waitUntil: 'networkidle0' })
await sleep(1500)
await click('sentarse')
await sleep(1500)
await page.keyboard.type('ab12', { delay: 80 })
await shot('unirse-codigo', 1500)
console.log(errors.length ? errors.join('\n') : 'no browser errors')
await browser.close()
