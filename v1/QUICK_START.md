# La Base - Quick Start Guide

**⏱️ 2 Minutes to Play**

## Step 1: Start Everything (15 seconds)

```bash
cd /home/frogbit/github/la-base
docker compose up
```

Wait for the message: `🎮 La Base Server running on http://0.0.0.0:3000`

## Step 2: Open Your Browser (5 seconds)

**IMPORTANT**: Use the same address for all players!

**Option A** (Local only):
```
http://localhost:5173
```
Works if all players are on the same computer.

**Option B** (Network - Recommended):
Find your computer's IP address:
```bash
# Windows
ipconfig  # Look for IPv4 Address

# Mac/Linux
ifconfig  # Look for inet
```

Then use:
```
http://YOUR_IP:5173   (e.g., http://192.168.1.145:5173)
```

**Important**: All players must use the same address (either all `localhost` OR all the IP address).

You'll see the La Base game with three tabs:
- 👤 **Guest** — Play without signing up
- 🔐 **Login** — Use existing account
- 📝 **Register** — Create new account

## Step 3: Play as Guest (30 seconds) — Fastest way to test

1. Click **Guest** tab (default)
2. Enter your name (e.g., "Player1")
3. Click **Play as Guest**
4. You're in the Lobby!

## Step 4: Invite Friends (1 minute)

To play with others on the same network:

**Player 1 (Host)**
1. Click **New Game**
2. Select 4 players
3. Click **Create Game**
4. A room code appears (e.g., "ABCD1234")
5. Share this code with friends

**Players 2, 3, 4**
1. Open http://localhost:5173 (or http://YOUR_COMPUTER_IP:5173)
2. Click **Join Game**
3. Enter the room code
4. Click **Join**

Once all 4+ players join:

**Player 1 (Host) Only**
1. Click **Configure Game & Start**
2. Choose game structure
3. Click **Start Game**

## Step 5: Play! (varies)

1. **Bidding Phase**: Each team declares confidence in their cards
2. **Playing Phase**: Cards are played one by one
3. **Scoring**: Points awarded based on bases won
4. **Repeat**: Game continues until all rounds are complete
5. **Winner**: Team with highest score wins!

---

## Keyboard Shortcuts & Tips

| Action | How |
|--------|-----|
| See connection status | Look at header (🟢 Connected or 🔴 Disconnected) |
| View room code | It's displayed at top of waiting room |
| Leave room | Click "Leave Room" button |
| Logout | Click red "Logout" button in top-right |
| Hard refresh | Ctrl+Shift+R (clears cache) |

## Multiple Players on Same Computer

Use **Private/Incognito Windows**:
1. Player 1: Normal window (http://localhost:5173)
2. Player 2: Private window (Ctrl+Shift+P or Cmd+Shift+P)
3. Player 3: Another private window
4. Player 4: Another private window

Each has separate localStorage, so they stay logged in as different users.

## Multiple Players on Different Computers

Get your computer's IP address:

**Windows**
```bash
ipconfig
# Look for "IPv4 Address" (like 192.168.1.100)
```

**Mac/Linux**
```bash
ifconfig
# Look for "inet" address
```

Then share: **http://YOUR_IP:5173**

All players use this URL to connect to your game.

## Verify Everything Works

```bash
./verify.sh
```

Should show ✅ for all checks.

## Quick Troubleshooting

| Issue | Fix |
|-------|-----|
| "Cannot connect" | Refresh browser (F5) or try `docker compose restart` |
| Port already in use | `docker compose down` then `docker compose up` |
| "Game stuck" | Refresh page (F5) |
| "Can't see players" | Make sure you're in same room code |

## What's Next?

Once you're familiar with the game:

1. **Test thoroughly**: Follow TEST_GUIDE.md for detailed test scenarios
2. **Deploy**: See DEPLOYMENT_READY.md for production setup
3. **Enhance**: Add features like turn timers, animations, etc.

## Still Want to Build?

```bash
# Install dependencies (one time)
pnpm install

# Development with hot reload
pnpm dev

# Build for production
pnpm build

# Run tests
pnpm test
```

---

**Questions?** See TEST_GUIDE.md or DEPLOYMENT_READY.md

**Ready to play?** ➡️ Open http://localhost:5173 now! 🎮

