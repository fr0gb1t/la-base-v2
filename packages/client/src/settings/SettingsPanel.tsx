import { useEffect, useRef, useState } from 'react';
import { GiCog, GiSpeaker, GiCandleLight, GiCardPlay, GiReturnArrow, GiCrosshair, GiMovementSensor, GiHand, GiDividedSquare, GiMouse, GiEyeTarget, GiCompass, GiLightBulb } from 'react-icons/gi';
import { getViewSettings, onViewSettings, setViewSettings, orderedSenas, SENS_MIN, SENS_MAX, FOV_MIN, FOV_MAX, BLOOM_MAX, type ViewSettings } from './viewSettings';
import { getAudioSettings, onAudioSettings, setAudioSettings, type AudioSettings } from './audioSettings';
import { previewSound, audioReady, uiSound } from '../table3d/audio';
import { isTouch } from '../lib/device';
import { SenaFace } from '../components/senas/SenaFace';
import { BackStage } from './BackStage';
import { AvatarStage } from './AvatarStage';
import { AvatarPicker } from './AvatarPicker';
import { setAvatar, useAvatar } from './avatarSettings';
import { FullPicker, type PickOption } from './FullPicker';
import { FACES, type FaceId } from '@la-base/shared';
import { FACE_INFO } from '../table3d/faces/catalog';
import { BACK_DESIGNS, backPicture, drawBackDesign, type BackDesign } from '../table3d/cardBacks';
import type { DrawnBack } from '../table3d/backDesigns';
import { useOverlay } from '../lib/overlay';

const previews = new Map<BackDesign, string>();
/** A small picture of a card back for the chooser (drawn once). */
function backPreview(d: BackDesign) {
  if (!previews.has(d)) previews.set(d, backPicture(d) ?? drawBackDesign(d as DrawnBack, 0.35).toDataURL());
  return previews.get(d)!;
}

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

const FACE_OPTIONS: PickOption[] = FACES.map((id) => ({ id, name: FACE_INFO[id].name, group: FACE_INFO[id].kind === 'led' ? 'Máscaras de LEDs' : 'Cabezas' }));
const BACK_OPTIONS: PickOption[] = BACK_DESIGNS.map((d) => ({ id: d.id, name: d.label }));

export function SettingsHost() {
  const [open, setOpen] = useState(false);
  useOverlay(open);
  const s = useAudioSettings();
  // the ledger is paper: it rustles open and shut
  const wasOpen = useRef(false);
  useEffect(() => {
    if (open !== wasOpen.current) uiSound('paper');
    wasOpen.current = open;
  }, [open]);
  const view = useViewSettings();
  const avatar = useAvatar();
  // the stage beside the ledger shows whatever you are working on: your mask, or the back of your cards
  const [stage, setStage] = useState<'avatar' | 'back'>('avatar');
  // on a phone the stage does not fit beside the ledger: it opens over the whole screen instead
  const [full, setFull] = useState<'avatar' | 'back' | null>(null);

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
  const senaList = orderedSenas(view.senaOrder);
  const moveSena = (i: number, by: -1 | 1) => {
    const ids = senaList.map((x) => x.id);
    [ids[i], ids[i + by]] = [ids[i + by], ids[i]];
    setViewSettings({ senaOrder: ids.join(',') });
  };

  return (
    <div className="settings-veil" onPointerDown={(e) => e.target === e.currentTarget && setOpen(false)}>
      {stage === 'avatar' ? <AvatarStage avatar={avatar} /> : <BackStage />}
      {full === 'avatar' && (
        <FullPicker
          title="Tu cara"
          stage={<AvatarStage avatar={avatar} />}
          options={FACE_OPTIONS}
          value={avatar.face}
          note={FACE_INFO[avatar.face].idea}
          onPick={(id) => setAvatar({ face: id as FaceId })}
          onClose={() => setFull(null)}
        />
      )}
      {full === 'back' && (
        <FullPicker
          title="Dorso de las cartas"
          stage={<BackStage />}
          options={BACK_OPTIONS}
          value={view.cardBack}
          note="lo ves solo vos"
          onPick={(id) => setViewSettings({ cardBack: id as BackDesign })}
          onClose={() => setFull(null)}
        />
      )}
      <section className="ledger settings" role="dialog" aria-modal="true" aria-label="Ajustes">
        <h2><GiCog aria-hidden /> Ajustes</h2>

        <div className="ledger-col">
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
          {!audioReady() && <p className="ledger-note">El navegador habilita el sonido con tu primer click o tecla en la página.</p>}
        </fieldset>

        <fieldset className="ledger-group" onPointerEnter={() => setStage('avatar')} onFocus={() => setStage('avatar')}>
          <legend>Avatar</legend>
          <AvatarPicker avatar={avatar} />
          <button type="button" className="fullpick-open" onClick={() => { uiSound('chip'); setFull('avatar'); }}>Ver en pantalla entera</button>
        </fieldset>

        <fieldset className="ledger-group" onPointerEnter={() => setStage('back')} onFocus={() => setStage('back')}>
          <legend>Cartas</legend>
          <div className="setting-backs" role="radiogroup" aria-label="Dorso de las cartas">
            <span className="setting-backs-title"><b>Dorso</b> <small>(lo ves solo vos) · {BACK_DESIGNS.find((d) => d.id === view.cardBack)?.label}</small></span>
            <div className="setting-backs-row">
              {BACK_DESIGNS.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  role="radio"
                  aria-checked={view.cardBack === d.id}
                  className={`setting-back ${view.cardBack === d.id ? 'on' : ''}`}
                  onClick={() => setViewSettings({ cardBack: d.id })}
                  title={d.label}
                >
                  <img src={backPreview(d.id)} alt={d.label} loading="lazy" />
                </button>
              ))}
            </div>
          </div>
          <button type="button" className="fullpick-open" onClick={() => { uiSound('chip'); setFull('back'); }}>Ver en pantalla entera</button>
        </fieldset>
        </div>

        <div className="ledger-col">
        <fieldset className="ledger-group">
          <legend>Mesa</legend>
          <Switch
            on={view.handResetOnTurn}
            icon={<GiHand aria-hidden className="setting-icon" />}
            title="Mano a la vista en tu turno"
            hint={view.handResetOnTurn ? 'si bajaste las cartas con la ruedita, vuelven a su lugar cuando te toca' : 'las cartas quedan a la altura que las dejaste con la ruedita'}
            onToggle={() => setViewSettings({ handResetOnTurn: !view.handResetOnTurn })}
          />
          <Switch
            on={view.smoothProps}
            icon={<GiDividedSquare aria-hidden className="setting-icon" />}
            title="Bordes suaves (anti-aliasing)"
            hint={view.smoothProps ? 'las cartas, las manos, los botones, los televisores, el anotador y el reloj se dibujan nítidos y sin escalones (más pesado)' : 'todo con el mismo aspecto pixelado de la mesa'}
            onToggle={() => setViewSettings({ smoothProps: !view.smoothProps, smoothChosen: true })}
          />
          <label className="setting-volume">
            <span className="setting-volume-head">
              <GiLightBulb aria-hidden className="setting-icon" />
              <b>Resplandor de las luces</b>
              <span className="setting-state">{view.bloom === 0 ? 'no' : `${Math.round(view.bloom * 100)}%`}</span>
            </span>
            <input
              type="range"
              min={0}
              max={BLOOM_MAX}
              step={0.05}
              value={view.bloom}
              style={{ ['--fill' as string]: `${(view.bloom / BLOOM_MAX) * 100}%` }}
              onChange={(e) => setViewSettings({ bloom: Number(e.target.value) })}
              aria-label="Resplandor de las luces (bloom)"
            />
            <small className="setting-volume-hint">bloom: cuánto se abre la luz de la lámpara, las velas y las máscaras LED</small>
          </label>
          <Switch
            on={view.guides}
            icon={<GiDividedSquare aria-hidden className="setting-icon" />}
            title="Guías en la mesa"
            hint={view.guides ? 'recuadros de tiza para las cartas y círculos para los porotos' : 'mesa limpia: sin recuadros ni círculos (los porotos quedan)'}
            onToggle={() => setViewSettings({ guides: !view.guides })}
          />
        </fieldset>

        <fieldset className="ledger-group">
          <legend>Anillo de señas</legend>
          <p className="ledger-note">Ordenalo a gusto (se guarda en este navegador).</p>
          <ol className="sena-order">
            {senaList.map((x, i) => (
              <li key={x.id}>
                <SenaFace sena={x.id} size={22} />
                <span>{x.label}</span>
                <button type="button" aria-label={`Subir ${x.label}`} disabled={i === 0} onClick={() => moveSena(i, -1)}>▲</button>
                <button type="button" aria-label={`Bajar ${x.label}`} disabled={i === senaList.length - 1} onClick={() => moveSena(i, 1)}>▼</button>
              </li>
            ))}
          </ol>
          <button type="button" className="setting-reset" disabled={!view.senaOrder} onClick={() => setViewSettings({ senaOrder: '' })}>restablecer el orden</button>
        </fieldset>
        </div>

        <div className="ledger-col">
        <fieldset className="ledger-group">
          <legend>Cámara</legend>
          <label className="setting-volume">
            <span className="setting-volume-head">
              <GiMouse aria-hidden className="setting-icon" />
              <b>Sensibilidad del mouse</b>
              <span className="setting-state">{view.lookSensitivity.toFixed(2)}×</span>
            </span>
            <input
              type="range"
              min={SENS_MIN * 100}
              max={SENS_MAX * 100}
              step={5}
              value={Math.round(view.lookSensitivity * 100)}
              style={{ ['--fill' as string]: `${((view.lookSensitivity - SENS_MIN) / (SENS_MAX - SENS_MIN)) * 100}%` }}
              onChange={(e) => setViewSettings({ lookSensitivity: Number(e.target.value) / 100 })}
              aria-label="Sensibilidad del mouse al mirar"
            />
          </label>
          <label className="setting-volume">
            <span className="setting-volume-head">
              <GiEyeTarget aria-hidden className="setting-icon" />
              <b>Campo visual</b>
              <span className="setting-state">{Math.round(view.fov)}°</span>
            </span>
            <input
              type="range"
              min={FOV_MIN}
              max={FOV_MAX}
              step={1}
              value={view.fov}
              style={{ ['--fill' as string]: `${((view.fov - FOV_MIN) / (FOV_MAX - FOV_MIN)) * 100}%` }}
              onChange={(e) => setViewSettings({ fov: Number(e.target.value) })}
              aria-label="Campo visual en grados"
            />
          </label>
          {isTouch && (
            <Switch
              on={view.gyro}
              icon={<GiCompass aria-hidden className="setting-icon" />}
              title="Giroscopio"
              hint={view.gyro ? 'girá el celular para mirar alrededor (también podés arrastrar con el dedo)' : 'la vista solo se mueve arrastrando con el dedo'}
              onToggle={() => setViewSettings({ gyro: !view.gyro })}
            />
          )}
          <Switch
            on={view.cameraReturn}
            icon={<GiReturnArrow aria-hidden className="setting-icon" />}
            title="Volver a tu lugar"
            hint={view.cameraReturn ? 'al soltar, la vista vuelve a mirar la mesa' : 'al soltar, la vista queda donde la dejaste'}
            onToggle={() => setViewSettings({ cameraReturn: !view.cameraReturn })}
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
          <Switch
            on={view.senaSeenFlash}
            icon={<GiEyeTarget aria-hidden className="setting-icon" />}
            title="Aviso de seña vista"
            hint={view.senaSeenFlash ? 'tu seña destella en rojo en tu pantalla si un rival la capta (sin destello: no la vio nadie)' : 'no te enterás si un rival vio tu seña'}
            onToggle={() => setViewSettings({ senaSeenFlash: !view.senaSeenFlash })}
          />
        </fieldset>
        </div>

        <button type="button" className="stamp-btn" onClick={() => setOpen(false)}>listo</button>
        <p className="ledger-note">O abre y cierra este panel · Esc lo cierra</p>
      </section>
    </div>
  );
}
