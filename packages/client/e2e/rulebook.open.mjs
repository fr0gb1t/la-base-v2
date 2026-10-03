// How smoothly the rulebook opens: frame gaps (ms) from the click until the cover has opened, and
// the share of that time the canvas was visible. Usage: node e2e/rulebook.open.mjs (vite 5174)
import puppeteer from 'puppeteer-core'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const b = await puppeteer.launch({ executablePath: '/usr/bin/chromium', headless: 'new', args: ['--use-angle=vulkan', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'], defaultViewport: { width: 1280, height: 720 } })
const p = await b.newPage()
await p.goto('http://localhost:5174/?debug=1', { waitUntil: 'domcontentloaded' }); await sleep(2000)
await p.evaluate(() => { localStorage.clear(); localStorage.setItem('guestName', 'Vos') })
await p.reload({ waitUntil: 'domcontentloaded' }); await sleep(8000) // idle: the fonts are fetched
const r = await p.evaluate(async () => {
  const gaps = []
  let last = performance.now(); let stop = false; let visibleAt = null
  const t0 = performance.now()
  const tick = () => {
    const n = performance.now(); gaps.push([Math.round(n - t0), Math.round(n - last)]); last = n
    const c = document.querySelector('.rb-canvas')
    if (visibleAt === null && c && c.style.opacity === '1') visibleAt = Math.round(n - t0)
    if (!stop) requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
  ;[...document.querySelectorAll('button')].find((e) => /reglas|reglamento/i.test(e.textContent))?.click()
  while (!(window.__book?.debug().page === 0 && !window.__book.debug().turning)) await new Promise((r) => setTimeout(r, 30))
  const done = Math.round(performance.now() - t0)
  stop = true
  const afterReveal = gaps.filter(([t]) => visibleAt === null || t >= visibleAt)
  return { visibleAt, done, worstGapBeforeReveal: Math.max(...gaps.filter(([t]) => visibleAt !== null && t < visibleAt).map(([, g]) => g), 0), worstGapAfterReveal: Math.max(...afterReveal.map(([, g]) => g)), over100AfterReveal: afterReveal.filter(([, g]) => g > 100).length }
})
console.log(JSON.stringify(r))
await b.close()
