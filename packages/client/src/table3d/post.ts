import * as THREE from 'three'
import { DARK_SNAP, DUOTONES, hex } from './look'

// Pass 1 (low-res, e.g. 640×360): scene → selective dark snap + Bayer dither + duotone.
// Pass 2 (full-res): nearest upscale + mip bloom + chromatic aberration + grain + vignette.
const lowFrag = /* glsl */ `
precision highp float;
uniform sampler2D tScene;
uniform vec3 uDark[6];
uniform float uSnapEdge;   // luminance under which colours snap to the dark palette
uniform float uLevels;     // posterize levels for the bright range (Buckshot ≈ 8)
uniform float uDither;
uniform float uExposure;
uniform vec3 uDuoA, uDuoB;
uniform float uDuo;        // 0 = off, 1 = full duotone (Horripilant moment)
varying vec2 vUv;

float bayer4(vec2 p) {
  ivec2 i = ivec2(mod(p, 4.0));
  int idx = i.x + i.y * 4;
  float m[16] = float[](0.,8.,2.,10.,12.,4.,14.,6.,3.,11.,1.,9.,15.,7.,13.,5.);
  return m[idx] / 16. - 0.5;
}
vec3 aces(vec3 x) { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0., 1.); }
vec3 nearestDark(vec3 c, float jitter) {
  float best = 1e9; vec3 pick = uDark[0];
  for (int i = 0; i < 6; i++) {
    float d = distance(c, uDark[i]) + jitter * 0.04 * float(i % 2 == 0 ? 1 : -1);
    if (d < best) { best = d; pick = uDark[i]; }
  }
  return pick;
}
void main() {
  vec3 c = texture2D(tScene, vUv).rgb;                 // linear
  vec3 s = pow(aces(c * uExposure), vec3(1.0 / 2.2));   // tone map, then work in display space
  float b = bayer4(gl_FragCoord.xy);
  float l = dot(s, vec3(0.299, 0.587, 0.114));
  // Brights: light posterize with dither (keeps cards/hands legible).
  vec3 post = floor(s * uLevels + 0.5 + b * uDither) / uLevels;
  // Darks: snap to the palette (Inscryption: hard, blended shadows).
  vec3 snapped = nearestDark(s, b * uDither);
  float k = smoothstep(uSnapEdge - 0.06, uSnapEdge + 0.06, l + b * 0.08);
  s = mix(snapped, post, k);
  vec3 duo = mix(uDuoA, uDuoB, smoothstep(0.05, 0.75, l + b * 0.25));
  s = mix(s, duo, uDuo);
  gl_FragColor = vec4(pow(s, vec3(2.2)), 1.0);         // back to linear for the next pass
}`

const finalFrag = /* glsl */ `
precision highp float;
uniform sampler2D tLow;     // nearest-sampled look
uniform sampler2D tScene;   // mipmapped raw scene → cheap bloom from its small mips
uniform vec2 uLowRes;
uniform sampler2D tOver;    // the smooth overlay: the props drawn at full resolution with MSAA (premultiplied)
uniform float uOver;        // 0 = no overlay
uniform float uExposure;
uniform float uTime, uCA, uGrain, uVignette, uBloom;
varying vec2 vUv;
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main() {
  vec2 q = vUv - 0.5;
  vec2 dir = q * uCA * dot(q, q) * 4.0;
  vec2 px = 1.0 / uLowRes;
  vec2 snapUv = (floor(vUv * uLowRes) + 0.5) * px;
  vec3 col;
  col.r = texture2D(tLow, snapUv + dir).r;
  col.g = texture2D(tLow, snapUv).g;
  col.b = texture2D(tLow, snapUv - dir).b;
  // the props (televisions, notepad, clock): same exposure, tone map and a fine posterize as the
  // world, but at full resolution and anti-aliased, so their text and edges stay clean
  if (uOver > 0.5) {
    vec4 o = texture2D(tOver, vUv);
    if (o.a > 0.001) {
      vec3 oc = o.rgb / o.a;
      vec3 os = pow(clamp((oc * uExposure * (2.51 * oc * uExposure + 0.03)) / (oc * uExposure * (2.43 * oc * uExposure + 0.59) + 0.14), 0.0, 1.0), vec3(1.0 / 2.2));
      os = floor(os * 48.0 + 0.5) / 48.0;
      col = mix(col, pow(os, vec3(2.2)), o.a);
    }
  }
  vec3 bloom = vec3(0.0);
  // Thresholds are in linear HDR: only the bulb, candles and LEDs (>1.5) bloom, never the felt.
  bloom += max(textureLod(tScene, vUv, 2.0).rgb - 1.5, 0.0) * 0.5;
  bloom += max(textureLod(tScene, vUv, 3.5).rgb - 1.2, 0.0) * 0.8;
  bloom += max(textureLod(tScene, vUv, 5.0).rgb - 1.0, 0.0);
  col += bloom * uBloom;
  col *= 1.0 - dot(q, q) * uVignette;
  float t = floor(uTime * 12.0);                        // grain boils at 12 fps
  col += (hash(gl_FragCoord.xy + t) - 0.5) * uGrain;
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`

const vert = /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }`

export function makePost(renderer: THREE.WebGLRenderer, lowHeight = 360) {
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2))
  const cam = new THREE.OrthographicCamera()
  const sceneRT = new THREE.WebGLRenderTarget(1, 1, {
    type: THREE.HalfFloatType,
    generateMipmaps: true,
    minFilter: THREE.LinearMipmapLinearFilter,
    magFilter: THREE.LinearFilter,
    samples: 0,
  })
  // the smooth overlay: full resolution, multisampled, transparent where nothing is drawn
  const overRT = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter })
  const depthOnly = new THREE.MeshBasicMaterial({ colorWrite: false })
  const lowRT = new THREE.WebGLRenderTarget(1, 1, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, type: THREE.HalfFloatType })
  const low = new THREE.ShaderMaterial({
    vertexShader: vert,
    fragmentShader: lowFrag,
    uniforms: {
      tScene: { value: sceneRT.texture },
      uDark: { value: DARK_SNAP.map((h) => new THREE.Color(hex(h)).convertLinearToSRGB()) },
      uSnapEdge: { value: 0.12 },
      uLevels: { value: 24 },
      uDither: { value: 0.3 },
      uExposure: { value: 1.4 },
      uDuoA: { value: new THREE.Color() },
      uDuoB: { value: new THREE.Color() },
      uDuo: { value: 0 },
    },
  })
  const final = new THREE.ShaderMaterial({
    vertexShader: vert,
    fragmentShader: finalFrag,
    uniforms: {
      tLow: { value: lowRT.texture },
      tScene: { value: sceneRT.texture },
      tOver: { value: overRT.texture },
      uOver: { value: 0 },
      uExposure: low.uniforms.uExposure, // the same object: one exposure for both passes
      uLowRes: { value: new THREE.Vector2() },
      uTime: { value: 0 },
      uCA: { value: 0.003 },
      uGrain: { value: 0.035 },
      uVignette: { value: 1.1 },
      uBloom: { value: 0.6 },
    },
  })

  function resize(w: number, h: number) {
    const lh = Math.min(lowHeight, h)
    const lw = Math.round((lh * w) / h)
    sceneRT.setSize(lw, lh)
    lowRT.setSize(lw, lh)
    overRT.setSize(w, h)
    final.uniforms.uLowRes.value.set(lw, lh)
  }

  function duotone(name: keyof typeof DUOTONES | null, amount: number) {
    if (name) {
      low.uniforms.uDuoA.value.set(hex(DUOTONES[name][0])).convertLinearToSRGB()
      low.uniforms.uDuoB.value.set(hex(DUOTONES[name][1])).convertLinearToSRGB()
    }
    low.uniforms.uDuo.value = name ? amount : 0
  }

  /** The layer of the props drawn smooth, apart from the pixelated world. */
  const PROPS = 2

  /** `propsColor(false)` hides the props' colours from the world pass (they still cast shadows and hide what is behind them); `(true)` restores them. */
  function render(scene: THREE.Scene, camera: THREE.Camera, time: number, smoothProps = false, propsColor: (on: boolean) => void = () => undefined) {
    // the world: the props are in it too (their shadows, their depth), but without colour when they are drawn smooth
    camera.layers.set(0)
    camera.layers.enable(PROPS)
    if (smoothProps) propsColor(false)
    renderer.setRenderTarget(sceneRT)
    renderer.render(scene, camera)
    if (smoothProps) propsColor(true)
    final.uniforms.uOver.value = smoothProps ? 1 : 0
    if (smoothProps) {
      // the props: full resolution, multisampled. First everything else as depth only (so what is in
      // front of a prop hides it), then the props themselves, lit as in the world (shadows are reused)
      const shadows = renderer.shadowMap.autoUpdate
      renderer.shadowMap.autoUpdate = false
      renderer.setRenderTarget(overRT)
      const background = scene.background // (a background colour would clear the overlay to opaque on every render call)
      scene.background = null
      const clearA = renderer.getClearAlpha()
      renderer.setClearAlpha(0)
      renderer.clear()
      camera.layers.set(0)
      scene.overrideMaterial = depthOnly
      const auto = renderer.autoClear
      renderer.autoClear = false
      renderer.render(scene, camera)
      scene.overrideMaterial = null
      camera.layers.set(PROPS)
      renderer.render(scene, camera)
      renderer.autoClear = auto
      renderer.setClearAlpha(clearA)
      scene.background = background
      renderer.shadowMap.autoUpdate = shadows
      camera.layers.set(0)
    }
    quad.material = low
    renderer.setRenderTarget(lowRT)
    renderer.render(quad, cam)
    quad.material = final
    final.uniforms.uTime.value = time
    renderer.setRenderTarget(null)
    renderer.render(quad, cam)
  }
  /** (tests) one pixel of the overlay, in 0–1 screen coordinates */
  const probeOver = (u: number, v: number) => {
    const out = new Uint16Array(4)
    renderer.readRenderTargetPixels(overRT, Math.floor(u * overRT.width), Math.floor(v * overRT.height), 1, 1, out as unknown as Uint8Array)
    return Array.from(out)
  }
  return { probeOver, resize, render, duotone, uniforms: { ...low.uniforms, ...final.uniforms } }
}
