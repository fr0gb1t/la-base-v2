import type { ReactNode } from 'react';
import { SENAS } from '@la-base/shared';
import { GiKnockout } from 'react-icons/gi';
import { SenaFace } from '../senas/SenaFace';
import { Bean, Example, MiniCard, Plane, TableTop, INK, NUM_FONT, OXBLOOD, TEAL, ROSE } from './art';

// The rulebook's chapters. Each one: a drawing on the left page, the rule on the right.
// Tone: short and a bit cheeky (Exploding Kittens), steps and boxed examples (The Crew),
// a board of faces for the señas (Quién soy).

export interface Chapter {
  id: string;
  tab: string;
  title: string;
  kicker: string; // the one-liner under the title
  art: ReactNode;
  body: ReactNode;
}

const SEQ = {
  Clásica: [1, 3, 5, 5, 3, 1, 1, 3, 5, 5, 3, 1],
  Alternativa: [1, 3, 5, 6, 6, 5, 3, 1, 1, 3, 5, 6, 6, 5, 3, 1],
  Postpandemia: [1, 2, 3, 4, 5, 6, 6, 5, 4, 3, 2, 1],
};

function BeanBars({ seq }: { seq: number[] }) {
  const w = 300;
  const step = w / seq.length;
  return (
    <svg className="rb-fit" width={w} height={110} viewBox={`0 0 ${w} 110`} aria-hidden>
      {seq.map((n, i) => (
        <g key={i}>
          {Array.from({ length: n }, (_, k) => (
            <Bean key={k} x={i * step + step / 2} y={86 - k * 12} r={(i * 37 + k * 53) % 40 - 20} />
          ))}
          <text x={i * step + step / 2} y={104} fontSize={11} textAnchor="middle" fill={INK} fontFamily={NUM_FONT}>{n}</text>
        </g>
      ))}
    </svg>
  );
}

const Keycap = ({ children }: { children: ReactNode }) => <kbd className="rb-key">{children}</kbd>;

export const CHAPTERS: Chapter[] = [
  {
    id: 'portada',
    tab: 'La Base',
    title: 'La Base',
    kicker: 'Un juego de cartas españolas, una mesa redonda y gente que promete cosas.',
    art: (
      <TableTop n={8} size={300} seats={{ 0: { label: 'vos' }, 4: { label: 'enfrente' } }} />
    ),
    body: (
      <>
        <p>
          Se juega de a <b>4, 6 u 8</b>, en dos equipos que se sientan <b>alternados</b>: <span className="rb-mine">Nosotros</span> y{' '}
          <span className="rb-rival">Ellos</span>. Tu compañero nunca está al lado tuyo: está del otro lado de un rival.
        </p>
        <p>
          En cada ronda tu equipo <b>promete</b> cuántas bases va a ganar. Cumplir paga mucho. Fallar cuesta. Fallar feo te deja afuera de la partida.
        </p>
        <Example title="Qué hay en la mesa">
          <ul>
            <li>Mazo español de 40 cartas (sin 8 ni 9). Con 8 jugadores, dos mazos.</li>
            <li>Porotos para contar las bases ganadas.</li>
            <li>Aviones de metal: los kamikazes de cada equipo.</li>
            <li>La ficha <b>D</b> de quien reparte y la ficha <b>pide</b> de quien declara primero.</li>
          </ul>
        </Example>
      </>
    ),
  },
  {
    id: 'cartas',
    tab: 'Cartas',
    title: 'Quién le gana a quién',
    kicker: 'El ancho de bastos manda. Los ases, en general, dan lástima.',
    art: (
      <div className="rb-ladder">
        <MiniCard value={1} suit="bastos" w={92} glow="win" label="ancho de bastos" />
        <MiniCard value={12} suit="oros" w={80} label="rey" />
        <MiniCard value={11} suit="copas" w={72} label="caballo" />
        <MiniCard value={10} suit="espadas" w={66} label="sota" />
        <MiniCard value={7} suit="oros" w={60} label="7, 6, 5, 4" />
        <MiniCard value={3} suit="copas" w={54} label="3, 2" />
        <MiniCard value={1} suit="espadas" w={50} label="ases" />
      </div>
    ),
    body: (
      <>
        <ol className="rb-steps">
          <li><b>Ancho de bastos</b>: la carta más fuerte. Casi nada la vence (ver el As de Espadas).</li>
          <li><b>Rey</b> (12), <b>caballo</b> (11) y <b>sota</b> (10), de cualquier palo.</li>
          <li>Después <b>7, 6, 5, 4, 3, 2</b>.</li>
          <li>Al fondo, los <b>ases</b> de oros, copas y espadas: valen 1… salvo que tengan su poder activado.</li>
        </ol>
        <p>El palo no importa: un rey de copas y un rey de oros valen lo mismo.</p>
        <Example title="Empate">
          <p>Dos cartas iguales: gana la que se jugó <b>primero</b> (la más cercana a la Mano).</p>
        </Example>
      </>
    ),
  },
  {
    id: 'rondas',
    tab: 'Rondas',
    title: 'Rondas y bases',
    kicker: 'Una base es una vuelta de cartas. Una ronda es un montón de bases. No es tan difícil.',
    art: (
      <div className="rb-stack">
        {Object.entries(SEQ).map(([name, seq]) => (
          <figure key={name}>
            <BeanBars seq={seq} />
            <figcaption>{name} · {seq.length} rondas</figcaption>
          </figure>
        ))}
      </div>
    ),
    body: (
      <>
        <p>
          Antes de empezar se elige una <b>estructura</b>: la lista de cuántas bases tiene cada ronda. En una ronda de 5 bases, cada uno recibe{' '}
          <b>5 cartas</b> y se juegan 5 vueltas.
        </p>
        <ol className="rb-steps">
          <li><b>Base</b>: cada jugador tira una carta; la más alta se la lleva.</li>
          <li><b>Ronda</b>: todas las bases que salen de una repartida.</li>
          <li><b>Partida</b>: todas las rondas de la estructura.</li>
        </ol>
        <Example>
          <p>Clásica: 1 · 3 · 5 · 5 · 3 · 1 · 1 · 3 · 5 · 5 · 3 · 1. La primera ronda se juega con una sola carta. Suerte.</p>
        </Example>
      </>
    ),
  },
  {
    id: 'mano',
    tab: 'Mano',
    title: 'Repartir, la Mano y el Pie',
    kicker: 'Todo gira a la derecha. Literalmente.',
    art: (
      <TableTop
        n={4}
        size={290}
        direction="antihorario"
        seats={{ 0: { label: 'vos', sub: 'da (D)' }, 3: { label: 'Mano', sub: 'recibe primero', ring: OXBLOOD }, 2: { label: 'Pie', sub: 'responde' } }}
      />
    ),
    body: (
      <>
        <ol className="rb-steps">
          <li>
            <b>Sorteo</b>: al empezar, cada uno saca una carta del mazo del centro. La más alta <b>da</b> (reparte) primero.
          </li>
          <li>
            Se reparte de a una carta en <b>sentido antihorario</b>: el turno pasa <b>a tu derecha</b>. En cada ronda nueva da el siguiente, también a la derecha.
          </li>
          <li>
            La <b>Mano</b> es quien recibe la primera carta: declara primero y abre la primera base.
          </li>
          <li>
            El <b>Pie</b> es el primero del otro equipo después de la Mano: responde la declaración.
          </li>
        </ol>
        <Example title="Derecha, aunque no parezca">
          <p>
            <b>Antihorario</b> quiere decir que cada uno le pasa el turno <b>al de su derecha</b>. Visto desde arriba, como en el dibujo, la vuelta gira al revés de las agujas del reloj y parece ir «para la izquierda»: pensalo siempre desde tu silla.
          </p>
        </Example>
        <p>Después de cada base, <b>quien la gana abre la siguiente</b>: pasa a ser la nueva Mano.</p>
      </>
    ),
  },
  {
    id: 'declarar',
    tab: 'Declarar',
    title: 'Prometer bases',
    kicker: 'La regla de oro: la suma nunca da justo. Alguien va a fallar. Siempre.',
    art: (
      <svg className="rb-fit" width={300} height={210} viewBox="0 0 300 210" aria-hidden>
        <text x={10} y={22} fontSize={15} fill={INK} fontFamily="IM Fell English SC, Georgia, serif">ronda de 5 bases</text>
        <text x={10} y={62} fontSize={13} fill={OXBLOOD} fontFamily="IM Fell English SC, Georgia, serif">la Mano pide 3</text>
        {[0, 1, 2].map((k) => (
          <Bean key={k} x={150 + k * 20} y={57} r={k * 25 - 20} />
        ))}
        <text x={10} y={112} fontSize={13} fill={INK} fontFamily="IM Fell English SC, Georgia, serif">el Pie puede pedir</text>
        {[0, 1, 2, 3, 4, 5].map((v) => (
          <g key={v}>
            <circle cx={30 + v * 45} cy={150} r={17} fill="none" stroke={v === 2 ? OXBLOOD : INK} strokeWidth={2} />
            <text x={30 + v * 45} y={157} fontSize={20} textAnchor="middle" fill={v === 2 ? OXBLOOD : INK} fontFamily={NUM_FONT}>{v}</text>
            {v === 2 && <path d={`M${13 + v * 45} 167 L${47 + v * 45} 133`} stroke={OXBLOOD} strokeWidth={3} />}
          </g>
        ))}
        <text x={120} y={196} fontSize={12} fill={OXBLOOD} fontFamily="IM Fell English, Georgia, serif">3 + 2 = 5: prohibido</text>
      </svg>
    ),
    body: (
      <>
        <ol className="rb-steps">
          <li>La <b>Mano</b> declara por su equipo: de cero hasta todas las bases de la ronda.</li>
          <li>El <b>Pie</b> responde por el suyo, también de cero al total, <b>pero</b> la suma de los dos pedidos no puede ser igual a las bases de la ronda.</li>
          <li>Lo dicho, dicho está: no se puede cambiar.</li>
        </ol>
        <p>
          Antes de declarar podés <b>pedir señas</b> (golpecitos en la mesa) para saber qué tienen tus compañeros. Ver el capítulo Señas.
        </p>
      </>
    ),
  },
  {
    id: 'kamikaze',
    tab: 'Kamikaze',
    title: 'Kamikaze: todo o nada',
    kicker: 'Un avión de metal y mucha fe en tu equipo.',
    art: (
      <svg className="rb-fit" width={300} height={220} viewBox="0 0 300 220" aria-hidden>
        <Plane x={150} y={80} s={3.4} />
        <text x={70} y={190} fontSize={46} textAnchor="middle" fill={INK} fontFamily={NUM_FONT}>0</text>
        <text x={150} y={186} fontSize={16} textAnchor="middle" fill={OXBLOOD} fontFamily="IM Fell English SC, Georgia, serif">o</text>
        <text x={230} y={190} fontSize={42} textAnchor="middle" fill={INK} fontFamily="IM Fell English SC, Georgia, serif">todas</text>
      </svg>
    ),
    body: (
      <>
        <p>
          Cada equipo arranca la partida con unos pocos <b>kamikazes</b> (de cero a tres; se eligen al armar la mesa). Cada uno usado queda en la mesa como un avioncito delante de quien lo jugó.
        </p>
        <ol className="rb-steps">
          <li>Solo la <b>Mano</b> puede declarar kamikaze, antes de pedir.</li>
          <li>Con kamikaze solo se puede pedir <b>cero o todas</b> las bases.</li>
          <li>Gasta uno de los aviones de su equipo.</li>
        </ol>
        <Example title="El castigo">
          <p>
            Si la Mano pide <b>sin</b> kamikaze y le erra por <b>2 o más</b> bases, su equipo <b>pierde la partida en el acto</b>. El avión es tu seguro: si vas a jugártela, jugátela entera.
          </p>
        </Example>
      </>
    ),
  },
  {
    id: 'base',
    tab: 'Jugar',
    title: 'Jugar una base',
    kicker: 'Una carta cada uno, a la derecha, y que gane el más bruto.',
    art: (
      <TableTop n={4} size={300} direction="antihorario" seats={{ 3: { label: 'Mano', ring: OXBLOOD }, 2: { label: 'gana', ring: '#c9a227' } }}>
        {(pos) => (
          <>
            {[
              { seat: 3, value: 7, suit: 'copas' as const },
              { seat: 2, value: 12, suit: 'oros' as const, glow: 'win' as const },
              { seat: 1, value: 11, suit: 'espadas' as const },
              { seat: 0, value: 3, suit: 'bastos' as const },
            ].map((c) => {
              const p = pos(c.seat, 62)
              return <MiniCard key={c.seat} x={p.x - 18} y={p.y - 28} w={30} value={c.value} suit={c.suit} glow={c.glow} />
            })}
          </>
        )}
      </TableTop>
    ),
    body: (
      <>
        <ol className="rb-steps">
          <li>Abre la <b>Mano</b> y sigue cada uno a su derecha, hasta que todos tiraron una carta.</li>
          <li>Gana la base la carta <b>más alta</b>; si hay empate, la que salió primero.</li>
          <li>El equipo ganador se lleva las cartas y suma un <b>poroto</b> al lado de su carta.</li>
          <li>Quien ganó <b>abre la siguiente</b> base.</li>
        </ol>
        <Example>
          <p>La Mano tira un 7, el siguiente un <b>rey</b>, después un caballo y vos un 3. Gana el rey: ese jugador abre la próxima.</p>
        </Example>
        <p className="rb-small">En la mesa: click corto en una carta la juega; mantené el click para llevarla con el brazo (y amagar) y soltala sobre tu recuadro de tiza.</p>
      </>
    ),
  },
  {
    id: 'ases',
    tab: 'Ases',
    title: 'Los ases con poder',
    kicker: 'Tres ases que dejan de dar lástima. Se activan (o no) al armar la mesa.',
    art: (
      <div className="rb-aces">
        <figure>
          <div className="rb-row">
            <MiniCard value={1} suit="bastos" w={58} label="primero" />
            <span className="rb-then">→</span>
            <MiniCard value={1} suit="espadas" w={58} glow="win" label="después" />
          </div>
          <figcaption>El Matador: el as de espadas <b>después</b> del ancho lo mata</figcaption>
        </figure>
        <figure>
          <TableTop n={4} size={170} direction="horario" fit={false} />
          <figcaption>El Girador: el as de copas puede invertir el sentido</figcaption>
        </figure>
        <figure>
          <div className="rb-row">
            <MiniCard value={1} suit="oros" w={58} />
          </div>
          <figcaption>El Elegidor: si tu equipo gana esa base, elegís quién abre</figcaption>
        </figure>
      </div>
    ),
    body: (
      <>
        <h4>As de Espadas · El Matador</h4>
        <p>Si se juega <b>después</b> del ancho de bastos en la misma base, lo mata y gana. Si se juega antes, es un as cualquiera.</p>
        <h4>As de Copas · El Girador</h4>
        <p>
          Quien lo tira elige <b>mantener</b> o <b>invertir</b> el sentido, hasta el final de la ronda (después vuelve a antihorario). La Mano sigue abriendo igual. En la mesa: dos carteles y una flecha de tiza que te muestra para dónde va.
        </p>
        <h4>As de Oros · El Elegidor</h4>
        <p>
          Si el equipo que lo tiró <b>gana esa base</b> y no es la última de la ronda, quien lo tiró elige qué compañero abre la siguiente. En la mesa: click en su cara (o en su cartel).
        </p>
        <p className="rb-small">Con el poder apagado, cada uno de estos ases vale 1 y listo.</p>
      </>
    ),
  },
  {
    id: 'puntos',
    tab: 'Puntos',
    title: 'Los puntos',
    kicker: 'Cumplir paga diez. Fallar te cobra la diferencia. Por arriba o por abajo.',
    art: (
      <div className="rb-score">
        <table>
          <thead>
            <tr><th /><th>pidió</th><th>ganó</th><th>puntos</th></tr>
          </thead>
          <tbody>
            <tr className="rb-mine-row"><td>Tu equipo</td><td>3</td><td>3</td><td>+13</td></tr>
            <tr className="rb-rival-row"><td>Rivales</td><td>1</td><td>2</td><td>−1</td></tr>
          </tbody>
        </table>
        <svg width={330} height={60} viewBox="0 0 330 60" aria-hidden>
          {[0, 1, 2].map((k) => <Bean key={k} x={30 + k * 18} y={30 + (k % 2) * 6} r={k * 30} />)}
          <text x={100} y={36} fontSize={14} fill={TEAL} fontFamily="IM Fell English SC, Georgia, serif">cumplió</text>
          {[0, 1].map((k) => <Bean key={k} x={185 + k * 18} y={30 + k * 5} r={k * 40} red={k === 1} />)}
          <text x={225} y={36} fontSize={14} fill={ROSE} fontFamily="IM Fell English SC, Georgia, serif">uno de más</text>
        </svg>
      </div>
    ),
    body: (
      <>
        <ol className="rb-steps">
          <li>Si tu equipo ganó <b>exactamente</b> lo que pidió: <b>10 + las bases ganadas</b>.</li>
          <li>Si no: pierde la <b>diferencia</b> (pedir 5 y ganar 3 es −2; pedir 2 y ganar 4 también es −2).</li>
          <li>Pueden fallar los dos equipos en la misma ronda.</li>
        </ol>
        <Example>
          <p>Pidieron cero y no ganaron ninguna: cumplieron. Son 10 puntos por no hacer nada, que es el mejor negocio del juego.</p>
        </Example>
      </>
    ),
  },
  {
    id: 'senas',
    tab: 'Señas',
    title: 'Las señas',
    kicker: '¿Quién tiene el ancho? Mirale la cara. Pero que no te vean mirando.',
    art: (
      <div className="rb-faces">
        {SENAS.map((s) => (
          <figure key={s.id} className="rb-face">
            <SenaFace sena={s.id} size={60} />
            <figcaption>
              <b>{s.label}</b>
              <span>{s.gesture}</span>
            </figcaption>
          </figure>
        ))}
      </div>
    ),
    body: (
      <>
        <p>Con la cara le contás a tu equipo qué tenés. Mentir está permitido (y es buena idea, a veces).</p>
        <ol className="rb-steps">
          <li>
            <b>Hacer una seña</b>: clic del medio (o <Keycap>G</Keycap>), apuntá a una cara y soltá. La seña sale <b>mirando hacia donde apunta tu cámara</b>: mirá a tu compañero.
          </li>
          <li>
            <b>Tu equipo</b> siempre la ve. Un <b>rival</b> solo si en ese momento tiene el punto de mira sobre tu cara, y vos no estás de espaldas a él.
          </li>
          <li>
            <b>Pedir señas</b> <GiKnockout aria-hidden className="rb-inline-icon" />: golpecitos en la mesa (<Keycap>P</Keycap>). Todos lo ven y lo oyen… y los rivales van a clavar la mirada en quien tiene que contestar.
          </li>
          <li>
            Con la cabeza: <b>sí</b> (asentir) es «pedí al menos una, yo puedo hacer una»; <b>no</b> (negar) es «no te paso información». Las dos cuentan como respuesta cuando te piden señas.
          </li>
          <li>
            Cada cabeza muestra hacia dónde mira ese jugador: usalo para saber quién te está mirando.
          </li>
        </ol>
        <p className="rb-small">«Nada» (ojos cerrados): ni figuras, ni ancho de bastos, ni ases con poder.</p>
      </>
    ),
  },
  {
    id: 'fin',
    tab: 'Final',
    title: 'Cómo termina',
    kicker: 'O se acaban las rondas, o alguien se manda una macana.',
    art: (
      <svg className="rb-fit" width={300} height={200} viewBox="0 0 300 200" aria-hidden>
        <text x={150} y={60} fontSize={26} textAnchor="middle" fill={TEAL} fontFamily={NUM_FONT}>132</text>
        <text x={150} y={92} fontSize={14} textAnchor="middle" fill={INK} fontFamily="IM Fell English, Georgia, serif">contra</text>
        <text x={150} y={130} fontSize={26} textAnchor="middle" fill={ROSE} fontFamily={NUM_FONT}>118</text>
        <path d="M60 150 Q150 175 240 150" stroke={INK} strokeWidth={2} fill="none" />
      </svg>
    ),
    body: (
      <>
        <ol className="rb-steps">
          <li>Al terminar <b>todas las rondas</b>, gana el equipo con más puntos.</li>
          <li>Si la <b>Mano</b> erra por 2 o más <b>sin kamikaze</b>, su equipo pierde ahí mismo, sin importar los puntos.</li>
          <li>
            <b>Empate</b>: se juegan 2 rondas de desempate con el máximo de bases de la estructura, alternando qué equipo es Mano. Gana quien suma más.
          </li>
        </ol>
      </>
    ),
  },
  {
    id: 'mesa',
    tab: 'Controles',
    title: 'En la mesa',
    kicker: 'Todo lo que se puede hacer sin levantarse de la silla.',
    art: (
      <dl className="rb-keys">
        <dt>click en carta</dt><dd>jugarla</dd>
        <dt>mantener click</dt><dd>mover el brazo y amagar; soltá en tu recuadro</dd>
        <dt>arrastrar la mesa</dt><dd>mirar alrededor</dd>
        <dt>ruedita</dt><dd>subir o bajar tus cartas</dd>
        <dt>clic derecho</dt><dd>zoom donde apuntás (lejos: te parás)</dd>
        <dt>clic del medio · <Keycap>G</Keycap></dt><dd>señas</dd>
        <dt><Keycap>P</Keycap></dt><dd>pedir señas</dd>
        <dt><Keycap>H</Keycap> · <Keycap>J</Keycap></dt><dd>anotador · historial</dd>
        <dt><Keycap>O</Keycap> · <Keycap>R</Keycap></dt><dd>ajustes · este manual</dd>
        <dt><Keycap>Enter</Keycap></dt><dd>listo / siguiente base</dd>
      </dl>
    ),
    body: (
      <>
        <p>
          Al final de cada base y de cada ronda, todos confirman con <b>listo</b> antes de seguir: nadie se pierde qué pasó.
        </p>
        <p>
          Desde <b>ajustes</b> podés cambiar la sensibilidad del mouse, invertir la cámara, apagar las guías de tiza o el punto de mira, y elegir si la vista vuelve sola a tu lugar.
        </p>
        <p className="rb-small">Iconos: game-icons.net (CC BY 3.0) · Sonidos: Kenney (CC0)</p>
      </>
    ),
  },
];
