// Whether a menu is open over the screen (ajustes, novedades, the anotador, the manual...). While one is, the 3D
// scene behind it is only a picture: the cursor does not hover, aim or light anything in it.
import { useEffect } from 'react'

let open = 0

export const overlayOpen = () => open > 0

/** Marks a menu as open while the component is mounted (and `active`). */
export function useOverlay(active = true) {
  useEffect(() => {
    if (!active) return
    open++
    document.documentElement.classList.add('has-overlay')
    return () => {
      open--
      if (open === 0) document.documentElement.classList.remove('has-overlay')
    }
  }, [active])
}
