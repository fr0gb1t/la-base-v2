// View settings: persisted per browser, observable.
import { SENAS } from '@la-base/shared'
import { isTouch } from '../lib/device'
import { isBackDesign, type BackDesign } from '../table3d/backDesigns'

export interface ViewSettings {
  cameraReturn: boolean // after dragging the view, ease back to the seated default
  reticle: boolean // a dot in the middle of the screen to aim (at faces, for señas)
  invertLook: boolean // dragging moves the view the other way
  handResetOnTurn: boolean // your turn brings the hand back to its default height
  guides: boolean // chalk guides where things go: dotted card boxes, circles for the beans
  lookSensitivity: number // multiplier on how far the view turns per pixel dragged (0.25–3)
  fov: number // vertical field of view in degrees (FOV_MIN–FOV_MAX)
  cardBack: BackDesign // the design on the back of every card
  gyro: boolean // phones: the phone's orientation turns the view (the finger can still drag it)
  handHeight: number // where the wheel left your fan (metres, camera space); 0 = resting
  senaOrder: string // your señas ring, comma-separated ids in your order ('' = the default order)
}

export const SENS_MIN = 0.25
export const SENS_MAX = 3
// 63°: at 16:9 the edge of the view falls on the neighbours' faces with 4 players (their centres
// sit 47.5° to each side): you see where they look, nothing more. With 6 or 8, two players are
// always out of view.
export const FOV_MIN = 50
export const FOV_MAX = 80
const KEY = 'laBase.view'
// phones start with: hand not reset on your turn, no table guides, view returns to your seat (gyroscope and reticle on, camera not inverted)
const DEFAULTS: ViewSettings = { cameraReturn: isTouch, reticle: true, invertLook: false, handResetOnTurn: !isTouch, guides: !isTouch, lookSensitivity: 1, fov: 63, cardBack: 'rueda-roja', handHeight: 0, senaOrder: '', gyro: true }

function load(): ViewSettings {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, unknown>
    const out = { ...DEFAULTS }
    for (const k of Object.keys(DEFAULTS) as Array<keyof ViewSettings>) {
      if (typeof raw[k] === typeof DEFAULTS[k]) Object.assign(out, { [k]: raw[k] })
    }
    out.lookSensitivity = Math.min(SENS_MAX, Math.max(SENS_MIN, Number(out.lookSensitivity) || 1))
    out.fov = Math.min(FOV_MAX, Math.max(FOV_MIN, Number(out.fov) || DEFAULTS.fov))
    if (out.fov === 66) out.fov = DEFAULTS.fov // the previous default: move it along
    out.handHeight = Math.min(0.04, Math.max(-0.2, Number(out.handHeight) || 0))
    if (!isBackDesign(out.cardBack)) out.cardBack = DEFAULTS.cardBack
    return out
  } catch {
    return { ...DEFAULTS }
  }
}

/** The señas in the player's own ring order (ids they never placed go last, in the default order). */
export function orderedSenas(order: string): typeof SENAS {
  const ids = order.split(',')
  const rank = (id: string) => (ids.includes(id) ? ids.indexOf(id) : ids.length + SENAS.findIndex((x) => x.id === id))
  return [...SENAS].sort((a, b) => rank(a.id) - rank(b.id))
}

let current = load()
const listeners = new Set<(s: ViewSettings) => void>()

export const getViewSettings = () => current

export function setViewSettings(patch: Partial<ViewSettings>) {
  current = { ...current, ...patch }
  try {
    localStorage.setItem(KEY, JSON.stringify(current))
  } catch {
    /* session only */
  }
  listeners.forEach((l) => l(current))
}

export function onViewSettings(fn: (s: ViewSettings) => void) {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}
