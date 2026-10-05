import { describe, expect, it } from 'vitest'
import { FACES, avatarKey } from '@la-base/shared'
import { tableFaces } from './tableFaces'

describe('tableFaces', () => {
  it('never shows two alike, even when faces did not arrive', () => {
    for (let n = 2; n <= 8; n++) {
      const none = tableFaces(Array(n).fill(undefined))
      expect(new Set(none.map(avatarKey)).size).toBe(n)
    }
    // the missing ones avoid the faces the others wear
    const mixed = tableFaces([{ face: 'led:purga' }, undefined, undefined, { face: 'led:arquero' }, undefined])
    expect(new Set(mixed.map(avatarKey)).size).toBe(5)
    expect(mixed[0]).toEqual({ face: 'led:purga' })
  })
  it('keeps everyone’s own face, and picks the same stand-ins on every screen', () => {
    const given = [{ face: FACES[5] }, undefined, { face: FACES[9] }]
    expect(tableFaces(given)).toEqual(tableFaces(given))
    expect(tableFaces(given)[2]).toEqual({ face: FACES[9] })
  })
})
