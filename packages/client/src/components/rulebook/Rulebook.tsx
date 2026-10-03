import { Fragment, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { GiBookCover, GiCrossMark } from 'react-icons/gi';
import { CHAPTERS, type Chapter, type Note } from './pages';
import { uiSound } from '../../table3d/audio';
import { BookScene } from './BookScene';
import { PageTextures } from './pageTextures';

// The rulebook as a little booklet (after Tunic's manual) lying on the game table, under the lamp.
// The booklet is 3D (BookScene): its cover opens, its pages are turned by hand, its index tabs
// are part of it. The pages are still written as DOM: they are laid out offscreen and photographed into
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

// ---- the booklet is built ahead of time ----------------------------------------------------------
// Building it (a second 3D room, its shaders, the photographs of the pages) takes a few hundred
// milliseconds: done on click it froze the menu. So RulebookHost (mounted once, in App) builds it
// while the menu is idle and keeps it parked, invisible; <Rulebook/> (what the screens render to
// ask for the manual) just tells the host to come up, and the entrance is only animation.

type Opener = { onClose: () => void; start: number } | null;
const hostListeners = new Set<(o: Opener) => void>();
let requested: Opener = null;
const request = (o: Opener) => {
  requested = o;
  hostListeners.forEach((l) => l(o));
};

/** Ask for the manual while mounted (what the menu and the table render to show it). */
export function Rulebook({ onClose, start = 0 }: { onClose: () => void; start?: number }) {
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    request({ onClose: () => close.current(), start });
    return () => request(null);
  }, [start]);
  return null;
}

const IDLE_BEFORE_BUILD_MS = 2500;

export function RulebookHost() {
  const [opener, setOpener] = useState<Opener>(requested);
  const [armed, setArmed] = useState(false); // the booklet may be built now
  const [generation, setGeneration] = useState(0); // a new booklet after each use
  const [page, setPage] = useState(0);
  const host = useRef<HTMLDivElement>(null);
  const sheets = useRef<HTMLDivElement>(null);
  const book = useRef<BookScene | null>(null);
  const open = opener !== null;

  useEffect(() => {
    hostListeners.add(setOpener);
    return () => void hostListeners.delete(setOpener);
  }, []);

  // build it when the menu has been quiet for a moment (or at once if the manual is asked for first)
  useEffect(() => {
    if (armed) return;
    if (open) return setArmed(true);
    const t = window.setTimeout(() => setArmed(true), IDLE_BEFORE_BUILD_MS);
    return () => window.clearTimeout(t);
  }, [armed, open]);

  useEffect(() => {
    if (!armed) return;
    const start = 0;
    const scene: { current: BookScene | null } = { current: null };
    const pages = new PageTextures(sheets.current!, () => scene.current?.refresh(), 8);
    scene.current = new BookScene(host.current!, {
      count: CHAPTERS.length,
      tabs: CHAPTERS.map((c) => c.tab),
      start,
      pages,
      onPage: setPage,
      onTurnStart: () => uiSound('page'),
      onReveal: () => uiSound('book'),
      reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
    });
    book.current = scene.current;
    setPage(start);
    if (requested) scene.current.present(); // asked for before it was ready
    if (new URLSearchParams(location.search).has('debug')) Object.assign(window, { __book: scene.current, __bookPages: pages });
    return () => {
      scene.current?.dispose();
      pages.dispose();
      book.current = null;
    };
  }, [armed, generation]); // eslint-disable-line react-hooks/exhaustive-deps

  // asked for: come up. Closed: it fades out and stays put; the next booklet is built only once the
  // menu has been quiet again (building at the end of the fade made the exit hitch). If it is asked
  // for again before that, the used booklet is replaced on the spot (rare: you just closed it).
  const wasOpen = useRef(false);
  const used = useRef(false);
  useEffect(() => {
    if (open && !wasOpen.current) {
      if (used.current) {
        used.current = false;
        setGeneration((g) => g + 1); // a fresh one (it presents itself: `requested` is set)
      } else book.current?.present();
    }
    if (!open && wasOpen.current) {
      used.current = true;
      const t = window.setTimeout(() => {
        used.current = false;
        setGeneration((g) => g + 1);
      }, IDLE_BEFORE_BUILD_MS);
      wasOpen.current = false;
      return () => window.clearTimeout(t);
    }
    wasOpen.current = open;
  }, [open]);

  const go = (to: number) => book.current?.go(to);
  const onClose = () => opener?.onClose();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') book.current?.step1(1); // from where the book is heading: quick presses add leaves
      if (e.key === 'ArrowLeft') book.current?.step1(-1);
      if (e.key === 'r' || e.key === 'R') e.stopPropagation();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!armed) return null;
  // portaled to <body>: menus create their own stacking contexts, the booklet must cover them all
  return createPortal(
    <div className={`rb-veil${open ? '' : ' rb-parked'}`} onPointerDown={(e) => e.target === e.currentTarget && onClose()} aria-hidden={!open}>
      <section className="rulebook" role="dialog" aria-modal="true" aria-label="Manual de La Base">
        <nav className="sr-only" aria-label="Capítulos">
          {CHAPTERS.map((c, i) => (
            <button key={c.id} type="button" className={`rb-tab${i === page ? ' on' : ''}`} onClick={() => go(i)} aria-current={i === page} tabIndex={open ? 0 : -1}>
              {c.tab}
            </button>
          ))}
        </nav>
        <div className="rb-book" ref={host} />
        <div className="sr-only" aria-live="polite">
          <RightPage ch={CHAPTERS[page]} n={page} />
        </div>
        <footer className="rb-nav">
          <button type="button" className="rb-turn" onClick={() => book.current?.step1(-1)} disabled={page === 0} tabIndex={open ? 0 : -1}>← {page > 0 ? CHAPTERS[page - 1].tab : ''}</button>
          <span className="rb-hint">agarrá una hoja y arrastrala, o hacé clic · ← → · Esc para cerrar</span>
          <button type="button" className="rb-turn" onClick={() => book.current?.step1(1)} disabled={page === CHAPTERS.length - 1} tabIndex={open ? 0 : -1}>{page < CHAPTERS.length - 1 ? CHAPTERS[page + 1].tab : ''} →</button>
        </footer>
        <button type="button" className="rb-close" onClick={onClose} aria-label="Cerrar el manual" tabIndex={open ? 0 : -1}><GiCrossMark aria-hidden /></button>
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
