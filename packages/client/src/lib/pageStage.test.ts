import { describe, expect, test } from 'vitest'
import { needsVeil, stageReducer, type Stage } from './pageStage'

const at = (shown: Stage['shown'], veil: Stage['veil'] = 'off'): Stage => ({ shown, veil })

describe('needsVeil', () => {
  test('only the way into the game table is veiled', () => {
    expect(needsVeil('game:waiting', 'game', false)).toBe(true)
    expect(needsVeil('lobby', 'game', false)).toBe(true)
    expect(needsVeil('game', 'lobby', false)).toBe(false)
    expect(needsVeil('lobby', 'game:waiting', false)).toBe(false)
    expect(needsVeil('game', 'game', false)).toBe(false)
  })

  test('never with reduced motion', () => {
    expect(needsVeil('game:waiting', 'game', true)).toBe(false)
  })
})

describe('stageReducer', () => {
  test('entering the game closes the veil first and keeps the old page on screen', () => {
    expect(stageReducer(at('game:waiting'), { type: 'target', target: 'game', reduced: false })).toEqual(at('game:waiting', 'closing'))
  })

  test('once the veil is closed the game mounts and the veil opens', () => {
    expect(stageReducer(at('game:waiting', 'closing'), { type: 'closed', target: 'game' })).toEqual(at('game', 'opening'))
  })

  test('when it has opened the veil is gone', () => {
    expect(stageReducer(at('game', 'opening'), { type: 'opened' })).toEqual(at('game', 'off'))
  })

  test('with reduced motion the game mounts at once, with no veil', () => {
    expect(stageReducer(at('game:waiting'), { type: 'target', target: 'game', reduced: true })).toEqual(at('game'))
  })

  test('leaving the game, or any other change, is immediate', () => {
    expect(stageReducer(at('game'), { type: 'target', target: 'lobby', reduced: false })).toEqual(at('lobby'))
    expect(stageReducer(at('lobby'), { type: 'target', target: 'game:waiting', reduced: false })).toEqual(at('game:waiting'))
  })

  test('the same target changes nothing (and the very same state object comes back)', () => {
    const s = at('lobby')
    expect(stageReducer(s, { type: 'target', target: 'lobby', reduced: false })).toBe(s)
  })

  test('changing the mind while the veil closes: another veiled target keeps closing', () => {
    const s = at('lobby', 'closing')
    expect(stageReducer(s, { type: 'target', target: 'game', reduced: false })).toBe(s)
  })

  test('changing the mind while the veil closes: an unveiled target drops the veil', () => {
    expect(stageReducer(at('game:waiting', 'closing'), { type: 'target', target: 'lobby', reduced: false })).toEqual(at('lobby', 'off'))
  })

  test('leaving the game while the veil is opening drops it too', () => {
    expect(stageReducer(at('game', 'opening'), { type: 'target', target: 'lobby', reduced: false })).toEqual(at('lobby', 'off'))
  })

  test('a late "closed" or "opened" that no longer applies is ignored', () => {
    expect(stageReducer(at('lobby'), { type: 'closed', target: 'game' })).toEqual(at('lobby'))
    expect(stageReducer(at('lobby'), { type: 'opened' })).toEqual(at('lobby'))
  })
})
