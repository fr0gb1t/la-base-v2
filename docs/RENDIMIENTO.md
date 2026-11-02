# Rendimiento: lo hecho y lo pendiente

Notas de la ronda de rendimiento de noviembre de 2026 (PRs #10 y el de la transición de entrada). Todo lo medido sale de
`packages/client/e2e/perf.measure.mjs` (ver `packages/client/e2e/README.md`): build de producción, Chromium sin ventana en
una PC con RTX 5070, y la CPU limitada (`CPU=4`, `CPU=6`) para aproximar equipos modestos. **La GPU no se limitó.**

## Hecho

- **«Bordes suaves» recalculaba los shaders en cada cuadro** (PR #10). El post-proceso dibuja la escena 3 veces con distintas
  capas de cámara; las luces propias de los objetos suaves estaban solo en la capa de props, así que la pasada de
  profundidad veía menos luces, three.js subía la versión del estado de luces dos veces por cuadro y todo material con luz
  volvía a pedir su shader. `toProps()` deja ahora esas luces también en la capa 0. Con CPU 6×: 42 → 55,7 fps; cuadros
  de más de 25 ms: 1356 → 158.
- **El tirón al entrar a la partida se tapa con un velo** (opción 3, abajo). No lo achica: lo esconde.

## El tirón al entrar a la partida

Pasa una vez por partida: ~205 ms en una PC buena, ~480 ms con CPU 4×. Al pasar de la sala de espera a la mesa,
`App` desmonta `MenuBackdrop` (su propia escena 3D y su contexto WebGL) y monta `GamePage`, que crea una `TableScene` nueva
con otro contexto WebGL. Todo cae en un solo cuadro:

| Parte (CPU sin limitar) | ms aprox. |
|---|---|
| Trabajo nativo de GPU y controlador (segundo contexto WebGL, texturas) | 78 |
| React montando `GamePage` (`TableScene` ~40, cartel de controles ~14) | 71 |
| Primer cuadro de la mesa | 34 |

No hay una función lenta que arreglar (`rebuildSeats` 6 ms, `setHud` 13 ms). `compileAsync` en el constructor no sirve:
`TableScene.frame()` sale sin hacer nada mientras no hay jugadores, y los materiales se crean después, en `setPlayers`.

### Opciones, de más barata a más invasiva

1. **(Hecha) Tapar con un velo.** `src/lib/pageStage.ts` + `src/hooks/useStagedPage.ts` + `.page-veil` en `index.css`.
   Al pasar a `game` desde otra pantalla, un velo negro se cierra en 160 ms (animación de opacidad, la mueve el compositor
   aunque el hilo principal esté ocupado), recién entonces se monta la mesa, y el velo se abre en 420 ms. Respeta
   `prefers-reduced-motion`. Cuesta 160 ms de espera extra. Si se tocan los tiempos, mantener `VEIL_*_MS` y el CSS
   sincronizados. El e2e de mesa comprueba la secuencia `off > closing > opening > off`.
2. **(Pendiente) Construir la mesa estacionada mientras se espera en la sala**, como ya hace `RulebookHost` con el libro de
   reglas, y mostrarla recién al empezar. Mueve el costo a un momento tranquilo. Riesgo medio: la mesa se arma sin saber
   todavía quiénes juegan, y gasta memoria y GPU durante la espera.
3. **(Pendiente) Una sola `WebGLRenderer` para el menú y la mesa**, sin destruir y recrear el contexto al entrar. Es lo que
   más reduce el trabajo, pero toca cómo se crean y destruyen las dos escenas (redimensionado, `dispose`, pérdida de
   contexto). Riesgo más alto; no se midió cuánto de los 205 ms ahorraría.

## Otros pendientes, con evidencia

- **Carga inicial:** el bundle de ~1,3 MB tarda ~300 ms en parsearse (partir con `import()`), y el precalentamiento del libro
  de reglas (`RulebookHost`, `html-to-image`) hace tareas de 220–430 ms. Se podrían repartir.
- **~500 llamadas de dibujo por cuadro** (3 pasadas): fusionar mallas estáticas o usar instancias. `updateMatrixWorld` sobre
  objetos estáticos también pesa (~2 s en un perfil de 84 s).
- **Apagado automático de «bordes suaves»** cuando los cuadros son lentos y el jugador no eligió nada (`smoothChosen`
  falso). Se mide bien en CPU; conviene validarlo en una GPU integrada, que es donde el pase de props (MSAA ×4 a resolución
  completa) puede seguir pesando.
- **Medir en un equipo real y con la GPU limitada.** Limitar la CPU es una aproximación. Pendiente también repetir la
  medición con Chrome DevTools MCP (trazas e insights).

## Advertencias al medir

- `page.screenshot` fuerza una lectura de pantalla y alarga un cuadro: parte de los picos aislados son del arnés.
- Chromium sin ventana atiende las teclas con decenas de segundos de demora dentro de la mesa 3D; por eso el e2e escribe el
  código de sala directo en el `<input>` oculto.
- En local, `/_vercel/insights/script.js` (Vercel Web Analytics) da 404: solo existe en Vercel.
