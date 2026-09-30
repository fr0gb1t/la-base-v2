# Plan: La Base — Multiplayer Online Card Game

## Context

"La Base" is a Spanish card game (40-card deck) for 4/6/8 players in two teams. The user wants to build a multiplayer online version where players can play in real-time, with audio/video communication integrated from day one (critical for bluffing and team strategy). 

**Scale goal**: MVP for casual play, but designed to scale to multiple concurrent game rooms (many games of 8 players running in parallel).

**Key UX feature**: Video tiles replace player avatars at the table for face-to-face bluffing experience.

This is a greenfield project — no existing codebase.

---

## Tech Stack

| Layer | Choice | Reason |
|---|---|---|
| Frontend | React + TypeScript + Vite | Strong ecosystem, types shared with backend |
| Styling | Tailwind CSS | Fast UI iteration |
| Animations | Framer Motion | Card dealing/playing animations |
| Client state | Zustand | Lightweight, good for real-time state mirroring |
| Backend | Node.js + TypeScript + Fastify | Same language as frontend, shares types |
| WebSockets | Socket.io | Rooms, namespaces, reconnection built-in |
| Audio/Video | LiveKit | Open-source compatible, self-hosted or Cloud free tier |
| Database | PostgreSQL | User accounts, game history, rankings, guest sessions |
| Auth | JWT (register/login) | Authenticated users tracked; guests play as temp sessions |
| Deployment | Docker Compose | All services containerized for easy scaling |

---

## Architecture Overview

```
Frontend (React + TypeScript)
├── UI: card table, player hands, bidding panel, scoreboard
├── Socket.io client — game event bus
├── LiveKit client SDK — audio/video tracks per player
└── Zustand store — local mirror of server game state

Backend (Node.js + TypeScript + Fastify)
├── Socket.io server — real-time game events
├── LiveKit server SDK — generate room tokens
├── Game Engine (pure TS, fully testable)
│   ├── Card hierarchy & comparison
│   ├── State machine
│   ├── Bid validator
│   ├── Scoring calculator
│   └── Ace power handlers
└── RoomManager — in-memory room state

Database (PostgreSQL)
├── users, game_records, player_stats
```

---

## Implementation Order (Granular with Verification Points)

### Phase 1: Foundation (Verify: All packages initialize correctly)
1. **Monorepo init** — pnpm workspaces, package.json structure
   - ✓ `npm list` shows all 3 packages (shared, server, client)
2. **TypeScript shared config** — tsconfig base, shared types skeleton
   - ✓ All packages build without errors
3. **Docker Compose** — PostgreSQL + server + (optional LiveKit) services
   - ✓ `docker-compose up` starts all services, health checks pass

### Phase 2: Game Engine (Verify: All unit tests pass)
1. **Card system** — define all 40 cards, implement hierarchy logic
2. **Card.ts** — `cardRank()`, `resolveBase()`, tie-breaking
3. **Structures** — Clásica, Alternativa, Postpandemia, custom
4. **Bid validator** — Mano picks 0-max, Pie response constraint
5. **Scoring calculator** — +10+bases if met, -difference if not, Kamikaze penalty
6. **State machine** — full phase transitions

### Phase 3: Backend - Server Setup
1. **Fastify + Socket.io boilerplate**
2. **RoomManager** — in-memory room storage, room codes
3. **Socket.io event stubs**
4. **Reconnect token system**

### Phase 4: Backend - Authentication
1. **Database schema**
2. **JWT setup**
3. **Auth routes** — register/login
4. **Guest session**
5. **Protected routes**

### Phase 5: Backend - Game Logic Integration
1. **Game initialization**
2. **Bidding flow**
3. **Card play**
4. **Base resolution**
5. **Ace power handlers**
6. **Full game simulation**

### Phase 6: Frontend - Basics
1. **React app setup**
2. **Auth modal**
3. **Lobby page**
4. **Game page skeleton**

### Phase 7: Frontend - Game Table & Hand Display
1. **Player hand component**
2. **Played cards zone**
3. **Turn indicator**
4. **Scoreboard**

### Phase 8: Frontend - Video Tiles
1. **LiveKit connection**
2. **Video tile component**
3. **Fallback UI**
4. **Audio indicator**
5. **Mute/unmute controls**

### Phase 9: Frontend - Bidding UI
1. **Bidding panel**
2. **Kamikaze toggle**
3. **Submit bid button**
4. **Pie response logic**
5. **Bid confirmation**

### Phase 10: Frontend - Card Play & Base Resolution
1. **Card play interaction**
2. **Invalid play detection**
3. **Base resolution animation**
4. **Ace power prompts**
5. **Base progression**

### Phase 11: Frontend - Game Over & Persistence
1. **Game over page**
2. **Auto-record to DB**
3. **Rankings update**
4. **User history page**

### Phase 12: Polish & Testing
1. **Full E2E test**
2. **Mobile responsive**
3. **Reconnection test**
4. **Multi-room test**
5. **Animations & polish**

---

## Key Features Summary

- **4/6/8 player teams** with Mano/Pie rotation
- **Video tiles** as avatars (critical UX)
- **Bidding constraint**: sum of bids ≠ total bases
- **Kamikaze**: declare all-or-nothing before bidding
- **Ace powers**: As Espadas kills Ancho Bastos, As Copas reverses direction, As Oros chooses next Mano
- **Scoring**: +10 + bases if bid met, -difference if not
- **Auth**: Login/Register for persistence, Guest for anonymous play
- **Persistence**: Only authenticated games recorded to DB
- **Scalable**: Multiple concurrent rooms supported

---

See PLAN.md for full technical details.
