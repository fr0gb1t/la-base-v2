import { useEffect, useState } from 'react';
import { GiCog, GiSpeaker, GiCandleLight, GiCardPlay, GiReturnArrow, GiCrosshair, GiMovementSensor, GiHand } from 'react-icons/gi';
import { getViewSettings, onViewSettings, setViewSettings, type ViewSettings } from './viewSettings';
import { getAudioSettings, onAudioSettings, setAudioSettings, type AudioSettings } from './audioSettings';
import { previewSound, audioReady } from '../table3d/audio';

// Settings: a paper ledger like the rest of the menus. Opened from the in-game HUD, the menu bar,
// or the O key; Esc or a click outside closes it.

const openers = new Set<(open: boolean) => void>();
export function openSettings(open = true) {
  openers.forEach((f) => f(open));
}

function useAudioSettings(): AudioSettings {
  const [s, set] = useState(getAudioSettings());
  useEffect(() => onAudioSettings(set), []);
  return s;
}

export function useViewSettings(): ViewSettings {
  const [s, set] = useState(getViewSettings());
  useEffect(() => onViewSettings(set), []);
  return s;
}

interface SwitchProps {
  on: boolean;
  icon: React.ReactNode;
  title: string;
  hint: string;
  onToggle: () => void;
}

function Switch({ on, icon, title, hint, onToggle }: SwitchProps) {
  return (
    <button type="button" role="switch" aria-checked={on} className={`setting-row ${on ? 'on' : ''}`} onClick={onToggle}>
      {icon}
      <span className="setting-text">
        <b>{title}</b>
        <small>{hint}</small>
      </span>
      <span className="setting-state">{on ? 'sí' : 'no'}</span>
    </button>
  );
}

export function SettingsButton({ className = 'hud-tab' }: { className?: string }) {
  return (
    <button type="button" className={className} onClick={() => openSettings(true)} title="Ajustes (O)">
      <GiCog aria-hidden /> ajustes
    </button>
  );
}

export function SettingsHost() {
  const [open, setOpen] = useState(false);
  const s = useAudioSettings();
  const view = useViewSettings();

  useEffect(() => {
    openers.add(setOpen);
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
      if (e.key === 'o' || e.key === 'O') setOpen((o) => !o);
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      openers.delete(setOpen);
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  if (!open) return null;
  const pct = Math.round(s.volume * 100);

  return (
    <div className="settings-veil" onPointerDown={(e) => e.target === e.currentTarget && setOpen(false)}>
      <section className="ledger settings" role="dialog" aria-modal="true" aria-label="Ajustes">
        <h2><GiCog aria-hidden /> Ajustes</h2>

        <fieldset className="ledger-group">
          <legend>Sonido</legend>

          <button
            type="button"
            role="switch"
            aria-checked={s.ambient}
            className={`setting-row ${s.ambient ? 'on' : ''}`}
            onClick={() => setAudioSettings({ ambient: !s.ambient })}
          >
            <GiCandleLight aria-hidden className="setting-icon" />
            <span className="setting-text">
              <b>Sonido ambiente</b>
              <small>el zumbido de la lámpara, el cuarto</small>
            </span>
            <span className="setting-state">{s.ambient ? 'sí' : 'no'}</span>
          </button>

          <button
            type="button"
            role="switch"
            aria-checked={s.effects}
            className={`setting-row ${s.effects ? 'on' : ''}`}
            onClick={() => {
              setAudioSettings({ effects: !s.effects });
              if (!s.effects) window.setTimeout(previewSound, 80);
            }}
          >
            <GiCardPlay aria-hidden className="setting-icon" />
            <span className="setting-text">
              <b>Sonidos del juego</b>
              <small>cartas, mesa, golpes</small>
            </span>
            <span className="setting-state">{s.effects ? 'sí' : 'no'}</span>
          </button>

          <label className="setting-volume">
            <span className="setting-volume-head">
              <GiSpeaker aria-hidden className="setting-icon" />
              <b>Volumen</b>
              <span className="setting-state">{pct}%</span>
            </span>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={pct}
              style={{ ['--fill' as string]: `${pct}%` }}
              onChange={(e) => setAudioSettings({ volume: Number(e.target.value) / 100 })}
              onPointerUp={() => previewSound()}
              onKeyUp={() => previewSound()}
            />
          </label>
          {!audioReady() && <p className="ledger-note">El sonido arranca con tu primer click en la mesa.</p>}
        </fieldset>

        <fieldset className="ledger-group">
          <legend>Cámara</legend>
          <Switch
            on={view.cameraReturn}
            icon={<GiReturnArrow aria-hidden className="setting-icon" />}
            title="Volver a tu lugar"
            hint={view.cameraReturn ? 'al soltar, la vista vuelve a mirar la mesa' : 'al soltar, la vista queda donde la dejaste'}
            onToggle={() => setViewSettings({ cameraReturn: !view.cameraReturn })}
          />
          <Switch
            on={view.handResetOnTurn}
            icon={<GiHand aria-hidden className="setting-icon" />}
            title="Mano a la vista en tu turno"
            hint={view.handResetOnTurn ? 'si bajaste las cartas con la ruedita, vuelven a su lugar cuando te toca' : 'las cartas quedan a la altura que las dejaste con la ruedita'}
            onToggle={() => setViewSettings({ handResetOnTurn: !view.handResetOnTurn })}
          />
          <Switch
            on={view.invertLook}
            icon={<GiMovementSensor aria-hidden className="setting-icon" />}
            title="Invertir cámara"
            hint={view.invertLook ? 'arrastrás la mesa: la vista va al revés del mouse' : 'arrastrás la mirada: la vista sigue al mouse'}
            onToggle={() => setViewSettings({ invertLook: !view.invertLook })}
          />
          <Switch
            on={view.reticle}
            icon={<GiCrosshair aria-hidden className="setting-icon" />}
            title="Punto de mira"
            hint="un puntito en el medio de la pantalla para apuntar (a las caras, para las señas)"
            onToggle={() => setViewSettings({ reticle: !view.reticle })}
          />
        </fieldset>

        <button type="button" className="stamp-btn" onClick={() => setOpen(false)}>listo</button>
        <p className="ledger-note">O abre y cierra este panel · Esc lo cierra</p>
      </section>
    </div>
  );
}
