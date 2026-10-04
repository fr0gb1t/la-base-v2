import { useCallback, useEffect, useState } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { GiCog, GiNewspaper } from 'react-icons/gi';
import { useMenuScene } from '../menu/MenuBackdrop';
import { openSettings } from '../settings/SettingsPanel';
import { NOVEDADES, markNovedadesSeen, useUnseenNovedades } from '../changelog/novedades';
import { NovedadesPanel } from './NovedadesPanel';

// The home screen's televisions, on the side table in the 3D basement: ajustes and novedades. The
// novedades set turns amber and pulses until it's been opened. The DOM keeps real buttons (hidden)
// for the keyboard and screen readers.

export function MenuTelevisions() {
  const scene = useMenuScene();
  const unseen = useUnseenNovedades();
  const [open, setOpen] = useState(false);

  const openNovedades = useCallback(() => {
    setOpen(true);
    markNovedadesSeen();
  }, []);

  // the sets follow `unseen` in place (HudBoard re-tints a set that gains or loses news without rebuilding it)
  useEffect(() => {
    if (!scene) return;
    const icon = (el: JSX.Element) => renderToStaticMarkup(el);
    scene.setHud([
      {
        id: 'novedades',
        label: 'novedades',
        hint: unseen > 0 ? `Hay novedades: ${NOVEDADES[0].title}` : 'Lo que cambió en el juego',
        svg: icon(<GiNewspaper />),
        attention: unseen > 0,
      },
      { id: 'ajustes', label: 'ajustes', hint: 'Sonido, cámara, dorso, señas (O)', svg: icon(<GiCog />) },
    ]);
  }, [scene, unseen]);

  // the click handler, and taking the sets away when the home screen goes
  useEffect(() => {
    if (!scene) return;
    scene.onHud = (id) => (id === 'ajustes' ? openSettings(true) : openNovedades());
    return () => {
      scene.setHud([]);
      scene.onHud = () => undefined;
    };
  }, [scene, openNovedades]);

  const close = useCallback(() => setOpen(false), []);
  return (
    <>
      <nav className="sr-only" aria-label="Televisores">
        <button type="button" onClick={openNovedades}>
          Novedades{unseen > 0 ? ' (hay nuevas)' : ''}
        </button>
        <button type="button" onClick={() => openSettings(true)}>
          Ajustes
        </button>
      </nav>
      {open && <NovedadesPanel onClose={close} />}
    </>
  );
}
