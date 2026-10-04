// View settings: persisted per browser, observable.
import { SENAS } from '@la-base/shared'
import { isLowEnd, isTouch } from '../lib/device'
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
  smoothProps: boolean // cards, hands, buttons, televisions, notepad, clock... drawn smooth (anti-aliased, full resolution)
  smoothChosen: boolean // the player picked smoothProps themselves; until then it follows the device (on, unless it is a modest one)
  gyro: boolean // phones: the phone's orientation turns the view (the finger can still drag it)
  handHeight: number // where the wheel left your fan (metres, camera space); 0 = resting
  senaSeenFlash: boolean // your seña flashes red on your screen when a rival catches it (off: you never know)
  senaOrder: string // your señas ring, comma-separated ids in your order ('' = the default order)
  bloom: number // how far bright lights (the bulb, the candles, the LED masks) spill their glow: 0 = none, 1 = as made, up to BLOOM_MAX
}

export const SENS_MIN = 0.25
export const SENS_MAX = 3
// 63°: at 16:9 the edge of the view falls on the neighbours' faces with 4 players (their centres
// sit 47.5° to each side): you see where they look, nothing more. With 6 or 8, two players are
// always out of view.
export const FOV_MIN = 50
export const FOV_MAX = 80
export const BLOOM_MAX = 2
const KEY = 'laBase.view'
// What a new player starts with. Desktop: hand not reset on your turn, no table guides, view not sent back to
// your seat, aiming dot on, camera not inverted, your seña flashes when a rival catches it, soft edges on
// (unless the device is modest). Phones: the view returns to your seat (gyroscope and reticle on, camera not
// inverted), no hand reset, no guides, no seña flash. Everybody: the Brújula card back.
const DEFAULTS: ViewSettings = { cameraReturn: isTouch, reticle: true, invertLook: false, handResetOnTurn: false, guides: false, lookSensitivity: 1, fov: 63, cardBack: 'brujula', handHeight: 0, senaOrder: '', senaSeenFlash: !isTouch, gyro: true, smoothProps: !isLowEnd, smoothChosen: false, bloom: 1 }

function load(): ViewSettings {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, unknown>
    const out = { ...DEFAULTS }
    for (const k of Object.keys(DEFAULTS) as Array<keyof ViewSettings>) {
      if (typeof raw[k] === typeof DEFAULTS[k]) Object.assign(out, { [k]: raw[k] })
    }
    if (!out.smoothChosen) out.smoothProps = DEFAULTS.smoothProps // never picked: follows the device
    out.lookSensitivity = Math.min(SENS_MAX, Math.max(SENS_MIN, Number(out.lookSensitivity) || 1))
    out.fov = Math.min(FOV_MAX, Math.max(FOV_MIN, Number(out.fov) || DEFAULTS.fov))
    if (out.fov === 66) out.fov = DEFAULTS.fov // the previous default: move it along
    out.bloom = Math.min(BLOOM_MAX, Math.max(0, Number.isFinite(out.bloom) ? out.bloom : 1))
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
