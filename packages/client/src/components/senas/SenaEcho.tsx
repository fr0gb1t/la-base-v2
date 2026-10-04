import type { Sena } from '@la-base/shared';
import { SenaFace } from './SenaFace';

// You can't see your own face, so the seña you just made plays here, where the wheel was: the
// mask at rest turns into the seña (a nod or a shake for sí / no), holds, and fades away.

export interface Echo {
  sena: Sena;
  x: number;
  y: number;
  key: number;
}

export function SenaEcho({ echo, caught = false }: { echo: Echo; caught?: boolean }) {
  const motion = echo.sena === 'si' ? 'nod' : echo.sena === 'no' ? 'shake' : 'pop';
  return (
    <div key={echo.key} className={`sena-echo ${motion}${caught ? ' caught' : ''}`} style={{ left: echo.x, top: echo.y }} aria-hidden>
      <div className="sena-echo-face">
        <span className="rest"><SenaFace sena={null} size={104} /></span>
        <span className="made"><SenaFace sena={echo.sena} size={104} /></span>
      </div>
    </div>
  );
}
