import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { GiBookCover, GiCrossMark } from 'react-icons/gi';
import { CHAPTERS } from './pages';

// The illustrated rulebook: a booklet with index tabs. A drawing on the left page, the rule on the
// right; ← → or the tabs to move, Esc to close. Opened from the main menu and from the table (R).

export function Rulebook({ onClose, start = 0 }: { onClose: () => void; start?: number }) {
  const [page, setPage] = useState(start);
  const ch = CHAPTERS[page];
  const go = (d: number) => setPage((p) => Math.min(CHAPTERS.length - 1, Math.max(0, p + d)));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') go(1);
      if (e.key === 'ArrowLeft') go(-1);
      if (e.key === 'r' || e.key === 'R') e.stopPropagation();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]); // eslint-disable-line react-hooks/exhaustive-deps

  // portaled to <body>: menus create their own stacking contexts, the booklet must cover them all
  return createPortal(
    <div className="rb-veil" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <section className="rulebook" role="dialog" aria-modal="true" aria-label="Manual de La Base">
        <nav className="rb-tabs" aria-label="Capítulos">
          {CHAPTERS.map((c, i) => (
            <button key={c.id} type="button" className={`rb-tab${i === page ? ' on' : ''}`} onClick={() => setPage(i)} aria-current={i === page}>
              {c.tab}
            </button>
          ))}
        </nav>
        <div className="rb-spread" key={ch.id}>
          <div className="rb-page rb-left">
            <div className="rb-art">{ch.art}</div>
          </div>
          <div className="rb-page rb-right">
            <header>
              <span className="rb-chapter"><GiBookCover aria-hidden /> {page + 1} / {CHAPTERS.length}</span>
              <h2>{ch.title}</h2>
              <p className="rb-kicker">{ch.kicker}</p>
            </header>
            <div className="rb-body">{ch.body}</div>
          </div>
        </div>
        <footer className="rb-nav">
          <button type="button" className="rb-turn" onClick={() => go(-1)} disabled={page === 0}>← {page > 0 ? CHAPTERS[page - 1].tab : ''}</button>
          <span className="rb-hint">← → para pasar de página · Esc para cerrar</span>
          <button type="button" className="rb-turn" onClick={() => go(1)} disabled={page === CHAPTERS.length - 1}>{page < CHAPTERS.length - 1 ? CHAPTERS[page + 1].tab : ''} →</button>
        </footer>
        <button type="button" className="rb-close" onClick={onClose} aria-label="Cerrar el manual"><GiCrossMark aria-hidden /></button>
      </section>
    </div>,
    document.body,
  );
}
