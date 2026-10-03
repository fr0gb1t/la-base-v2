// The app on a phone (touch emulation): every menu in landscape and portrait. Usage: node e2e/mobile.shots.mjs <out-prefix> (vite 5174, test server 3100)
import puppeteer from 'puppeteer-core'
const out = process.argv[2] ?? '/tmp/mob'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const b = await puppeteer.launch({ executablePath: '/usr/bin/chromium', headless: 'new', args: ['--use-angle=vulkan', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/126 Mobile Safari/537.36'
for (const [tag, vp] of [['land', { width: 844, height: 390, isLandscape: true }], ['port', { width: 390, height: 844, isLandscape: false }]]) {
  const p = await b.newPage()
  await p.emulate({ viewport: { ...vp, deviceScaleFactor: 1, isMobile: true, hasTouch: true }, userAgent: UA })
  const errs = []; p.on('pageerror', (e) => errs.push(e.message))
  await p.goto('http://localhost:5174/?debug=1', { waitUntil: 'networkidle0' })
  await p.evaluate(() => localStorage.clear()); await p.reload({ waitUntil: 'networkidle0' }); await sleep(2500)
  const shot = async (name, wait = 1500) => { await sleep(wait); await p.screenshot({ path: `${out}-${tag}-${name}.png` }) }
  const tap = (t) => p.evaluate((t) => { const x = [...document.querySelectorAll('button')].find((e) => e.textContent.trim().toLowerCase().startsWith(t) && !e.disabled); x?.click(); return !!x }, t)
  await shot('0-entrada', 500)
  await tap('tengo cuenta'); await shot('0b-cuenta', 1500); await tap('volver'); await sleep(500); await p.keyboard.press('Escape'); await sleep(500)
  await p.keyboard.type('Fede', { delay: 50 }); await tap('sentarse a la mesa'); await shot('1-lobby', 2200)
  await tap('armar mesa'); await shot('2-armar', 2000)
  await tap('abrir la mesa'); await sleep(2500); for (let i = 0; i < 3; i++) { await tap('+ bot'); await sleep(500) }
  await shot('3-sala', 2500)
  await tap('configurar y empezar'); await shot('4-config', 2500)
  await p.keyboard.press('o'); await shot('5-ajustes', 1200); await p.keyboard.press('Escape')
  await tap('salir'); await sleep(1500); await tap('reglamento'); await shot('6-reglas', 4500)
  console.log(tag, errs.join('|') || 'ok')
  await p.close()
}
await b.close()
