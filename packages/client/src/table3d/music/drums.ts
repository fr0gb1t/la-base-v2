// The synthetic drums (the sample bank has no kit): kick, snare, hats, cymbal and the noise sweep that leads into a change.

export function makeKit(ctx: BaseAudioContext, out: AudioNode) {
  const noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate)
  const data = noise.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1

  function noiseHit(at: number, dur: number, type: BiquadFilterType, freq: number, vel: number, q = 0.7) {
    const src = ctx.createBufferSource()
    src.buffer = noise
    const filter = ctx.createBiquadFilter()
    filter.type = type
    filter.frequency.value = freq
    filter.Q.value = q
    const env = ctx.createGain()
    env.gain.setValueAtTime(vel, at)
    env.gain.exponentialRampToValueAtTime(0.0001, at + dur)
    src.connect(filter).connect(env).connect(out)
    src.start(at, Math.random())
    src.stop(at + dur + 0.05)
  }

  function thump(at: number, from: number, to: number, dur: number, vel: number) {
    const osc = ctx.createOscillator()
    osc.frequency.setValueAtTime(from, at)
    osc.frequency.exponentialRampToValueAtTime(to, at + dur * 0.4)
    const env = ctx.createGain()
    env.gain.setValueAtTime(vel, at)
    env.gain.exponentialRampToValueAtTime(0.0001, at + dur)
    osc.connect(env).connect(out)
    osc.start(at)
    osc.stop(at + dur + 0.05)
  }

  return {
    kick(at: number, vel: number) {
      thump(at, 150, 46, 0.32, vel)
      noiseHit(at, 0.02, 'lowpass', 900, vel * 0.4)
    },
    snare(at: number, vel: number) {
      noiseHit(at, 0.17, 'bandpass', 1900, vel * 0.8, 0.6)
      thump(at, 220, 150, 0.1, vel * 0.5)
    },
    hat(at: number, vel: number, open = false) {
      noiseHit(at, open ? 0.2 : 0.04, 'highpass', 7500, vel)
    },
    crash(at: number, vel: number) {
      noiseHit(at, 1.8, 'highpass', 3200, vel, 0.5)
    },
    /** A band of noise that climbs for `dur` seconds and fades out. */
    riser(at: number, dur: number, vel: number) {
      const src = ctx.createBufferSource()
      src.buffer = noise
      src.loop = true
      const filter = ctx.createBiquadFilter()
      filter.type = 'bandpass'
      filter.Q.value = 2.5
      filter.frequency.setValueAtTime(300, at)
      filter.frequency.exponentialRampToValueAtTime(5000, at + dur)
      const env = ctx.createGain()
      env.gain.setValueAtTime(0.0001, at)
      env.gain.linearRampToValueAtTime(vel, at + dur * 0.97)
      env.gain.linearRampToValueAtTime(0.0001, at + dur)
      src.connect(filter).connect(env).connect(out)
      src.start(at)
      src.stop(at + dur + 0.05)
    },
  }
}

export type Kit = ReturnType<typeof makeKit>
