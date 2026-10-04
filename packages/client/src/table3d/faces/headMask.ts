// A sculpted head, put together on the page from the pieces the worker sculpts, and its señas: the brows lift and
// drop, the lids close over glossy eyes, and the mouth works the way that head's mouth works (the devil's sculpted
// gestures, the rooster's beak, everyone else's lips and teeth). The head shows as soon as its pieces are ready;
// until then the group is empty.
import * as THREE from 'three'
import type { HeadFace, Sena } from '@la-base/shared'
import { HEADS, MORPH_SENAS, type EyeSpec } from './heads'
import { sculpted, type PieceGeometry } from './sculpted'
import type { FaceRig } from './ledMask'
import { tintMaterial } from './tint'

/** A glossy eyeball, with an iris and a pupil looking down −z (or a slit pupil, for rams). */
function eyeball(e: EyeSpec) {
  const g = new THREE.Group()
  const mats: THREE.Material[] = []
  const m = (color: number, rough: number) => {
    const x = new THREE.MeshStandardMaterial({ color, roughness: rough })
    mats.push(x)
    return x
  }
  if (!e.pupilOnly) g.add(new THREE.Mesh(new THREE.SphereGeometry(e.r, 18, 12), m(e.white, 0.12)))
  if (e.iris !== undefined && e.irisR) {
    const ir = new THREE.Mesh(new THREE.SphereGeometry(e.r * 1.005, 18, 8, 0, Math.PI * 2, 0, e.irisR), m(e.iris, 0.15))
    ir.rotation.x = -Math.PI / 2
    g.add(ir)
  }
  const pupil = new THREE.Mesh(e.slit ? new THREE.BoxGeometry(e.r * 0.9, e.r * 0.22, e.r * 0.1) : new THREE.SphereGeometry(e.pupilOnly ? e.r * 0.39 : e.r * 0.38, 12, 8), m(0x050403, 0.1))
  pupil.position.z = -e.r * (e.pupilOnly ? 0.86 : 0.97)
  if (!e.slit) pupil.scale.z = e.pupilOnly ? 0.5 : 0.3
  g.add(pupil)
  // the lid: a cap of a sphere round the eye, tucked up and back when open, down over the front when shut
  const lid = new THREE.Mesh(new THREE.SphereGeometry(e.r * 1.08, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), m(e.lid, 0.55))
  g.add(lid)
  g.position.set(...e.pos)
  g.rotation.set(e.rotX ?? 0, e.rotY ?? 0, 0, 'YXZ')
  return { g, lid, s: e.s, mats, shut: (k: number) => (lid.rotation.x = THREE.MathUtils.lerp(1.05, -1.57, k)) }
}

export function makeHeadMask(name: HeadFace, seed: number, tint = 0): FaceRig {
  const spec = HEADS[name]
  const head = new THREE.Group()
  const materials: THREE.Material[] = []
  const eyes = spec.eyes.map(eyeball)
  eyes.forEach((e) => {
    head.add(e.g)
    materials.push(...e.mats)
  })
  const parts: Record<string, THREE.Mesh> = {}
  let mouthGroup: THREE.Group | null = null
  let gone = false

  sculpted({ job: 'head', name }).then((pieces: PieceGeometry[]) => {
    if (gone) return
    if (spec.mouth !== 'morph') {
      // lips (or the beak's halves) and teeth move together as the mouth
      mouthGroup = new THREE.Group()
      mouthGroup.position.copy(new THREE.Vector3(...spec.mouthAt))
      head.add(mouthGroup)
    }
    for (const p of pieces) {
      const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: p.rough })
      tintMaterial(mat, tint)
      materials.push(mat)
      const mesh = new THREE.Mesh(p.geometry, mat)
      mesh.castShadow = true
      if (p.key === 'base' && p.geometry.morphAttributes.position) mesh.morphTargetInfluences = p.geometry.morphAttributes.position.map(() => 0)
      const inMouth = mouthGroup && (p.key === 'upper' || p.key === 'lower' || p.key === 'teeth')
      if (inMouth) {
        mesh.position.copy(p.pivot).sub(mouthGroup!.position) // pivots are in head space; the mouth group sits at the mouth
        mouthGroup!.add(mesh)
      } else {
        mesh.position.copy(p.pivot)
        head.add(mesh)
      }
      mesh.userData.home = mesh.position.clone()
      parts[p.key] = mesh
    }
    apply()
  })

  let s: Sena | null = null
  let k = 0
  let t = 0
  function sena(next: Sena | null, amount: number) {
    s = next
    k = next ? amount : 0
    apply()
  }
  function tick(now: number) {
    t = Math.floor(now * 15) / 15
    apply()
  }

  const reset = (m?: THREE.Object3D) => {
    if (!m) return
    m.position.copy(m.userData.home ?? m.position)
    m.rotation.set(0, 0, 0)
    m.scale.set(1, 1, 1)
    m.visible = true
  }

  function apply() {
    // eyes: the wink shuts the right one, nothing shuts both, and now and then they blink
    const blink = Math.sin(t * 1.7 + seed * 1.3) > 0.985 ? 1 : 0
    eyes.forEach((e) => e.shut(s === 'nada' ? k : s === 'ancho-basto' && e.s > 0 ? k : blink))
    // brows: up for the as de espadas; the right one down and tilted for the wink
    for (const [key, side] of [['browR', 1], ['browL', -1]] as const) {
      const b = parts[key]
      if (!b) continue
      reset(b)
      if (s === 'ancho-espada') b.position.y += spec.brow * k
      if (s === 'ancho-basto' && side > 0) {
        b.position.y -= spec.brow * 0.3 * k
        b.rotation.z = 0.3 * k
      }
    }
    const fish = s === 'porno' ? k * (0.55 + 0.45 * Math.sin(t * 9)) : 0
    if (spec.mouth === 'morph') {
      const base = parts.base
      if (base?.morphTargetInfluences) {
        base.morphTargetInfluences.fill(0)
        const i = s ? MORPH_SENAS.indexOf(s as (typeof MORPH_SENAS)[number]) : -1
        if (i >= 0) base.morphTargetInfluences[i] = s === 'porno' ? fish : k
      }
      // the devil's teeth follow its mouth: aside, wide, biting over the lip, back out of sight for a kiss or a fish
      const teeth = parts.teeth
      if (teeth) {
        reset(teeth)
        if (s === 'ancho-copa' || s === 'ancho-oro') {
          const side = s === 'ancho-copa' ? 1 : -1
          teeth.position.x += side * 0.022 * k
          teeth.position.y += 0.003 * k
          teeth.rotation.z = side * 0.25 * k
          teeth.scale.x = 1 - 0.25 * k
        }
        if (s === 'figuras') teeth.scale.set(1 + 0.3 * k, 1 - 0.3 * k, 1)
        if (s === 'tres') {
          teeth.position.y -= 0.007 * k
          teeth.position.z -= 0.003 * k
        }
        if (s === 'dos' || s === 'porno') {
          const o = s === 'porno' ? fish : k
          teeth.position.z += 0.03 * o
          teeth.scale.x = 1 - 0.5 * o
        }
        teeth.visible = !(s === 'dos' && k > 0.4)
      }
      return
    }
    const mouth = mouthGroup
    if (!mouth) return
    mouth.position.set(...spec.mouthAt)
    mouth.rotation.set(0, 0, 0)
    mouth.scale.set(1, 1, 1)
    const up = parts.upper
    const lo = parts.lower
    const teeth = parts.teeth
    reset(up)
    reset(lo)
    reset(teeth)
    if (spec.mouth === 'beak') {
      // the rooster: the beak twists to a side, stretches wide, bites down with its hooked tip, purses, gapes
      if (s === 'ancho-copa' || s === 'ancho-oro') {
        const side = s === 'ancho-copa' ? 1 : -1
        mouth.rotation.y = -side * 0.42 * k // the tip swings to that side
        mouth.rotation.z = side * 0.18 * k
        mouth.position.x += side * 0.006 * k
      }
      if (s === 'figuras') {
        mouth.scale.x = 1 + 0.9 * k
        if (lo) lo.rotation.x = -0.12 * k
      }
      if (s === 'tres') {
        if (up) up.rotation.x = -0.32 * k
        if (lo) {
          lo.position.z += 0.012 * k
          lo.rotation.x = 0.12 * k
        }
      }
      if (s === 'dos') {
        mouth.position.z -= 0.026 * k
        mouth.scale.set(1 - 0.5 * k, 1 - 0.2 * k, 1 + 0.25 * k)
        mouth.rotation.x = 0.12 * k
      }
      if (s === 'porno' && lo) lo.rotation.x = -0.5 * fish
      return
    }
    // lips: the mouth slides and tips to a side, stretches, the lower lip tucks under two teeth, purses, gapes
    const w = spec.mouthW
    if (teeth) teeth.visible = s === 'tres' && k > 0.15
    if (s === 'ancho-copa' || s === 'ancho-oro') {
      const side = s === 'ancho-copa' ? 1 : -1
      mouth.position.x += side * w * 0.5 * k
      mouth.position.y += w * 0.12 * k
      mouth.rotation.z = side * 0.32 * k // a crooked smirk toward that side
      mouth.scale.x = 1 - 0.2 * k
    }
    if (s === 'figuras') {
      mouth.scale.x = 1 + 0.6 * k
      if (up) up.position.y += w * 0.06 * k
      if (lo) lo.position.y -= w * 0.04 * k
    }
    if (s === 'tres' && lo) {
      lo.position.z += w * 0.35 * k
      lo.position.y += w * 0.1 * k
      if (teeth) teeth.position.y -= w * 0.12 * k
    }
    if (s === 'dos') {
      mouth.scale.set(1 - 0.5 * k, 1 + 0.15 * k, 1)
      mouth.position.z -= w * 0.35 * k
      if (up) up.position.y -= w * 0.06 * k
      if (lo) lo.position.y += w * 0.06 * k
    }
    if (s === 'porno') {
      mouth.scale.x = 1 - 0.3 * fish
      if (lo) lo.position.y -= w * 0.45 * fish
      if (up) up.position.y += w * 0.1 * fish
    }
  }

  return {
    head,
    sena,
    tick,
    dispose() {
      gone = true
      materials.forEach((m) => m.dispose())
    },
  }
}
