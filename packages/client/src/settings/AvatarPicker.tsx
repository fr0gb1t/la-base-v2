import { AVATAR_KINDS, AVATAR_PARTS, type AvatarPart, type AvatarSpec } from '@la-base/shared';
import { GiPerspectiveDiceSixFacesRandom } from 'react-icons/gi';
import { EYE_COLOR_LOOK, PART_LABELS } from '../table3d/avatarLook';
import { rerollAvatar, setAvatar } from './avatarSettings';
import { uiSound } from '../table3d/audio';

// The pickers for your avatar: a kind for each part (‹ ›) and a colour for the eyes and the hair. The mask on
// the stage beside the ledger changes as you pick.

function Colors({ label, value, colors, onPick }: { label: string; value: number; colors: ReadonlyArray<{ name: string; hex: string }>; onPick: (i: number) => void }) {
  return (
    <div className="avatar-colors" role="radiogroup" aria-label={label}>
      <span className="avatar-part-title">{label} <small>{colors[value].name}</small></span>
      <div className="avatar-swatches">
        {colors.map((c, i) => (
          <button
            key={c.hex}
            type="button"
            role="radio"
            aria-checked={value === i}
            aria-label={c.name}
            title={c.name}
            className={`avatar-swatch ${value === i ? 'on' : ''}`}
            style={{ background: c.hex }}
            onClick={() => {
              uiSound('chip');
              onPick(i);
            }}
          />
        ))}
      </div>
    </div>
  );
}

export function AvatarPicker({ avatar }: { avatar: AvatarSpec }) {
  const step = (part: AvatarPart, by: 1 | -1) => {
    uiSound('chip');
    setAvatar({ [part]: (avatar[part] + by + AVATAR_KINDS) % AVATAR_KINDS });
  };
  return (
    <div className="avatar-picker">
      <p className="ledger-note avatar-note">Tu máscara en la mesa (la ven los demás). Empezás con una cara al azar: cambiala como quieras.</p>
      {AVATAR_PARTS.map((part) => (
        <div className="avatar-part" key={part}>
          <span className="avatar-part-title">{PART_LABELS[part].title}</span>
          <button type="button" className="avatar-step" aria-label={`${PART_LABELS[part].title}: anterior`} onClick={() => step(part, -1)}>‹</button>
          <span className="avatar-kind" aria-live="polite">{PART_LABELS[part].kinds[avatar[part]]}</span>
          <button type="button" className="avatar-step" aria-label={`${PART_LABELS[part].title}: siguiente`} onClick={() => step(part, 1)}>›</button>
        </div>
      ))}
      <Colors label="Color de ojos" value={avatar.eyeColor} colors={EYE_COLOR_LOOK} onPick={(i) => setAvatar({ eyeColor: i })} />
      <button
        type="button"
        className="avatar-dice"
        onClick={() => {
          uiSound('chip');
          rerollAvatar();
        }}
      >
        <GiPerspectiveDiceSixFacesRandom aria-hidden /> Al azar
      </button>
    </div>
  );
}
