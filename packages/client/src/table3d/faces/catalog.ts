// The faces by name, as the settings show them: the thirty LED masks and the six sculpted heads.
import { FACES, HEAD_FACES, LED_FACES, faceKind, type FaceId, type HeadFace } from '@la-base/shared'
import { ledDesign } from './ledFaces'

const HEAD_INFO: Record<HeadFace, { name: string; idea: string }> = {
  caballo: { name: 'Caballo', idea: 'cabeza de caballo de papel maché, hueso sucio, crin oscura; guantes de cuero' },
  gallo: { name: 'Gallo', idea: 'gallo de riña: cresta roja, pico de hueso que se tuerce y se abre, manos con garras' },
  carnero: { name: 'Carnero', idea: 'lana sucia, cuernos en espiral, ojos de pupila horizontal' },
  diablo: { name: 'Diablo', idea: 'máscara de diablo del carnaval del norte: roja, cejas negras, ojos saltones, dientes' },
  ventrilocuo: { name: 'Ventrílocuo', idea: 'muñeco de madera pintada: pelo pintado, mejillas rosadas, ojos enormes' },
  santo: { name: 'Santo', idea: 'santo de madera policromada, la pintura saltada, ojos de vidrio, una lágrima roja' },
}

export interface FaceInfo { id: FaceId; kind: 'led' | 'cabeza'; name: string; idea: string }

export const FACE_INFO: Record<FaceId, FaceInfo> = Object.fromEntries(
  FACES.map((id) => {
    const f = faceKind(id)
    const info = f.kind === 'led' ? ledDesign(f.name, LED_FACES) : HEAD_INFO[f.name]
    return [id, { id, kind: f.kind, name: info.name, idea: info.idea }]
  }),
) as Record<FaceId, FaceInfo>

export const LED_LIST = LED_FACES.map((f) => FACE_INFO[`led:${f}`])
export const HEAD_LIST = HEAD_FACES.map((f) => FACE_INFO[`cabeza:${f}`])
