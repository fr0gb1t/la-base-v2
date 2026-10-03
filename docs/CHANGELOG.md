# Registro de cambios — La Base v2

## Desde `a603e36`

Todo lo hecho después de `a603e36` (la sección de abajo cubre lo anterior), agrupado por área.

### Celulares y tablets (solo con pantalla táctil; la versión de escritorio no cambia)
- **Giroscopio:** girar el celular mueve la vista igual que arrastrar el mouse (tomando solo el
  giro, sin importar hacia dónde apunta al empezar); se enciende solo con el primer toque (en iOS
  pide permiso) y se apaga en Ajustes → Cámara → Giroscopio. Arrastrar con el dedo sigue
  sumando.
- **Un dedo = clic izquierdo:** un toque es un clic (juega la carta, aprieta botones de la mesa,
  de la pizarra y de los menús) y mantener y arrastrar lleva la carta y mueve la vista, igual
  que con el mouse.
- **Dos dedos arriba/abajo:** suben y bajan las cartas (como la ruedita, y la altura queda
  guardada). **Tres dedos, un toque:** activa el zoom donde tocaste; otro toque de tres dedos lo
  desactiva (con el zoom activo, un dedo arrastra el punto de vista).
- **Menús:** los botones 3D responden al toque; los paneles (anotador, sala, ajustes, ofertas,
  manual, entrar) se achican en pantallas bajas y apaisadas; si el celular está vertical el cuadro
  se ensancha para que entre la mesa y en la partida aparece un aviso para girarlo. Botón
  redondo «señas» para abrir el anillo sin mouse. Se saca la ayuda de teclas.
- Probado con emulación táctil (`e2e/mobile.shots.mjs`, `e2e/mobile.game.mjs`): toque, mantener y
  arrastrar, dos y tres dedos, giroscopio y manual con el dedo.

### Reloj de pedidos
- **Reloj de ajedrez:** en la configuración se elige sin tiempo, 1, 2 o 5 min por equipo para toda
  la partida (por defecto 1 min). Corre solo en los pedidos: arranca el equipo de la Mano cuando
  terminan de repartirse las cartas, elegís cuántas bases y tocás el reloj para pasarle el turno al
  rival; el segundo pedido lo frena para los dos hasta la ronda siguiente (que empieza el otro
  equipo, porque cambia la Mano). Si a un equipo se le acaba el tiempo mientras pide, pierde la
  partida. `fb9d520`, `025d9f5`
- **Diseño del reloj:** reloj de torneo (caja de nogal con veta, tapa negra basculante, pantalla
  LCD gris con «tu equipo / rivales», triángulo del lado que corre, botones), apoyado a tu derecha,
  inclinado hacia vos y fuera del paso de las cartas, los porotos y las bases ganadas (con 8
  jugadores, más chico y más cerca tuyo). Sin tiempo marca «-:--». `25d49ce`

### Mesa de juego
- **El anotador es un objeto de la mesa:** un anotador de espiral con un lápiz encima, en diagonal al
  montoncito de porotos; al pasar el mouse se levanta un poco y al hacerle clic (o con H) se abre,
  flotando en el medio de la pantalla, una hoja rayada escrita a mano: los textos y los números se
  escriben de izquierda a derecha en letra manuscrita, y las rayas, la separación y las estrellas
  (vacía = pedida, llena = lograda, roja = de más) se dibujan trazo por trazo con rough.js.
  Muestra ronda, base, sentido, puntos, lo que pidió y lleva cada equipo, kamikazes y los jugadores
  con su estado. Reemplaza al papelito fijo de la esquina y al botón de la pizarra.
- **La pizarra dice qué hacer:** la tira de texto sobre la mesa («Sorteo: hacé click en el
  mazo…», «Tu turno…», «Declara …») ahora está escrita con tiza en la mitad derecha de la pizarra
  (que se ensanchó), y se escribe de izquierda a derecha cada vez que cambia; también aparecen
  ahí las descripciones al pasar el mouse por sus botones. El texto sigue en el HTML, oculto,
  para lectores de pantalla.
- **Los botones de la partida viven en una pizarra:** anotador, historial, reglas, ajustes y salir
  son cinco botones redondos de tiza sobre una pizarra colgada de dos cadenas al fondo de la sala,
  más arriba que las cabezas de todos (no la tapa ningún jugador, con 4, 6 u 8) y con su propia
  lamparita. Sin texto: al pasar el mouse el botón se enciende y su nombre aparece escrito
  debajo, y la descripción sale en la línea de estado. Anotador e historial/reglas ya no repiten
  icono (cuaderno, reloj de retroceso, libro, engranaje, puerta en rojo). Los botones del DOM
  quedan ocultos para teclado y lectores de pantalla (H, J, R, O siguen andando). La línea de
  estado pasó al borde de abajo.
- **Cartas jugadas sin quemarse:** la cara de las cartas ya no se quema con la lámpara (de ~45 % de
  píxeles quemados a ~1 %), y se leen sin zoom. `ac8e036`
- **Porotos más juntos:** caen en un círculo de media carta de ancho (antes tres cuartos). `be55c02`
- **Número pedido y papelito:** el número de tiza y los puntos usan una tipografía con el 1 con
  bandera (Old Standard TT), así el 11 ya no parece un II (también en las cartas y en el selector
  de bases). En el papelito las bases pedidas son estrellas vacías, las logradas llenas y las de
  más, llenas y rojas. `ac8e036`, `b2a5742`
- **Jugadores:** las mangas llevan el color de tu equipo visto desde tu lugar (tu equipo, verde
  azulado; estaban invertidas); el pulgar de los guantes apunta hacia adentro en las dos manos y
  está dado vuelta sobre sí mismo (la derecha tenía un pulgar izquierdo); se fue el «dientito» de las
  máscaras (era la mandíbula; ahora solo aparece en la seña de la carta porno). `be55c02`, `ac8e036`, `b2a5742`
- **Manual sobre la mesa:** el librito está apoyado en la mesa, bajo la misma lámpara; ocupa toda
  la pantalla y las pestañas son papelitos que salen de las hojas. `dd4700d`
- **34 dorsos ilustrados** (además de los 4 dibujados); el selector de Ajustes es una grilla. `f4ddbb0`
- **La mano se ve igual con cualquier campo visual** (por defecto 63°), **reordenar la mano**
  arrastrando una carta a lo largo del abanico, **cartas jugadas más al centro** y **número
  pedido más grande y visible con zoom**. `8b5950a`, `d3645de`, `3b717bd`, `68ff423`

### Menús 3D
- **Títulos quietos:** los títulos de cada fila o botón no flotan ni se mueven; los botones
  conservan su perspectiva y su vaivén. `708e437`, `8b66443`
- **Configurar y empezar:** rehecho y centrado. Poderes (los tres ases, inclinados hacia la luz) más
  arriba, con su título pegado al primer as; los tres botones de estructura son iguales y centrados;
  **kamikazes en un solo botón** (el avioncito) con su cantidad como exponente, un círculo más
  chico con la misma inclinación que da medio giro por cada cambio (0 → 1 → 2 → 3 → 0), y el reloj
  como un solo botón que cicla las opciones; kamikazes y reloj comparten fila, cada uno con su
  título debajo, centrado respecto del botón; Volver e Iniciar partida más derechos. `ac8e036`,
  `315838d`, `4f679ab`, `9c4922d`, `bb8c94f`, `3b11855`, `68f889b`, `8de64d7`, `0a9241c`
- **Armar mesa y Sentarse:** «¿Cuántos juegan?» centrado arriba de los números; Volver y Abrir la
  mesa (y Volver y Sentarse) simétricos y derechos. `4faca50`, `5feff9f`
- **Carta con el código de mesa:** papel más oscuro y letra más gruesa y oscura: se lee con la
  lámpara encima. `735a0d6`
- **Salir de la sala:** los nombres se desvanecen en una fracción de segundo y los personajes se
  hunden rápido (antes tardaban varios segundos). `ddbc375`, `4a41738`

### Ajustes
- **Carta grande del dorso:** al costado del panel, colgada bajo una lámpara que se mueve para que
  la luz la recorra desde distintos ángulos; cambia sola al elegir otro dorso. `ac8e036`
- **Anillo de señas reordenable** (flechas en Ajustes, con «restablecer») y los números del
  teclado siguen tu orden; la altura de la mano (ruedita) también se guarda. Todo queda en el
  navegador con el resto de las preferencias (cuando haya usuarios pasarán a la cuenta). `ac8e036`

### Manual de reglas
- **Entrada nueva:** se arma de antemano mientras el menú está en reposo (la sala 3D, los shaders y
  las fotos de la tapa y la primera doble página); al tocar «reglas» solo se reproduce la entrada:
  fundido, el librito baja ladeado sobre la mesa, se acomoda y la tapa se abre sola. Antes se
  trababa al abrir y mostraba la primera página en vez de la tapa. Al cerrarlo, un fundido sin
  cortes; el siguiente se prepara cuando el menú vuelve al reposo. `cda0486`, `93e47cc`, `f37e453`
- **Varias hojas a la vez:** con las flechas, los botones o clics seguidos cada hoja sale un
  instante después de la anterior y quedan varias en el aire, cada una con su forma y sus dos
  caras. Para cambiar de sentido, las que están en el aire terminan de caer primero. `383f301`
- **Manual en 3D con hojas agarrables:** la hoja se agarra y se dobla según de dónde la tomes; un
  clic la pasa sola. `98149c4`

### Antes en este tramo
- **Sonidos de los menús** propios de la sala (cadenita, silla que cruje) `6dfeaa4`, `6bf4f6c`;
  **dorsos nuevos** y **campo visual de 50° a 80°** `399787c`, `bf64246`; **bots:** la Mano pide
  kamikaze según su mano `5a71c6a`; arreglos de porotos, la sota y los nombres de la sala `8c65187`,
  `37f5d37`, `a9229cd`; los e2e corren contra un servidor (3100) y un cliente (5174) propios `c7cb215`.

### Pruebas y herramientas nuevas
- `e2e/clock.place.mjs` (ubicación del reloj con 4 y 8 jugadores), `e2e/settings.back.mjs` (Ajustes
  con la carta del dorso), `e2e/rulebook.{open,frames,longtasks,close,multi}.mjs` (apertura, cierre
  y hojas múltiples del manual) y pasos nuevos en `e2e/menu.shots.mjs` (giro del kamikaze, títulos
  centrados).

---

## Hasta `a603e36`

Cambios desde `e8ac8dc` (último push), agrupados por área. Cada punto describe **cómo funciona
ahora**; cuando algo se rehízo después, se marca con *(reemplaza a …)* y el commit nuevo.
Los hashes son los commits de `main`.

---

## Reglas del juego

- **Quien reparte rota cada ronda, en sentido antihorario; la Mano de la ronda es quien recibe la
  primera carta.** Arregló que en la última base no se pudiera aplicar el As de Oros y que la Mano
  siguiente no pudiera declarar. `422d6d3`
- **Antihorario = el turno pasa a la derecha** (desde la silla de cada jugador; visto desde arriba
  la ronda gira al revés de las agujas del reloj y parece "a la izquierda"). Corregido en
  `RULEBOOK.md`, en el manual del juego y en las pistas del As de Copas. `7d25922`
- **Empate al final:** se juegan dos rondas de desempate con el máximo de bases de la estructura
  (la Mano alterna sola entre equipos). Si siguen iguales, ganan los dos. Antes la partida se la
  llevaba "Ellos". Se anuncia, queda en el historial y el anotador marca las rondas como
  "desempate". `55d15bf`
- **Kamikazes:** se verificó que se cuentan por equipo (ya funcionaba así; quedó cubierto por un
  test). `15a0a62`

## Servidor y estabilidad

- **"Game not found or not started":** las salas se borraban a los ~10 min en plena partida porque
  nunca se registraba actividad. Ahora cada evento la registra y la limpieza no borra salas con
  jugadores conectados. `548f77b`
- **As de Copas:** después de invertir el sentido, el turno saltea a quienes ya jugaron esa base
  (antes se podía trabar la base). `02e0fa2`
- **El servidor registra quién declaró cada pedido y cada kamikaze** (para las fichas y el
  historial). `5b2e5c9`
- **La mesa 3D ya no se congela si falla un frame:** el error se reporta una vez y el render sigue.
  Se detecta la pérdida del contexto WebGL y se intenta recuperar. Los errores del cliente llegan
  al log del servidor con nombre, navegador y stack (`client:error`). `266d3a4`

## Mesa 3D — cámara y controles

- **Mirar alrededor:** apretar y arrastrar sobre la mesa (reemplaza al clic que alternaba la
  vista). `10f8630`
- **Límite de giro:** alcanza la cara de cada jugador de la mesa y frena justo ahí (4, 6 y 8
  jugadores). `b143b62` → ajustado en `2714852`
- **Arrastre contra el borde de la pantalla:** si el cursor queda pegado al borde, la vista sigue
  girando hacia ese lado (antes no se llegaba a la cara del vecino de la derecha). `2714852`
- **Zoom con clic derecho:** al soltar, la vista vuelve exactamente a donde estaba antes del zoom.
  `981bfe3`
- **Ruedita del mouse:** sube y baja tus cartas de forma continua. `cbd9d66`
- **Sorteo inicial:** se saca la carta haciendo clic en el mazo del centro, que brilla cuando te
  toca. `c0ee663`
- **Cada cabeza muestra hacia dónde apunta la cámara de ese jugador** (zoom incluido), para todos.
  `163a838`

## Mesa 3D — fichas, porotos y guías

- **Ficha "D"** de quien reparte, **ficha "pide"** de quien declara primero y **un avión de metal**
  por cada kamikaze usado. `74897a4`
- **Porotos:** cada base ganada deja un poroto en un punto al azar dentro de un círculo (menor al
  ancho de una carta) al lado del borde de arriba de la carta del que pidió; no se mueven durante
  la ronda; los de más salen rojizos. Lo pedido se escribe en tiza como un número en un círculo.
  `c798c53` *(reemplaza a la fila de círculos de `74897a4` / `5116488`)*
- **Número pedido con guías apagadas:** solo se ve al pasar el mouse por esos porotos. `583b5de`
- **Tu lugar para apoyar la carta:** recuadro punteado en tiza que se ilumina con la carta encima.
  Con las guías apagadas aparece solo en tu turno. `59fea43` *(reemplaza al brillo de `7e12a26`)*
- **Guías apagadas:** nunca se ve el recuadro de otro jugador, tampoco el ámbar del ganador de la
  base (la carta ganadora igual se eleva). `9d1e371`
- **As de Copas y As de Oros se deciden sobre la mesa:** carteles flotantes "Mantener / Invertir"
  con una flecha de tiza que muestra el sentido; para el As de Oros, un cartel sobre cada compañero
  elegible o clic directo en su cara. Siguen accesibles por teclado. `551544a`

## Mesa 3D — personajes

- **Nombres flotando a la altura de la panza**, mirando a tu cámara, en colores de equipo (tu
  equipo / rivales). `2aba3dd`; un poco más bajos (0,84 m) `3fc1474`
- **Postura:** todos se sientan igual que vos: abanico en la mano izquierda al costado, mano
  derecha apoyada en la mesa. Las cartas ajenas muestran el dorso de los dos lados y el cliente
  nunca recibe su identidad. `ce57742`

## Señas

- **Las señas** (en la máscara): as de espadas = cejas; ancho de bastos = guiño derecho; as de
  copas / oros = labios a la derecha / izquierda; figuras (10, 11, 12) = boca estirada; tres =
  morder el labio; dos = beso; 4–7 = boca de pescado; nada = cerrar los ojos; **sí / no** = asentir
  / negar con la cabeza. `6b3b026`, `316b390`, `371d2cf`
- **"Nada"** = una mano sin 10, 11, 12, ancho de bastos ni ases con poder. `fc58eeb`
- **Menú radial:** clic del medio (o G), 11 caras; 1–9 para las de cartas, S / N para sí / no.
  `f5a16c5`
- **Tu propia seña** se ve animada donde estaba el menú radial (no ves tu cara). `fece841`
- **La seña sale hacia donde apunta tu cámara:** la máscara gira hacia ahí al hacerla. `3c3589f`
- **Pedir señas:** golpecitos en la mesa (P, centro del menú radial o botón del panel de
  declarar); todos lo ven y lo oyen. `0ca533f`
- **Quién ve una seña lo decide el servidor:** tu equipo siempre; un rival solo si su cámara está
  sobre la cara del que la hace (al menos 0,15 s) y ese jugador no está prácticamente de espaldas.
  Si nadie la ve, no le llega nada por la red. La geometría de la mesa vive en `@la-base/shared`.
  `34522a8` *(reemplaza al filtro en el cliente de `6f35aba`, con su regla de ~53°)*
- **Punto de mira** en el centro de la pantalla, que se abre en un aro sobre una cara legible.
  `6f35aba`
- **Nadie hace señas, pide ni declara antes de que termine la animación del reparto.** `3ba1c1a`

## Bots

- **Hacen e interpretan señas;** al hacerlas giran la cabeza hacia su compañero. `b0f4b4f`
- **No están obligados a hacer señas:** al repartir las hacen el 75% de las veces; contestan un
  pedido el 80%. Cuando un rival pide señas, miran la cara de quien tiene que contestar, y lo que
  ven cambia cuánto piden. `581d314`
- **A veces contestan corto:** "sí" (solo si su mano puede hacer una base) o "no". `f2232df`
- **Después de pedir señas esperan la respuesta** (hasta 20 s) antes de declarar; un "sí" del
  compañero cuenta como al menos una base. `d85f64e`
- **Planifican para el equipo:** guardan solo las cartas fuertes que el equipo todavía necesita
  (descontando la base que el compañero ya gana y lo que se espera de él) y largan el resto cuanto
  antes. `122fa91` → `cbf437a`
- **Si la base ya es de su equipo,** tiran la carta sobrante más alta aunque pase al compañero.
  `6ff7100`
- **Hacen perder al rival:** si uno va ganando con una carta menor que un 7, muchas veces (75%) se
  la dejan pasar, siempre que no perjudique al propio equipo. `323cf7d`

## HUD y paneles

- **Historial de la partida** (oculto; pestaña "historial" o tecla J). `61ac7ce`
- **Panel de partida terminada** en papel, desde tu lado ("Ganó tu equipo" / "Ganaron los
  rivales"), con el motivo traducido. `87828bd`
- **Lista de la sala** como anotador de papel; textos del HUD más grandes. `cc76098`
- Arreglo de keys duplicadas en el anuncio de kamikaze. `0667893`

## Menús 3D

- **Configuración de la partida:** cada fila con su título a la izquierda (poderes, estructura,
  kamikazes; "jugadores" al armar la mesa), sin superposiciones. `2889194` → `e98e458`
- **Kamikazes:** tres aviones tipo puntuación por estrellas (clic en el último encendido baja
  uno); avión sin hélice girado 45°; los apagados oscuros y tachados con una cruz roja. `59633c1`,
  `e98e458`, `9b432d1`, `746b426`
- **Cartas de poderes:** flotan como el resto de los botones y giran en horizontal (dorso = poder
  apagado). `9bbe3cc`
- **Nombres flotando sobre los personajes** en la sala y la configuración; nada escrito en el
  paño; guías según tu ajuste. `5c4f875`
- **Sombras:** cada botón proyecta una sombra real con su forma (disco o rectángulo). `7b4cc78` →
  `d7aae9d`

## Ajustes

Sonido | Mesa | Cámara (`0443d38`, reordenado en `e16b87e`):
- volver la vista a tu lugar `bd7710f` · invertir cámara `4baa90b` · sensibilidad del mouse
  0.25×–3× `e16b87e` · punto de mira `8c780a4` · mano a la vista al empezar tu turno `ef5e487` ·
  guías en la mesa `e074428`

## Manual de reglas

- **Manual ilustrado dentro del juego** ("Reglamento" en el menú, o R / pestaña "reglas" en la
  mesa): 12 capítulos, pasos numerados, ejemplos, humor y la grilla de caras de las señas.
  `1f9a501`
- **Como un librito (estilo Tunic):** tapa que se abre, hojas que giran en 3D sobre el lomo, papel
  punteado con manchas de café, dibujos con trazo de tinta que "hierve" y notas de birome en los
  márgenes; fondo desenfocado con líneas de barrido. `3234ab1`

## Audio y aspecto

- **El sonido arranca con la app** (con la primera tecla o clic en cualquier lado, por la regla de
  los navegadores); botón "activar sonido" si entrás directo a una partida. `822ed37`
- **Sombras suaves** de la lámpara, en la mesa y en los menús. `380d3a4`

## Build y deploy

- **El build del cliente compila antes `@la-base/shared`.** El cliente ahora usa valores del paquete
  compartido (señas, geometría de la mesa), no solo tipos, y en Vercel no existía su `dist`.

## Tests y herramientas

- `packages/server/e2e/rules.e2e.mjs`: reglas (kamikaze, As de Copas, As de Oros, reparto, salas,
  señas, pedir señas, empate, bots). Correr con
  `LABASE_TEST=1 LABASE_ROOM_TTL_MS=1500 LABASE_CLEANUP_MS=300` en el servidor.
- Tests unitarios: `packages/shared` (señas, geometría) y `packages/server` (bots, reparto de
  señas).
- e2e del cliente (`packages/client/e2e/`): mesa completa, límites de giro, cabezas, zoom,
  señas, menú radial, decisiones sobre la mesa, guías, porotos, sorteo, audio, manual.

## Documentación

- Ideas a futuro anotadas en `docs/V2_PLAN.md`: juegos como módulos (Steam Workshop), micrófono que
  anima la máscara, chat de voz de mesa y de equipo. `86664d5`, `484c7a9`
