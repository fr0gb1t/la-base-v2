// The señas lab (open http://localhost:5173/senas-lab.html on the dev server to play with it): everybody signs all
// the time, and a rival's seña only reads when your aim is on their zone. This drives it and checks the rule.
// Usage (dev server on 5174): node e2e/senas.lab.mjs <out-prefix>
import puppeteer from 'puppeteer-core'
const out = process.argv[2] ?? '/tmp/lab'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const b = await puppeteer.launch({ executablePath: process.env.CHROME ?? '/usr/bin/chromium', headless: 'new', args: ['--no-sandbox', '--use-angle=vulkan', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'], defaultViewport: { width: 1400, height: 800 } })
const p = await b.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message))
await p.goto('http://localhost:5174/senas-lab.html', { waitUntil: 'domcontentloaded' }); await sleep(4500)
const read = () => p.evaluate(() => [...document.querySelectorAll('#seats tbody tr')].map((r) => Number(r.children[3].textContent.split('/')[0])))
const set = (id, v) => p.evaluate((id, v) => { const el = document.getElementById(id); if (el.type === 'checkbox') el.checked = v; else el.value = v; el.dispatchEvent(new Event(el.type === 'checkbox' ? 'change' : 'input')) }, id, v)
const reset = () => p.evaluate(() => [...document.querySelectorAll('#count button')].find((x) => x.classList.contains('on')).click())
const aim = (down) => p.evaluate((down) => { const s = window.__lab.scene; s.debugAimHead(1); s.pitchT -= down }, down)
await set('every', 0.2)
const r = {}
await reset(); await sleep(7000); const idle = await read()
r.partnerAlwaysRead = idle[1] > 0
r.rivalsNotReadWhenNotLooking = idle[0] === 0 && idle[2] === 0
await reset(); await aim(0); await sleep(1000); await reset(); await aim(0); await sleep(7000); const head = await read()
r.rivalReadWhenAimedAtFace = head[0] > 0 && head[2] === 0
await reset(); await aim(0.22); await sleep(7000); const chest = await read()
r.rivalReadWhenAimedNearTheirPlace = chest[0] > 0
await set('radius', 0.05); await reset(); await aim(0.22); await sleep(7000); const tiny = await read()
r.tinyZoneNoLongerReads = tiny[0] === 0
await p.screenshot({ path: `${out}-lab.png` })
console.log(JSON.stringify(r, null, 1), errs.length ? `errors: ${errs.join(' | ')}` : 'no page errors')
const ok = Object.values(r).every(Boolean) && !errs.length
console.log(ok ? 'PASS' : 'FAIL'); await b.close(); process.exit(ok ? 0 : 1)
