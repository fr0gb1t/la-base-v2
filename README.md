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
