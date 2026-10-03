// Frame gaps and long tasks while closing the rulebook (Esc). Usage: node e2e/rulebook.close.mjs
import puppeteer from 'puppeteer-core'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const b = await puppeteer.launch({ executablePath: '/usr/bin/chromium', headless: 'new', args: ['--use-angle=vulkan', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'], defaultViewport: { width: 1280, height: 720 } })
const p = await b.newPage()
await p.goto('http://localhost:5174/?debug=1', { waitUntil: 'domcontentloaded' }); await sleep(2000)
await p.evaluate(() => { localStorage.clear(); localStorage.setItem('guestName', 'Vos') })
await p.reload({ waitUntil: 'domcontentloaded' }); await sleep(8000)
await p.evaluate(() => [...document.querySelectorAll('button')].find((e) => /reglas|reglamento/i.test(e.textContent))?.click())
await sleep(3500)
const r = await p.evaluate(async () => {
  const gaps = []; const tasks = []; let last = performance.now(); const t0 = last; let stop = false
  new PerformanceObserver((l) => l.getEntries().forEach((e) => tasks.push([Math.round(e.startTime - t0), Math.round(e.duration)]))).observe({ entryTypes: ['longtask'] })
  const tick = () => { const n = performance.now(); gaps.push([Math.round(n - t0), Math.round(n - last)]); last = n; if (!stop) requestAnimationFrame(tick) }
  requestAnimationFrame(tick)
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
  const veil = () => document.querySelector('.rb-veil')
  const samples = []
  for (let i = 0; i < 40; i++) { await new Promise((r) => setTimeout(r, 50)); const v = veil(); samples.push(v ? `${Math.round(t0 ? performance.now() - t0 : 0)}:${getComputedStyle(v).opacity}` : 'none') }
  stop = true
  return { tasks, worst: gaps.sort((a, b) => b[1] - a[1]).slice(0, 4), samples: samples.filter((_, i) => i % 3 === 0) }
})
console.log(JSON.stringify(r))
await b.close()
