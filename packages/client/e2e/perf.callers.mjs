// Who calls a hot function? Reads the raw CPU profile written by perf.gate.mjs (<out>-profile.json) and prints,
// for every function whose name matches <pattern>, its inclusive time grouped by the chain of callers above it.
// Usage: node e2e/perf.callers.mjs <out>-profile.json <pattern> [depth=6]
import fs from 'node:fs'
import path from 'node:path'
import { SourceMap } from 'node:module'
const [, , file, pattern = 'getProgram', depthArg = '6'] = process.argv
const { profile } = JSON.parse(fs.readFileSync(file, 'utf8'))
const dist = path.join(import.meta.dirname, '../dist/assets')
const cache = new Map()
const orig = (cf) => {
  try {
    const u = cf.url.split('/').pop()
    if (!u.endsWith('.js')) return null
    if (!cache.has(u)) cache.set(u, { map: new SourceMap(JSON.parse(fs.readFileSync(path.join(dist, u + '.map'), 'utf8'))) })
    const e = cache.get(u).map.findEntry(cf.lineNumber, cf.columnNumber)
    return e?.originalSource ? `${e.originalSource.split('/src/').pop().split('/').pop()}:${e.originalLine + 1}${e.name ? ' ' + e.name : ''}` : null
  } catch { return null }
}
const nodes = new Map(profile.nodes.map((n) => [n.id, n]))
const parent = new Map()
for (const n of profile.nodes) for (const c of n.children ?? []) parent.set(c, n.id)
const self = new Map()
profile.samples.forEach((id, i) => self.set(id, (self.get(id) ?? 0) + profile.timeDeltas[i] / 1000))
const incl = new Map()
for (const [id, t] of self) for (let x = id; x != null; x = parent.get(x)) incl.set(x, (incl.get(x) ?? 0) + t)
const label = (n) => (n.callFrame.functionName || '(anon)') + (orig(n.callFrame) ? ' [' + orig(n.callFrame) + ']' : '')
const matcher = new RegExp(pattern)
const groups = new Map()
for (const n of profile.nodes) {
  if (!matcher.test(n.callFrame.functionName + ' ' + (orig(n.callFrame) ?? ''))) continue
  const chain = []
  for (let x = parent.get(n.id), d = 0; x != null && d < Number(depthArg); x = parent.get(x), d++) chain.push(label(nodes.get(x)))
  const key = chain.join('\n      <- ')
  groups.set(key, (groups.get(key) ?? 0) + (incl.get(n.id) ?? 0))
}
console.log(`Inclusive time of functions matching /${pattern}/ by caller chain (ms):`)
for (const [k, v] of [...groups].sort((a, b) => b[1] - a[1]).slice(0, 8)) console.log(v.toFixed(0).padStart(7) + ' ms  ' + k)
