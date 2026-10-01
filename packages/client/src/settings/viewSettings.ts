// View settings: persisted per browser, observable.
export interface ViewSettings {
  cameraReturn: boolean // after dragging the view, ease back to the seated default
}

const KEY = 'laBase.view'
const DEFAULTS: ViewSettings = { cameraReturn: false }

function load(): ViewSettings {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<ViewSettings>
    return { cameraReturn: typeof raw.cameraReturn === 'boolean' ? raw.cameraReturn : DEFAULTS.cameraReturn }
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
