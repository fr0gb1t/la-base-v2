// Long main-thread tasks (>40 ms) from the click on "reglas" until the cover has opened.
// Usage: node e2e/rulebook.longtasks.mjs (vite on 5174)
import puppeteer from 'puppeteer-core'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const b = await puppeteer.launch({ executablePath: '/usr/bin/chromium', headless: 'new', args: ['--use-angle=vulkan', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'], defaultViewport: { width: 1280, height: 720 } })
const p = await b.newPage()
await p.goto('http://localhost:5174/?debug=1', { waitUntil: 'domcontentloaded' }); await sleep(2000)
await p.evaluate(() => { localStorage.clear(); localStorage.setItem('guestName', 'Vos') })
await p.reload({ waitUntil: 'domcontentloaded' }); await sleep(8000)
const r = await p.evaluate(async () => {
  const tasks = []
  const t0 = performance.now()
  new PerformanceObserver((l) => l.getEntries().forEach((e) => tasks.push([Math.round(e.startTime - t0), Math.round(e.duration)]))).observe({ entryTypes: ['longtask'] })
  const marks = {}
  const origRaf = window.requestAnimationFrame
  ;[...document.querySelectorAll('button')].find((e) => /reglas|reglamento/i.test(e.textContent))?.click()
  while (!window.__book) await new Promise((r) => setTimeout(r, 5))
  marks.mounted = Math.round(performance.now() - t0)
  while (!(window.__book?.debug().page === 0 && !window.__book.debug().turning)) await new Promise((r) => setTimeout(r, 30))
  marks.done = Math.round(performance.now() - t0)
  await new Promise((r) => setTimeout(r, 300))
  return { marks, tasks }
})
console.log(JSON.stringify(r))
await b.close()
