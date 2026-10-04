import { useEffect, useLayoutEffect, useRef } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import rough from 'roughjs';
import type { RoughSVG } from 'roughjs/bin/svg';
import { useOverlay } from '../lib/overlay';

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

/** Handwriting (the face does it: no animation, the sheet is there at once). */
function Ink({ children, tilt = 0, className = '' }: { children: ReactNode; delay?: number; tilt?: number; className?: string }) {
  const style = { '--tilt': `${tilt}deg` } as CSSProperties;
  return (
    <span className={`ink ${className}`} style={style}>
      {children}
    </span>
  );
}

/** A box of wobbly pencil strokes (rough.js): drawn once, as soon as it is laid out. */
function Sketch({
  draw,
  w,
  h,
  className = '',
}: {
  draw: (rc: RoughSVG, w: number, h: number) => SVGElement[];
  w?: number;
  h?: number; // omitted: as tall as the box CSS gives it (the margin and the split follow the sheet)
  delay?: number;
  className?: string;
}) {
  const svg = useRef<SVGSVGElement>(null);
  useLayoutEffect(() => {
    const el = svg.current;
    if (!el) return;
    const box = el.getBoundingClientRect();
    const width = w ?? box.width;
    const height = h ?? Math.max(20, box.height);
    el.setAttribute('viewBox', `0 0 ${width} ${height}`);
    el.replaceChildren();
    const rc = rough.svg(el);
    for (const node of draw(rc, width, height)) el.appendChild(node);
  });
  return <svg ref={svg} className={`sketch ${className}`} width={w ?? '100%'} height={h ?? '100%'} aria-hidden />;
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

export function Anotador({ data, full, onToggleFull, onClose }: { data: AnotadorData; full: boolean; onToggleFull: () => void; onClose: () => void }) {
  useOverlay();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="anotador-veil" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <section className="anotador-sheet" role="dialog" aria-label="Anotador" key={data.room}>
        <button type="button" className="anotador-mode" onClick={onToggleFull} title="Tecla H" aria-pressed={full}>
          {full ? 'reducido' : 'completo'}
        </button>
        <button type="button" className="anotador-close" onClick={onClose} aria-label="Cerrar el anotador">×</button>
        <Sketch
          className="anotador-margin"
          w={10}
         
          draw={(rc, _w, h) => [rc.line(5, 6, 4, h - 6, { stroke: RED, strokeWidth: 1.6, roughness: 1.2, seed: 7 })]}
        />
        <header className="anotador-head">
          <Ink tilt={-1}>
            Ronda {data.round} <small>de {data.rounds}{data.tiebreak ? ' · desempate' : ''}</small>
          </Ink>
          <Ink tilt={0.8}>
            base {data.base} <small>de {data.bases}</small>
          </Ink>
          <Ink className="anotador-dir">{data.clockwise ? '↻' : '↺'}</Ink>
        </header>
        <Sketch h={12} draw={line(PENCIL, 2.2, 3)} />

        <div className="anotador-cols">
          {data.teams.map((team, i) => (
            <div key={team.label} className={`anotador-col ${team.mine ? 'mine' : 'rival'}${team.acting ? ' acting' : ''}`}>
              <div className="anotador-team">
                <Ink tilt={i ? 1.2 : -1.2} className={team.mine ? 'mine' : 'rival'}>{team.label}</Ink>
                <small><Ink>{team.sub}</Ink></small>
              </div>
              <Sketch h={10} draw={line(team.mine ? TEAL : RED, 2, 4 + i)} />
              <div className="anotador-score"><Ink tilt={i ? 2 : -2}>{team.score}</Ink></div>
              <div className="anotador-row">
                <span><Ink>pidió</Ink></span>
                <b><Ink>{team.asked}</Ink></b>
                {team.kamikaze && <em><Ink>kamikaze</Ink></em>}
              </div>
              <div className="anotador-row">
                <span><Ink>lleva</Ink></span>
                <b><Ink>{team.won}</Ink></b>
              </div>
              <div className="anotador-stars">
                {team.bid !== null &&
                  Array.from({ length: team.bid + Math.max(0, team.won - team.bid) }, (_, k) => {
                    const kind = k >= (team.bid ?? 0) ? 'over' : k < team.won ? 'on' : 'owed';
                    return <Sketch key={k} w={30} h={30} draw={star(kind, k + 3 + i * 9)} />;
                  })}
                {team.bid === 0 && team.won === 0 && <Ink className="anotador-zero">–</Ink>}
              </div>
              {full && <div className="anotador-foot"><Ink>kamikazes {team.kamikazes}</Ink></div>}
            </div>
          ))}
          <Sketch
            className="anotador-split"
            w={10}
            draw={(rc, _w, h) => [rc.line(5, 4, 6, h - 4, { stroke: PENCIL, strokeWidth: 2, roughness: 1.6, bowing: 3, seed: 11 })]}
          />
        </div>

        {full && (
          <>
            <Sketch h={12} draw={line(PENCIL, 2, 9)} />
            <ul className={`anotador-players${data.players.length > 4 ? ' many' : ''}`}>
              {data.players.map((p, i) => (
                <li key={p.name + i} className={p.mine ? 'mine' : 'rival'}>
                  <span className="anotador-name"><Ink>{p.name}</Ink></span>
                  <span className="anotador-cards"><Ink>{p.cards} c.</Ink></span>
                  <span className="anotador-tags">{p.tags ? <Ink>{p.tags}</Ink> : null}</span>
                  {p.ready !== null && <span className={p.ready ? 'anotador-ready ok' : 'anotador-ready'}>{p.ready ? '✓' : '…'}</span>}
                </li>
              ))}
            </ul>
            <div className="anotador-room"><Ink>mesa {data.room || '…'}</Ink></div>
          </>
        )}
      </section>
    </div>
  );
}
