import { FACES, type AvatarSpec, type FaceId } from '@la-base/shared';
import { GiPerspectiveDiceSixFacesRandom } from 'react-icons/gi';
import { FACE_INFO, HEAD_LIST, LED_LIST } from '../table3d/faces/catalog';
import { rerollAvatar, setAvatar } from './avatarSettings';
import { uiSound } from '../table3d/audio';

// Your face at the table: one of the thirty LED masks or one of the six sculpted heads, in two short lines so the
// ledger stays its size: ‹ › walk through all of them, the list (grouped) jumps straight to one, and «Al azar».
// The face on the stage beside the ledger changes as you pick, and makes the señas as it will at the table.

export function AvatarPicker({ avatar }: { avatar: AvatarSpec }) {
  const info = FACE_INFO[avatar.face];
  const pick = (face: FaceId) => {
    uiSound('chip');
    setAvatar({ face });
  };
  const step = (by: 1 | -1) => pick(FACES[(FACES.indexOf(avatar.face) + by + FACES.length) % FACES.length]);
  return (
    <div className="avatar-picker">
      <div className="avatar-part">
        <span className="avatar-part-title">Cara</span>
        <button type="button" className="avatar-step" aria-label="Cara anterior" onClick={() => step(-1)}>‹</button>
        <select id="avatar-face" className="avatar-select" aria-label="Elegir cara" title={info.idea} value={avatar.face} onChange={(e) => pick(e.target.value as FaceId)}>
          <optgroup label="Máscaras de LEDs">
            {LED_LIST.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </optgroup>
          <optgroup label="Cabezas">
            {HEAD_LIST.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </optgroup>
        </select>
        <button type="button" className="avatar-step" aria-label="Cara siguiente" onClick={() => step(1)}>›</button>
      </div>
      <p className="ledger-note avatar-idea">
        {info.idea}
        <button type="button" className="avatar-dice" onClick={() => { uiSound('chip'); rerollAvatar(); }}>
          <GiPerspectiveDiceSixFacesRandom aria-hidden /> Al azar
        </button>
      </p>
    </div>
  );
}
