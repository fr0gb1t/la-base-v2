import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { GiBookCover, GiCrossMark } from 'react-icons/gi';
import { CHAPTERS, type Chapter, type Note } from './pages';

// The rulebook as a little booklet (after Tunic's manual): it comes up over a blurred, scanlined
// table, its cover opens, and every page is a leaf that turns over the spine in 3D (the next
// page is printed on its back). The drawings go through an ink filter whose noise "boils" a
// few times a second, like hand-drawn lines; a previous player left ballpoint notes in the margins.

const TURN_MS = 760;
const OPEN_MS = 900;
const BOIL_MS = 140;

type Turn = { from: number; to: number; dir: 1 | -1 };

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
  const [turn, setTurn] = useState<Turn | null>(null);
  const [opening, setOpening] = useState(true);
  const turnRef = useRef<Turn | null>(null);
  const noise = useRef<SVGFETurbulenceElement>(null);
  turnRef.current = turn;

  const go = (to: number) => {
    const target = Math.min(CHAPTERS.length - 1, Math.max(0, to));
    if (turnRef.current || opening || target === page) return;
    const t: Turn = { from: page, to: target, dir: target > page ? 1 : -1 };
    setTurn(t);
    window.setTimeout(() => {
      setPage(target);
      setTurn(null);
    }, TURN_MS);
  };

  // the cover opens once, when the booklet comes up
  useEffect(() => {
    const t = window.setTimeout(() => setOpening(false), OPEN_MS + 250);
    return () => window.clearTimeout(t);
  }, []);

  // boiling ink: the displacement noise changes seed a few times a second (not with reduced motion)
  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let k = 0;
    const id = window.setInterval(() => noise.current?.setAttribute('seed', String((k = (k + 1) % 3) + 1)), BOIL_MS);
    return () => window.clearInterval(id);
  }, []);

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

  const ch = (i: number) => CHAPTERS[i];
  let left: ReactNode;
  let right: ReactNode;
  let leaf: ReactNode = null;
  if (opening) {
    left = <div className="rb-page-face rb-inside-cover" />;
    right = <RightPage ch={ch(page)} n={page} />;
    leaf = (
      <div className="rb-leaf fwd opening">
        <div className="rb-leaf-face front"><Cover /></div>
        <div className="rb-leaf-face back"><LeftPage ch={ch(page)} n={page} /></div>
      </div>
    );
  } else if (turn && turn.dir > 0) {
    left = <LeftPage ch={ch(turn.from)} n={turn.from} />;
    right = <RightPage ch={ch(turn.to)} n={turn.to} />;
    leaf = (
      <div className="rb-leaf fwd">
        <div className="rb-leaf-face front"><RightPage ch={ch(turn.from)} n={turn.from} /></div>
        <div className="rb-leaf-face back"><LeftPage ch={ch(turn.to)} n={turn.to} /></div>
      </div>
    );
  } else if (turn) {
    left = <LeftPage ch={ch(turn.to)} n={turn.to} />;
    right = <RightPage ch={ch(turn.from)} n={turn.from} />;
    leaf = (
      <div className="rb-leaf back">
        <div className="rb-leaf-face front"><LeftPage ch={ch(turn.from)} n={turn.from} /></div>
        <div className="rb-leaf-face back"><RightPage ch={ch(turn.to)} n={turn.to} /></div>
      </div>
    );
  } else {
    left = <LeftPage ch={ch(page)} n={page} />;
    right = <RightPage ch={ch(page)} n={page} />;
  }
  const shown = turn ? turn.to : page;

  // portaled to <body>: menus create their own stacking contexts, the booklet must cover them all
  return createPortal(
    <div className="rb-veil" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <svg width={0} height={0} style={{ position: 'absolute' }} aria-hidden>
        <filter id="rb-ink" x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence ref={noise} type="fractalNoise" baseFrequency="0.035" numOctaves={2} seed={1} result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale={3.2} xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </svg>
      <section className="rulebook" role="dialog" aria-modal="true" aria-label="Manual de La Base">
        <nav className="rb-tabs" aria-label="Capítulos">
          {CHAPTERS.map((c, i) => (
            <button key={c.id} type="button" className={`rb-tab${i === shown ? ' on' : ''}`} onClick={() => go(i)} aria-current={i === shown}>
              {c.tab}
            </button>
          ))}
        </nav>
        <div className="rb-book">
          <div className="rb-half rb-half-left">{left}</div>
          <div className="rb-half rb-half-right">{right}</div>
          {leaf}
          <div className="rb-spine" aria-hidden />
        </div>
        <footer className="rb-nav">
          <button type="button" className="rb-turn" onClick={() => go(page - 1)} disabled={page === 0}>← {page > 0 ? CHAPTERS[page - 1].tab : ''}</button>
          <span className="rb-hint">← → para pasar de página · Esc para cerrar</span>
          <button type="button" className="rb-turn" onClick={() => go(page + 1)} disabled={page === CHAPTERS.length - 1}>{page < CHAPTERS.length - 1 ? CHAPTERS[page + 1].tab : ''} →</button>
        </footer>
        <button type="button" className="rb-close" onClick={onClose} aria-label="Cerrar el manual"><GiCrossMark aria-hidden /></button>
      </section>
    </div>,
    document.body,
  );
}
