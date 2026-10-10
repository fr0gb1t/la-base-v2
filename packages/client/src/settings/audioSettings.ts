// Player audio settings: persisted per browser, observable by the audio engine and the UI.

export interface AudioSettings {
  volume: number // 0..1 master
  ambient: boolean // the room: the rain outside, the thunder, drips, the lamp's crackle
  music: boolean // the old milonga on the radio (table3d/music.ts)
  effects: boolean // cards, table, knocks
}

const KEY = 'laBase.audio'
// everybody starts with everything: the game's sounds, the music and the storm
const DEFAULTS: AudioSettings = { volume: 0.8, ambient: true, effects: true, music: true }
// 2: the room sound became the rain. Before it, desktop started with it off and that choice got saved along with
// the volume, so an older save has its room sound turned back on once.
const VERSION = 2

function load(): AudioSettings {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<AudioSettings> & { v?: number }
    const volume = typeof raw.volume === 'number' && raw.volume >= 0 && raw.volume <= 1 ? raw.volume : DEFAULTS.volume
    const keepsAmbient = raw.v === VERSION && typeof raw.ambient === 'boolean'
    return {
      volume,
      ambient: keepsAmbient ? raw.ambient! : DEFAULTS.ambient,
      effects: typeof raw.effects === 'boolean' ? raw.effects : DEFAULTS.effects,
      music: typeof raw.music === 'boolean' ? raw.music : DEFAULTS.music,
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
    localStorage.setItem(KEY, JSON.stringify({ ...current, v: VERSION }))
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
