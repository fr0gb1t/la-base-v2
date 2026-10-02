import type { ReactNode } from 'react';

// Ink drawings for the rulebook: Spanish cards, the table from above, beans, a plane. Same
// palette as the game (bone paper, ink, oxblood; teal = your team, rose = rivals).

export const INK = '#140e0c';
export const BONE = '#e9dcc2';
export const OXBLOOD = '#602217';
export const TEAL = '#2c4a53';
export const ROSE = '#8e3b3c';
const GOLD = '#c9a227';
/** Lining figures for numbers in drawings (the period face draws 0 like an o). */
export const NUM_FONT = "'Times New Roman', Times, serif";

export type Suit = 'oros' | 'copas' | 'espadas' | 'bastos';

/** A suit drawn small (24×24 box), at (x, y) top-left, scaled. */
export function SuitGlyph({ suit, x = 0, y = 0, s = 1 }: { suit: Suit; x?: number; y?: number; s?: number }) {
  const t = `translate(${x} ${y}) scale(${s})`;
  if (suit === 'oros')
    return (
      <g transform={t}>
        {Array.from({ length: 8 }, (_, i) => {
          const a = (i / 8) * Math.PI * 2;
          return <line key={i} x1={12 + Math.cos(a) * 7.5} y1={12 + Math.sin(a) * 7.5} x2={12 + Math.cos(a) * 10.5} y2={12 + Math.sin(a) * 10.5} stroke={INK} strokeWidth={1.4} strokeLinecap="round" />;
        })}
        <circle cx={12} cy={12} r={6.5} fill={GOLD} stroke={INK} strokeWidth={1.4} />
        <path d="M9.5 11h1M13.5 11h1M10 14q2 1.4 4 0" stroke={INK} strokeWidth={1} fill="none" strokeLinecap="round" />
      </g>
    );
  if (suit === 'copas')
    return (
      <g transform={t}>
        <path d="M5 3h14q0 8-7 10-7-2-7-10z" fill={OXBLOOD} stroke={INK} strokeWidth={1.4} strokeLinejoin="round" />
        <path d="M12 13v5M7.5 21h9" stroke={INK} strokeWidth={1.8} strokeLinecap="round" />
      </g>
    );
  if (suit === 'espadas')
    return (
      <g transform={t}>
        <path d="M12 1.5l2.2 4v10h-4.4v-10z" fill="#7d93a6" stroke={INK} strokeWidth={1.3} strokeLinejoin="round" />
        <path d="M6.5 15.5h11" stroke={INK} strokeWidth={2.2} strokeLinecap="round" />
        <path d="M12 16v5.5" stroke={INK} strokeWidth={2.4} strokeLinecap="round" />
      </g>
    );
  return (
    <g transform={t}>
      <path d="M10.4 22l.8-12.5q-3.2-1.6-1.6-5.2 1.8-3.4 4.6-.4 2 3-1.4 5.6l.9 12.5z" fill="#6b7a35" stroke={INK} strokeWidth={1.3} strokeLinejoin="round" />
      <path d="M11 7.5l-1.6-.8M13.2 11.5l1.5-.6" stroke={INK} strokeWidth={1} strokeLinecap="round" />
    </g>
  );
}

const FIGURE = { 10: 'sota', 11: 'caballo', 12: 'rey' } as Record<number, string>;

/** A small Spanish card (face up, or its back). */
export function MiniCard({ value, suit, w = 56, back = false, glow, tilt = 0, label, x, y }: { value?: number; suit?: Suit; w?: number; back?: boolean; glow?: 'win' | 'mine' | 'rival'; tilt?: number; label?: string; x?: number; y?: number }) {
  const h = w * 1.55;
  const ring = glow === 'win' ? GOLD : glow === 'mine' ? TEAL : glow === 'rival' ? ROSE : null;
  return (
    <svg x={x} y={y} width={w + 8} height={h + (label ? 22 : 8)} viewBox={`-4 -4 ${w + 8} ${h + (label ? 22 : 8)}`} aria-hidden style={{ transform: tilt ? `rotate(${tilt}deg)` : undefined }}>
      {ring && <rect x={-3} y={-3} width={w + 6} height={h + 6} rx={7} fill="none" stroke={ring} strokeWidth={3} />}
      <rect x={0} y={0} width={w} height={h} rx={5} fill={back ? OXBLOOD : '#f4ead2'} stroke={INK} strokeWidth={1.6} />
      {back ? (
        <g stroke={BONE} strokeWidth={1} opacity={0.6} fill="none">
          <rect x={5} y={5} width={w - 10} height={h - 10} rx={3} />
          <path d={`M${w / 2} 12 L${w - 12} ${h / 2} L${w / 2} ${h - 12} L12 ${h / 2} Z`} />
        </g>
      ) : (
        <>
          <text x={5} y={14} fontSize={12} fontFamily={NUM_FONT} fill={INK}>{value}</text>
          {suit && <SuitGlyph suit={suit} x={w / 2 - 12 * (w / 56)} y={h / 2 - 12 * (w / 56)} s={w / 56} />}
          {value && FIGURE[value] && (
            <text x={w / 2} y={h - 7} fontSize={9} textAnchor="middle" fontFamily="IM Fell English SC, Georgia, serif" fill={INK} opacity={0.75}>{FIGURE[value]}</text>
          )}
        </>
      )}
      {label && (
        <text x={w / 2} y={h + 15} fontSize={11} textAnchor="middle" fontFamily="IM Fell English, Georgia, serif" fill={INK}>{label}</text>
      )}
    </svg>
  );
}

/** A bean (poroto) seen from above. */
export function Bean({ x, y, r = 0, red = false }: { x: number; y: number; r?: number; red?: boolean }) {
  return <ellipse cx={x} cy={y} rx={5.5} ry={3.4} transform={`rotate(${r} ${x} ${y})`} fill={red ? '#c46a5c' : '#efe3c8'} stroke={INK} strokeWidth={1} />;
}

/** The kamikaze plane token, from above, diving at 45°. */
export function Plane({ x = 0, y = 0, s = 1, color = '#9a9384' }: { x?: number; y?: number; s?: number; color?: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s}) rotate(45)`}>
      <path
        d="M0 -14 C3 -14 3 -3 1.4 12 L-1.4 12 C-3 -3 -3 -14 0 -14 Z M-2 -6 L-17 -1 Q-18.5 2 -15.5 2 L-2 0.6 Z M2 -6 L17 -1 Q18.5 2 15.5 2 L2 0.6 Z M-1 8 L-7 11 L-6.5 13 L6.5 13 L7 11 L1 8 Z"
        fill={color}
        stroke={INK}
        strokeWidth={1.1}
        strokeLinejoin="round"
      />
    </g>
  );
}

/** A little mask (the players are masked puppets). */
export function Mask({ x, y, team, r = 11, label, sub, ring }: { x: number; y: number; team: 'mine' | 'rival'; r?: number; label?: string; sub?: string; ring?: string }) {
  return (
    <g>
      {ring && <circle cx={x} cy={y} r={r + 5} fill="none" stroke={ring} strokeWidth={2.5} strokeDasharray="3 2" />}
      <ellipse cx={x} cy={y} rx={r * 0.82} ry={r} fill={BONE} stroke={team === 'mine' ? TEAL : ROSE} strokeWidth={3} />
      <circle cx={x - r * 0.3} cy={y - r * 0.15} r={r * 0.13} fill={INK} />
      <circle cx={x + r * 0.3} cy={y - r * 0.15} r={r * 0.13} fill={INK} />
      <path d={`M${x - r * 0.3} ${y + r * 0.4} h${r * 0.6}`} stroke={INK} strokeWidth={1.4} />
      {label && (
        <text x={x} y={y + r + 13} fontSize={11} textAnchor="middle" fontFamily="IM Fell English SC, Georgia, serif" fill={INK}>{label}</text>
      )}
      {sub && (
        <text x={x} y={y + r + 25} fontSize={9.5} textAnchor="middle" fontFamily="IM Fell English, Georgia, serif" fill={INK} opacity={0.7}>{sub}</text>
      )}
    </g>
  );
}

/**
 * The table from above, YOU at the bottom (seat 0). Seats go clockwise on the page (seat 1 is at
 * your left), so 'antihorario' runs to your right and 'horario' to your left.
 */
export function TableTop({
  n = 4,
  size = 260,
  seats = {},
  direction,
  children,
  fit = true,
}: {
  n?: number;
  size?: number;
  seats?: Record<number, { label?: string; sub?: string; ring?: string }>;
  direction?: 'antihorario' | 'horario';
  children?: (pos: (seat: number, r?: number) => { x: number; y: number }) => ReactNode;
  fit?: boolean; // grow to fill the page
}) {
  const c = size / 2;
  const R = size * 0.36;
  const pos = (seat: number, r = R) => {
    const a = Math.PI / 2 + (seat / n) * Math.PI * 2;
    return { x: c + Math.cos(a) * r, y: c + Math.sin(a) * r };
  };
  const ar = size * 0.17;
  const sweep = direction === 'horario' ? 1 : 0;
  return (
    <svg className={fit ? 'rb-fit' : undefined} width={size} height={size + 24} viewBox={`0 -6 ${size} ${size + 24}`} role="img" aria-label="La mesa vista desde arriba">
      <circle cx={c} cy={c} r={size * 0.27} fill="#7a6a35" stroke={INK} strokeWidth={2} />
      <circle cx={c} cy={c} r={size * 0.27 - 6} fill="none" stroke={BONE} strokeWidth={1} opacity={0.5} />
      {direction && (
        <g stroke={BONE} strokeWidth={2.2} fill="none" strokeLinecap="round">
          {/* three quarters of a turn from the top, ending in a chevron that points the way it runs */}
          <path d={`M${c} ${c - ar} A${ar} ${ar} 0 1 ${sweep} ${c + (sweep ? -ar : ar)} ${c}`} />
          <path
            d={sweep ? `M${c - ar - 6} ${c + 7} L${c - ar} ${c} L${c - ar + 6} ${c + 7}` : `M${c + ar - 6} ${c + 7} L${c + ar} ${c} L${c + ar + 6} ${c + 7}`}
          />
        </g>
      )}
      {Array.from({ length: n }, (_, s) => {
        const p = pos(s);
        const seat = seats[s];
        return <Mask key={s} x={p.x} y={p.y} team={s % 2 === 0 ? 'mine' : 'rival'} label={seat?.label ?? (s === 0 ? 'vos' : undefined)} sub={seat?.sub} ring={seat?.ring} />;
      })}
      {children?.(pos)}
    </svg>
  );
}

/** A boxed example, The Crew style. */
export function Example({ title = 'Ejemplo', children }: { title?: string; children: ReactNode }) {
  return (
    <aside className="rb-example">
      <b>{title}</b>
      {children}
    </aside>
  );
}
