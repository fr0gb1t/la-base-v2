// View settings: persisted per browser, observable.
export interface ViewSettings {
  cameraReturn: boolean // after dragging the view, ease back to the seated default
  reticle: boolean // a dot in the middle of the screen to aim (at faces, for señas)
}

const KEY = 'laBase.view'
const DEFAULTS: ViewSettings = { cameraReturn: false, reticle: true }

function load(): ViewSettings {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, unknown>
    const out = { ...DEFAULTS }
    for (const k of Object.keys(DEFAULTS) as Array<keyof ViewSettings>) if (typeof raw[k] === 'boolean') out[k] = raw[k] as boolean
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
