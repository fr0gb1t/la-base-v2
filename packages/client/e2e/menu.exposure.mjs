// Measures how burnt the bright menu surfaces are: % of near-white pixels on the name card and a
// floating tag, plus their mean luminance. Usage: node e2e/menu.exposure.mjs <out.png>
import puppeteer from 'puppeteer-core'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const b = await puppeteer.launch({ executablePath: '/usr/bin/chromium', headless: 'new', args: ['--use-angle=vulkan', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'], defaultViewport: { width: 1280, height: 720 } })
const p = await b.newPage()
await p.goto('http://localhost:5174/?debug=1', { waitUntil: 'networkidle0' })
await p.evaluate(() => localStorage.clear())
await p.reload({ waitUntil: 'networkidle0' })
await sleep(2500)
await p.keyboard.type('Fede')
await sleep(1500)
const boxes = await p.evaluate(() => {
  const m = window.__menu
  const proj = (o) => { const v = o.getWorldPosition(o.position.clone()).project(m.camera); return { x: ((v.x + 1) / 2) * innerWidth, y: ((1 - v.y) / 2) * innerHeight } }
  const card = proj(m.inputCard.mesh)
  const tag = [...m.floating.live.values()].find((l) => l.def.id === 'entrar')
  return { card, tag: tag ? proj(tag.mesh) : null }
})
await p.screenshot({ path: process.argv[2] ?? '/tmp/exposure.png' })
console.log(JSON.stringify(boxes))
await b.close()
