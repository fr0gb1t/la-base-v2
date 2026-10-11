// Music lab (development only: open /music-lab.html on the dev server). The score by itself: pick a mood and, for the
// moods that are songs of several sections, the section to start from. The status line shows what is playing.
import { FORMS, MOODS, makeMusic, type Mood, type Score } from '../table3d/music'

const NAMES: Record<Mood, string> = {
  menu: 'Menú', calm: 'Calma', promising: 'Prometedora', winning: 'Casi ganada', tension: 'Tensión', danger: 'Peligro crítico',
}
const SECTION_NAMES = ['estrofa', 'estribillo', 'segunda estrofa', 'puente', 'estribillo otra vez']

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T
let ctx: AudioContext | null = null
let score: Score | null = null
let chosen: Mood = 'menu'

function button(label: string, onClick: () => void): HTMLButtonElement {
  const b = document.createElement('button')
  b.textContent = label
  b.onclick = onClick
  return b
}

function paint() {
  const moods = $('moods')
  moods.replaceChildren(...MOODS.map((m) => {
    const b = button(NAMES[m], () => pick(m))
    b.classList.toggle('on', m === chosen)
    return b
  }))
  const sections = $('sections')
  const forms = FORMS[chosen]
  sections.replaceChildren(...(forms.length > 1 ? forms.map((_, i) => button(`${i + 1} · ${SECTION_NAMES[i] ?? 'sección'}`, () => pick(chosen, i))) : []))
}

function pick(mood: Mood, section?: number) {
  chosen = mood
  void start().then(() => score?.setMood(mood, section))
  paint()
}

async function start() {
  if (score) return
  ctx = new AudioContext()
  const out = ctx.createGain()
  out.gain.value = Number($<HTMLInputElement>('vol').value)
  out.connect(ctx.destination)
  score = makeMusic(ctx, out)
  score.setMood(chosen)
  score.start()
  $('start').textContent = 'Audio activo'
  $<HTMLButtonElement>('start').disabled = true
  $<HTMLInputElement>('vol').oninput = (e) => { out.gain.value = Number((e.target as HTMLInputElement).value) }
  setInterval(show, 250)
}

function show() {
  if (!score) return
  const st = score.status()
  const n = FORMS[st.mood].length
  const waiting = st.pending !== st.mood ? `  →  ${NAMES[st.pending]} (en el próximo compás par)` : ''
  $('status').textContent = `Sonando: ${NAMES[st.mood]}${waiting}\nSección ${st.section + 1}/${n}${n > 1 ? ` · ${SECTION_NAMES[st.section] ?? ''}` : ''} · compás ${st.bar + 1}/8`
}

$('start').onclick = () => void start()
document.querySelectorAll<HTMLButtonElement>('[data-end]').forEach((b) => {
  b.onclick = () => void start().then(() => score?.stinger(b.dataset.end as 'victory' | 'defeat'))
})
paint()
