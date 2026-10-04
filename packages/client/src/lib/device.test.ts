import { describe, expect, it } from 'vitest'
import { judgeLowEnd } from './device'

describe('judgeLowEnd', () => {
  it('lets a desktop with a graphics card keep the extras', () => {
    expect(judgeLowEnd({ touch: false, cores: 8, memoryGb: 8 })).toBe(false)
    expect(judgeLowEnd({ touch: false })).toBe(false) // nothing reported (Firefox, Safari): trust it
  })

  it('treats phones and tablets as modest', () => {
    expect(judgeLowEnd({ touch: true, cores: 8, memoryGb: 8 })).toBe(true)
  })

  it('treats few cores, little memory, a data saver or CPU-drawn graphics as modest', () => {
    expect(judgeLowEnd({ touch: false, cores: 4 })).toBe(true)
    expect(judgeLowEnd({ touch: false, cores: 8, memoryGb: 4 })).toBe(true)
    expect(judgeLowEnd({ touch: false, cores: 8, saveData: true })).toBe(true)
    expect(judgeLowEnd({ touch: false, cores: 8, softwareGl: true })).toBe(true)
  })
})
