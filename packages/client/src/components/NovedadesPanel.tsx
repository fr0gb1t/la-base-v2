import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { GiNewspaper } from 'react-icons/gi';
import { NOVEDADES, groupByDate } from '../changelog/novedades';
import { uiSound } from '../table3d/audio';
import { useOverlay } from '../lib/overlay';

// What's new, on a sheet of paper like the settings ledger. Esc or a click outside closes it.

const dateLabel = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' });
};

const DAYS = groupByDate(NOVEDADES);

export function NovedadesPanel({ onClose }: { onClose: () => void }) {
  useOverlay();
  // 0 is the newest day; going back walks to older ones
  const [day, setDay] = useState(0);
  const go = (to: number) => {
    if (to < 0 || to >= DAYS.length || to === day) return;
    uiSound('paper');
    setDay(to);
  };
  const current = DAYS[day];

  // a breathing arrow says there is more below; it goes away once the end has been reached
  const listRef = useRef<HTMLDivElement>(null);
  const [more, setMore] = useState(false);
  const check = useCallback(() => {
    const el = listRef.current;
    if (el) setMore(el.scrollHeight - el.scrollTop - el.clientHeight > 6);
  }, []);
  useLayoutEffect(() => {
    listRef.current?.scrollTo({ top: 0 }); // each day starts at its top
    check();
  }, [day, check]);
  useEffect(() => {
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, [check]);

  useEffect(() => {
    uiSound('paper');
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft') setDay((d) => Math.min(d + 1, DAYS.length - 1));
      else if (e.key === 'ArrowRight') setDay((d) => Math.max(d - 1, 0));
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      uiSound('paper');
    };
  }, [onClose]);

  return (
    <div className="settings-veil" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <section className="ledger novedades" role="dialog" aria-modal="true" aria-label="Novedades">
        <h2><GiNewspaper aria-hidden /> Novedades</h2>
        {current && (
          <nav className="novedades-nav" aria-label="Fechas">
            <button type="button" onClick={() => go(day + 1)} disabled={day >= DAYS.length - 1} aria-label="Fecha anterior">‹ Antes</button>
            <strong>{dateLabel(current.date)}{day === 0 && <small> · lo último</small>}</strong>
            <button type="button" onClick={() => go(day - 1)} disabled={day === 0} aria-label="Fecha siguiente">Después ›</button>
          </nav>
        )}
        <div className="novedades-body">
          <div className="novedades-list" ref={listRef} onScroll={check}>
            {current?.entries.map((n) => (
              <article key={n.id} className="novedad">
                <h3>{n.title}</h3>
                <ul>
                  {n.items.map((it) => (
                    <li key={it}>{it}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
          {more && <div className="novedades-more" aria-hidden><span>▾</span></div>}
        </div>
        <p className="ledger-note">{DAYS.length > 1 ? '← → cambian de fecha · Esc cierra' : 'Esc cierra'}</p>
      </section>
    </div>
  );
}
