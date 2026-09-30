// Screenshots of every menu screen. Usage: node e2e/menu.shots.mjs <out-prefix>
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
  const b = [...document.querySelectorAll('button')].find((x) => x.textContent.toLowerCase().includes(t) && !x.disabled)
  b?.click(); return Boolean(b)
}, text)
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle0' })
await page.evaluate(() => localStorage.clear())
await page.reload({ waitUntil: 'networkidle0' })
await shot('entrada-vacia', 3000)
await page.type('input[placeholder="Ingresá tu nombre"]', 'Fede', { delay: 60 })
await shot('entrada-nombre', 1500)
await click('jugar como invitado')
await shot('lobby', 2500)
await page.hover('.option-btn:nth-child(2)')
await shot('lobby-hover-sentarse', 1200)
await click('reglamento')
await shot('reglas', 2000)
await click('volver')
await click('armar mesa')
await shot('armar-mesa', 2000)
await click('6')
await shot('armar-mesa-6', 1500)
await click('4')
await click('crear sala')
await shot('sala-sola', 2500)
for (let i = 0; i < 3; i++) { await click('+ bot'); await sleep(700) }
await shot('sala-con-bots', 3000)
await click('configurar y empezar')
await shot('config', 2500)
await click('as de copas')
await shot('config-copas-off', 1800)
console.log(errors.length ? errors.join('\n') : 'no browser errors')
await browser.close()
