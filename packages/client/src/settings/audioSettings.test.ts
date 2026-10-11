import { afterEach, describe, expect, it, vi } from 'vitest'

// Loads audioSettings fresh against a browser storage holding `saved` under its key.
async function loadWith(saved: object) {
  const store = new Map([['laBase.audio', JSON.stringify(saved)]])
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => store.set(k, v),
  })
  vi.resetModules()
  const mod = await import('./audioSettings')
  return { ...mod, store }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('saved audio settings', () => {
  it('turns the room sound on for a player who had it off before the rain', async () => {
    const { getAudioSettings } = await loadWith({ volume: 0.5, ambient: false, effects: true })
    expect(getAudioSettings().ambient).toBe(true)
    expect(getAudioSettings().volume).toBe(0.5)
  })

  it('keeps the room sound off once the player turned it off after the rain', async () => {
    const first = await loadWith({ volume: 0.5, ambient: false, effects: true })
    first.setAudioSettings({ ambient: false })
    const { getAudioSettings } = await loadWith(JSON.parse(first.store.get('laBase.audio')!))
    expect(getAudioSettings().ambient).toBe(false)
  })

  it('gives the music its own volume, 0.8 unless the player moved it', async () => {
    const fresh = await loadWith({ volume: 0.5 })
    expect(fresh.getAudioSettings().musicVolume).toBe(0.8)
    fresh.setAudioSettings({ musicVolume: 0.3 })
    const { getAudioSettings } = await loadWith(JSON.parse(fresh.store.get('laBase.audio')!))
    expect(getAudioSettings().musicVolume).toBe(0.3)
  })

  it('ignores a music volume outside 0..1', async () => {
    const { getAudioSettings } = await loadWith({ musicVolume: 7 })
    expect(getAudioSettings().musicVolume).toBe(0.8)
  })
})
