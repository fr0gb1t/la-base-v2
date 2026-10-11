import { describe, expect, it } from 'vitest'
import { encodeWav } from './wav'

describe('encodeWav', () => {
  it('writes a stereo 16-bit header and the samples', () => {
    const wav = encodeWav([Float32Array.of(0, 1, -1), Float32Array.of(0.5, 0, 0)], 44100)
    const view = new DataView(wav.buffer)
    expect(String.fromCharCode(...wav.slice(0, 4))).toBe('RIFF')
    expect(view.getUint16(22, true)).toBe(2)
    expect(view.getUint32(24, true)).toBe(44100)
    expect(wav.length).toBe(44 + 3 * 2 * 2)
    expect(view.getInt16(44, true)).toBe(0) // L0
    expect(view.getInt16(46, true)).toBe(16383) // R0 = 0.5
    expect(view.getInt16(48, true)).toBe(32767) // L1 = +1
    expect(view.getInt16(52, true)).toBe(-32768) // L2 = -1
  })
})
