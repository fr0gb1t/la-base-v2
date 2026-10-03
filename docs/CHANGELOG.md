# Registro de cambios — La Base v2

## Desde `a603e36`

- **La mano tapa las pilas de bases ganadas (sin glitch):** la mano derecha en reposo atravesaba
  las cartas de la pila (los dedos quedaban ~1,3 cm por debajo del tope), y según el ángulo de la
  cámara se veía la mano o la carta. Ahora la mano descansa unos 2 cm más alto y pasa por encima de
  la pila (8 mm de margen sobre el tope), así que siempre la tapa a ella y no al revés.
- **La carta que va ganando flota en vivo:** durante la base, la carta que gana hasta el momento
  flota (se levanta y su recuadro brilla ámbar) y el efecto pasa de carta en carta: cada vez que se
  juega una mejor, la anterior se asienta suavemente y la nueva se levanta. Al terminar la base, la
  ganadora sigue flotando hasta que todos confirman, como antes. Sirve para ver de un vistazo quién
  va ganando.
- **El reparto y el reloj:** las cartas se reparten todas boca abajo sobre la mesa, en una fila
  frente a cada jugador; cuando ya están todas, hay un respiro y todos las levantan a la vez. Recién
  **un segundo después** de eso arranca el reloj de pedidos (antes empezaba antes de que terminara
  el reparto). Los bots también esperan a que todos tengan sus cartas en la mano antes de hacer
  señas o pedir.
- **La respuesta forzada del Pie es automática:** cuando al responder queda una sola opción legal
  (la regla del Pie no deja elegir), el pedido se declara solo, enseguida (un instante después del
  aviso del rival), y no aparece el panel de pedidos. Con varias opciones todo sigue igual.
- **El aviso de cada pedido es un título de verdad:** al declararse una cantidad de bases aparece un
  cartel grande (hasta 124 px) sobre una banda oscura, que cae con rebote desde grande, con brillo
  rojo si pide el rival y celeste si pide tu equipo, el destello de color de toda la pantalla (rojo
  cuando pide el rival, celeste cuando pide tu equipo y blanco y negro si es un kamikaze), el golpe
  de la mesa y un sonido propio: golpe grave con una campana. El cambio de sentido suena igual.
- **Bots: no esperan señas cuando no sirven de nada:** si responden y solo les queda una opción
  legal (la regla del Pie la fuerza), o si sus cartas solas alcanzan para todas las bases de la
  ronda, ya no tocan la mesa ni esperan la respuesta de los compañeros: declaran al instante.
- **Anotador y lápiz:** el anotador ya no se levanta al pasar el mouse (solo sube un poco el lápiz) y
  no tiembla al tocarlo desde el borde (la zona que detecta el mouse ya no se mueve con el
  anotador); la punta del lápiz estaba mal armada (un cono sobre otro) y ahora es una madera
  afilada que termina justo donde empieza la mina.
- **Retoques:** trazo del anotador más fino; el lápiz casi paralelo al anotador y más abajo, lejos
  del mazo central; el tilde más chico y más abajo (lejos de los nombres); el dorso del mazo central
  menos brillante (ahora se ve el dibujo); los porotos más grandes (y su montoncito un poco más
  ancho); y cuando el **rival pide**, el panel de segmentos destella en pulsos rápidos durante unos
  segundos para que se vea al instante cuántas bases pidió.
- **Anotador navegable:** las hojas de cada resumen (cada base y cada ronda, tal como quedaron
  tildadas) se van acumulando en el anotador de la mesa, y la de arriba es siempre el marcador en
  vivo. Se las hojea arrastrando sobre el anotador con el mouse (o el dedo): hacia arriba da vuelta
  la hoja por el anillado, con la misma física de las hojas del manual (se dobla según de dónde la
  agarres, sigue a la mano, cae sola o vuelve), y las hojas dadas vuelta quedan apiladas detrás de
  los anillos; arrastrando hacia abajo las traés de vuelta. Un clic sin arrastrar sigue abriendo la
  hoja completa. Mientras hay un resumen para tildar no se hojea (se ve siempre ese).
- **Anotador:** el cero se marca con un guión «–»; más chico (1,6 veces el real); la tinta es más
  oscura y gruesa y el papel un poco más apagado para que la lámpara no queme las letras; el
  resumen de base muestra además los puntos totales del partido hasta ese momento.
- **Panel de segmentos más directo:** solo «Tu turno» / «Turno de Ana», «Rival pide 2» / «Tu
  equipo pide 2», «Sacá una carta», «Elegí quién abre» y «Marcá el tilde»; ya no repite los
  mensajes de animación ni las ayudas.
- **El anotador reducido se ve en vivo, apoyado en la mesa:** el anotador de la mesa muestra todo
  el tiempo, sin hacerle clic, el marcador reducido (ronda, base, sentido sobre la hoja; cada equipo
  con sus puntos grandes, lo que pidió, lo que lleva y las estrellas), en letra grande para leerse
  desde tu asiento. Sigue apoyado en la mesa, en diagonal a los porotos y con el lápiz al lado; con
  el zoom del clic derecho se lee perfecto, igual que las cartas. El clic sigue abriendo la hoja
  completa (o con H).
- **El zoom al anotador espera:** antes la cámara salía hacia el anotador apenas llegaba el resumen,
  cuando la última carta todavía se estaba apoyando. Ahora espera a que la mesa termine de mostrar
  la última jugada, deja pasar un instante para verla, y recién ahí se acerca, más despacio (≈1,5 s).
- **Un solo zoom para los dos resúmenes:** el de ronda y el de base se leen con el mismo zoom (desde
  tu asiento, con el zoom del clic derecho sobre el anotador); el texto del resumen de ronda se
  agrandó para leerse a esa distancia. El lápiz descansa del lado derecho del anotador. El tilde
  vuelve a ser el de antes (dos trazos limpios), con una línea más fina, gris clarito apagado y
  verde al escribirse.
- **El resumen entre bases también va en el anotador:** en vez de la ventana «Base X de Y», la
  cámara se queda en tu asiento y apunta al anotador con el zoom del clic derecho (las cartas de la
  base siguen a la vista, con la ganadora marcada), y el anotador se levanta de frente con la base,
  quién la ganó y con qué, cómo va cada equipo (lleva/pidió) y quién ya está listo. Queda fijo hasta
  que apretás el tilde. El resumen de ronda sigue acercando más la cámara.
- **El tilde:** ahora se escribe en unos 0,15 s (antes más de medio segundo), está dibujado a mano
  (trazos desparejos, con una segunda pasada de lápiz y distinto cada vez) y al activarse queda
  **verde**; gris clarito mientras está apagado.
- **Resumen de la ronda en el anotador:** al terminar una ronda la cámara hace zoom sobre el
  anotador de la mesa y se queda ahí mientras todos confirman; el anotador se acomoda de frente a
  la cámara y su hoja muestra, escrita a mano, lo mismo que la ventana «Ronda N terminada» (última
  base, pidió/ganó/cumplió-falló/puntos/total de cada equipo y quién ya está listo). El botón de
  listo es un tilde gris clarito, como apagado, en la esquina inferior derecha de la hoja; se
  oscurece al pasar el mouse y al apretarlo el lápiz se mueve y lo escribe, y después la cámara
  vuelve a tu lugar. Enter sigue confirmando; la ventana vieja queda solo para lectores de pantalla
  y teclado. La ventana de cada base no cambió.
- **Anotador inmediato y sin cortes:** se sacó la animación de «escritura»: la hoja aparece en una
  fracción de segundo con todo el contenido (letra manuscrita y trazos de lápiz de rough.js, ya
  dibujados). Se arregló lo que se veía cortado: la raya del margen y la separación ahora siguen la
  altura real de la hoja, el botón de cerrar ya no pisa el sentido de juego y, con 6 u 8
  jugadores, la lista pasa a dos columnas para que la hoja entre sin scroll (se verificó con 4 y 8).
  Sigue habiendo versión **reducida** (sin kamikazes ni lista de jugadores) y **completa**: un botón
  en la hoja las alterna, y H recorre completa → reducida → cerrada; se recuerda la última que usaste.
- **Nuevo significado de la seña «no»:** ahora es «por mí no pidas nada» (antes era «no te paso
  información»): cartas bajas, o alguna alta que se puede descartar porque el otro equipo ya pidió
  varias bases. Los bots lo usan así: al responder un toque dicen «no» cuando su mano es floja o
  cuando los rivales ya pidieron el 60 % o más de las bases y su mano no alcanza para asegurar
  una (nunca con una mano que seguro hace una: ahí dicen «sí»), y cuando un compañero hace «no»
  cuentan con cero bases de su parte (antes lo tomaban como un compañero cualquiera). Si hay un
  «sí» y un «no» seguidos, vale el último. Cambiaron la etiqueta del anillo y el manual.
- **Regla corregida: lo que puede pedir el Pie.** La regla real es que el pedido del Pie, sumado al
  de la Mano, dé **una base menos o una base más** que las de la ronda (5 bases y la Mano pide 3:
  el Pie solo puede pedir 1 o 3; 5 bases y pide 2: 2 o 4; 3 bases y pide 3: solo 1, porque no hay
  pedidos negativos). Es la regla por defecto en el servidor, el panel de pedidos (que ahora dice
  qué podés pedir), los bots, el manual y `RULEBOOK.md`. La regla anterior (cualquier pedido menos
  el que suma justo el total) quedó como **«Pedido del Pie: Amplia»**, un botón nuevo en Configurar
  y empezar (junto a kamikazes y reloj), que se manda al servidor con la configuración.
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
- **Televisores más chicos con más pantalla, íconos y nombres legibles:** el cuerpo es ~7 % más
  chico pero la pantalla ocupa más del frente; el ícono es más grande y brillante (núcleo claro con
  poco halo, así no se empasta) y la estática le cede lugar; el nombre al pasar el mouse va grande,
  sobre una franja oscura. El panel LED ya no muestra la explicación de cada botón: solo qué hacer.
- **Televisores CRT más de verdad:** carcasa casi cuadrada de esquinas redondeadas con el tubo
  hundido detrás de un bisel y un aro cromado, vidrio abombado en los dos sentidos con esquinas
  redondeadas y distorsión de barril, cuerpo trasero que se achica en dos escalones con ranuras de
  ventilación arriba, y una tira de controles a la derecha (perilla grande, perilla chica, botones y
  rejilla) como en un televisor de los 70/80. Plástico gris oscuro y negro. Detrás del ícono hay
  ruido de estática (cambia cada cuadro, con líneas de barrido, una banda que baja y rasgaduras
  ocasionales). Cada televisor tiene su propio desgaste, al azar y distinto en cada partida: gris
  de otro tono, mugre en los bordes y esquinas, rayones, desportillados, polvo, a veces una huella,
  vidrio más o menos sucio, perillas en otra posición, cromo más o menos opaco y colgado apenas torcido.
- **Pizarra reemplazada por televisores CRT y un panel LED:** historial, reglas, ajustes y salir son
  cuatro televisores de tubo colgados de cables al fondo de la sala, con el dibujo en fósforo verde
  (salir en ámbar) sobre vidrio abombado con líneas de barrido y titileo; al pasar el mouse el
  televisor se enciende más y escribe su nombre en la pantalla. Todo se balancea apenas sobre sus
  cables, como la lámpara. Al lado, un panel de LED verde de catorce segmentos deletrea qué hacer
  (letra por letra, con cursor) y la descripción del botón bajo el mouse. Sigue sin tapar ningún
  jugador con 4, 6 u 8. *(reemplaza a la pizarra de tiza de abajo)*
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
