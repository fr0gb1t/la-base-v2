import { describe, expect, it } from 'vitest'
import { makeFormCursor, SECTION_STEPS } from './form'

const lengths = { menu: 1, calm: 5, promising: 5, winning: 1, tension: 5, danger: 1 }

describe('form cursor', () => {
  it('goes through the sections of a mood and then round again', () => {
    const cursor = makeFormCursor(lengths, 'calm')
    const sectionAt = (bar: number) => cursor.position(bar * 16).section
    expect([0, 8, 16, 24, 32, 40].map(sectionAt)).toEqual([0, 1, 2, 3, 4, 0])
    expect(cursor.position(8 * 16 + 20).p).toBe(20)
  })

  it('starts a mood at its first section the first time', () => {
    const cursor = makeFormCursor(lengths)
    cursor.switchTo('promising', 64)
    expect(cursor.position(64)).toEqual({ section: 0, p: 0 })
    expect(cursor.position(64 + SECTION_STEPS)).toEqual({ section: 1, p: 0 })
  })

  it('goes on with the next section when it comes back to a mood', () => {
    const cursor = makeFormCursor(lengths, 'calm')
    cursor.switchTo('tension', 8 * 16 + 32) // calm was in its 2nd section (index 1) when it was left
    cursor.switchTo('calm', 8 * 16 + 32 + 64)
    expect(cursor.position(8 * 16 + 32 + 64).section).toBe(2)
  })

  it('a section can be forced', () => {
    const cursor = makeFormCursor(lengths)
    cursor.switchTo('tension', 0, 3)
    expect(cursor.position(0).section).toBe(3)
    expect(cursor.position(SECTION_STEPS).section).toBe(4)
  })

  it('restarts from the first section', () => {
    const cursor = makeFormCursor(lengths, 'calm')
    cursor.restart(500)
    expect(cursor.position(500)).toEqual({ section: 0, p: 0 })
  })

  it('single-section moods always play their one section', () => {
    const cursor = makeFormCursor(lengths, 'danger')
    expect(cursor.position(3 * SECTION_STEPS + 5)).toEqual({ section: 0, p: 5 })
  })
})
