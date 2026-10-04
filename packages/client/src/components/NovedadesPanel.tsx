import { useEffect } from 'react';
import { GiNewspaper } from 'react-icons/gi';
import { NOVEDADES } from '../changelog/novedades';
import { uiSound } from '../table3d/audio';

// What's new, on a sheet of paper like the settings ledger. Esc or a click outside closes it.

const dateLabel = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('es-AR', { day: 'numeric', month: 'long' });
};

export function NovedadesPanel({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    uiSound('paper');
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
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
        <div className="novedades-list">
          {NOVEDADES.map((n) => (
            <article key={n.id} className="novedad">
              <h3>{n.title} <small>{dateLabel(n.date)}</small></h3>
              <ul>
                {n.items.map((it) => (
                  <li key={it}>{it}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
        <p className="ledger-note">Esc cierra</p>
      </section>
    </div>
  );
}
