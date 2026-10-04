import { describe, expect, it } from 'vitest'
import { AVATAR_KINDS, EYE_COLORS, HAIR_COLORS } from '@la-base/shared'
import { EYE_COLOR_LOOK, HAIR_COLOR_LOOK, PART_LABELS } from './avatarLook'

const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
function hsl(h: string) {
  const [r, g, b] = rgb(h)
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  const s = max === min ? 0 : (max - min) / (1 - Math.abs(2 * l - 1))
  return { s, l, chroma: max - min }
}

describe('avatar colours stay inside the game\'s muted range', () => {
  const all = [...EYE_COLOR_LOOK, ...HAIR_COLOR_LOOK]

  it('has the colours the shared contract promises', () => {
    expect(EYE_COLOR_LOOK).toHaveLength(EYE_COLORS)
    expect(HAIR_COLOR_LOOK).toHaveLength(HAIR_COLORS)
    for (const p of Object.values(PART_LABELS)) expect(p.kinds).toHaveLength(AVATAR_KINDS)
  })

  it('has no neon: nothing too saturated, too pure or too bright', () => {
    for (const c of all) {
      const { s, l, chroma } = hsl(c.hex)
      expect(s, `${c.name} saturation`).toBeLessThanOrEqual(0.65) // the game's most saturated (oxblood) is ~0.61
      expect(chroma, `${c.name} chroma`).toBeLessThanOrEqual(0.55)
      expect(l, `${c.name} lightness`).toBeGreaterThan(0.08)
      expect(l, `${c.name} lightness`).toBeLessThan(0.86)
    }
  })

  it('every colour is a real hex and none repeats', () => {
    for (const list of [EYE_COLOR_LOOK, HAIR_COLOR_LOOK]) {
      expect(new Set(list.map((c) => c.hex)).size).toBe(list.length)
      for (const c of list) expect(c.hex).toMatch(/^#[0-9a-f]{6}$/i)
    }
  })
})
