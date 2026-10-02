// View settings: persisted per browser, observable.
export interface ViewSettings {
  cameraReturn: boolean // after dragging the view, ease back to the seated default
  reticle: boolean // a dot in the middle of the screen to aim (at faces, for señas)
  invertLook: boolean // dragging moves the view the other way
  handResetOnTurn: boolean // your turn brings the hand back to its default height
  guides: boolean // chalk guides where things go: dotted card boxes, circles for the beans
  lookSensitivity: number // multiplier on how far the view turns per pixel dragged (0.25–3)
  fov: number // vertical field of view in degrees (FOV_MIN–FOV_MAX)
}

export const SENS_MIN = 0.25
export const SENS_MAX = 3
// 66°: at 16:9 the view spans ~49° to each side, past the neighbours' heads (~47° with 4 players)
export const FOV_MIN = 50
export const FOV_MAX = 80
const KEY = 'laBase.view'
const DEFAULTS: ViewSettings = { cameraReturn: false, reticle: true, invertLook: false, handResetOnTurn: true, guides: true, lookSensitivity: 1, fov: 66 }

function load(): ViewSettings {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, unknown>
    const out = { ...DEFAULTS }
    for (const k of Object.keys(DEFAULTS) as Array<keyof ViewSettings>) {
      if (typeof raw[k] === typeof DEFAULTS[k]) Object.assign(out, { [k]: raw[k] })
    }
    out.lookSensitivity = Math.min(SENS_MAX, Math.max(SENS_MIN, Number(out.lookSensitivity) || 1))
    out.fov = Math.min(FOV_MAX, Math.max(FOV_MIN, Number(out.fov) || DEFAULTS.fov))
    return out
  } catch {
    return { ...DEFAULTS }
  }
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
