import { useEffect, useReducer } from 'react'
import { stageReducer, VEIL_CLOSE_MS, VEIL_OPEN_MS, type VeilPhase } from '../lib/pageStage'
import type { AppPage } from '../store/gameStore'

const prefersReducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * The page to render now and the veil's phase. It follows `target`, but the way into the game table goes behind a
 * veil (see lib/pageStage.ts): the table is only mounted once the veil has closed.
 */
export function useStagedPage(target: AppPage): { page: AppPage; veil: VeilPhase } {
  const [stage, dispatch] = useReducer(stageReducer, { shown: target, veil: 'off' as VeilPhase })

  useEffect(() => {
    dispatch({ type: 'target', target, reduced: prefersReducedMotion() })
  }, [target])

  useEffect(() => {
    if (stage.veil !== 'closing') return
    const t = window.setTimeout(() => dispatch({ type: 'closed', target }), VEIL_CLOSE_MS)
    return () => window.clearTimeout(t)
  }, [stage.veil, target])

  useEffect(() => {
    if (stage.veil !== 'opening') return
    const t = window.setTimeout(() => dispatch({ type: 'opened' }), VEIL_OPEN_MS)
    return () => window.clearTimeout(t)
  }, [stage.veil])

  return { page: stage.shown, veil: stage.veil }
}
