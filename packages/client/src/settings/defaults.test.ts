import { describe, expect, it } from 'vitest'
import { getViewSettings } from './viewSettings'
import { getAudioSettings } from './audioSettings'

// What a new player starts with on a computer (the test runs without a touch screen or saved settings).
describe('default settings (desktop)', () => {
  it('sound: the game\'s sounds, the music and the storm, all on', () => {
    expect(getAudioSettings().effects).toBe(true)
    expect(getAudioSettings().music).toBe(true)
    expect(getAudioSettings().ambient).toBe(true)
  })

  it('the table: no hand reset, no guides, camera not sent back or inverted, aiming dot and seña flash on', () => {
    const v = getViewSettings()
    expect(v.handResetOnTurn).toBe(false)
    expect(v.guides).toBe(false)
    expect(v.cameraReturn).toBe(false)
    expect(v.invertLook).toBe(false)
    expect(v.reticle).toBe(true)
    expect(v.senaSeenFlash).toBe(true)
  })

  it('the card back is the Brújula', () => {
    expect(getViewSettings().cardBack).toBe('brujula')
  })
})
