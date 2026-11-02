import type { AppPage } from '../store/gameStore'

// Going into the game table is the one heavy moment of the app: the menu's 3D scene is torn down, the table's own
// WebGL context is created, the scene built and its first frame drawn, all in a single frame (a freeze of ~0.2 s on
// a good PC, about half a second on a modest one). It cannot be made smaller without restructuring both scenes, so
// it is hidden: a black veil closes over the menu first (the compositor animates it, so it keeps moving), the table
// is mounted behind it, and the veil opens once the table is there.

export type VeilPhase = 'off' | 'closing' | 'opening'

/** What is on screen now (`shown`), which may lag behind the page the app wants while the veil closes. */
export interface Stage {
  shown: AppPage
  veil: VeilPhase
}

export type StageEvent =
  | { type: 'target'; target: AppPage; reduced: boolean }
  | { type: 'closed'; target: AppPage }
  | { type: 'opened' }

/** Keep in step with `.page-veil-closing` / `.page-veil-opening` in index.css. */
export const VEIL_CLOSE_MS = 160
export const VEIL_OPEN_MS = 420

/** Only the way into the table is veiled; and never for people who asked for less motion. */
export function needsVeil(from: AppPage, to: AppPage, reducedMotion: boolean): boolean {
  return to === 'game' && from !== 'game' && !reducedMotion
}

export function stageReducer(s: Stage, e: StageEvent): Stage {
  switch (e.type) {
    case 'target': {
      if (e.target === s.shown && s.veil === 'off') return s
      if (needsVeil(s.shown, e.target, e.reduced)) return s.veil === 'closing' ? s : { shown: s.shown, veil: 'closing' }
      return { shown: e.target, veil: 'off' }
    }
    case 'closed':
      return s.veil === 'closing' ? { shown: e.target, veil: 'opening' } : s
    case 'opened':
      return s.veil === 'opening' ? { shown: s.shown, veil: 'off' } : s
  }
}
