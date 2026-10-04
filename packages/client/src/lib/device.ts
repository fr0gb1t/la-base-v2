// Is this a touch device (a phone or tablet: the main pointer is a finger)? Everything for phones is
// gated on this, so desktop behaves exactly as it always did.
export const isTouch: boolean = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches

export interface DeviceHints {
  touch: boolean
  cores?: number // navigator.hardwareConcurrency
  memoryGb?: number // navigator.deviceMemory (Chromium only; it rounds down to 8 at most)
  saveData?: boolean // the browser asked for less data
  softwareGl?: boolean // WebGL is drawn by the CPU (SwiftShader, llvmpipe...)
}

/** A device that should not get the heavy extras (soft edges...) on by default: phones and tablets, few cores or little memory, data saver, or no graphics card. */
export function judgeLowEnd(h: DeviceHints): boolean {
  return h.touch || (h.cores !== undefined && h.cores <= 4) || (h.memoryGb !== undefined && h.memoryGb <= 4) || !!h.saveData || !!h.softwareGl
}

function softwareRenderer(): boolean {
  try {
    const gl = document.createElement('canvas').getContext('webgl')
    if (!gl) return false
    const info = gl.getExtension('WEBGL_debug_renderer_info')
    const name = info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : ''
    gl.getExtension('WEBGL_lose_context')?.loseContext()
    return /swiftshader|llvmpipe|softpipe|software|microsoft basic render/i.test(name)
  } catch {
    return false
  }
}

function readHints(): DeviceHints {
  if (typeof navigator === 'undefined') return { touch: false }
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } }
  return { touch: isTouch, cores: nav.hardwareConcurrency, memoryGb: nav.deviceMemory, saveData: nav.connection?.saveData, softwareGl: softwareRenderer() }
}

/** Decided once per page load (it needs a throwaway WebGL context to tell a graphics card from the CPU). */
export const isLowEnd: boolean = judgeLowEnd(readHints())
