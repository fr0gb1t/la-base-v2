import type { Novedad } from './novedades';

// Newest first (by date, and within a day the latest goes on top). Write for players, not for us: what
// changed at the table, in a few short lines. The technical history is docs/CHANGELOG.md.
export const NOVEDADES: Novedad[] = [
  // ------------------------------------------------------------------ 5 de octubre
  {
    id: '2026-10-05-manos',
    date: '2026-10-05',
    title: 'Manos que agarran las cartas',
    items: [
      'Las manos sostienen las cartas de verdad, entre el pulgar y el índice: ya no las atraviesan.',
      'Cada uno tiene su abanico agarrado de la base con la mano izquierda, y vos también.',
      'Jugar una carta es un gesto entero: la sacás del abanico, la llevás boca abajo, la apoyás, levantás el borde y cae boca arriba en su lugar, con un rebote.',
      'Las cartas se doblan un poco con su peso mientras las llevan y tiemblan al caer sobre el paño.',
    ],
  },
  // ------------------------------------------------------------------ 4 de octubre
  {
    id: '2026-10-04-caras-unicas',
    date: '2026-10-04',
    title: 'Nunca dos caras iguales en la mesa',
    items: [
      'Si alguien en la sala tiene tu misma cara, a los dos les aparece un aviso para que uno la cambie.',
      'Si ninguno quiere cambiarla, tocan «Me la quedo»: la usa quien llegó primero y el otro la lleva en otro color.',
      'Las caras que ya tiene otro jugador aparecen como «la tiene…» en el selector, y los bots te dejan la suya si la querés.',
    ],
  },
  {
    id: '2026-10-04-leds',
    date: '2026-10-04',
    title: 'Máscaras que brillan',
    items: [
      'Las máscaras LED brillan de verdad: cada luz tiene su resplandor e ilumina las manos y el borde de la mesa con sus colores.',
      'En Ajustes → Mesa podés regular el «Resplandor de las luces» (bloom), o apagarlo.',
    ],
  },
  {
    id: '2026-10-04-menus',
    date: '2026-10-04',
    title: 'Menús más claros',
    items: ['Con un menú abierto, lo de atrás se oscurece y se desenfoca, y la mesa ya no reacciona al mouse.'],
  },
  {
    id: '2026-10-04-pantalla-entera',
    date: '2026-10-04',
    title: 'Caras y dorsos en pantalla entera (celular)',
    items: [
      'En el celular, Ajustes → Avatar y Cartas tienen «Ver en pantalla entera»: tu cara (o el dorso) ocupa toda la pantalla, como se ve al costado en la computadora.',
      'Deslizá a los costados para pasar de una a otra, o elegila de la lista. Lo que dejás a la vista queda elegido; «Listo» vuelve a los ajustes.',
    ],
  },
  {
    id: '2026-10-04-avatares',
    date: '2026-10-04',
    title: 'Caras flotantes',
    items: [
      'En la mesa ya nadie tiene cuerpo: una cara flota sobre la mesa y dos manos juegan las cartas.',
      'Hay 36 caras para elegir: 30 máscaras de LEDs (payaso, calavera, muñeca, kitsune, oni, ópera china, calabaza, la Llorona, rey de espadas y muchas más) y 6 cabezas esculpidas (caballo, gallo, carnero, diablo, ventrílocuo y santo), cada una con sus manos.',
      'Todas hacen las once señas: las máscaras las dibujan con luz; las cabezas mueven cejas, párpados, labios o pico.',
      'Las manos se pierden en la oscuridad a la altura de la muñeca, como en Buckshot Roulette, y nunca se quedan quietas: respiran, se balancean y la mano libre tamborilea sobre el paño mientras esperás.',
      'Empezás con una cara al azar. En Ajustes → Avatar elegís otra y la ves moverse y hacer señas, igual que en la mesa. Los demás jugadores y los bots también se sientan con la suya.',
    ],
  },
  {
    id: '2026-10-04-senas-zona',
    date: '2026-10-04',
    title: 'Señas rivales, más fáciles de captar',
    items: [
      'Para ver la seña de un rival alcanza con apuntar a donde está sentado, no hace falta clavar la mira en la cara.',
      'Cuando entrás en esa zona, el punto de mira se agranda para avisarte.',
    ],
  },
  {
    id: '2026-10-04-ases-bordes',
    date: '2026-10-04',
    title: 'Arreglo: los ases de la configuración',
    items: ['Con «Bordes suaves» activado, una franja negra cruzaba los ases al configurar la partida. Ya no aparece.'],
  },
  {
    id: '2026-10-04-ajustes-defecto',
    date: '2026-10-04',
    title: 'Ajustes de fábrica renovados',
    items: [
      'En la computadora, quien empieza de cero tiene ahora: sonidos del juego sí y sonido ambiente no; sin guías en la mesa; mano sin volver sola en tu turno; vista sin volver a tu lugar; punto de mira sí; aviso de seña vista sí.',
      'La carta por defecto es la Brújula, en computadora y en celular.',
      'Si ya habías tocado tus ajustes, se respetan tal cual: nada cambia para vos.',
    ],
  },
  {
    id: '2026-10-04-bordes-suaves',
    date: '2026-10-04',
    title: 'Bordes suaves, para todo',
    items: [
      'Las cartas, las manos, los nombres, los botones flotantes y los televisores se ven nítidos y sin escalones, en la partida y en los menús.',
      'Viene encendido, salvo en celulares, tablets y equipos modestos, donde pesaría de más. Lo cambiás en Ajustes → Mesa.',
    ],
  },
  {
    id: '2026-10-04-historial',
    date: '2026-10-04',
    title: 'Novedades con historial',
    items: [
      'Ahora podés ir para atrás: «‹ Antes» y «Después ›» (o las flechas ← →) te llevan por las fechas anteriores.',
      'La hoja siempre tiene el mismo tamaño; si hay más para leer, se desplaza.',
    ],
  },
  {
    id: '2026-10-04-televisores',
    date: '2026-10-04',
    title: 'Televisores en los menús',
    items: [
      'Novedades y Ajustes son dos televisores chicos, uno al lado del otro sobre una mesita, y están en todas las pantallas del menú desde el ingreso.',
      'El de Novedades se pone ámbar y pulsa cuando hay algo que no viste. Al abrirlo se calma.',
      'Ajustes ya no tiene un botón suelto en la esquina: se abre desde el televisor, desde el de la sala o con la tecla O.',
      'Con «Bordes suaves» activado, estos televisores también se ven nítidos.',
      'En la sala y al armar la mesa, la mesita se corre sola para no chocar con las sillas ni con los jugadores.',
    ],
  },
  {
    id: '2026-10-04-senas',
    date: '2026-10-04',
    title: 'Señas más vivas',
    items: [
      'Los bots te miran, esperan unos segundos y recién ahí piden señas. Y solo las piden si tu respuesta puede cambiarles el pedido.',
      'Antes de pedir esperan a que termines de hacer señas, y te miran un instante cuando les llega una.',
      'Si les hacés «no», pueden explicarte con señas por qué pidieron lo que pidieron.',
      'Nuevo ajuste, «Aviso de seña vista»: tu seña destella en rojo si un rival la capta. En la computadora viene encendido; en el celular, apagado.',
    ],
  },
  {
    id: '2026-10-04-giro',
    date: '2026-10-04',
    title: 'Giro del As de Copas, corregido',
    items: [
      'Cuando el As de Copas invierte el sentido, la base se lee desde el Mano en el sentido nuevo.',
      'Ya no se pierde la última carta jugada, y los empates los gana el primero leído.',
    ],
  },

  // ------------------------------------------------------------------ 3 de octubre
  {
    id: '2026-10-03-mesa',
    date: '2026-10-03',
    title: 'La mesa, más cuidada',
    items: [
      'La carta que va ganando la base flota y su recuadro brilla.',
      'Las cartas se reparten boca abajo y el reloj de pedidos arranca un segundo después.',
      'El Pie pide una base menos o una más que las de la ronda. La regla anterior quedó como «Pedido del Pie: Amplia».',
      'Nuevo ajuste, «Bordes suaves», para ver nítidos los televisores, el anotador y el reloj. Viene apagado.',
      'Las cartas que quedan sobre la mesa se apilan en el orden en que se jugaron, desde cualquier ángulo, y tu mano siempre se ve por encima.',
    ],
  },
  {
    id: '2026-10-03-pedidos',
    date: '2026-10-03',
    title: 'Pedidos y señas',
    items: [
      'Cada pedido se anuncia como un cartel grande, con golpe de mesa y sonido propio: rojo si pide el rival, celeste si pide tu equipo.',
      'Si al Pie le queda una sola opción legal, el pedido se declara solo.',
      'La seña «no» ahora significa «por mí no pidas nada». Los bots la usan así.',
      'Los bots ya no esperan señas ni golpean la mesa cuando no tienen nada que decidir.',
    ],
  },
  {
    id: '2026-10-03-celular',
    date: '2026-10-03',
    title: 'Celulares y tablets',
    items: [
      'Juego táctil con giroscopio: movés la vista inclinando el celular.',
      'Un toque en cualquier lado es un clic donde apunta la mira. Doble toque: zoom.',
      'El botón de señas está arriba a la derecha: un toque abre el anillo y otro lo cierra.',
      'Menús y paneles adaptados a pantallas bajas y verticales. El teclado se abre al tocar la carta del nombre.',
      'Sin grano de película en el celular, y el sonido sigue andando con el iPhone en silencio.',
    ],
  },
  {
    id: '2026-10-03-anotador',
    date: '2026-10-03',
    title: 'El anotador, sobre la mesa',
    items: [
      'Un anotador de espiral con lápiz, junto a los porotos, muestra el marcador en vivo sin tocarlo.',
      'Un clic (o H) abre la hoja completa, en versión reducida o completa.',
      'Al terminar cada base y cada ronda la cámara apunta al anotador y se escribe un resumen a mano. Lo confirmás con el tilde (o Enter).',
      'Los resúmenes quedan como hojas: se hojean arrastrando hacia arriba, como el manual.',
    ],
  },
  {
    id: '2026-10-03-televisores-crt',
    date: '2026-10-03',
    title: 'Televisores en la partida',
    items: [
      'Historial, reglas, ajustes y salir son ahora televisores de tubo colgados al fondo, con ruido de estática. Al pasar el mouse se escribe su nombre en la pantalla.',
      'Un panel de LED verde dice solo lo importante: «Tu turno», «Rival pide 2», «Sacá una carta»…',
      'Reemplazan a la pizarra de tiza.',
    ],
  },
  {
    id: '2026-10-03-reloj',
    date: '2026-10-03',
    title: 'Reloj de torneo y mesa más legible',
    items: [
      'Un reloj de ajedrez de torneo cuenta el tiempo de los pedidos (1, 2 o 5 minutos por equipo; 1 por defecto), apoyado a tu derecha.',
      'Las cartas jugadas ya no se queman con la luz, los porotos son más grandes y los números se leen mejor.',
      'Las mangas muestran el color de tu equipo visto desde tu lugar, y los pulgares apuntan bien.',
    ],
  },
  {
    id: '2026-10-03-menus',
    date: '2026-10-03',
    title: 'Menús, ajustes y manual',
    items: [
      '«Configurar y empezar» rehecho: los kamikazes van en un solo botón con su cantidad, y el reloj en otro que cicla.',
      'Armar mesa y Sentarse más prolijos; al salir de la sala los personajes desaparecen rápido.',
      'Ajustes: carta grande para elegir el dorso, anillo de señas reordenable (con «restablecer») y altura de la mano guardada.',
      'El manual entra con una animación nueva y sin tirones, y se pueden dar vuelta varias hojas a la vez.',
    ],
  },

  // ------------------------------------------------------------------ 2 de octubre
  {
    id: '2026-10-02-personalizar',
    date: '2026-10-02',
    title: 'Dorsos, mano y manual',
    items: [
      '34 dorsos ilustrados para elegir en Ajustes, y sonidos en los menús.',
      'Reordenás tu mano arrastrando una carta por el abanico.',
      'Campo visual más amplio (63 % por defecto, ajustable) y las cartas jugadas caen más cerca del centro.',
      'El manual es un librito 3D con hojas que das vuelta con la mano, y también se abre sobre la mesa de juego, con solapas.',
      'Los bots, siendo Mano con una mano muy despareja, a veces cantan kamikaze.',
    ],
  },
  {
    id: '2026-10-02-reglas',
    date: '2026-10-02',
    title: 'Reglas corregidas',
    items: [
      'Quien reparte rota cada ronda en sentido antihorario, y la Mano es quien recibe la primera carta.',
      'Antihorario significa que el turno pasa a tu derecha. Quedó explicado en el manual.',
      'Si la partida termina empatada se juegan dos rondas de desempate; si siguen iguales, ganan los dos equipos.',
      'Después de que el As de Copas invierte el sentido, el turno saltea a quienes ya jugaron esa base.',
      'Se arregló que las salas se borraran en plena partida («Game not found or not started»).',
    ],
  },
  {
    id: '2026-10-02-mesa',
    date: '2026-10-02',
    title: 'La mesa 3D, a fondo',
    items: [
      'Mirás alrededor apretando y arrastrando sobre la mesa; el giro llega hasta la cara de cada jugador y frena ahí.',
      'Clic derecho hace zoom y al soltar volvés exactamente a donde estabas. La ruedita sube y baja tus cartas.',
      'El sorteo inicial se hace haciendo clic en el mazo del centro.',
      'Cada cabeza muestra hacia dónde mira la cámara de su jugador.',
      'Fichas: «D» de quien reparte, «pide» de quien declara primero y un avión de metal por cada kamikaze.',
      'Cada base ganada deja un poroto; lo pedido se escribe en tiza. Tu lugar para apoyar la carta se marca con un recuadro punteado.',
      'El As de Copas y el As de Oros se deciden sobre la mesa, con carteles flotantes.',
      'Los nombres flotan a la altura de la panza, en los colores de cada equipo, y todos se sientan igual que vos.',
    ],
  },
  {
    id: '2026-10-02-senas',
    date: '2026-10-02',
    title: 'Señas con la máscara',
    items: [
      'Hacés señas con la cara: as de espadas = cejas, ancho de bastos = guiño, figuras = boca estirada, y más. «Sí» y «no» se hacen con la cabeza.',
      'Abrís el menú de señas con el clic del medio (o G): 1 a 9 para cartas, S y N para sí y no. Tu propia seña se ve donde estaba el menú.',
      'Podés pedir señas golpeando la mesa (P, o el botón del panel de declarar).',
      'Un rival solo ve tu seña si su cámara está sobre tu cara y no estás de espaldas. Tu equipo siempre la ve.',
      'Hay un punto de mira en el centro de la pantalla.',
    ],
  },
  {
    id: '2026-10-02-bots',
    date: '2026-10-02',
    title: 'Bots que hacen y leen señas',
    items: [
      'Los bots hacen y entienden señas y giran la cabeza hacia su compañero al hacerlas.',
      'No siempre las hacen: a veces se distraen, y cuando un rival golpea la mesa miran a quien tiene que contestar.',
      'Planifican para el equipo, guardan solo las cartas fuertes que hacen falta y a veces dejan pasar al rival para hacerlo ganar una base que no quiere.',
      'Después de pedir señas esperan la respuesta antes de declarar, y no hacen nada hasta que las cartas están en tu pantalla.',
    ],
  },
  {
    id: '2026-10-02-paneles',
    date: '2026-10-02',
    title: 'Historial, ajustes y menús',
    items: [
      'Historial de la partida (pestaña «historial» o tecla J) y un panel de fin de partida en papel: «Ganó tu equipo» o «Ganaron los rivales».',
      'Ajustes nuevos: volver la vista a tu lugar, invertir cámara, sensibilidad del mouse, punto de mira, mano a la vista al empezar tu turno y guías en la mesa.',
      'Manual ilustrado dentro del juego («Reglamento» en el menú, o R en la mesa), con 12 capítulos y la grilla de caras de las señas.',
      'El sonido arranca con la app y las luces proyectan sombras suaves.',
      'Menú de configuración con los kamikazes como aviones y los poderes como cartas que flotan.',
    ],
  },

  // ------------------------------------------------------------------ 30 de septiembre
  {
    id: '2026-09-30-nace',
    date: '2026-09-30',
    title: 'La Base en 3D',
    items: [
      'La mesa pasa a ser un sótano en primera persona, con el mismo ambiente en los menús.',
      'Cartas con figuras de la baraja española dibujadas a mano.',
      'Los bots pueden completar la mesa.',
      'Primer menú de ajustes (sonido) y un tablero en papel con lo importante de la partida.',
    ],
  },
];
