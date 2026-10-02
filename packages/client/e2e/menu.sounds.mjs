// Menu sounds fire on real pointer use: hover ticks, a pick, chalk while typing, the rulebook's
// book and page, the settings' paper. Usage: node e2e/menu.sounds.mjs
import puppeteer from 'puppeteer-core'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const b = await puppeteer.launch({ executablePath: '/usr/bin/chromium', headless: 'new', args: ['--use-angle=vulkan', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'], defaultViewport: { width: 1280, height: 720 } })
const p = await b.newPage()
const errors = []
p.on('pageerror', (e) => errors.push(e.message))
await p.goto('http://localhost:5174/?debug=1', { waitUntil: 'domcontentloaded' }); await sleep(2000)
await p.evaluate(() => localStorage.clear())
await p.reload({ waitUntil: 'domcontentloaded' }); await sleep(2500)
await p.keyboard.type('Fede', { delay: 60 }) // chalk on the name card (the first key also unlocks the audio, so it is silent)
await p.evaluate(() => [...document.querySelectorAll('button')].find((e) => /sentarse a la mesa/i.test(e.textContent))?.click()); await sleep(2000)
// sweep the screen with the pointer over the lobby cards, then click where it points
let clicked = false
for (let y = 300; y <= 620 && !clicked; y += 40)
  for (let x = 200; x <= 1080 && !clicked; x += 40) {
    await p.mouse.move(x, y); await sleep(25)
    if ((await p.evaluate(() => document.querySelector('canvas')?.style.cursor)) === 'pointer') { await p.mouse.click(x, y); clicked = true }
  }
await sleep(1200)
await p.keyboard.press('o'); await sleep(400); await p.keyboard.press('Escape'); await sleep(400)
const s = await p.evaluate(() => window.__uiSounds ?? {})
console.log(JSON.stringify(s), errors.length ? errors : 'no page errors')
const ok = s.write >= 3 && s.hover >= 1 && (s.pick ?? 0) + (s.stamp ?? 0) >= 1 && s.paper >= 2
console.log(ok ? 'PASS' : 'FAIL')
await b.close(); process.exit(ok ? 0 : 1)
