import { AVATAR_KINDS, EYE_COLORS, type AvatarPart, type AvatarSpec } from '@la-base/shared'

// What the avatar parts are called, and the colours the eyes can take. Every colour sits
// inside the game's muted range (dusty, earthy, a little greyed: nothing neon, nothing electric), like
// the rest of PALETTE; avatarLook.test.ts keeps it that way.

export const PART_LABELS: Record<AvatarPart, { title: string; kinds: string[] }> = {
  eyes: { title: 'Ojos', kinds: ['Redondos', 'Rasgados', 'Grandes', 'Caídos', 'Puntitos'] },
  mouth: { title: 'Boca', kinds: ['Línea', 'Sonrisa', 'Seria', 'Ancha', 'Chiquita'] },
  brows: { title: 'Cejas', kinds: ['Finas', 'Gruesas', 'Bravas', 'Arqueadas', 'Cortitas'] },
  symbol: { title: 'Símbolo', kinds: ['Círculo', 'Triángulo', 'Cuadrado', 'Rombo', 'Pentágono'] },
}

// The eyes are light on a black mask, so these are the lit versions of the dusty tones (still nothing neon).
export const EYE_COLOR_LOOK: ReadonlyArray<{ name: string; hex: string }> = [
  { name: 'Ámbar', hex: '#d4a24e' },
  { name: 'Verde musgo', hex: '#8fa55a' },
  { name: 'Celeste acero', hex: '#7fb0c4' },
  { name: 'Cobre', hex: '#c0804a' },
  { name: 'Gris ceniza', hex: '#bdb9ae' },
  { name: 'Violeta polvo', hex: '#9a7fb0' },
]

if (EYE_COLOR_LOOK.length !== EYE_COLORS) throw new Error('avatar colour tables out of step with @la-base/shared')
for (const p of Object.values(PART_LABELS)) if (p.kinds.length !== AVATAR_KINDS) throw new Error('avatar part labels out of step with @la-base/shared')

/** The spec as the part pickers show it: which kind each part is on. */
export const kindOf = (a: AvatarSpec, part: AvatarPart) => a[part]
