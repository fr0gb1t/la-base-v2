# Registro de cambios — La Base v2

## Desde `a603e36`

Todo lo hecho después de `a603e36` (la sección de abajo cubre lo anterior), agrupado por área. Lo
más reciente (después del último push a `main`, `1265ce2`) va primero.

### Lo último (desde `02045de`)
- **Tormenta: lluvia, truenos y el refucilo por la ventanita:** `table3d/storm.ts` lleva el reloj de los rayos (cada
  22 a 67 s, cerca o lejos, con dos a cuatro destellos). `buildWindow` (`table.ts`) pone una ventanita con barrotes
  en una pared de ladrillo, arriba, del otro lado de la mesa (en la mesa y en el menú): de noche un vidrio azul
  apenas visible; con el refucilo, el vidrio blanco, la pared iluminada, una luz fría que entra por la ventana y las
  sombras de los barrotes cruzando la mesa (su mapa de sombras se dibuja solo mientras destella). En `audio.ts`:
  lluvia amortiguada con un ir y venir lento y el golpeteo de gotas grandes, goteras sueltas con eco, y el trueno
  (más tarde y más apagado cuanto más lejos; si cae cerca, primero el estallido), todo en el bus de «Sonido
  ambiente», que ahora viene prendido. La música pasa a ser **un tema fijo para tararear** (forma A A B A, 32
  compases, re menor, 104 bpm): un gancho en el 3-3-2, su respuesta, una parte B en fa mayor y la vuelta; el
  contrabajo con su propio riff que camina al acorde siguiente y el bandoneón con acordes cortos. Notas cortas.
- **Música: una milonga en la radio del sótano** (`table3d/music.ts`), hecha en el momento con Web Audio, sin
  grabaciones: bandoneón (dos lengüetas por nota, en octava y un poco desafinadas, con el fuelle que respira),
  contrabajo en pizzicato sobre el 3-3-2 de la milonga, frases de melodía en re menor armónico y silencios; frases de
  ocho compases elegidas al azar (re menor, a 72 bpm), con marcato, legato o el bajo solo. Todo pasa por «la radio»:
  banda angosta, saturación de válvula, crujido de disco y una leve desafinación de cinta. Ajuste nuevo `music`
  (prendido por defecto), en su propio bus; el zumbido de la lámpara se fue y «Sonido ambiente» queda para su
  chisporroteo. `renderMusic(segundos)` la graba offline para escucharla fuera del juego.
- **El As de espadas que mata al Ancho gana la base:** `resolveBase` (`shared/card.ts`) comparaba de a pares la carta
  que iba ganando con la siguiente; el As de espadas le ganaba al Ancho, pero después volvía a pesar como un as
  común y cualquier carta leída después (un 5) le ganaba. Ahora, leído después de un Ancho, el As lo mata y queda
  como la carta más fuerte de la base (por encima del Ancho); leído antes, sigue siendo un as. Vale para quién gana
  en el servidor, la carta que flota como «la que va ganando» y las decisiones de los bots. Tests en `card.test.ts`.
- **Caras de repuesto que no se repiten, y manos sin tamborileo:** si la cara de un jugador no llega a la pantalla (un
  servidor viejo, por ejemplo), la mesa y la sala le ponían una de repuesto por asiento que se repetía (los asientos
  1 y 2 salían los dos con Purga). Ahora `table3d/tableFaces.ts` (`tableFaces`) le da a cada uno que falte una cara
  que nadie más en la mesa tiene, la misma en todas las pantallas. La mano abierta ya no tamborilea sobre el paño
  mientras espera (`handIdle`): distraía.
- **Nunca dos caras iguales en una mesa:** el avatar lleva ahora una variante de color opcional
  (`AvatarSpec.tint`, `TINT_COUNT = 6`, `avatarKey`, `freeTint`, `freeAvatar`, `untangleAvatars` en
  `shared/avatar.ts`). En el servidor (`server/src/avatarClash.ts`): un bot toma una cara que nadie usa y, si una
  persona elige la suya, se corre a otra; dos personas que llegan con la misma ven en la sala un aviso
  («Ana eligió tu misma cara… alguno tiene que cambiarla») con «Cambiar la mía» (abre Ajustes) y «Me la quedo»
  (`avatar:keep`). Cuando todos los que la tienen se la quedan, la usa quien llegó primero y el resto la lleva en
  otro color; al empezar la partida se resuelve igual lo que quede (`settleAll`). Cambiar de cara en Ajustes
  mientras esperás en una sala la manda al servidor (`avatar:set`), que rechaza una cara que ya tiene otra
  persona; los selectores la muestran como «— la tiene Ana» y no la ofrecen, y «Al azar» la evita. Las variantes
  (`table3d/faces/tint.ts`) giran los tonos de la cara; en las máscaras LED las luces blancas toman el color de
  la variante.
- **Resplandor de las luces (bloom), ajustable:** Ajustes → Mesa tiene un control de 0 a 200 %
  (`ViewSettings.bloom`, multiplica `uBloom` en `post.ts`; vale para la mesa, el menú y el manual).
- **Máscaras LED que brillan como LEDs:** cada LED encendido brilla muy por encima de la lámpara (`LED_GLOW`),
  así el bloom lo agarra, con un halo de difusor alrededor de cada punto; y cada máscara tiene una luz puntual
  del color promedio de su cara (`spill`) que ilumina su borde, sus manos y el paño cercano. La vista previa de
  Ajustes, sin bloom, usa un brillo menor para que los colores no se quemen a blanco.
- **Menús sobre la pantalla:** Ajustes, Novedades, el anotador, el manual y los diálogos oscurecen y desenfocan
  lo que queda detrás, y la escena 3D deja de responder al cursor mientras están abiertos (`lib/overlay.ts`:
  `useOverlay`, `overlayOpen`).
- **Caras y dorsos en pantalla entera, para el celular:** en Ajustes → Avatar y → Cartas hay un botón «Ver en
  pantalla entera» (solo en pantallas de hasta 1180 px, donde el escenario no entra al costado del panel) que
  abre `settings/FullPicker.tsx`: el mismo escenario de la computadora (`AvatarStage` o `BackStage`) ocupando la
  pantalla, con la luz cenital; se pasa de uno a otro deslizando a los costados (o ‹ ›, o las flechas del
  teclado), se elige de la lista desplegable (las caras agrupadas en máscaras y cabezas) y «Listo» cierra.
  Cada paso queda elegido al instante. En pantallas angostas los dos escenarios alejan la cámara para que la
  cara, las manos y la carta entren enteras.
- **Manos que se pierden en la oscuridad, y en movimiento:** la mano ya no termina en un muñón redondo con un aro
  (se veía cortada). Como en Buckshot Roulette (sin manga ni puño), sus colores se oscurecen del dorso al final de
  la muñeca hasta casi negro (`fadeWrist`, `makeHand` en `table3d/faces/index.ts`), y en la penumbra la mano
  parece salir de la nada. Los guantes de las máscaras LED pasan de casi negros a gris goma, para que se vean
  (la muñeca igual se funde con el fondo). Las manos ya no llevan el color del equipo. En la vista previa de Ajustes las manos
  estaban cambiadas de lado (los pulgares quedaban hacia afuera): ahora cada una está en su lado, pulgar adentro. Y se mueven solas mientras esperan, en stop-motion
  (`handIdle`): respiran, se balancean, y la mano abierta tamborilea dos veces sobre el paño cada tanto; la que
  sostiene el abanico apenas se inclina. En la mesa, una mano que está jugando queda quieta. Igual en la vista
  previa de Ajustes.
- **Caras flotantes, sin cuerpo (como en Buckshot Roulette):** en la mesa ya no hay capucha, abrigo ni brazos:
  una cara flota donde iría la cabeza y dos manos esculpidas flotan donde irían las muñecas (los brazos se
  siguen resolviendo con IK, sin dibujarse, solo para orientar cada mano).
  El avatar es ahora **una cara elegida entre 36** (`shared/avatar.ts`: `AvatarSpec = { face }`, `FACES`,
  `faceKind`; una cara vieja de ojos/boca/cejas se rechaza y se sortea una nueva):
  - **30 máscaras de LEDs** (`table3d/faces/ledMask.ts`): la forma copiada de las máscaras LED reales
    (escudo curvo como un visor, borde negro grueso, solapas para la tira) con una matriz de 32 × 40 LEDs en un
    `ShaderMaterial` (un punto por celda que se funde con su color promedio cuando la máscara queda lejos, para
    que no haga moiré); cada cara se dibuja por cuadro en `faces/ledFaces.ts` a partir del estado de la seña,
    y 12 están basadas en las caras que traen las máscaras en su app (Shining Mask).
  - **6 cabezas esculpidas** (`faces/heads.ts`, `faces/headMask.ts`): caballo, gallo, carnero, diablo,
    ventrílocuo y santo, modeladas con campos de distancia (`faces/sculpt.ts`) en un worker
    (`faces/sculptWorker.ts`, caché por página en `faces/sculpted.ts`). Las señas mueven piezas: cejas,
    párpados sobre ojos brillantes, labios y dientes, el pico del gallo en dos mitades, y gestos esculpidos de
    la boca del diablo (blend shapes: la malla en reposo llevada sobre cada gesto; los colores van en RGBA
    porque three r186 no compila la mezcla de colores con RGB).
  La mesa ya no tiene sillas; las caras flotan un poco más grandes y más bajas que una cabeza sentada.
  Ajustes → Avatar (`settings/AvatarPicker`, `AvatarStage`): una fila «Cara ‹ lista ›» (la lista agrupada en
  máscaras y cabezas) y la descripción con «Al azar»; la cara elegida flota a un costado, bajo una luz cenital,
  con sus manos, y hace señas al azar. Se guarda por navegador
  (`laBase.avatar`); el servidor valida la cara al crear o entrar a una sala y les sortea una a los bots.
- **Ases de la configuración con bordes suaves:** una franja negra los cruzaba por el medio. La pasada nítida
  dibuja primero el resto de la escena solo en profundidad, con un material de reemplazo, y las huellas
  invisibles que proyectan la sombra de lo que flota (sin color ni profundidad) se volvían opacas: la de cada
  as lo cortaba. Ahora quedan afuera de esa pasada (`post.ts`).
- **Laboratorio de señas (solo desarrollo):** `senas-lab.html` (con el servidor de desarrollo, en
  `http://localhost:5173/senas-lab.html`) abre la mesa real sin servidor ni partida, con todos haciendo señas
  todo el tiempo. Los compañeros siempre se leen; un rival solo cuando la regla de lectura dice que lo estás
  mirando (la misma de `shared/tableGeometry.ts`, con el tiempo de permanencia y el «captar a mitad de seña» del
  servidor). El panel permite cambiar la cantidad de jugadores, el radio de la zona, el tiempo apuntando, la
  lectura exclusiva, la frecuencia de las señas y mostrar las zonas dibujadas en la mesa, y cuenta por asiento
  cuántas señas te llegaron. `AimOptions` (radio y exclusividad) es opcional en `seesFace` / `seatUnderAim`:
  el juego usa los valores por defecto. `e2e/senas.lab.mjs` comprueba la regla.
- **Señas de los rivales: alcanza con apuntar a su lugar, no a la cara exacta:** la zona de lectura ya no es
  un círculo de 14 cm sobre la cabeza sino el tramo desde la cabeza hasta el lugar del jugador en la mesa, a
  34 cm (`SEAT_AIM_RADIUS`, `aimAtSeat` y `seatUnderAim` en `shared/tableGeometry.ts`; una regla única para
  servidor y cliente). Se lee un solo asiento a la vez, el más centrado, así que apuntar entre dos vecinos
  nunca lee a los dos. Al entrar en la zona el punto de mira se agranda (de 16 a 38 px, con un halo). Sigue
  sin leerse una cara girada casi de espaldas. `senas.visibility.mjs` comprueba también apuntar al costado.
- **Novedades al día:** entrada nueva «Ajustes de fábrica renovados» (valores por defecto y carta Brújula), el
  aviso de seña vista aclara que viene encendido en PC, y la de televisores menciona la mesita que esquiva las
  sillas.
- **La mesita de los televisores ya no cruza las sillas en el trayecto:** al cambiar la cantidad de jugadores
  las sillas aparecen de golpe y la mesita se deslizaba en línea recta hasta su lugar nuevo, atravesando
  alguna (llegaba a 10 cm de una). Ahora cualquier silla que toque la empuja hacia afuera, con un empujón
  suave (`placeTvTable` en `MenuScene.ts`): en una simulación de cambios 4↔6↔8 nunca baja de 50 cm de una silla.
- **Ajustes por defecto nuevos (para quien empieza de cero):** en la PC, sonido ambiente **no** y sonidos
  del juego **sí**; mano a la vista en tu turno **no**; guías en la mesa **no**; volver a tu lugar **no**;
  invertir cámara **no**; punto de mira **sí**; aviso de seña vista **sí**; bordes suaves **sí** (no en
  equipos modestos). El celular conserva los suyos (volver a tu lugar sí, sin aviso de seña vista, con el
  sonido ambiente). La carta por defecto es la **Brújula**, en PC y celular. Quien ya tiene ajustes
  guardados conserva los que tiene (salvo bordes suaves, que sigue al equipo si nunca lo eligió).
- **«Bordes suaves» viene encendido salvo en equipos modestos:** el valor automático es «sí» salvo en
  pantallas táctiles, 4 núcleos o menos, 4 GB de memoria o menos (`deviceMemory`, solo Chromium), ahorro de
  datos o WebGL por software (SwiftShader, llvmpipe…): `judgeLowEnd` / `isLowEnd` en `lib/device.ts`.
  Quien lo eligió a mano (`smoothChosen`) conserva su elección; el resto sigue al dispositivo, incluso
  quienes ya tenían ajustes guardados con el valor viejo.
- **«Bordes suaves» ahora también para todas las cartas y botones (prueba):** además de los televisores,
  el anotador y el reloj, la capa suave (full resolución + MSAA 4x) cubre todas las cartas (mazo, mano,
  jugadas, pilas, las de los demás), las manos/guantes, los nombres, los carteles de decisión y, en los
  menús, las cartas de opciones, los ases, los botones flotantes, la carta del nombre y los kamikazes. Con
  la opción apagada se ve igual que antes. Marcado por `toProps()` (`table3d/propsLayer.ts`; `makeCard`
  ya lo hace) y `PropColors` apaga/devuelve el color de todo lo marcado en el pase pixelado, salvo los
  materiales que ya eran solo-sombra. Rama `feat/aliasing-cartas-botones`.
- **La mesita de los televisores esquiva las sillas en «Armar mesa»:** al elegir 6 u 8 jugadores las sillas
  caían sobre la mesita. Ahora (`tvSpot` en `MenuScene.ts`) se tienen en cuenta las 8 sillas (las ocupadas en la
  mesa y las vacías empujadas atrás) y la mesita se desliza al lugar más cercano a su sitio que las libra y
  se ve de lleno desde la cámara de esa pantalla, sin irse tras el borde de la mesa. Igual en la sala y la
  configuración.
- **Televisores del menú en todas las pantallas, juntos y con bordes suaves:** Novedades y Ajustes
  están desde el ingreso en adelante (antes solo en el inicio), uno al lado del otro sobre una sola
  mesita a la derecha, donde la ven las cámaras de todas las pantallas. «Bordes suaves» (anti-aliasing)
  ahora también los afecta: van en su propia capa (`PROPS_LAYER`) como los de la partida. Se montan en
  `App.tsx`, no en el Lobby.
  En la sala y la configuración (donde hay gente sentada) la mesita se desliza al hueco más ancho entre
  dos jugadores, bien atrás de las sillas, para que ningún personaje la atraviese (`tvSpot` en `MenuScene.ts`);
  que un jugador la tape a medias no importa.
- **Novedades completas desde el 30/9:** la lista para jugadores (`client/src/changelog/entries.ts`) ahora
  cubre todo lo de este registro, agrupado por día real de cada commit (30/9, 2/10, 3/10, 4/10), en
  lenguaje de jugador. Un test cuida ids únicos y orden por fecha.
  Si hay más para leer abajo se muestra una flechita que respira (se oculta al llegar al final) y
  cada día arranca desde arriba.
- **Novedades y televisores en el inicio:** la pantalla de inicio del menú tiene dos televisores sobre
  mesitas, uno a cada lado (Novedades a la izquierda, Ajustes a la derecha), con el mismo `HudBoard` de
  la mesa en un modo «apoyado» (sin cables ni panel LED). El de Novedades se pone ámbar, pulsa y dice
  «NUEVO» mientras haya entradas sin ver; al abrir la hoja de novedades (lista corta para jugadores, en
  `client/src/changelog/`) se calma. Reemplaza al botón «Ajustes» de la esquina en esa pantalla. Se
  agregó `vitest` al cliente (`pnpm test`).
- **Novedades por fecha:** la hoja de novedades muestra un día a la vez (el más nuevo primero) con
  «‹ Antes» / «Después ›» (o las flechas ← →) para revisar los cambios de fechas anteriores. Las
  entradas se agrupan con `groupByDate` en `client/src/changelog/novedades.ts`. La hoja tiene siempre
  el mismo tamaño; si el contenido no entra, la lista de entradas hace scroll por dentro.
- **Ajustes solo por el televisor:** se quitó el botón «ajustes» suelto de la esquina en todas las
  pantallas del menú (también en celular); se abre desde el televisor del inicio, con la tecla `O` o desde
  el de la sala. Los televisores de las mesitas son bastante más chicos (`SIDE_TV_SCALE` en `MenuScene.ts`).
- **Quién gana la base, corregido:** al invertirse el sentido con el As de Copas, el servidor leía las
  cartas al revés y **se saltaba la última carta jugada** (un 3 le ganaba a un 5 jugado después). Ahora
  las cartas se leen siempre desde el Mano, silla por silla, en el sentido vigente al cerrarse la base;
  esa lectura decide los empates (gana el primero leído) y el «después» del As de Espadas. Ej.: Jorgito
  (Mano) 5, Álvaro Rey, Pepe Rey, Franco As de Copas e invierte → se lee Jorgito, Franco, Pepe, Álvaro:
  gana Pepe. Rige en el servidor, los bots y la carta que flota en el cliente; el manual (`RULEBOOK.md`)
  lo explica con ese ejemplo. `9a0027f`
- **Los bots piden señas solo si les sirve:** antes de pedir, el bot compara su pedido con un compañero
  que no vale nada contra uno que tiene todas las bases; si da lo mismo (un Rey siendo Mano en la ronda
  de una carta), no golpea la mesa. Tampoco cuando tiene un único pedido legal. `5fc91c7`
- **Los bots calculan por asiento en la ronda de una carta:** la chance de ganar es exacta según la
  posición (el Mano solo teme al Ancho de Bastos: ≈ 92 % con un Rey; el último asiento también pierde
  los empates: ≈ 72 %). Con más bases sigue la tabla por rango, porque el asiento cambia en cada base. `5fc91c7`
- **Las señas de los bots, más humanas:** el bot mira a su compañero, espera 3 segundos y recién ahí
  golpea la mesa (sigue mirándolo mientras espera). Después de una seña espera a que el compañero esté
  4 segundos en silencio (20 como máximo) antes de pedir, así da tiempo a hacer más. Cuando le llega una
  seña mira al compañero un instante, como acuse de recibo. Si el compañero le dijo «no» y todavía no
  había mostrado su mano, después de pedir le explica con señas por qué. `5fc91c7`
- **Aviso de seña vista (opcional):** tu seña destella en rojo en tu pantalla cuando un rival, bot o
  persona, la capta; sin destello, nadie la vio. No dice cuál rival, y con un compañero nunca avisa
  (los compañeros siempre la reciben). Ajustes → Mesa → «Aviso de seña vista», apagado por defecto y
  por jugador. `bafe5ca`

### Lo anterior (desde `1265ce2`)
- **Bordes suaves en los televisores, el anotador y el reloj:** esos objetos se dibujan aparte, a
  pantalla completa y con anti-aliasing (MSAA 4x), sobre el mundo pixelado: el texto del reloj, de
  los LED y del anotador queda nítido y sin escalones, y el resto de la mesa conserva su estética
  (posterizado, tramado, dado en bajos). Siguen tapados por lo que tengan delante, proyectan sombras
  y se pueden tocar. Es opcional: Ajustes → Mesa → «Bordes suaves (anti-aliasing)», apagado por defecto.
- **Reparto boca abajo y reloj:** las cartas se reparten todas boca abajo sobre la mesa, en una fila
  frente a cada jugador; con todas puestas hay un respiro y todos las levantan a la vez. El reloj de
  pedidos arranca **un segundo después** de que todos tienen sus cartas en la mano (antes empezaba
  antes de terminar el reparto). Los bots esperan a tener las cartas antes de hacer señas o pedir. `fb7a6f6`
- **La carta que va ganando flota en vivo:** durante la base, la que gana hasta el momento se levanta
  y su recuadro brilla ámbar; el efecto pasa de carta en carta a medida que se juegan mejores. Al
  terminar la base la ganadora sigue flotando hasta que todos confirman. `cc33488`
- **Prioridad de dibujo explícita (adiós glitch de superposición):** las cartas que quedan sobre la
  mesa (jugadas, del sorteo, repartidas y pilas de bases ganadas) se dibujan en el orden en que se
  apoyaron (la primera abajo, cada nueva sobre todas las anteriores) desde cualquier ángulo, y las
  manos tienen la prioridad máxima: siempre se ven sobre las cartas. La mano descansa pegada a la
  mesa. Los nombres de los jugadores siguen por encima de todo. `af08e31`, `3b2b1c0`

### Reglas, bots y pedidos
- **Regla corregida del Pie:** lo que pide el Pie, sumado a lo de la Mano, tiene que dar **una base
  menos o una más** que las de la ronda (5 bases y la Mano pide 3: el Pie solo puede pedir 1 o 3; 5 y
  pide 2: 2 o 4; 3 y pide 3: solo 1). Rige en el servidor, el panel, los bots, el manual y
  `RULEBOOK.md`. La regla anterior quedó como **«Pedido del Pie: Amplia»**, un botón nuevo en
  Configurar y empezar. `bfcaff9`
- **Respuesta forzada automática:** cuando al Pie le queda una sola opción legal, el pedido se
  declara solo (un instante después del aviso del rival) y no aparece el panel. `1265ce2`
- **Seña «no» = «por mí no pidas nada»** (antes «no te paso información»): cartas bajas, o alguna
  alta que se puede descartar porque el otro equipo ya pidió varias bases. Los bots la dicen cuando
  su mano es floja o los rivales ya pidieron el 60 % o más (nunca con una mano que seguro hace una:
  ahí dicen «sí»), y cuentan con cero bases de un compañero que hace «no». `c7c49e9`
- **Bots sin esperas inútiles:** no tocan la mesa ni esperan señas si solo les queda una opción
  legal o si sus cartas solas alcanzan para todas las bases. `04616c0`
- **Aviso de cada pedido como título:** cartel grande (hasta 124 px) sobre una banda oscura, que cae
  con rebote, con brillo rojo si pide el rival y celeste si pide tu equipo, destello de color de
  toda la pantalla (blanco y negro en un kamikaze), golpe de mesa y un sonido propio (golpe grave
  y campana); el cambio de sentido suena igual. `85a4425`

### Anotador (objeto de la mesa)
- **Siempre en vivo:** un anotador de espiral con lápiz, apoyado en diagonal a los porotos, muestra
  sin hacerle clic el marcador reducido (ronda, base, sentido; por equipo: puntos grandes, lo que
  pidió, lo que lleva y estrellas), en letra manuscrita oscura y fina que la lámpara no quema; el
  cero se marca con un guión «–». Con el zoom del clic derecho se lee perfecto. Un clic (o H) abre la
  hoja completa flotante, instantánea (sin animación de escritura), con versión **reducida** y
  **completa**.
- **Resúmenes en el anotador:** al terminar cada base y cada ronda la cámara se queda en tu asiento
  y apunta al anotador (con el zoom del clic derecho, después de que la última carta se apoyó), y la
  hoja muestra, escrita a mano, lo mismo que las ventanas viejas (más los puntos totales hasta el
  momento). Se confirma con un **tilde** gris clarito en la esquina de la hoja que el lápiz escribe
  en verde en 0,15 s; Enter también confirma.
- **Navegable:** cada resumen tildado queda como una hoja del anotador; se hojea arrastrando (mouse o
  dedo) hacia arriba, dando vuelta la hoja por el anillado con la física de las hojas del manual;
  las hojas dadas vuelta quedan apiladas detrás y se agarran desde cualquier punto para traerlas.
- **Detalles:** el anotador no se levanta al pasar el mouse (solo sube un poco el lápiz) y no
  tiembla en el borde; lápiz casi paralelo y flotando a la derecha, con la punta bien armada;
  tilde más chico y bajo. `ca42767` y anteriores

### Panel de segmentos y televisores (los botones de la partida)
- **Televisores CRT:** historial, reglas, ajustes y salir son cuatro televisores de tubo colgados al
  fondo (carcasa gris/negra casi cuadrada de esquinas redondeadas, tubo hundido tras un bisel y
  aro cromado, vidrio abombado con distorsión de barril, cuerpo trasero escalonado con ventilación,
  tira de controles a la derecha), con el ícono en fósforo verde (salir, en ámbar) sobre ruido de
  estática, líneas de barrido y titileo; al pasar el mouse el nombre se escribe grande en la
  pantalla. Cada uno tiene su propio desgaste, al azar y distinto en cada partida. Se balancean
  apenas sobre sus cables. Reemplazan a la pizarra de tiza. `78b899a`…`a1b08c2`
- **Panel de LED verde de segmentos** al lado: dice solo lo relevante («Tu turno», «Turno de Ana»,
  «Rival pide 2», «Tu equipo pide 2», «Sacá una carta», «Elegí quién abre», «Marcá el tilde»), casi
  al instante, y destella en pulsos cuando pide el rival. Ya no repite animaciones ni ayudas. `01adaf1`
- Ninguno tapa a un jugador con 4, 6 u 8.

### Mesa de juego
- **Cartas jugadas sin quemarse** (de ~45 % de píxeles quemados a ~1 %); dorso del mazo central
  menos brillante; porotos un 47 % más grandes; tipografía con el 1 con bandera (Old Standard TT)
  en cartas, número de tiza, puntos y selector de bases. `ac8e036`, `b2a5742`, `3b4aa16`
- **Jugadores:** mangas con el color de tu equipo visto desde tu lugar (estaban invertidas); pulgares
  hacia adentro y bien orientados en las dos manos; se fue el «dientito» de las máscaras. `be55c02`
- **Reloj de ajedrez de torneo** (1, 2 o 5 min por equipo; 1 min por defecto): caja de nogal, tapa
  basculante, pantalla LCD, apoyado a tu derecha y fuera del paso de cartas y porotos. `025d9f5`, `25d49ce`
- **Manual sobre la mesa**, **34 dorsos ilustrados**, **reordenar la mano**, **campo visual
  consistente (63 %)**, **cartas jugadas más al centro**. `dd4700d`, `f4ddbb0`, `d3645de`, `3b717bd`

### Menús 3D
- **Configurar y empezar** rehecho y centrado: poderes (ases inclinados hacia la luz) más arriba,
  estructura en tres botones iguales, **kamikazes en un solo botón** con su cantidad como exponente
  que da medio giro por cambio, reloj en un botón que cicla, «Pedido del Pie» (Estricta/Amplia);
  títulos quietos (los botones conservan su perspectiva); Volver/Iniciar derechos y simétricos. `ac8e036`…`bfcaff9`
- **Armar mesa / Sentarse:** «¿Cuántos juegan?» centrado, botones simétricos; carta del código de
  mesa legible con la lámpara encima; al salir de la sala los nombres y los personajes desaparecen
  rápido. `4faca50`, `735a0d6`, `ddbc375`, `4a41738`

### Ajustes
- **Carta grande del dorso** bajo una lámpara que se mueve; **anillo de señas reordenable** (con
  «restablecer»); altura de la mano y orden de señas guardados en el navegador. `ac8e036`

### Manual de reglas
- **Entrada nueva y sin tirones:** se arma de antemano mientras el menú descansa; al abrirlo el librito
  baja ladeado sobre la mesa, se acomoda y la tapa se abre sola; cierre sin cortes; **varias hojas a
  la vez** al pasar rápido; hojas agarrables. `cda0486`…`383f301`

### Celulares y tablets (solo con pantalla táctil; el escritorio no cambia)
- **Sin grano de película en el celular:** el efecto de estática sobre toda la pantalla se quita en pantallas táctiles (en la PC se mantiene). También: los números de los botones redondos se centran por su tinta.
- **Rama `mobile`: controles apuntando con la mira.** Un tap en cualquier lado que no sea una carta
  o un botón es un clic donde está la mira (el centro de la pantalla, que se mueve con el
  giroscopio): apuntás al anotador y tocás donde sea para abrirlo. **Doble tap = zoom** en la mira
  (otro doble tap lo desactiva), y con el zoom activo el giroscopio sigue moviendo lo que mirás. El
  zoom de tres dedos se sacó. El botón de señas (ahora arriba a la derecha) abre el anillo con un
  tap y lo cierra con un segundo tap. Los botones 3D (televisores, reloj, mazo, tilde) tienen
  prioridad: si el dedo cae sobre uno, el tap es para él y no para la mira. Valores por defecto en
  el celular: mano a la vista en tu turno **no**, guías **no**, giroscopio **sí**, volver a tu lugar
  **sí**, invertir cámara **no**, punto de mira **sí**.
- **Giroscopio** (se apaga en Ajustes → Cámara), **un dedo = clic izquierdo** (toque, mantener y
  arrastrar), **dos dedos arriba/abajo = subir/bajar las cartas**, **tres dedos = zoom**; menús y
  paneles adaptados a pantallas bajas y verticales; botón «señas»; el teclado se abre al tocar la
  carta del nombre. `c8b790d`, `e7d265a`

### Pruebas y herramientas nuevas
- `e2e/clock.place.mjs`, `e2e/settings.back.mjs`, `e2e/rulebook.{open,frames,longtasks,close,multi}.mjs`,
  `e2e/mobile.{shots,game}.mjs`, `e2e/anotador.shots.mjs`, `e2e/{round,base}.report.mjs`,
  `e2e/{deal,leader,pie.auto,pile.hand,bid.announce}.mjs`; pasos nuevos en `e2e/menu.shots.mjs`.

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
