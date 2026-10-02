// The card backs you can pick (Ajustes → Cartas): four drawn here (cardBacks.ts) and a set of
// illustrated ones (pictures in ./backs). Kept apart from the drawing code so the settings can
// validate a stored choice without loading three.js.

export const DRAWN_BACKS = [
  { id: 'rueda-roja', label: 'Rueda roja' },
  { id: 'rueda-azul', label: 'Rueda azul' },
  { id: 'abanico', label: 'Abanico' },
  { id: 'rombos', label: 'Rombos' },
] as const

export const PICTURE_BACKS = [
  { id: 'brujula', label: 'Brújula' },
  { id: 'rosa-negra', label: 'Rosa de los vientos' },
  { id: 'calaveras', label: 'Calaveras' },
  { id: 'serpiente-roja', label: 'Serpiente y laurel' },
  { id: 'lunas-verdes', label: 'Lunas verdes' },
  { id: 'reloj-verde', label: 'Reloj verde' },
  { id: 'ojo-hojas', label: 'Ojo entre hojas' },
  { id: 'fenix', label: 'Fénix' },
  { id: 'llamas', label: 'Llamas' },
  { id: 'polilla', label: 'Polilla' },
  { id: 'noche', label: 'Noche' },
  { id: 'engranajes', label: 'Engranajes' },
  { id: 'cristal', label: 'Cristal' },
  { id: 'raices', label: 'Raíces' },
  { id: 'ojo-rojo', label: 'Ojo rojo' },
  { id: 'montana', label: 'Montaña' },
  { id: 'manos', label: 'Manos' },
  { id: 'fuego-rojo', label: 'Fuego' },
  { id: 'cristales', label: 'Cristales' },
  { id: 'arbol', label: 'Árbol' },
  { id: 'mascara', label: 'Máscara' },
  { id: 'serpiente', label: 'Serpiente' },
  { id: 'orbitas', label: 'Órbitas' },
  { id: 'cuervos', label: 'Cuervos' },
  { id: 'ojo-llamas', label: 'Ojo en llamas' },
  { id: 'reloj-arena', label: 'Reloj de arena' },
  { id: 'mareas', label: 'Mareas' },
  { id: 'mariposa', label: 'Mariposa' },
  { id: 'eclipse', label: 'Eclipse' },
  { id: 'laberinto', label: 'Laberinto' },
  { id: 'cripta', label: 'Cripta' },
  { id: 'uroboros', label: 'Uróboros' },
  { id: 'leones', label: 'Leones' },
  { id: 'estrella', label: 'Estrella' },
] as const

export type DrawnBack = (typeof DRAWN_BACKS)[number]['id']
export type BackDesign = DrawnBack | (typeof PICTURE_BACKS)[number]['id']
export const BACK_DESIGNS: ReadonlyArray<{ id: BackDesign; label: string }> = [...DRAWN_BACKS, ...PICTURE_BACKS]
export const isBackDesign = (v: unknown): v is BackDesign => BACK_DESIGNS.some((d) => d.id === v)
