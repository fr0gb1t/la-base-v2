// Regression: after leaving the name card you can click it again and keep typing.
// Usage: node e2e/namecard.refocus.mjs
import puppeteer from 'puppeteer-core'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const b = await puppeteer.launch({ executablePath: '/usr/bin/chromium', headless: 'new', args: ['--use-angle=vulkan', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'], defaultViewport: { width: 1280, height: 720 } })
const p = await b.newPage()
await p.goto('http://localhost:5174/?debug=1', { waitUntil: 'networkidle0' })
await p.evaluate(() => localStorage.clear())
await p.reload({ waitUntil: 'networkidle0' })
await sleep(2500)
const value = () => p.evaluate(() => document.querySelector('.sr-only-input')?.value)
await p.keyboard.type('Fe')
console.log('typed:', await value())
await p.mouse.click(40, 700) // click outside the card (empty table area)
await sleep(400)
await p.keyboard.type('X')
console.log('after clicking outside, typing X:', await value())
// click on the card centre
const c = await p.evaluate(() => {
  const m = window.__menu
  const h = m.inputCard.hit
  const v = h.position.clone().project(m.camera)
  return { x: ((v.x + 1) / 2) * innerWidth, y: ((1 - v.y) / 2) * innerHeight }
})
await p.mouse.move(c.x, c.y)
await sleep(300)
await p.mouse.click(c.x, c.y)
await sleep(300)
await p.keyboard.type('de')
const final = await value()
console.log('after clicking the card, typing de:', final)
console.log(final?.endsWith('de') ? 'PASS' : 'FAIL')
await b.close()
process.exit(final?.endsWith('de') ? 0 : 1)
