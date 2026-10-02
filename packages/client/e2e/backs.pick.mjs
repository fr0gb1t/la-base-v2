// Card backs: the chooser lists every design; picking one repaints every card back.
// Usage: node e2e/backs.pick.mjs <out-dir>   (test vite on 5174, see README.md)
import puppeteer from 'puppeteer-core'
const OUT = process.argv[2] ?? '/tmp'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const b = await puppeteer.launch({ executablePath: '/usr/bin/chromium', headless: 'new', args: ['--use-angle=vulkan', '--enable-unsafe-swiftshader'], defaultViewport: { width: 1280, height: 720 } })
const p = await b.newPage()
const errors = []
p.on('pageerror', (e) => errors.push(e.message))
p.on('console', (m) => (m.type() === 'error' || m.type() === 'warn') && /card back|Error/i.test(m.text()) && errors.push(m.text()))
await p.evaluateOnNewDocument(() => { if (!localStorage.getItem('guestName')) localStorage.setItem('guestName', 'Vos') })
await p.goto('http://localhost:5174/?debug=1', { waitUntil: 'networkidle2' })
await p.waitForSelector('button[title="Ajustes (O)"]', { timeout: 20000 })
await p.click('button[title="Ajustes (O)"]')
await sleep(800)
const n = await p.evaluate(() => document.querySelectorAll('.setting-back').length)
await p.click('.setting-back img[alt="Cuervos"]')
await sleep(600)
await p.screenshot({ path: `${OUT}/backs-settings.png` })
const picked = await p.evaluate(() => JSON.parse(localStorage.getItem('laBase.view')).cardBack)
// every thumbnail loaded
const broken = await p.evaluate(() => [...document.querySelectorAll('.setting-back img')].filter((i) => i.complete && i.naturalWidth === 0).map((i) => i.alt))
console.log('designs', n, 'picked', picked, 'broken', broken.join(',') || 'none', errors.length ? 'errors: ' + errors.join(' | ') : 'no errors')
await b.close()
process.exit(n >= 38 && picked === 'cuervos' && !broken.length && !errors.length ? 0 : 1)
