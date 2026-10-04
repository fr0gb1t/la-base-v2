import { FACES, type AvatarSpec, type FaceId } from '@la-base/shared';
import { GiPerspectiveDiceSixFacesRandom } from 'react-icons/gi';
import { FACE_INFO, HEAD_LIST, LED_LIST, type FaceInfo } from '../table3d/faces/catalog';
import { rerollAvatar, setAvatar } from './avatarSettings';
import { uiSound } from '../table3d/audio';

// Your face at the table: one of the thirty LED masks or one of the six sculpted heads. ‹ › walk through all of
// them; the lists below jump straight to one. The face on the stage beside the ledger changes as you pick, and
// makes the señas the way it will make them at the table.

function Group({ title, list, current }: { title: string; list: FaceInfo[]; current: FaceId }) {
  return (
    <div className="avatar-faces" role="radiogroup" aria-label={title}>
      <span className="avatar-part-title">{title}</span>
      <div className="avatar-face-list">
        {list.map((f) => (
          <button
            key={f.id}
            type="button"
            role="radio"
            aria-checked={current === f.id}
            title={f.idea}
            className={`avatar-face ${current === f.id ? 'on' : ''}`}
            onClick={() => {
              uiSound('chip');
              setAvatar({ face: f.id });
            }}
          >
            {f.name}
          </button>
        ))}
      </div>
    </div>
  );
}

export function AvatarPicker({ avatar }: { avatar: AvatarSpec }) {
  const info = FACE_INFO[avatar.face];
  const step = (by: 1 | -1) => {
    uiSound('chip');
    const i = FACES.indexOf(avatar.face);
    setAvatar({ face: FACES[(i + by + FACES.length) % FACES.length] });
  };
  return (
    <div className="avatar-picker">
      <p className="ledger-note avatar-note">Tu cara en la mesa (la ven los demás): una máscara de LEDs o una cabeza esculpida. Nadie tiene cuerpo: solo la cara y las manos.</p>
      <div className="avatar-part">
        <span className="avatar-part-title">Cara</span>
        <button type="button" className="avatar-step" aria-label="Cara anterior" onClick={() => step(-1)}>‹</button>
        <span className="avatar-kind" aria-live="polite">{info.name}</span>
        <button type="button" className="avatar-step" aria-label="Cara siguiente" onClick={() => step(1)}>›</button>
      </div>
      <p className="ledger-note avatar-idea">{info.idea}</p>
      <Group title="Máscaras de LEDs" list={LED_LIST} current={avatar.face} />
      <Group title="Cabezas" list={HEAD_LIST} current={avatar.face} />
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
