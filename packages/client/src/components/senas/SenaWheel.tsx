import { useEffect, useMemo, useRef, useState } from 'react';
import { type Sena, type SENAS } from '@la-base/shared';
import { SenaFace } from './SenaFace';
import { orderedSenas } from '../../settings/viewSettings';
import { useViewSettings } from '../../settings/SettingsPanel';

// Radial menu of señas. Opened with the middle mouse button (hold, aim, release) or the G key.
// Releasing in the centre keeps it open: then click a face, press 1–8, or Esc to close. The centre
// itself asks your partners for señas (two knocks on the table).

const RADIUS = 138; // 11 faces around the hub
const DEAD_ZONE = 34; // px from the centre where nothing is selected

export interface WheelOpen {
  x: number;
  y: number;
  held: boolean; // opened by holding the middle button (release picks)
}

interface Props {
  open: WheelOpen;
  onPick: (sena: Sena) => void;
  onAsk: () => void;
  onClose: () => void;
}

/** Keyboard shortcut shown on each face: 1–9 for the cards, S / N for sí and no. */
type Ring = typeof SENAS;
const isYesNo = (id: Sena) => id === 'si' || id === 'no';
/** The digits count the card señas in ring order (so they follow your own order); S / N are fixed. */
const keyOf = (list: Ring, i: number) => (list[i].id === 'si' ? 'S' : list[i].id === 'no' ? 'N' : String(list.slice(0, i).filter((x) => !isYesNo(x.id)).length + 1));

/** Sector under a pointer offset, or -1 in the dead zone. Item 0 is at the top, clockwise. */
function sectorAt(dx: number, dy: number, count: number) {
  if (Math.hypot(dx, dy) < DEAD_ZONE) return -1;
  const a = (Math.atan2(dx, -dy) + Math.PI * 2) % (Math.PI * 2);
  return Math.round(a / ((Math.PI * 2) / count)) % count;
}

export function SenaWheel({ open, onPick, onAsk, onClose }: Props) {
  const { senaOrder } = useViewSettings();
  const list = useMemo(() => orderedSenas(senaOrder), [senaOrder]); // your own ring order (Ajustes)
  const [hover, setHover] = useState(-1);
  const hoverRef = useRef(-1);
  hoverRef.current = hover;
  // keep it on screen
  const x = Math.min(Math.max(open.x, RADIUS + 50), window.innerWidth - RADIUS - 50);
  const y = Math.min(Math.max(open.y, RADIUS + 50), window.innerHeight - RADIUS - 50);

  useEffect(() => {
    let held = open.held;
    const onMove = (e: PointerEvent) => setHover(sectorAt(e.clientX - x, e.clientY - y, list.length));
    const onUp = (e: PointerEvent) => {
      if (!held || e.button !== 1) return;
      held = false;
      const k = sectorAt(e.clientX - x, e.clientY - y, list.length);
      if (k >= 0) onPick(list[k].id);
    };
    const onDown = (e: PointerEvent) => {
      if (held) return;
      if ((e.target as HTMLElement | null)?.closest?.('.touch-senas')) return; // its own tap closes the ring (the click handler)
      const dx = e.clientX - x;
      const dy = e.clientY - y;
      const k = sectorAt(dx, dy, list.length);
      if (e.button === 0 && k >= 0 && Math.hypot(dx, dy) < RADIUS + 50) onPick(list[k].id);
      else if (e.button === 0 && Math.hypot(dx, dy) < DEAD_ZONE) onAsk();
      else onClose();
      e.preventDefault();
      e.stopPropagation();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 's' || e.key === 'S') return onPick('si');
      if (e.key === 'n' || e.key === 'N') return onPick('no');
      const n = Number(e.key);
      const cards = list.filter((x) => !isYesNo(x.id));
      if (n >= 1 && n <= cards.length) onPick(cards[n - 1].id);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointerdown', onDown, true);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('keydown', onKey);
    };
  }, [open, x, y, onPick, onAsk, onClose, list]);

  const current = hover >= 0 ? list[hover] : null;
  return (
    <div className="sena-wheel" style={{ left: x, top: y }} role="menu" aria-label="Señas">
      <div className="sena-hub">
        {current ? (
          <>
            <strong>{current.label}</strong>
            <span>{current.gesture}</span>
          </>
        ) : (
          <>
            <strong>pedir señas</strong>
            <span>tocá el centro · P</span>
          </>
        )}
      </div>
      {list.map((s, i) => {
        const a = (i / list.length) * Math.PI * 2;
        return (
          <button
            key={s.id}
            type="button"
            role="menuitem"
            className={`sena-item${i === hover ? ' on' : ''}`}
            style={{ transform: `translate(${Math.sin(a) * RADIUS}px, ${-Math.cos(a) * RADIUS}px) translate(-50%, -50%)` }}
            aria-label={`${keyOf(list, i)}: ${s.label} (${s.gesture})`}
            onClick={() => onPick(s.id)}
          >
            <SenaFace sena={s.id} />
            <small>{keyOf(list, i)}</small>
          </button>
        );
      })}
    </div>
  );
}
