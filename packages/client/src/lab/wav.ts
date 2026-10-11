// A 16-bit PCM WAV file from channels of samples (what an offline render gives back).

export function encodeWav(channels: readonly Float32Array[], sampleRate: number): Uint8Array<ArrayBuffer> {
  const frames = channels[0]?.length ?? 0
  const bytes = new Uint8Array(new ArrayBuffer(44 + frames * channels.length * 2))
  const view = new DataView(bytes.buffer)
  const text = (at: number, s: string) => [...s].forEach((c, i) => view.setUint8(at + i, c.charCodeAt(0)))
  text(0, 'RIFF')
  view.setUint32(4, bytes.length - 8, true)
  text(8, 'WAVE')
  text(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true) // PCM
  view.setUint16(22, channels.length, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * channels.length * 2, true)
  view.setUint16(32, channels.length * 2, true)
  view.setUint16(34, 16, true)
  text(36, 'data')
  view.setUint32(40, frames * channels.length * 2, true)
  let at = 44
  for (let f = 0; f < frames; f++) {
    for (const channel of channels) {
      const x = Math.max(-1, Math.min(1, channel[f]))
      view.setInt16(at, x < 0 ? x * 0x8000 : x * 0x7fff, true)
      at += 2
    }
  }
  return bytes
}
