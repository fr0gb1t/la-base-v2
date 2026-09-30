// Player audio settings: persisted per browser, observable by the audio engine and the UI.

export interface AudioSettings {
  volume: number // 0..1 master
  ambient: boolean // room tone: lamp hum and crackle
  effects: boolean // cards, table, knocks
}

const KEY = 'laBase.audio'
const DEFAULTS: AudioSettings = { volume: 0.8, ambient: true, effects: true }

function load(): AudioSettings {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<AudioSettings>
    const volume = typeof raw.volume === 'number' && raw.volume >= 0 && raw.volume <= 1 ? raw.volume : DEFAULTS.volume
    return {
      volume,
      ambient: typeof raw.ambient === 'boolean' ? raw.ambient : DEFAULTS.ambient,
      effects: typeof raw.effects === 'boolean' ? raw.effects : DEFAULTS.effects,
    }
  } catch {
    return { ...DEFAULTS }
  }
}

let current = load()
const listeners = new Set<(s: AudioSettings) => void>()

export const getAudioSettings = () => current

export function setAudioSettings(patch: Partial<AudioSettings>) {
  current = { ...current, ...patch }
  try {
    localStorage.setItem(KEY, JSON.stringify(current))
  } catch {
    /* storage unavailable: settings last for this session only */
  }
  listeners.forEach((l) => l(current))
}

export function onAudioSettings(fn: (s: AudioSettings) => void) {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}
