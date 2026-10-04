import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { uiSound } from '../table3d/audio';
import { useOverlay } from '../lib/overlay';

// A picker the size of the screen, for phones: the same lit stage the desktop shows beside the ledger (your face
// making señas, or the back of your cards turning under the lamp), filling the screen. Swipe left or right — or
// ‹ › or the arrow keys — to go through them one by one; the list jumps straight to one; «Listo» closes it.
// Every step is picked at once, as on the desktop.

export interface PickOption { id: string; name: string; group?: string; disabled?: boolean }

interface Props {
  title: string;
  stage: ReactNode;
  options: readonly PickOption[];
  value: string;
  note?: string; // a line under the name (what the face is)
  onPick: (id: string) => void;
  onClose: () => void;
}

const SWIPE = 45; // px across before a drag counts as a swipe

export function FullPicker({ title, stage, options, value, note, onPick, onClose }: Props) {
  useOverlay();
  const i = Math.max(0, options.findIndex((o) => o.id === value));
  const step = (by: 1 | -1) => {
    // (passing over the ones not on offer)
    for (let k = 1; k < options.length; k++) {
      const o = options[(i + by * k + options.length * k) % options.length];
      if (o.disabled) continue;
      uiSound('chip');
      onPick(o.id);
      return;
    }
  };
  const stepRef = useRef(step);
  stepRef.current = step;
  const start = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') stepRef.current(-1);
      else if (e.key === 'ArrowRight') stepRef.current(1);
      else if (e.key === 'Escape') onClose();
      else return;
      e.preventDefault();
      e.stopPropagation();
    };
    addEventListener('keydown', key, true);
    return () => removeEventListener('keydown', key, true);
  }, [onClose]);

  // the groups of the list, in the order they first appear
  const groups = [...new Set(options.map((o) => o.group ?? ''))];

  return createPortal(
    <div
      className="fullpick"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onPointerDown={(e) => (start.current = { x: e.clientX, y: e.clientY })}
      onPointerUp={(e) => {
        const s = start.current;
        start.current = null;
        if (!s) return;
        const dx = e.clientX - s.x;
        if (Math.abs(dx) > SWIPE && Math.abs(dx) > Math.abs(e.clientY - s.y) * 1.5) step(dx < 0 ? 1 : -1); // drag left: the next one
      }}
      onPointerCancel={() => (start.current = null)}
    >
      <div className="fullpick-stage">{stage}</div>
      <header className="fullpick-top">
        <span className="fullpick-title">{title}</span>
        <span className="fullpick-count">{i + 1} / {options.length}</span>
        <button type="button" className="fullpick-done" onClick={onClose}>Listo</button>
      </header>
      <footer className="fullpick-bottom" onPointerDown={(e) => e.stopPropagation()}>
        <div className="fullpick-row">
          <button type="button" className="fullpick-step" aria-label="Anterior" onClick={() => step(-1)}>‹</button>
          <select
            id="fullpick-list"
            className="fullpick-select"
            aria-label={title}
            value={value}
            onChange={(e) => {
              uiSound('chip');
              onPick(e.target.value);
            }}
          >
            {groups.map((g) =>
              g ? (
                <optgroup key={g} label={g}>
                  {options.filter((o) => o.group === g).map((o) => <option key={o.id} value={o.id} disabled={o.disabled}>{o.name}</option>)}
                </optgroup>
              ) : (
                options.filter((o) => !o.group).map((o) => <option key={o.id} value={o.id} disabled={o.disabled}>{o.name}</option>)
              ),
            )}
          </select>
          <button type="button" className="fullpick-step" aria-label="Siguiente" onClick={() => step(1)}>›</button>
        </div>
        {note && <p className="fullpick-note">{note}</p>}
        <p className="fullpick-hint">deslizá a los costados para pasar</p>
      </footer>
    </div>,
    document.body,
  );
}
