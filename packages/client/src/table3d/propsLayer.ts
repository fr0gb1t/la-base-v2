import * as THREE from 'three'

// The props drawn smooth (anti-aliased, at full resolution) when «Bordes suaves» is on: the televisions,
// the notepad, the clock, every card, the hands, the names and the floating buttons of the menus. They
// live on their own layer; the world pass still draws them (shadows, depth, and their colour when the
// setting is off), and the post pass paints them again, crisp, over the pixelated world.
export const PROPS_LAYER = 2

/** Put an object and everything under it on the props layer. */
export function toProps(o: THREE.Object3D) {
  o.traverse((c) => c.layers.set(PROPS_LAYER))
  return o
}

/**
 * Hides the props' colours from the world pass (drawn smooth on top, so they must not show through the
 * low-res pass) and gives them back afterwards. Only meshes on the props layer, and only materials that
 * write colour to begin with: the shadow-only ones (colorWrite off) stay as they are.
 */
export class PropColors {
  private mats = new Set<THREE.Material>()

  off(scene: THREE.Scene) {
    this.mats.clear()
    scene.traverse((o) => {
      if (!(o instanceof THREE.Mesh) || !o.visible || o.layers.isEnabled(0) || !o.layers.isEnabled(PROPS_LAYER)) return
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) if (m.colorWrite) this.mats.add(m)
    })
    for (const m of this.mats) m.colorWrite = false
  }

  on() {
    for (const m of this.mats) m.colorWrite = true
  }
}
