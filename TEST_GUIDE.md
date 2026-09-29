# La Base Game - Testing Guide

## Environment Setup

All services are running in Docker:
- **Client**: http://localhost:5173
- **Server**: http://localhost:3000
- **Database**: PostgreSQL at postgres:5432 (inside Docker network)

## Quick Start

```bash
docker compose up
```

Then open http://localhost:5173 in your browser.

## Testing Phases

### Phase 1: Authentication

#### 1.1 Register a User
1. Open http://localhost:5173
2. Click "Register" tab
3. Fill in:
   - Username: `testuser`
   - Email: `test@example.com`
   - Password: `password123`
4. Click "Register"
5. **Expected**: Redirected to Lobby page, username shown in header

#### 1.2 Login
1. Logout (red button in top-right)
2. Click "Login" tab
3. Use the credentials from 1.1
4. **Expected**: Redirected to Lobby, connected status shows 🟢

#### 1.3 Guest Mode
1. Click "Guest" tab (default)
2. Enter a name: `TestGuest`
3. Click "Play as Guest"
4. **Expected**: No token in localStorage, connection still works

#### 1.4 Persistence
1. In any mode, press F5 (refresh)
2. **Expected**: You stay on the same page without needing to log in again

### Phase 2: Room Creation & Joining

#### 2.1 Create a Room (Host)
1. In Lobby, click "New Game"
2. Select player count (4, 6, or 8)
3. Click "Create Game"
4. **Expected**: Redirected to "Players" waiting room, room code shown (e.g., "ABCD1234")

#### 2.2 Join a Room (Client 1)
1. Open a new private/incognito browser window
2. Go to http://localhost:5173
3. Register or login as a different user
4. In Lobby, click "Join Game"
5. Copy the room code from the host window
6. Paste and click "Join Game"
7. **Expected**: Both host and client see each other in the Players list

#### 2.3 Multiple Joins
1. Repeat 2.2 for additional players (open more browser windows)
2. **Expected**: All players appear in the list for both host and clients
3. Each player should see the others' connection status (green circle = connected)

### Phase 3: Game Configuration

#### 3.1 Host Configuration
1. With 4+ players in the waiting room:
   - Host should see: "Configure Game & Start" button (green)
   - Clients should see: "Waiting for Host to Configure Game" (disabled)
2. Host clicks "Configure Game & Start"
3. **Expected**: Redirected to GameConfig page

#### 3.2 Game Settings
1. On GameConfig page:
   - Choose game structure (Clásica, Alternativa, Postpandemia)
   - Toggle special powers if desired
2. Click "Start Game"
3. **Expected**: Game starts, all players see the game board

### Phase 4: Game Play

#### 4.1 Cards Dealt
1. All players should see their hand (cards face-up to them, hidden to others)
2. Team assignments visible (Nosotros vs Ellos)
3. **Expected**: Each player sees their own 12 cards

#### 4.2 Bidding Phase
1. Each team declares a bid (Mano or Pie)
2. Bid value reflects team confidence
3. **Expected**: After both teams bid, game transitions to Playing phase

#### 4.3 Playing Phase
1. Players play cards in turn
2. Each card played appears to all players
3. **Expected**: Base resolves when all players have played

#### 4.4 Base Resolution
1. After base completes, winner is shown
2. Next base begins
3. **Expected**: Game continues for all bases in round

### Phase 5: Rankings

#### 5.1 View Rankings
1. In Lobby, click "Rankings" (when implemented)
2. **Expected**: Top 20 players sorted by wins, then by average score
3. Rankings include: Rank, Username, Games Played, Wins, Losses, Avg Score

#### 5.2 Game History
1. After a game completes, it's recorded in the database
2. Authenticated users can view their history
3. **Expected**: Last 20 games shown with date, opponent teams, and score

## Connection Debugging

### Check Server Health
```bash
curl http://localhost:3000/health
# Expected: {"status":"ok","timestamp":"..."}
```

### Check Socket.io
1. Open DevTools (F12) in browser
2. Go to Console
3. Look for: `[useSocket] Connecting to: http://...`
4. Should see: `[useSocket] Connected: <socket-id>`

### Docker Logs
```bash
# Server logs
docker compose logs server -f

# Client logs  
docker compose logs client -f

# Database logs
docker compose logs postgres
```

## Known Limitations

- Rankings page shows all registered players (guests included)
- Guest games are not recorded in game_records table
- No real-time updates to rankings after each game (would need page refresh)
- Game history only available to authenticated users

## Troubleshooting

### Socket connection shows "Disconnected"
- Check if server is running: `docker compose ps`
- Check server logs for errors: `docker compose logs server`
- Browser may need hard refresh (Ctrl+Shift+R)

### Players don't see each other
- Verify all clients are in same room code
- Check browser console for errors
- Restart Docker containers: `docker compose restart`

### Database errors
- Check DATABASE_URL in docker-compose.yml points to postgres service
- Verify postgres container is healthy: `docker compose ps`
- Reset database: `docker compose down -v && docker compose up`

