import { useEffect, useLayoutEffect, useRef } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import rough from 'roughjs';
import type { RoughSVG } from 'roughjs/bin/svg';

// The scoresheet that opens when you pick up the notepad on the table: a sheet of ruled paper
// floating in the middle of the screen, written by hand. Words and figures are written left to right
// in a handwriting face; every rule, box and star is drawn with rough.js (wobbly pencil lines) and
// then drawn in stroke by stroke, one after the other.

export interface AnotadorTeam {
  label: string; // "Tu equipo" / "Rivales"
  sub: string; // Nosotros / Ellos
  score: number;
  asked: string; // what they asked: a number, … or —
  kamikaze: boolean;
  won: number;
  bid: number | null;
  kamikazes: number;
  mine: boolean;
  acting: boolean;
}

export interface AnotadorPlayer {
  name: string;
  cards: number;
  tags: string;
  mine: boolean;
  ready: boolean | null;
}

export interface AnotadorData {
  round: number;
  rounds: number;
  tiebreak: boolean;
  base: number;
  bases: number;
  clockwise: boolean;
  teams: AnotadorTeam[];
  players: AnotadorPlayer[];
  room: string;
}

const PENCIL = '#2a2622';
const RED = '#8e2a22';
const TEAL = '#2f5f6b';

/** Handwriting that writes itself, left to right, after `delay` seconds. */
function Ink({ children, delay = 0, tilt = 0, className = '' }: { children: ReactNode; delay?: number; tilt?: number; className?: string }) {
  const style = { '--d': `${delay}s`, '--tilt': `${tilt}deg` } as CSSProperties;
  return (
    <span className={`ink ${className}`} style={style}>
      {children}
    </span>
  );
}

/** A box of wobbly pencil strokes, drawn in after `delay` seconds. */
function Sketch({
  draw,
  w,
  h,
  delay = 0,
  className = '',
}: {
  draw: (rc: RoughSVG, w: number, h: number) => SVGElement[];
  w?: number;
  h: number;
  delay?: number;
  className?: string;
}) {
  const svg = useRef<SVGSVGElement>(null);
  useLayoutEffect(() => {
    const el = svg.current;
    if (!el) return;
    const width = w ?? el.getBoundingClientRect().width;
    el.setAttribute('viewBox', `0 0 ${width} ${h}`);
    el.replaceChildren();
    const rc = rough.svg(el);
    let n = 0;
    for (const node of draw(rc, width, h)) {
      el.appendChild(node);
      node.querySelectorAll('path').forEach((p) => {
        const len = Math.ceil((p as SVGPathElement).getTotalLength?.() ?? 200);
        (p as SVGPathElement).style.setProperty('--len', String(len));
        (p as SVGPathElement).style.setProperty('--d', `${delay + n * 0.12}s`);
        n++;
      });
    }
  });
  return <svg ref={svg} className={`sketch ${className}`} width={w ?? '100%'} height={h} aria-hidden />;
}

const line = (color = PENCIL, width = 2, seed = 1) => (rc: RoughSVG, w: number, h: number) => [
  rc.line(2, h / 2, w - 2, h / 2, { stroke: color, strokeWidth: width, roughness: 1.8, bowing: 2, seed }),
];

function star(kind: 'owed' | 'on' | 'over', seed: number) {
  return (rc: RoughSVG, w: number, h: number) => {
    const cx = w / 2;
    const cy = h / 2 + 1;
    const pts: Array<[number, number]> = [];
    for (let i = 0; i < 10; i++) {
      const r = (i % 2 ? 0.2 : 0.47) * Math.min(w, h) * 1.05;
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
    const color = kind === 'over' ? RED : PENCIL;
    return [
      rc.polygon(pts, {
        stroke: color,
        strokeWidth: 1.8,
        roughness: 1.4,
        seed,
        fill: kind === 'owed' ? undefined : color,
        fillStyle: 'solid',
      }),
    ];
  };
}

export function Anotador({ data, onClose }: { data: AnotadorData; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  let t = 0.2; // when the next thing is written (everything is down in about three seconds)
  const next = (dur = 0.35) => {
    const at = t;
    t += dur * 0.42;
    return at;
  };

  return (
    <div className="anotador-veil" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <section className="anotador-sheet" role="dialog" aria-label="Anotador" key={data.room}>
        <button type="button" className="anotador-close" onClick={onClose} aria-label="Cerrar el anotador">×</button>
        <Sketch
          className="anotador-margin"
          h={400}
          w={10}
          delay={0.05}
          draw={(rc, _w, h) => [rc.line(5, 6, 4, h - 6, { stroke: RED, strokeWidth: 1.6, roughness: 1.2, seed: 7 })]}
        />
        <header className="anotador-head">
          <Ink delay={next()} tilt={-1}>
            Ronda {data.round} <small>de {data.rounds}{data.tiebreak ? ' · desempate' : ''}</small>
          </Ink>
          <Ink delay={next()} tilt={0.8}>
            base {data.base} <small>de {data.bases}</small>
          </Ink>
          <Ink delay={next()} className="anotador-dir">{data.clockwise ? '↻' : '↺'}</Ink>
        </header>
        <Sketch h={12} delay={next(0.2)} draw={line(PENCIL, 2.2, 3)} />

        <div className="anotador-cols">
          {data.teams.map((team, i) => (
            <div key={team.label} className={`anotador-col ${team.mine ? 'mine' : 'rival'}${team.acting ? ' acting' : ''}`}>
              <div className="anotador-team">
                <Ink delay={next()} tilt={i ? 1.2 : -1.2} className={team.mine ? 'mine' : 'rival'}>{team.label}</Ink>
                <small><Ink delay={next(0.2)}>{team.sub}</Ink></small>
              </div>
              <Sketch h={10} delay={next(0.15)} draw={line(team.mine ? TEAL : RED, 2, 4 + i)} />
              <div className="anotador-score"><Ink delay={next(0.45)} tilt={i ? 2 : -2}>{team.score}</Ink></div>
              <div className="anotador-row">
                <span><Ink delay={next(0.2)}>pidió</Ink></span>
                <b><Ink delay={next(0.25)}>{team.asked}</Ink></b>
                {team.kamikaze && <em><Ink delay={next(0.2)}>kamikaze</Ink></em>}
              </div>
              <div className="anotador-row">
                <span><Ink delay={next(0.2)}>lleva</Ink></span>
                <b><Ink delay={next(0.25)}>{team.won}</Ink></b>
              </div>
              <div className="anotador-stars">
                {team.bid !== null &&
                  Array.from({ length: team.bid + Math.max(0, team.won - team.bid) }, (_, k) => {
                    const kind = k >= (team.bid ?? 0) ? 'over' : k < team.won ? 'on' : 'owed';
                    return <Sketch key={k} w={30} h={30} delay={next(0.22)} draw={star(kind, k + 3 + i * 9)} />;
                  })}
                {team.bid === 0 && <Ink delay={next(0.25)} className="anotador-zero">cero</Ink>}
              </div>
              <div className="anotador-foot"><Ink delay={next(0.2)}>kamikazes {team.kamikazes}</Ink></div>
            </div>
          ))}
          <Sketch
            className="anotador-split"
            w={10}
            h={300}
            delay={next(0.2)}
            draw={(rc, _w, h) => [rc.line(5, 4, 6, h - 4, { stroke: PENCIL, strokeWidth: 2, roughness: 1.6, bowing: 3, seed: 11 })]}
          />
        </div>

        <Sketch h={12} delay={next(0.2)} draw={line(PENCIL, 2, 9)} />
        <ul className="anotador-players">
          {data.players.map((p, i) => (
            <li key={p.name + i} className={p.mine ? 'mine' : 'rival'}>
              <span className="anotador-name"><Ink delay={next(0.25)}>{p.name}</Ink></span>
              <span className="anotador-cards"><Ink delay={next(0.1)}>{p.cards} c.</Ink></span>
              <span className="anotador-tags">{p.tags ? <Ink delay={next(0.15)}>{p.tags}</Ink> : null}</span>
              {p.ready !== null && <span className={p.ready ? 'anotador-ready ok' : 'anotador-ready'}>{p.ready ? '✓' : '…'}</span>}
            </li>
          ))}
        </ul>
        <div className="anotador-room"><Ink delay={next(0.2)}>mesa {data.room || '…'}</Ink></div>
      </section>
    </div>
  );
}
