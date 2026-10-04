// Asks the sculptor's worker for a head or a hand and keeps what it makes: every geometry is sculpted once per page
// and shared by everyone who wears it. Without workers (tests, very old browsers) the work runs on the page.
import * as THREE from 'three'
import { jobKey, runJob, type SculptJob, type SculptedPiece } from './sculptJobs'

export interface PieceGeometry {
  key: string
  pivot: THREE.Vector3
  rough: number
  geometry: THREE.BufferGeometry
}

let worker: Worker | null | undefined
let nextId = 1
const waiting = new Map<number, (r: { pieces?: SculptedPiece[]; error?: string }) => void>()

function getWorker(): Worker | null {
  if (worker !== undefined) return worker
  try {
    worker = new Worker(new URL('./sculptWorker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (e) => {
      const done = waiting.get(e.data.id)
      waiting.delete(e.data.id)
      done?.(e.data)
    }
  } catch {
    worker = null
  }
  return worker
}

/** RGB to RGBA (alpha 1). */
function rgba(c: Float32Array) {
  const out = new Float32Array((c.length / 3) * 4)
  for (let i = 0, j = 0; i < c.length; i += 3, j += 4) {
    out[j] = c[i]
    out[j + 1] = c[i + 1]
    out[j + 2] = c[i + 2]
    out[j + 3] = 1
  }
  return out
}

function toGeometry(p: SculptedPiece): PieceGeometry {
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(p.position, 3))
  g.setAttribute('normal', new THREE.BufferAttribute(p.normal, 3))
  g.setIndex(new THREE.BufferAttribute(p.index, 1))
  if (p.morphs?.length) {
    // (three r186 only mixes vertex colours in blend shapes when they carry an alpha: with plain RGB its vertex
    // shader adds a vec3 to a vec4 and does not compile; so these colours go as RGBA)
    g.setAttribute('color', new THREE.BufferAttribute(rgba(p.color), 4))
    g.morphAttributes.position = p.morphs.map((m) => new THREE.BufferAttribute(m.position, 3))
    g.morphAttributes.normal = p.morphs.map((m) => new THREE.BufferAttribute(m.normal, 3))
    g.morphAttributes.color = p.morphs.map((m) => new THREE.BufferAttribute(rgba(m.color), 4))
  } else g.setAttribute('color', new THREE.BufferAttribute(p.color, 3))
  g.computeBoundingSphere()
  return { key: p.key, pivot: new THREE.Vector3(...p.pivot), rough: p.rough, geometry: g }
}

const made = new Map<string, Promise<PieceGeometry[]>>()

/** The pieces of a head or a hand: from the cache, or sculpted now (in the worker). */
export function sculpted(job: SculptJob): Promise<PieceGeometry[]> {
  const key = jobKey(job)
  let p = made.get(key)
  if (!p) {
    const w = getWorker()
    p = w
      ? new Promise<SculptedPiece[]>((resolve, reject) => {
          const id = nextId++
          waiting.set(id, (r) => (r.pieces ? resolve(r.pieces) : reject(new Error(r.error))))
          w.postMessage({ id, job })
        }).then((pieces) => pieces.map(toGeometry))
      : Promise.resolve().then(() => runJob(job).map(toGeometry))
    made.set(key, p)
  }
  return p
}
