import type { Sena } from '@la-base/shared';

// The puppet mask drawn flat, making a seña. Drawn as in a MIRROR (your right is the drawing's
// right), since it shows what YOU do with your face.

const BONE = '#e3d3b0';
const INK = '#140e0c';
const ROSE = '#b76d6e';

interface Props {
  sena: Sena | null;
  size?: number;
}

/** Sí / no: the face at rest, with motion marks for the nod or the shake. */
function HeadMotion({ sena }: { sena: 'si' | 'no' }) {
  const arc = sena === 'si' ? 'M58 18 v28 M54 22 l4 -5 4 5 M54 42 l4 5 4 -5' : 'M14 6 h36 M18 2 l-5 4 5 4 M46 2 l5 4 -5 4';
  return <path d={arc} stroke={ROSE} strokeWidth={2.6} fill="none" strokeLinecap="round" strokeLinejoin="round" />;
}

export function SenaFace({ sena, size = 56 }: Props) {
  const browY = sena === 'ancho-espada' ? 15 : 21;
  const wink = sena === 'ancho-basto';
  const closed = sena === 'nada';
  const eye = (cx: number, shut: boolean) =>
    shut ? <path d={`M${cx - 6} 28 q6 4 12 0`} stroke={INK} strokeWidth={2.4} fill="none" strokeLinecap="round" /> : <circle cx={cx} cy={28} r={5} fill={INK} />;
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden>
      <ellipse cx={32} cy={34} rx={21} ry={26} fill={BONE} stroke={INK} strokeWidth={2} />
      <rect x={16} y={browY} width={12} height={3} fill={INK} />
      <rect x={36} y={wink ? 23 : browY} width={12} height={3} fill={INK} transform={wink ? 'rotate(-12 42 24)' : undefined} />
      {eye(22, closed)}
      {eye(42, closed || wink)}
      <Mouth sena={sena} />
      {(sena === 'si' || sena === 'no') && <HeadMotion sena={sena} />}
    </svg>
  );
}

function Mouth({ sena }: { sena: Sena | null }) {
  switch (sena) {
    case 'ancho-copa':
    case 'ancho-oro': {
      const dx = sena === 'ancho-copa' ? 7 : -7;
      return <ellipse cx={32 + dx} cy={45} rx={6} ry={2} fill={INK} transform={`rotate(${dx > 0 ? -12 : 12} ${32 + dx} 45)`} />;
    }
    case 'figuras':
      return <ellipse cx={32} cy={45} rx={14} ry={1.1} fill={INK} />; // stretched to both sides
    case 'tres':
      return (
        <g>
          <ellipse cx={32} cy={46} rx={8} ry={1.6} fill={INK} />
          <rect x={27.5} y={42.5} width={4.2} height={4.2} fill="#fbf6ea" stroke={INK} strokeWidth={0.8} />
          <rect x={32.3} y={42.5} width={4.2} height={4.2} fill="#fbf6ea" stroke={INK} strokeWidth={0.8} />
        </g>
      );
    case 'dos':
      return (
        <g>
          <circle cx={32} cy={45} r={4.6} fill="none" stroke={ROSE} strokeWidth={3} />
          <circle cx={32} cy={45} r={2.4} fill={INK} />
        </g>
      );
    case 'porno':
      return <ellipse cx={32} cy={46} rx={6} ry={4.5} fill={INK} />;
    default:
      return <ellipse cx={32} cy={45} rx={8} ry={1.6} fill={INK} />;
  }
}
