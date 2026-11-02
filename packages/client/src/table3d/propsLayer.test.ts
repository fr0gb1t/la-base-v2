import * as THREE from 'three'
import { describe, expect, test } from 'vitest'
import { PROPS_LAYER, toProps } from './propsLayer'

// The post pipeline renders the same scene with three camera layer sets. three.js only counts the lights the camera
// can see; if the passes disagree, the lights state changes version twice per frame and every lit material looks
// its shader up again in every pass (the "bordes suaves" slowdown).
const passes = {
  world: (() => { const c = new THREE.PerspectiveCamera(); c.layers.set(0); c.layers.enable(PROPS_LAYER); return c })(),
  depth: (() => { const c = new THREE.PerspectiveCamera(); c.layers.set(0); return c })(),
  props: (() => { const c = new THREE.PerspectiveCamera(); c.layers.set(PROPS_LAYER); return c })(),
}

describe('toProps', () => {
  test('puts meshes on the props layer only', () => {
    const group = new THREE.Group()
    const mesh = new THREE.Mesh()
    group.add(mesh)
    toProps(group)
    expect(mesh.layers.isEnabled(PROPS_LAYER)).toBe(true)
    expect(mesh.layers.isEnabled(0)).toBe(false)
    expect(group.layers.isEnabled(0)).toBe(false)
  })

  test('a light inside the props is seen by the world, depth and props passes alike', () => {
    const group = new THREE.Group()
    const lamp = new THREE.PointLight()
    group.add(new THREE.Mesh(), lamp)
    toProps(group)
    for (const [name, camera] of Object.entries(passes)) expect(lamp.layers.test(camera.layers), name).toBe(true)
  })

  test('nested lights are handled too', () => {
    const group = new THREE.Group()
    const inner = new THREE.Group()
    const spot = new THREE.SpotLight()
    inner.add(spot)
    group.add(inner)
    toProps(group)
    for (const [name, camera] of Object.entries(passes)) expect(spot.layers.test(camera.layers), name).toBe(true)
    expect(inner.layers.isEnabled(0)).toBe(false)
  })
})
