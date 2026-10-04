// A face's colour variants. Two players at a table never wear the same face; when two insist on the same one,
// the later one wears it in another colour (shared/avatar.ts). A variant turns the hues round the colour wheel;
// on an LED mask the white and grey lights (which have no hue to turn) take the variant's colour instead.
import * as THREE from 'three'

/** How far round the wheel each variant turns the hues (variant 0 is the design as made). */
const TURNS = [0, 0.5, 0.25, 0.75, 0.125, 0.625]

export const tintAngle = (tint = 0) => (TURNS[tint] ?? 0) * Math.PI * 2

/** The colour the white lights of an LED mask take in this variant (white for the design as made). */
export function tintWhite(tint = 0) {
  if (!tint) return new THREE.Color(1, 1, 1)
  const c = new THREE.Color().setHSL(TURNS[tint] ?? 0, 1, 0.62) // a light colour of the variant's own hue: cyan, lime, violet, orange, blue
  const m = Math.max(c.r, c.g, c.b)
  return c.multiplyScalar(1 / m)
}

/** GLSL: turns `c` round the wheel by `a` radians (about the grey axis), never below black. */
export const HUE_GLSL = /* glsl */ `
vec3 hueTurn(vec3 c, float a) {
  const vec3 k = vec3(0.57735);
  float ca = cos(a);
  return max(c * ca + cross(k, c) * sin(a) + k * dot(k, c) * (1.0 - ca), 0.0);
}`

/** Gives a (vertex-coloured) standard material the variant's hues. Variant 0 leaves it as it is. */
export function tintMaterial(m: THREE.MeshStandardMaterial, tint = 0) {
  if (!tint) return
  const a = tintAngle(tint)
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uHue = { value: a }
    sh.fragmentShader = sh.fragmentShader
      .replace('void main() {', `uniform float uHue;\n${HUE_GLSL}\nvoid main() {`)
      .replace('#include <color_fragment>', '#include <color_fragment>\n  diffuseColor.rgb = hueTurn(diffuseColor.rgb, uHue);')
  }
  m.customProgramCacheKey = () => `hue${tint}`
}
