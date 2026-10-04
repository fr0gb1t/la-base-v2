// What the sculptor is asked to make, and how its answer travels: plain arrays, so a worker can hand them over
// without copying. Used by the worker (sculptWorker.ts) and, where there is no worker, on the page itself.
import type { HeadFace } from '@la-base/shared'
import { sculpt, withGestures, type V3 } from './sculpt'
import { HEADS, HAND_BOX, LED_HANDS, handModel, type HandPose } from './heads'

export type HandStyleKey = 'led' | HeadFace
export type SculptJob = { job: 'head'; name: HeadFace } | { job: 'hand'; style: HandStyleKey; pose: HandPose; side: 1 | -1 }

export interface SculptedPiece {
  key: string
  pivot: V3
  rough: number
  position: Float32Array
  normal: Float32Array
  color: Float32Array
  index: Uint32Array
  morphs?: { position: Float32Array; normal: Float32Array; color: Float32Array }[]
}

export const jobKey = (j: SculptJob) => (j.job === 'head' ? `head:${j.name}` : `hand:${j.style}:${j.pose}:${j.side}`)

function pack(key: string, pivot: V3, rough: number, g: ReturnType<typeof sculpt>): SculptedPiece {
  g.translate(-pivot[0], -pivot[1], -pivot[2])
  const morphs = g.morphAttributes.position?.map((p, i) => ({
    position: (p.array as Float32Array).map((v, k) => v - pivot[k % 3]),
    normal: g.morphAttributes.normal![i].array as Float32Array,
    color: g.morphAttributes.color![i].array as Float32Array,
  }))
  return {
    key,
    pivot,
    rough,
    position: g.getAttribute('position').array as Float32Array,
    normal: g.getAttribute('normal').array as Float32Array,
    color: g.getAttribute('color').array as Float32Array,
    index: Uint32Array.from(g.getIndex()!.array),
    morphs,
  }
}

/** Does the work: sculpts every piece of a head, or one hand. */
export function runJob(j: SculptJob): SculptedPiece[] {
  if (j.job === 'hand') {
    const st = j.style === 'led' ? LED_HANDS : HEADS[j.style].hands
    return [pack('hand', [0, 0, 0], 0.7, sculpt(handModel(j.side, j.pose, st), HAND_BOX[0], HAND_BOX[1], 0.0026))]
  }
  return HEADS[j.name].pieces.map((p) => {
    let g = sculpt(p.model(), p.lo, p.hi, p.cell)
    if (p.gestures) g = withGestures(g, p.gestures())
    return pack(p.key, p.pivot, p.rough ?? 0.6, g)
  })
}

/** The arrays to hand over without copying. */
export function transferables(pieces: SculptedPiece[]): ArrayBuffer[] {
  const out: ArrayBuffer[] = []
  for (const p of pieces) {
    out.push(p.position.buffer as ArrayBuffer, p.normal.buffer as ArrayBuffer, p.color.buffer as ArrayBuffer, p.index.buffer as ArrayBuffer)
    for (const m of p.morphs ?? []) out.push(m.position.buffer as ArrayBuffer, m.normal.buffer as ArrayBuffer, m.color.buffer as ArrayBuffer)
  }
  return out
}
