import { useEffect, useRef, useState } from 'react';
import { SENAS, type Sena } from '@la-base/shared';
import { SenaFace } from './SenaFace';

// Radial menu of señas. Opened with the middle mouse button (hold, aim, release) or the G key.
// Releasing in the centre keeps it open: then click a face, press 1–8, or Esc to close. The centre
// itself asks your partners for señas (two knocks on the table).

const RADIUS = 118;
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

/** Sector under a pointer offset, or -1 in the dead zone. Item 0 is at the top, clockwise. */
function sectorAt(dx: number, dy: number) {
  if (Math.hypot(dx, dy) < DEAD_ZONE) return -1;
  const a = (Math.atan2(dx, -dy) + Math.PI * 2) % (Math.PI * 2);
  return Math.round(a / ((Math.PI * 2) / SENAS.length)) % SENAS.length;
}

export function SenaWheel({ open, onPick, onAsk, onClose }: Props) {
  const [hover, setHover] = useState(-1);
  const hoverRef = useRef(-1);
  hoverRef.current = hover;
  // keep it on screen
  const x = Math.min(Math.max(open.x, RADIUS + 50), window.innerWidth - RADIUS - 50);
  const y = Math.min(Math.max(open.y, RADIUS + 50), window.innerHeight - RADIUS - 50);

  useEffect(() => {
    let held = open.held;
    const onMove = (e: PointerEvent) => setHover(sectorAt(e.clientX - x, e.clientY - y));
    const onUp = (e: PointerEvent) => {
      if (!held || e.button !== 1) return;
      held = false;
      const k = sectorAt(e.clientX - x, e.clientY - y);
      if (k >= 0) onPick(SENAS[k].id);
    };
    const onDown = (e: PointerEvent) => {
      if (held) return;
      const dx = e.clientX - x;
      const dy = e.clientY - y;
      const k = sectorAt(dx, dy);
      if (e.button === 0 && k >= 0 && Math.hypot(dx, dy) < RADIUS + 50) onPick(SENAS[k].id);
      else if (e.button === 0 && Math.hypot(dx, dy) < DEAD_ZONE) onAsk();
      else onClose();
      e.preventDefault();
      e.stopPropagation();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      const n = Number(e.key);
      if (n >= 1 && n <= SENAS.length) onPick(SENAS[n - 1].id);
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
  }, [open, x, y, onPick, onAsk, onClose]);

  const current = hover >= 0 ? SENAS[hover] : null;
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
      {SENAS.map((s, i) => {
        const a = (i / SENAS.length) * Math.PI * 2;
        return (
          <button
            key={s.id}
            type="button"
            role="menuitem"
            className={`sena-item${i === hover ? ' on' : ''}`}
            style={{ transform: `translate(${Math.sin(a) * RADIUS}px, ${-Math.cos(a) * RADIUS}px) translate(-50%, -50%)` }}
            aria-label={`${i + 1}: ${s.label} (${s.gesture})`}
            onClick={() => onPick(s.id)}
          >
            <SenaFace sena={s.id} />
            <small>{i + 1}</small>
          </button>
        );
      })}
    </div>
  );
}
