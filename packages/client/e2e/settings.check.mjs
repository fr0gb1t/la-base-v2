// Settings panel: opens with O, toggles/volume persist, Esc closes. Usage: node e2e/settings.check.mjs
import puppeteer from 'puppeteer-core'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const b = await puppeteer.launch({ executablePath: '/usr/bin/chromium', headless: 'new', args: ['--use-angle=vulkan', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'], defaultViewport: { width: 1280, height: 720 } })
const p = await b.newPage()
p.on('pageerror', (e) => console.log('ERR', e.message))
await p.goto('http://localhost:5174/', { waitUntil: 'domcontentloaded' })
await sleep(2500)
await p.evaluate(() => { localStorage.clear(); localStorage.setItem('guestName', 'Fede') })
await p.reload({ waitUntil: 'domcontentloaded' })
await sleep(2500)
await p.keyboard.press('o'); await sleep(400)
const open = (await p.$('.settings-veil')) !== null
await p.evaluate(() => [...document.querySelectorAll('.setting-row')][0].click())
await p.evaluate(() => { const r = document.querySelector('.setting-volume input'); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(r, '35'); r.dispatchEvent(new Event('input', { bubbles: true })) })
await sleep(200)
const saved = JSON.parse(await p.evaluate(() => localStorage.getItem('laBase.audio')))
await p.keyboard.press('Escape'); await sleep(300)
const closed = (await p.$('.settings-veil')) === null
const ok = open && closed && saved.ambient === false && saved.effects === true && Math.abs(saved.volume - 0.35) < 0.01
console.log(JSON.stringify({ open, saved, closed }), ok ? 'PASS' : 'FAIL')
await b.close()
process.exit(ok ? 0 : 1)
