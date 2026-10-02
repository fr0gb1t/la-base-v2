# Registro de cambios — La Base v2

## Desde `a603e36`

- **Manual en 3D:** el librito es una escena 3D bajo una lámpara; cada hoja levantada proyecta
  sombra. Las hojas se agarran y se arrastran sobre el lomo: si la tomás de una esquina, se dobla
  la esquina; del borde, se arquea entera; del medio, la parte de afuera cuelga por su peso; si la
  pasás rápido, el borde queda atrás. Un clic la pasa sola, y una hoja que está pasando se puede
  volver a agarrar. Ya no tiene la tinta que "hierve". `98149c4`
- **Dorsos nuevos** (inspirados en Bicycle): rueda roja, rueda azul, abanico y rombos; se elige en
  Ajustes → Cartas. `399787c`
- **Reordenar la mano:** arrastrá una carta a lo largo del abanico para cambiarla de lugar; llevala
  a la mesa para jugarla. `8e3b45f`
- **Campo de visión más amplio** (66°), ajustable de 50° a 80° en Ajustes → Cámara. `bf64246`
- **Bots y kamikaze:** la Mano lo pide (a cero) cuando su mano es muy floja, o al máximo cuando es
  muy fuerte. `5a71c6a`
- **Sonidos en los menús:** pasar el mouse, elegir, sellar, fichas, papel. `6bf4f6c`
- **Arreglos:** los porotos ya no caen sobre las cartas ganadas `8c65187`; la cabeza de la sota
  quedó sobre el cuello `37f5d37`; nombres mucho más chicos en la sala y la configuración
  `a9229cd`.
- Los e2e corren contra un servidor (3100) y un cliente (5174) propios `c7cb215`; ideas de
  animaciones de los personajes en `docs/V2_PLAN.md` `c2f509c`.

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
