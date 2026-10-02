// The 3D booklet: it opens, a page can be dragged over (and shows its shadow), a click turns it,
// a page turning by itself can be caught. Screenshots go to $OUT (default /tmp).
// Needs the test vite on 5174 (see README.md).
import puppeteer from 'puppeteer-core'
const OUT = process.env.OUT ?? '/tmp'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const b = await puppeteer.launch({ executablePath: '/usr/bin/chromium', headless: 'new', args: ['--use-angle=vulkan', '--enable-unsafe-swiftshader'], defaultViewport: { width: 1280, height: 720 } })
const p = await b.newPage()
const errors = []
p.on('pageerror', (e) => errors.push(e.message))
p.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
await p.evaluateOnNewDocument(() => { if (!localStorage.getItem('guestName')) localStorage.setItem('guestName', 'Vos') })
await p.goto('http://localhost:5174/?debug=1', { waitUntil: 'networkidle2' })
await p.waitForFunction(() => [...document.querySelectorAll('button')].some((e) => /reglamento/i.test(e.textContent)), { timeout: 20000 })
await p.evaluate(() => [...document.querySelectorAll('button')].find((e) => /reglamento/i.test(e.textContent)).click())
await sleep(450)
await p.screenshot({ path: `${OUT}/b3-0-opening.png` })
await p.waitForFunction(() => window.__book?.debug().page === 0 && !window.__book.debug().turning, { timeout: 10000 })
await sleep(900)
await p.screenshot({ path: `${OUT}/b3-1-open.png` })
const book = (fn, ...a) => p.evaluate(fn, ...a)
const state = () => book(() => window.__book.debug())

// drag the bottom-right corner over, slowly, stopping half-way
const corner = await book(() => window.__book.screenOf('right', 0.95, 0.92))
const spineMid = await book(() => window.__book.screenOf('right', 0.0, 0.92))
await p.mouse.move(corner.x, corner.y)
await p.mouse.down()
for (let i = 1; i <= 12; i++) { await p.mouse.move(corner.x + (spineMid.x - corner.x) * i * 0.06, corner.y - i * 8); await sleep(30) }
await sleep(300)
await p.screenshot({ path: `${OUT}/b3-2-corner-lift.png` })
for (let i = 13; i <= 20; i++) { await p.mouse.move(corner.x + (spineMid.x - corner.x) * i * 0.06, corner.y - i * 8); await sleep(30) }
await sleep(300)
console.log('corner drag:', JSON.stringify(await state()))
await p.screenshot({ path: `${OUT}/b3-3-corner-past.png` })
await p.mouse.up()
await sleep(1300)
console.log('after release:', JSON.stringify(await state()))

// hold from the middle of the page and lift it to the vertical
const mid = await book(() => window.__book.screenOf('right', 0.5, 0.5))
const spine = await book(() => window.__book.screenOf('right', 0.0, 0.5))
await p.mouse.move(mid.x, mid.y)
await p.mouse.down()
for (let i = 1; i <= 6; i++) { await p.mouse.move(mid.x + (spine.x - mid.x) * i * 0.1, mid.y - i * 4); await sleep(30) }
await sleep(300)
await p.screenshot({ path: `${OUT}/b3-4a-middle-lifting.png` })
for (let i = 7; i <= 10; i++) { await p.mouse.move(mid.x + (spine.x - mid.x) * i * 0.1, mid.y - i * 4); await sleep(30) }
await sleep(300)
console.log('middle drag:', JSON.stringify(await state()))
await p.screenshot({ path: `${OUT}/b3-4-middle-held.png` })
// let it fall back
for (let i = 9; i >= 0; i--) { await p.mouse.move(mid.x + (spine.x - mid.x) * i * 0.1 + 40, mid.y); await sleep(20) }
await p.mouse.up()
await sleep(1200)
console.log('fell back:', JSON.stringify(await state()))

// a click turns it by itself; catch it mid-way and drag it back
const page0 = (await state()).page
const top = await book(() => window.__book.screenOf('right', 0.85, 0.15))
await p.mouse.click(top.x, top.y)
await sleep(260)
await p.screenshot({ path: `${OUT}/b3-5-click-turning.png` })
const s1 = await state()
console.log('click turning:', JSON.stringify(s1))
await sleep(1200)
console.log('after click:', JSON.stringify(await state()), 'was', page0)

// arrows
await p.keyboard.press('ArrowRight'); await sleep(1300)
await p.keyboard.press('ArrowLeft'); await sleep(250)
await p.screenshot({ path: `${OUT}/b3-6-back-turning.png` })
await sleep(1200)
console.log('arrows:', JSON.stringify(await state()))
// overflowing pages (text cut in the picture)
const over = await p.evaluate(() => [...document.querySelectorAll('.rb-sheet > *')].filter((n) => n.scrollHeight > n.clientHeight + 2).map((n) => n.parentElement.dataset.key + ':' + n.scrollHeight))
console.log('overflow:', over.join(' ') || 'none')
console.log('errors:', errors.length ? errors.slice(0, 5).join('\n') : 'none')
await b.close()
