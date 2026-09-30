# Los 3 Ases con Poderes Especiales en La Base

## 📋 Configuración

Los 3 ases tienen poderes **opcionales e independientes**. Se activan/desactivan ANTES de iniciar la partida:

```typescript
type AcePowers = {
  espadas: boolean;  // activado/desactivado
  copas: boolean;    // activado/desactivado
  oros: boolean;     // activado/desactivado
};

// Ejemplo: activar solo Espadas y Oros
const acePowers: AcePowers = { espadas: true, copas: false, oros: true };
```

Si todos están `false`, los ases actúan como cartas normales (valor 1, sin poder).

---

## 🗡️ As de Espadas (1♠)

### Poder Especial
**Mata el Ancho de Bastos si se juega DESPUÉS de él en la misma base**

### Lógica Exacta

```
CASO 1: Ambos en la misma base
┌─────────────────────────────────────────────┐
│ Orden de juego:                             │
│ 1. Player A juega Ancho de Bastos (orden=0) │
│ 2. Player B juega As de Espadas (orden=1)   │
│                                             │
│ Resultado: As de Espadas GANA ✓             │
│ (mata el Ancho aunque normalmente sea > 1)  │
└─────────────────────────────────────────────┘

CASO 2: As de Espadas se juega PRIMERO
┌─────────────────────────────────────────────┐
│ Orden de juego:                             │
│ 1. Player A juega As de Espadas (orden=0)   │
│ 2. Player B juega Ancho de Bastos (orden=1) │
│                                             │
│ Resultado: Ancho de Bastos GANA ✗           │
│ (As no tiene poder, actúa como 1 normal)    │
└─────────────────────────────────────────────┘
```

### Implementación (card.ts)

```typescript
// En compareCards():
if (acePowers.espadas) {
  // Si card1 es As Espadas y card2 es Ancho, y As fue jugado DESPUÉS
  if (isCard1AsEspadas && isCard2Ancho && card1.order > card2.order) {
    return true; // As Espadas gana
  }
  // Si card2 es As Espadas y card1 es Ancho, y As fue jugado DESPUÉS
  if (isCard2AsEspadas && isCard1Ancho && card2.order > card1.order) {
    return false; // Ancho no gana (As gana)
  }
}

// Si acePowers.espadas = false, los ases son cartas normales (rank = 1)
```

### Casos de Uso

| Escenario | Resultado |
|-----------|-----------|
| Ancho(orden 0) vs As Esp(orden 1) + power ON | As Espadas gana |
| As Esp(orden 0) vs Ancho(orden 1) + power ON | Ancho gana |
| Ancho(orden 0) vs As Esp(orden 1) + power OFF | Ancho gana (normal) |
| As Esp(orden 0) vs Rey(orden 1) + power ON | Rey gana (no afecta Rey) |

---

## 🏆 As de Copas (1♡)

### Poder Especial
**Cuando se juega, el jugador que lo tiró INVIERTE el sentido de juego**

Puede elegir:
- **"Mantener antihorario"** → sigue igual, no cambia nada
- **"Cambiar a horario"** → invierte la dirección para el resto de la base

### Lógica Exacta

```
ANTES (antihorario):        DESPUÉS (cambio a horario):
Player 1 (Mano)             Player 1 (Mano) ← sigue siendo Mano
    ↓                           ↑
Player 4                    Player 4 (juega As)
    ↑                           ↓
Player 3                    Player 3
    ↓                           ↓
Player 2                    Player 2
```

### Duración Crítica: TODA LA RONDA (no solo una base)

```
RONDA = TODAS las manos/bases de esa fase

Estructura Clásica: [1, 3, 5, 5, 3, 1, ...]

Ejemplo correcto:
RONDA 2 (3 bases):
  Base 1: Antihorario
  Base 2: As de Copas juega → INVIERTE A HORARIO
  Base 3: Sigue HORARIO ✓ (porque estamos EN LA MISMA RONDA)

RONDA 3 (1 base):
  Base 1: Vuelve a ANTIHORARIO ✓ (nueva ronda, reset automático)
```

### Lógica Exacta

```
ESCENARIO: Ronda 2 con 3 bases

BASE 1 (antihorario):
  1. Player 1 (Mano): 7♦
  2. Player 2: Rey♣
  3. Player 3: Sota♠
  4. Player 4: 3♦
  GANADOR: Rey♣
  Sentido: ANTIHORARIO

BASE 2 (antihorario):
  1. Player 2 (Mano): 4♦
  2. Player 3: As♡ ← JUEGA AQUÍ
     → Elige: "Cambiar a horario"
     → gameState.playDirection = 'horario'
  3. Player 4: Rey♣
  4. Player 1: 5♦
  GANADOR: Rey♣
  Sentido: AHORA HORARIO

BASE 3 (HORARIO):  ← ¡Sigue horario porque estamos EN LA MISMA RONDA!
  1. Player 3 (Mano): 6♠
  2. Player 4: Caballo♦  ← orden 1 en horario
  3. Player 1: As♠      ← orden 2 en horario
  4. Player 2: Rey♦     ← orden 3 en horario (se lee PRIMERO en horario)
  GANADOR: Rey♦
  Sentido: HORARIO

FIN DE RONDA 2:
  gameState.roundIndex++
  gameState.playDirection = 'antihorario'  ← RESET automático

RONDA 3:
  Vuelve a ANTIHORARIO
```

### Regla Importante: Mano es siempre el primero

El jugador **Mano SIEMPRE empieza la base**, independientemente del sentido.

```
Antihorario:  Mano → Player2 → Player3 → Player4
Horario:      Mano → Player4 → Player3 → Player2

Mano siempre es order=0, así que siempre juega primero.
```

### Implementación (engine.ts / game state)

```typescript
type GameState = {
  playDirection: 'antihorario' | 'horario';  // ← DURA TODA LA RONDA
  roundIndex: number;  // cambia cuando termina la ronda
  // ...
};

// Cuando se juega As de Copas:
if (acePowers.copas && playedCard.suit === 'copas' && playedCard.value === 1) {
  // Frontend emite evento: ace:copas { direction: 'keep' | 'reverse' }
  if (userChoice === 'reverse') {
    gameState.playDirection = 'horario';  // ← DURA HASTA FIN DE RONDA
  }
}

// Al finalizar la ronda (después de todas las bases):
if (isRoundComplete(gameState)) {
  gameState.playDirection = 'antihorario';  // ← RESET automático
  gameState.roundIndex++;
}
```

### Casos de Uso

| Caso | Sentido | Duración | Efecto |
|------|---------|----------|--------|
| Base 1 de ronda: As de Copas invierte | antihorario → horario | Hasta fin de ronda | Bases 2,3,4... siguen horario |
| Fin de ronda | horario → antihorario | Automático | Reset a antihorario |
| Siguiente ronda | antihorario | Nueva ronda | Vuelve a sentido normal |
| Player juega As, elige "mantener" | antihorario | Sin cambio | Sigue antihorario |
| As de Copas con poder OFF | - | - | Actúa como 1 normal |

---

## 👑 As de Oros (1♦)

### Poder Especial
**Si el equipo DEL JUGADOR que tiró el As GANA esa base, puede elegir quién abre la siguiente**

### Lógica Exacta

```
ESCENARIO:
Base 1:
  - Player 1 (Nosotros): As de Oros (poder ON)
  - Player 2 (Ellos): Rey♣
  - Player 3 (Nosotros): 6♠
  - Player 4 (Ellos): 3♦
  
  GANADOR: As de Oros = Equipo Nosotros GANA ✓

ACCIÓN: Como Nosotros ganó y fue Player 1 quien tiró el As:
         → Player 1 puede elegir quién abre Base 2
         
OPCIONES:
  • Que Player 1 abra (Mano)
  • Que Player 3 abra (otro jugador del equipo)

=====================================

CONTRAEJEMPLO: As de Oros pero su equipo PIERDE
  
Base 1:
  - Player 1 (Nosotros): As de Oros
  - Player 2 (Ellos): Rey♣ ← GANA
  - Player 3 (Nosotros): 6♠
  - Player 4 (Ellos): 3♦
  
  GANADOR: Rey♣ = Equipo Ellos GANA ✗

ACCIÓN: Como Nosotros PERDIÓ, el poder NO se activa
         → Mano automático (normal)
         → Player 2 abre Base 2 (ganador de Base 1)
```

### Implementación (engine.ts)

```typescript
// Después de resolver la base:
const baseWinner = resolveBase(playedCards, acePowers, playDirection);

// Buscar si hubo As de Oros jugado
const asOrosCard = playedCards.find(
  (pc) => pc.card.suit === 'oros' && pc.card.value === 1
);

if (asOrosCard && acePowers.oros) {
  const asOrosPlayerTeam = getPlayerTeam(players, asOrosCard.playerId);
  const baseWinnerTeam = getPlayerTeam(players, baseWinner.playerId);
  
  if (asOrosPlayerTeam === baseWinnerTeam) {
    // ✓ El equipo del As de Oros GANÓ la base
    // → Emitir evento: ace:oros:choose { asOrosPlayerId, teamPlayers }
    // → Esperar que elija quién abre la siguiente base
    
    gameState.nextManoPlayerId = selectedPlayerFromTeam;
  } else {
    // ✗ Su equipo perdió, sin poder
    gameState.nextManoPlayerId = baseWinner.playerId; // mano automático
  }
}
```

### Casos de Uso

| Caso | As de Oros Ganador | Su Equipo | Poder | Resultado |
|------|-------------------|-----------|-------|-----------|
| Player 1 juega As, su equipo gana | Sí | Sí | ON | Elige Mano ✓ |
| Player 1 juega As, su equipo pierde | Sí | No | OFF | Mano automático ✗ |
| Player 1 juega As, power desactivado | Sí | Sí | OFF | Mano automático ✗ |
| Player 2 juega Rey, su equipo gana | No | Sí | - | Mano automático |

---

## 🎮 Resumen de Activación

### Configuración Inicial (antes de la partida)

```
Pregunta al host:
┌─────────────────────────────────────┐
│ ¿Activar poderes de ases?           │
│                                     │
│ □ As de Espadas (mata Ancho)        │
│ □ As de Copas (invierte sentido)    │
│ □ As de Oros (elige Mano)           │
│                                     │
│ [Comenzar]                          │
└─────────────────────────────────────┘
```

### Guardado en GameState

```typescript
const gameState: GameState = {
  // ...
  acePowers: {
    espadas: true,   // si user marcó
    copas: false,    // si no marcó
    oros: true,      // si user marcó
  },
  // ...
};
```

### Durante el Juego

- **Espadas**: Automático en compareCards() si está ON
- **Copas**: Requiere que el jugador elija → emite `ace:copas` event
- **Oros**: Requiere que el jugador elija → emite `ace:oros` event

---

## ✅ Checklist de Implementación

- [x] Tipos AcePowers (independientes, booleanos)
- [x] As de Espadas: lógica en compareCards()
- [ ] As de Copas: lógica de dirección (engine.ts)
- [ ] As de Oros: lógica de Mano selection (engine.ts)
- [ ] UI: pantalla de configuración de poderes
- [ ] Socket.io: eventos `ace:copas` y `ace:oros`
- [ ] Tests: unitarios para cada poder (Phase 3)
