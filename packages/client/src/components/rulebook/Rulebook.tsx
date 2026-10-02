import { Fragment, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { GiBookCover, GiCrossMark } from 'react-icons/gi';
import { CHAPTERS, type Chapter, type Note } from './pages';
import { uiSound } from '../../table3d/audio';
import { BookScene } from './BookScene';
import { PageTextures } from './pageTextures';

// The rulebook as a little booklet (after Tunic's manual) lying under the lamp, over a blurred,
// scanlined table. The booklet itself is 3D (BookScene): its cover opens and its pages are turned
// by hand. The pages are still written as DOM: they are laid out offscreen and photographed into
// the 3D pages; a hidden copy of the open spread keeps the text readable by screen readers.

function Notes({ notes, side }: { notes?: Note[]; side: 'left' | 'right' }) {
  return (
    <>
      {notes
        ?.filter((n) => n.side === side)
        .map((n, i) => (
          <div key={i} className="rb-note" style={{ left: `${n.x}%`, top: `${n.y}%`, transform: `rotate(${n.rot}deg)` }}>
            {n.arrow && (
              <svg className="rb-note-arrow" width={90} height={70} viewBox="0 0 90 70" style={{ transform: `rotate(${n.arrow}deg)` }} aria-hidden>
                <path d="M6 60 C 25 40, 45 22, 78 12 M66 6 L80 11 L70 22" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
            {n.text}
          </div>
        ))}
    </>
  );
}

function LeftPage({ ch, n }: { ch: Chapter; n: number }) {
  return (
    <div className={`rb-page-face rb-left stain-${n % 3}`}>
      <div className="rb-art">{ch.art}</div>
      <Notes notes={ch.notes} side="left" />
      <span className="rb-folio left">{n * 2 + 1}</span>
    </div>
  );
}

function RightPage({ ch, n }: { ch: Chapter; n: number }) {
  return (
    <div className="rb-page-face rb-right">
      <header>
        <span className="rb-chapter"><GiBookCover aria-hidden /> {ch.tab}</span>
        <h2>{ch.title}</h2>
        <p className="rb-kicker">{ch.kicker}</p>
      </header>
      <div className="rb-body">{ch.body}</div>
      <Notes notes={ch.notes} side="right" />
      <span className="rb-folio right">{n * 2 + 2}</span>
    </div>
  );
}

function Cover() {
  return (
    <div className="rb-page-face rb-cover">
      <div className="rb-cover-frame">
        <span className="rb-cover-kicker">manual de la mesa</span>
        <h1>La Base</h1>
        <svg width={120} height={60} viewBox="0 0 120 60" aria-hidden className="rb-ink">
          {[20, 60, 100].map((x, i) => (
            <g key={x}>
              <ellipse cx={x} cy={30} rx={13} ry={17} fill="#e9dcc2" stroke="#140e0c" strokeWidth={2} />
              <circle cx={x - 4} cy={27} r={2} fill="#140e0c" />
              <circle cx={x + 4} cy={27} r={2} fill="#140e0c" />
              <path d={`M${x - 4} ${37 + (i - 1)} h8`} stroke="#140e0c" strokeWidth={1.6} />
            </g>
          ))}
        </svg>
        <span className="rb-cover-sub">cartas españolas · 4, 6 u 8 personas</span>
      </div>
    </div>
  );
}

export function Rulebook({ onClose, start = 0 }: { onClose: () => void; start?: number }) {
  const [page, setPage] = useState(start);
  const host = useRef<HTMLDivElement>(null);
  const sheets = useRef<HTMLDivElement>(null);
  const book = useRef<BookScene | null>(null);

  useEffect(() => {
    uiSound('book');
    const scene: { current: BookScene | null } = { current: null };
    const pages = new PageTextures(sheets.current!, () => scene.current?.refresh(), 8);
    scene.current = new BookScene(host.current!, {
      count: CHAPTERS.length,
      start,
      pages,
      onPage: setPage,
      onTurnStart: () => uiSound('page'),
      reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
    });
    book.current = scene.current;
    if (new URLSearchParams(location.search).has("debug")) Object.assign(window, { __book: scene.current, __bookPages: pages });
    return () => {
      scene.current?.dispose();
      pages.dispose();
      book.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const go = (to: number) => book.current?.go(to);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') go(page + 1);
      if (e.key === 'ArrowLeft') go(page - 1);
      if (e.key === 'r' || e.key === 'R') e.stopPropagation();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // portaled to <body>: menus create their own stacking contexts, the booklet must cover them all
  return createPortal(
    <div className="rb-veil" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <section className="rulebook" role="dialog" aria-modal="true" aria-label="Manual de La Base">
        <nav className="rb-tabs" aria-label="Capítulos">
          {CHAPTERS.map((c, i) => (
            <button key={c.id} type="button" className={`rb-tab${i === page ? ' on' : ''}`} onClick={() => go(i)} aria-current={i === page}>
              {c.tab}
            </button>
          ))}
        </nav>
        <div className="rb-book" ref={host} />
        <div className="sr-only" aria-live="polite">
          <RightPage ch={CHAPTERS[page]} n={page} />
        </div>
        <footer className="rb-nav">
          <button type="button" className="rb-turn" onClick={() => go(page - 1)} disabled={page === 0}>← {page > 0 ? CHAPTERS[page - 1].tab : ''}</button>
          <span className="rb-hint">agarrá una hoja y arrastrala, o hacé clic · ← → · Esc para cerrar</span>
          <button type="button" className="rb-turn" onClick={() => go(page + 1)} disabled={page === CHAPTERS.length - 1}>{page < CHAPTERS.length - 1 ? CHAPTERS[page + 1].tab : ''} →</button>
        </footer>
        <button type="button" className="rb-close" onClick={onClose} aria-label="Cerrar el manual"><GiCrossMark aria-hidden /></button>
      </section>
      {/* the pages, laid out offscreen to be photographed into the 3D booklet */}
      <div className="rb-sheets" ref={sheets} aria-hidden>
        <div className="rb-sheet" data-key="cover"><Cover /></div>
        {CHAPTERS.map((c, i) => (
          <Fragment key={c.id}>
            <div className="rb-sheet" data-key={`L${i}`}><LeftPage ch={c} n={i} /></div>
            <div className="rb-sheet" data-key={`R${i}`}><RightPage ch={c} n={i} /></div>
          </Fragment>
        ))}
      </div>
    </div>,
    document.body,
  );
}
