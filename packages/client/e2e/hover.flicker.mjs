// Hover-flicker regression test: park the cursor near the edge of a card (where the lift animation
// used to pull the card away) and count hover changes. Usage: node e2e/hover.flicker.mjs
import puppeteer from 'puppeteer-core'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const b = await puppeteer.launch({ executablePath: '/usr/bin/chromium', headless: 'new', args: ['--use-angle=vulkan', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'], defaultViewport: { width: 1280, height: 720 } })
const p = await b.newPage()
await p.goto('http://localhost:5173/?debug=1', { waitUntil: 'networkidle0' })
await p.evaluate(() => { localStorage.clear(); localStorage.setItem('guestName', 'Test') })
await p.reload({ waitUntil: 'networkidle0' })
await sleep(2500)
let fails = 0
for (const [i, edge] of [[1, -0.45], [1, 0.45], [0, -0.45], [2, 0.45]]) {
  const at = () => p.evaluate((i, edge) => {
    const m = window.__menu
    const h = m.options[i].hit
    const v = h.localToWorld(h.position.clone().set(0, edge * 0.095 * 1.75, 0)).project(m.camera)
    return { x: ((v.x + 1) / 2) * innerWidth, y: ((1 - v.y) / 2) * innerHeight }
  }, i, edge)
  // the lobby camera has a slight mouse parallax: aim, let it settle, aim again
  let pt = await at()
  await p.mouse.move(pt.x, pt.y)
  await sleep(1800)
  pt = await at()
  await p.mouse.move(pt.x, pt.y)
  await sleep(1200)
  let changes = 0
  let last = await p.evaluate(() => window.__menu.hovered)
  for (let k = 0; k < 40; k++) {
    await sleep(50)
    const h = await p.evaluate(() => window.__menu.hovered)
    if (h !== last) changes++
    last = h
  }
  console.log(`option ${i} edge ${edge}: hovered=${last} changes=${changes}`)
  if (changes > 0 || last !== i) fails++
  await p.mouse.move(5, 5)
  await sleep(700)
}
console.log(fails ? `FAIL (${fails})` : 'PASS: no hover flicker')
await b.close()
process.exit(fails ? 1 : 0)
