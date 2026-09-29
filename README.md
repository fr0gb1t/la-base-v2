# La Base v2 — mesa 3D en primera persona

Toda la lógica y el multijugador de La Base, con la nueva interfaz 3D (mesa redonda, primera persona,
brazo controlado por el jugador, presencia en vivo de los demás). Plan y etapas: `docs/V2_PLAN.md`.

## Correr en local (sin base de datos: modo invitado)

```bash
pnpm install
pnpm --filter @la-base/shared build
pnpm --filter @la-base/server dev      # :3000 (sin DATABASE_URL = sólo invitados)
pnpm --filter @la-base/client dev      # :5173
```

Con Postgres (cuentas y rankings): `docker compose up postgres` y `DATABASE_URL=postgresql://labase:labase_dev@localhost:5432/labase`.

## Controles en la mesa

- Click en la mesa: tomar/soltar la vista (mover la cabeza con el mouse).
- Click en una carta: jugarla. Mantener el click: llevarla con tu brazo (podés amagar) y soltar sobre el recuadro.
- Clic derecho: zoom al cursor; apuntando a la mitad lejana de la mesa te parás para ver desde arriba.

## Prueba end-to-end

Con server y cliente corriendo: `node packages/client/e2e/table.e2e.mjs /tmp/labase 150`
(un navegador + 3 bots juegan una partida real; guarda capturas de cada fase).

---

# La Base - Multiplayer Card Game

A multiplayer online card game built with React, Node.js, and WebSockets.

## Quick Start with Docker

The easiest way to get started is with Docker Compose:

```bash
cd /home/frogbit/github/la-base
docker-compose up
```

This will start:
- **Frontend**: http://localhost:5173
- **Backend**: http://localhost:3000
- **Database**: PostgreSQL on port 5432

## Manual Setup (without Docker)

### Prerequisites
- Node.js 20+
- pnpm (`npm install -g pnpm`)
- PostgreSQL 16

### Installation

```bash
# Install dependencies
pnpm install

# Build shared package
cd packages/shared
pnpm build
cd ../..

# Set up environment variables
cp .env.example .env.local

# Start development servers
pnpm dev
```

This will start:
- **Frontend** on http://localhost:5173 (Vite hot reload)
- **Backend** on http://localhost:3000 (with nodemon auto-restart)

## Project Structure

```
la-base/
├── IMPLEMENTATION_PLAN.md    # Detailed implementation roadmap
├── packages/
│   ├── shared/               # Shared types & game engine
│   │   └── src/
│   │       ├── types.ts      # TypeScript types
│   │       ├── card.ts       # Card hierarchy logic
│   │       ├── structures.ts # Game structures
│   │       ├── scoring.ts    # Scoring logic
│   │       └── engine.ts     # Game state machine
│   ├── server/               # Backend (Fastify + Socket.io)
│   │   └── src/
│   │       └── index.ts      # Server entry point
│   └── client/               # Frontend (React + Vite)
│       └── src/
│           ├── App.tsx       # Main app component
│           └── main.tsx      # React entry point
├── docker-compose.yml        # Docker services
└── package.json              # Monorepo (pnpm workspaces)
```

## Current Status

**Phase 1: Foundation** ✅ In Progress
- Monorepo setup with pnpm workspaces
- TypeScript configuration
- Docker Compose setup
- Game engine types and basic logic

## Development

### Running Tests

```bash
pnpm test
```

### Building for Production

```bash
pnpm build
```

### Linting

```bash
pnpm lint
```

## Next Steps

See [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) for the detailed 12-phase implementation roadmap.

## License

MIT
