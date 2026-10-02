// Screenshot of every court card (cards-preview.html). Usage: node e2e/cards.preview.mjs <out.png>
import puppeteer from 'puppeteer-core'
const b = await puppeteer.launch({ executablePath: '/usr/bin/chromium', headless: 'new', defaultViewport: { width: 1320, height: 1000 } })
const p = await b.newPage()
p.on('pageerror', (e) => console.log('ERR', e.message))
await p.goto('http://localhost:5174/cards-preview.html', { waitUntil: 'networkidle0' })
await p.waitForSelector('body[data-ready]')
await p.screenshot({ path: process.argv[2], fullPage: true })
await b.close()
