# LA BASE - MANUAL OFICIAL DEL JUEGO

## Índice
1. [Objetivo del Juego](#objetivo-del-juego)
2. [Componentes](#componentes)
3. [Preparación](#preparación)
4. [Flujo de Juego](#flujo-de-juego)
5. [Sistema de Cartas](#sistema-de-cartas)
6. [Sistema de Bidding](#sistema-de-bidding)
7. [Jugabilidad](#jugabilidad)
8. [Poderes Especiales de los Ases](#poderes-especiales-de-los-ases)
9. [Sistema de Puntuación](#sistema-de-puntuación)
10. [Fin de la Partida](#fin-de-la-partida)
11. [Terminología](#terminología)

---

## Objetivo del Juego

**La Base** es un juego de cartas para 4, 6 u 8 jugadores, divididos en dos equipos iguales denominados **"Nosotros"** y **"Ellos"**. El objetivo es que tu equipo acumule la mayor cantidad de puntos durante todas las rondas de la partida.

La partida consiste en un número predeterminado de rondas según la estructura elegida al inicio. Gana el equipo con mayor puntaje acumulado al finalizar.

---

## Componentes

### Cartas
- **Mazo español de 40 cartas** (sin los 8, 9 y comodín)
- **Para 8 jugadores**: se utilizan 2 mazos (80 cartas)

### Estructura del Mazo
**4 Palos:**
- Oros (♦)
- Copas (♡)
- Espadas (♠)
- Bastos (♣)

**Valores por palo:** 1 (As), 2, 3, 4, 5, 6, 7, 10 (Sota), 11 (Caballo), 12 (Rey)

### Jugadores y Equipos
- **4 jugadores**: 2 vs 2 (2 jugadores por equipo)
- **6 jugadores**: 3 vs 3 (3 jugadores por equipo)
- **8 jugadores**: 4 vs 4 (4 jugadores por equipo)

Los equipos se sientan de forma alternada alrededor de la mesa.

---

## Preparación

### 1. Selección de Quien Reparte
Antes de la primera ronda, todos los jugadores toman una carta del mazo boca abajo. El jugador con la carta más alta **"da"** (reparte las cartas) y es el primero en **"pie"** en esa ronda.

> **Nota**: En rondas posteriores, la responsabilidad de repartir rota entre todos los jugadores de manera cíclica.

### 2. Selección de Estructura
El equipo que da (o los jugadores de forma consensuada) elige la estructura de juego:

| Estructura | Rondas | Secuencia | Total de Bases |
|-----------|--------|-----------|----------------|
| **Clásica** | 12 | 1-3-5-5-3-1-1-3-5-5-3-1 | 36 |
| **Alternativa** | 16 | 1-3-5-6-6-5-3-1-1-3-5-6-6-5-3-1 | 60 |
| **Postpandemia** | 12 | 1-2-3-4-5-6-6-5-4-3-2-1 | 42 |
| **Custom** | Variable | Define tu secuencia | Variable |

Cada número representa la cantidad de **manos** (bases) a jugar en esa ronda.

### 3. Selección de Poderes Especiales (Opcional)
Antes de comenzar, el grupo decide si activan los poderes especiales de los ases:
- **As de Espadas**: ☐ Activado ☐ Desactivado
- **As de Copas**: ☐ Activado ☐ Desactivado
- **As de Oros**: ☐ Activado ☐ Desactivado

Los poderes se pueden activar/desactivar de forma independiente. Si están desactivados, los ases actúan como cartas normales (valor 1).

---

## Flujo de Juego

### Estructura Jerárquica

```
PARTIDA
└── RONDA (una ronda por cada número de la estructura)
    └── BASE/MANO (cada carta jugada constituye una mano)
```

### Ejemplo: Estructura Clásica, Ronda 1

Estructura Clásica comienza con **[1, 3, 5, ...]**

- **Ronda 1**: 1 base (1 mano)
- **Ronda 2**: 3 bases (3 manos)
- **Ronda 3**: 5 bases (5 manos)
- etc.

---

## Sistema de Cartas

### Jerarquía de Cartas

Las cartas se ordenan de mayor a menor valor de la siguiente manera:

| Rango | Carta | Valor |
|-------|-------|-------|
| 1 | **Ancho de Bastos** (1♣) | 13 |
| 2 | Rey (12) de cualquier palo | 12 |
| 3 | Caballo (11) de cualquier palo | 11 |
| 4 | Sota (10) de cualquier palo | 10 |
| 5 | Siete (7) de cualquier palo | 7 |
| 6 | Seis (6) de cualquier palo | 6 |
| 7 | Cinco (5) de cualquier palo | 5 |
| 8 | Cuatro (4) de cualquier palo | 4 |
| 9 | Tres (3) de cualquier palo | 3 |
| 10 | Dos (2) de cualquier palo | 2 |
| 11 | As (1) de cualquier palo excepto Bastos | 1 |

**El Ancho de Bastos es la carta más poderosa del juego** y nunca puede ser vencido, excepto por el As de Espadas bajo condiciones específicas (ver Poderes Especiales).

### Resolución de Bases

En cada base (mano), todos los jugadores juegan una carta. **Gana la base quien juega la carta con mayor jerarquía.**

**Desempate (Tie-breaking):** Si dos jugadores juegan cartas del mismo valor, **gana quien jugó primero** (más cercano al Mano en el orden de juego).

---

## Sistema de Declaración de Bases

### Roles por Ronda: Mano y Pie

En cada ronda, un equipo es **"Mano"** y el otro es **"Pie"**. Estos roles rotan entre rondas.

- **Equipo Mano**: Elige primero cuántas bases cree que ganará
- **Equipo Pie**: Elige cuántas bases cree que ganará, pero bajo una restricción

### Declaración de Bases

**Paso 1: Equipo Mano declara**

El equipo Mano elige un número entre **0 y el total de bases disponibles** en esa ronda.

> **Ejemplo**: En una ronda con 5 bases, Mano puede pedir 0, 1, 2, 3, 4 o 5.

**Paso 2: Equipo Pie responde**

El equipo Pie elige un número entre **0 y el total de bases disponibles**, PERO con una restricción crítica:

> **Restricción**: La suma de lo que pide Mano + lo que pide Pie **NO PUEDE SER IGUAL** al total de bases disponibles.

**Ejemplo:**
- Total de bases: 5
- Mano pide: 3
- Pie PUEDE pedir: 0, 1, 4 o 5 (suma = 3, 4, 7, 8)
- Pie NO PUEDE pedir: 2 (suma = 5, que es el total)

> **Garantía del Juego**: Esta regla asegura que SIEMPRE habrá un equipo que no cumpla su promesa.

### Kamikaze (Opcional)

Antes de iniciar la partida, los equipos definen cuántos **Kamikazes** tendrá cada equipo.

**Cantidad de Kamikazes por defecto**: 2 por equipo  
**Rango permitido**: 0 a 3 Kamikazes por equipo

En cada ronda, el equipo Mano tiene la opción de usar uno de sus Kamikazes para declarar **"Kamikaze"** ANTES de hacer su declaración de bases.

**Efecto del Kamikaze:**
- Mano solo puede declarar **0 o el máximo de bases disponibles** (todo o nada)
- No hay término medio
- Usa uno de los Kamikazes disponibles del equipo

**Ejemplo:**
- Ronda con 5 bases
- Mano declara Kamikaze
- Solo puede declarar: 0 o 5 (no puede declarar 1, 2, 3, 4)
- El equipo pierde uno de sus Kamikazes

**Estrategia:**

El Kamikaze existe como una herramienta estratégica. Un equipo puede elegir usarlo para:
- Protegerse de la penalización (si pierden por 2+ bases, no pierden automáticamente)
- Forzar una situación de todo o nada
- En algunos casos, buscar derrotar al equipo contrario a costa de no cumplir su objetivo

> **Estrategia**: Kamikaze es una forma de evitar la penalización cuando confías en tu equipo.

---

## Jugabilidad

### Repartición de Cartas

Al inicio de cada ronda, el repartidor distribuye cartas a todos los jugadores, una por una, en sentido antihorario, hasta que cada jugador tenga el número de cartas correspondientes para esa ronda.

**Ejemplo:**
- Ronda 1 (1 base): cada jugador recibe 1 carta
- Ronda 2 (3 bases): cada jugador recibe 3 cartas
- Ronda 3 (5 bases): cada jugador recibe 5 cartas

Se reparten todas las cartas necesarias al inicio de la ronda. Durante la ronda, se juegan las bases una a una hasta usar todas las cartas.

### Orden de Juego

Las cartas se juegan en **sentido antihorario**, comenzando por el jugador **Mano** (quien abre la base).

> **Antihorario = el turno pasa a la derecha.** Sentado a la mesa, después de vos juega quien está a tu derecha. Visto desde arriba la ronda gira al revés de las agujas del reloj, que a simple vista parece "hacia la izquierda": por eso conviene pensarlo siempre desde la silla de cada jugador.

> **Mano es siempre el primero en jugar cada base**, independientemente del sentido de juego.

### Cómo Jugar una Carta

1. El jugador actual selecciona una carta de su mano
2. La coloca sobre la mesa
3. Pasa el turno al siguiente jugador en sentido antihorario
4. Continúa hasta que todos los jugadores hayan jugado una carta

### Fin de una Base

Cuando todos los jugadores han jugado una carta para esa base:
1. Se determina la carta más alta (ver Jerarquía de Cartas)
2. El equipo que jugó esa carta **gana la base**
3. El equipo ganador recoge las cartas jugadas
4. Se prepara la siguiente base (si la hay)
5. El **ganador de la base anterior abre la siguiente** (es el nuevo Mano)

### Fin de una Ronda

Una ronda termina cuando se han jugado todas las bases según la estructura.

Se cuenta cuántas bases ganó cada equipo y se aplica el sistema de puntuación.

---

## Poderes Especiales de los Ases

Los poderes especiales de los ases se activan **solo si fueron habilitados** en la preparación. Los ases que no tienen poderes activados actúan como cartas normales (valor 1).

### As de Espadas (1♠) - "El Matador"

**Activación**: Power de Espadas = ON

**Poder Especial**: El As de Espadas es la única carta que puede vencer al Ancho de Bastos, PERO solo bajo una condición específica.

**Regla Exacta:**
- Si el As de Espadas se juega **DESPUÉS** del Ancho de Bastos en la misma base → **mata el Ancho y gana la base**
- Si el As de Espadas se juega **ANTES** del Ancho de Bastos → **actúa como un As normal** (valor 1) y el Ancho gana

**Ejemplo 1 (As mata Ancho):**
```
Base X:
1. Player 1: Ancho de Bastos (1♣) - orden 0
2. Player 2: As de Espadas (1♠) - orden 1  ← Se juega DESPUÉS

Resultado: As de Espadas GANA
```

**Ejemplo 2 (Ancho es invencible):**
```
Base X:
1. Player 1: As de Espadas (1♠) - orden 0  ← Se juega PRIMERO
2. Player 2: Ancho de Bastos (1♣) - orden 1

Resultado: Ancho de Bastos GANA
```

**Nota**: El As de Espadas actúa como valor 1 en todas las demás comparaciones.

---

### As de Copas (1♡) - "El Girador"

**Activación**: Power de Copas = ON

**Poder Especial**: Cuando se juega el As de Copas, el jugador que lo tiró puede **cambiar la dirección de juego para toda la ronda**.

**Regla Exacta:**

1. Cuando se juega el As de Copas, el jugador elige:
   - **"Mantener antihorario"** → El sentido sigue siendo antihorario (sin cambios)
   - **"Cambiar a horario"** → El sentido se invierte a horario

2. La nueva dirección se mantiene **hasta que termine la ronda completa**, no solo esa base

3. Cuando comienza la siguiente ronda, el sentido vuelve automáticamente a antihorario

4. **Mano es siempre el primero**, independientemente del sentido

**Sentidos de Juego:**

```
ANTIHORARIO (normal):
Player 1 (Mano) → Player 2 → Player 3 → Player 4

HORARIO (invertido):
Player 1 (Mano) → Player 4 → Player 3 → Player 2

Mano siempre inicia la base (order = 0)
```

**Ejemplo:**

```
Ronda 3 con 5 bases, comienza ANTIHORARIO:

Base 1: Antihorario
  1. Player 1: Rey♦
  2. Player 2: 5♠
  3. Player 3: Sota♣
  4. Player 4: As♡ ← JUEGA AQUÍ
     Elige: "Cambiar a horario"
     Nuevo sentido: HORARIO

Base 2: HORARIO ✓ (sigue siendo horario)
  1. Player 1 (Mano): 6♦
  2. Player 4: Rey♣
  3. Player 3: 2♠
  4. Player 2: 7♦

Base 3: HORARIO ✓ (sigue siendo horario)
Base 4: HORARIO ✓ (sigue siendo horario)
Base 5: HORARIO ✓ (sigue siendo horario)

Fin de Ronda 3:
  Sentido vuelve a ANTIHORARIO automáticamente

Ronda 4 comienza:
  Antihorario (reset)
```

**Nota sobre la Resolución:**

Cuando el sentido es horario, el orden de lectura de las cartas para determinar el ganador se invierte, pero el Mano sigue siendo quien abrió la base.

---

### As de Oros (1♦) - "El Elegidor"

**Activación**: Power de Oros = ON

**Poder Especial**: Si el equipo que jugó el As de Oros **gana esa base**, el jugador que tiró el As puede **elegir cuál jugador de su equipo abre la siguiente base**.

**Regla Exacta:**

1. Si el As de Oros se juega en una base:
   - Y el equipo que lo tiró **GANA esa base**
   - Y **NO ES LA ÚLTIMA BASE DE LA RONDA**
   - Entonces el jugador que tiró el As elige cuál jugador de su equipo abre la siguiente base

2. **Caso especial - Última base de la ronda:**
   - Si el As de Oros se juega en la última base y el equipo gana
   - El poder NO se puede aplicar (no hay siguiente base en esta ronda)
   - En la siguiente ronda, quien recibe la primera carta en la repartición es el nuevo Mano

3. Si el equipo que tiró el As de Oros **PIERDE esa base**:
   - El poder no se activa
   - El próximo Mano es automáticamente el ganador de la base (normal)

**Ejemplo 1 (Equipo del As gana, poder activo):**

```
Durante una ronda, en una base cualquiera:
  - Player 1 (Nosotros): As de Oros (1♦)
  - Player 2 (Ellos): 2♠
  - Player 3 (Nosotros): Rey♣ ← GANA (mayor que todas)
  - Player 4 (Ellos): 5♦
  
GANADOR: Rey♣ (Player 3, Nosotros)

ACCIÓN: Como Nosotros ganó la base donde se jugó el As de Oros:
  → Player 1 elige quién abre la siguiente base de esta ronda
  → Opciones: Player 1 o Player 3 (cualquiera de Nosotros)
```

**Ejemplo 2 (Equipo del As pierde, poder NO activo):**

```
Durante una ronda, en una base cualquiera:
  - Player 1 (Nosotros): As de Oros (1♦)
  - Player 2 (Ellos): Rey♣ ← GANA
  - Player 3 (Nosotros): 6♠
  - Player 4 (Ellos): 3♦
  
GANADOR: Rey♣ (Player 2, Ellos)

ACCIÓN: Como Ellos ganó (Nosotros perdió), el poder NO se activa
  → Player 2 abre la siguiente base automáticamente (ganador de base)
```

---

## Sistema de Puntuación

Después de que se juegan todas las bases de una ronda, se calcula la puntuación basada en lo que cada equipo pidió y lo que logró ganar.

### Cálculo de Puntos por Ronda

**Si el equipo cumple su promesa (Bid met):**
```
Puntos = 10 + número de bases ganadas

Ejemplo:
  - Mano pidió 3 bases y ganó 3 bases
  - Puntos: 10 + 3 = 13 puntos
```

**Si el equipo NO cumple su promesa (Bid missed):**
```
Puntos = -diferencia entre lo que pidió y lo que ganó

Ejemplo:
  - Mano pidió 5 bases pero solo ganó 3 bases
  - Diferencia: 5 - 3 = 2
  - Puntos: -2 puntos

Otro ejemplo:
  - Pie pidió 2 bases pero ganó 4 bases
  - Diferencia: 4 - 2 = 2
  - Puntos: -2 puntos
```

**Ambos equipos fallan (Both miss):**
```
Ambos equipos restan puntos según su diferencia

Ejemplo:
  - Mano pidió 4, ganó 2 → -2 puntos
  - Pie pidió 1, ganó 3 → -2 puntos
```

### Garantía de Desigualdad

Gracias a la restricción de bidding, **siempre hay un equipo que falla**. Solo en casos extremos pueden ambos fallar.

### Kamikaze - Penalización por No Declarar

Si el equipo Mano:
1. NO declaró Kamikaze
2. Pidió un número X
3. Ganó Y bases
4. Y |X - Y| ≥ 2 (diferencia de 2 o más)

**Entonces pierden automáticamente la partida**, incluso si podrían seguir por puntos. Esto los obliga a ser valientes.

---

## Fin de la Partida

### Condición 1: Se Completan Todas las Rondas (Condición por Defecto)

Si se completan todas las rondas de la estructura elegida sin que ocurra la Condición 2:

**Gana el equipo con mayor puntaje acumulado.**

**En caso de empate de puntos:**

Si ambos equipos terminan con exactamente el mismo puntaje, se juegan rondas de desempate:

1. **Se juegan 2 rondas con la mayor cantidad de bases de la estructura elegida**
   
   **Ejemplo según estructura:**
   - Clásica (máximo 5 bases) → 2 rondas de 5 bases cada una
   - Alternativa (máximo 6 bases) → 2 rondas de 6 bases cada una
   - Postpandemia (máximo 6 bases) → 2 rondas de 6 bases cada una

2. Cada ronda se juega normalmente con su declaración y puntuación
3. La Mano alterna entre equipos en cada ronda (si Nosotros fue Mano en ronda 1, Ellos es Mano en ronda 2)
4. **Gana quien tenga mayor puntaje después de las 2 rondas de desempate**

**Ejemplo de Desempate:**
```
Puntuación final (tras estructura principal): Nosotros 150, Ellos 150 (empate)

Estructura: Clásica (máximo 5 bases)
Rondas de desempate: 2 rondas de 5 bases cada una

Ronda de Desempate 1 (5 bases):
  - Nosotros es Mano, declara 3 bases
  - Ellos declara 4 bases
  - (Suma = 7, NO igual a 5 ✓)
  - Resultado: Nosotros gana 3 bases, Ellos gana 2
  - Nosotros: 10 + 3 = 13 puntos (total: 163) [pidió 3, ganó 3 ✓]
  - Ellos: -2 puntos (total: 148) [pidió 4, ganó 2 ✗]

Ronda de Desempate 2 (5 bases):
  - Ellos es Mano, declara 2 bases
  - Nosotros declara 4 bases
  - (Suma = 6, NO igual a 5 ✓)
  - Resultado: Ellos gana 2 bases, Nosotros gana 3
  - Ellos: 10 + 2 = 12 puntos (total: 160) [pidió 2, ganó 2 ✓]
  - Nosotros: -1 punto (total: 162) [pidió 4, ganó 3 ✗]

RESULTADO: Nosotros gana 163 vs 160
```

### Condición 2: Penalización por Kamikaze (Termina Partida Inmediatamente)

Si el equipo Mano:
1. NO declaró Kamikaze en una ronda
2. Declaró X bases pero ganó Y bases
3. Y |X - Y| ≥ 2 (diferencia de 2 o más)

**Entonces pierden la partida inmediatamente.** El otro equipo gana, sin importar los puntos acumulados hasta ese momento.

**Ejemplo:**
```
Mano declaró 5 bases
Mano ganó 3 bases
Diferencia: 5 - 3 = 2 ✗

Como no declararon Kamikaze y perdieron por 2 bases:
→ Pierden la partida automáticamente
```

---

## Terminología

| Término | Definición |
|---------|-----------|
| **Base** | Una mano jugada; cada jugador juega una carta, gana quien tenga la más alta |
| **Ronda** | Conjunto de todas las bases de una fase (ej: 5 bases en una ronda) |
| **Mano** | El equipo/jugador que abre la base y elige primero en la declaración |
| **Pie** | El equipo que responde la declaración |
| **Declaración** | La promesa de cuántas bases cree que ganará |
| **Cumplir** | Ganar exactamente lo que prometiste |
| **Fallar** | Ganar menos o más de lo que prometiste |
| **Antihorario** | Sentido de juego normal: cada jugador le pasa el turno al de su **derecha** (visto desde arriba, la ronda gira al revés de las agujas del reloj) |
| **Horario** | Sentido de juego invertido: cada jugador le pasa el turno al de su **izquierda** (visto desde arriba, gira como las agujas del reloj) |
| **Kamikaze** | Declaración de "todo o nada" antes del bidding |
| **Ancho de Bastos** | La carta más poderosa del juego (1♣) |
| **Poder Especial** | Habilidad única de un As, activada antes de la partida |

---

## Notas Finales

### Juego Responsable

La Base es un juego de estrategia, suerte y comunicación en equipo. Disfruta el juego con tus compañeros.

### Variantes y Personalización

- Las estructuras Custom permiten crear secuencias personalizadas
- Los poderes especiales pueden activarse/desactivarse para adaptar la dificultad
- El número de jugadores (4, 6, 8) cambia la dinámica estratégica

### Preguntas Frecuentes

**P: ¿Qué pasa si dos equipos empatan en puntos después de todas las rondas?**
R: Es una victoria compartida. Ambos equipos ganan.

**P: ¿Puedo cambiar de opinión en mi declaración?**
R: No. Una vez declarada, la cantidad de bases es vinculante.

**P: ¿Qué pasa si se juega un As con poder desactivado?**
R: Actúa como una carta normal (valor 1, sin efectos especiales).

**P: ¿Mano es siempre el mismo jugador durante toda la ronda?**
R: No. El jugador Mano abre cada base, pero es quien gana la base anterior quien abre la siguiente (se cambia el Mano en cada base).

---

**Versión**: 1.0  
**Última actualización**: Abril 2026  
**Modo de juego**: Offline (cartas físicas) y Online (multiplayer)
