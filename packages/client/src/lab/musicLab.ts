// Music lab (development only: open /music-lab.html on the dev server). The score by itself: pick a mood and, for the
// moods that are songs of several sections, the section to start from. The status line shows what is playing.
import { FORMS, MOODS, STINGER_LENGTH, makeMusic, planSeconds, type Mood, type PlanPart, type Score } from '../table3d/music'
import { encodeWav } from './wav'

const NAMES: Record<Mood, string> = {
  menu: 'Menú', calm: 'Calma', promising: 'Prometedora', winning: 'Casi ganada', tension: 'Tensión', danger: 'Peligro crítico',
}
const SECTION_NAMES = ['estrofa', 'estribillo', 'segunda estrofa', 'puente', 'estribillo otra vez']

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T
let ctx: AudioContext | null = null
let score: Score | null = null
let chosen: Mood = 'menu'
let chosenSection = 0

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
  chosenSection = section ?? 0
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

// ---- outside the game: render a whole piece offline and listen to it (or download it)
const SAMPLE_RATE = 44100
const BARS = 8
const CHUNK_SECONDS = 20
const EMOTIONAL_ORDER: Mood[] = ['menu', 'calm', 'promising', 'tension', 'danger', 'winning']

/** Every section of a mood in order; a mood that is a single loop plays twice. */
const allOf = (mood: Mood): PlanPart[] =>
  FORMS[mood].length > 1
    ? FORMS[mood].map((_, section) => ({ mood, bars: BARS, section }))
    : [{ mood, bars: BARS, section: 0 }, { mood, bars: BARS, section: 0 }]

async function renderPlan(plan: PlanPart[], name: string, finish?: 'victory') {
  const status = $('renderStatus')
  const seconds = planSeconds(plan) + (finish ? STINGER_LENGTH : 0) + 4
  status.textContent = `Grabando ${Math.round(seconds)} s de música…`
  const offline = new OfflineAudioContext(2, Math.ceil(seconds * SAMPLE_RATE), SAMPLE_RATE)
  const out = offline.createGain()
  out.connect(offline.destination)
  const piece = makeMusic(offline, out)
  await piece.ready()
  const writer = piece.renderer(plan, finish)
  // the notes are written a chunk at a time, ahead of the render, so a long piece never holds all of them
  for (let t = CHUNK_SECONDS; t < seconds; t += CHUNK_SECONDS) {
    void offline.suspend(t).then(() => { writer.scheduleUntil(t + CHUNK_SECONDS + 1); void offline.resume() })
  }
  writer.scheduleUntil(CHUNK_SECONDS + 1)
  const rendered = await offline.startRendering()
  const wav = encodeWav([rendered.getChannelData(0), rendered.getChannelData(1)], SAMPLE_RATE)
  const url = URL.createObjectURL(new Blob([wav], { type: 'audio/wav' }))
  const player = $<HTMLAudioElement>('player')
  player.src = url
  player.hidden = false
  const link = $<HTMLAnchorElement>('download')
  link.href = url
  link.download = `${name}.wav`
  link.hidden = false
  status.textContent = `Listo: ${name} (${Math.round(seconds)} s).`
}

const fullPlan = (): PlanPart[] => EMOTIONAL_ORDER.flatMap(allOf)
$('renderFull').onclick = () => void renderPlan(fullPlan(), 'la-base-tema-completo', 'victory')
$('renderMood').onclick = () => void renderPlan(allOf(chosen), `la-base-${chosen}`)
$('renderOne').onclick = () => void renderPlan([{ mood: chosen, bars: BARS, section: chosenSection }], `la-base-${chosen}-${chosenSection + 1}`)
