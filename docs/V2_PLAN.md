# La Base v2 — plan

v2 = the full La Base logic (rules, engine, multiplayer) + the first-person 3D table UI developed in
`~/github/truco-mesa-muestra` (skill `art-directing-dread-card-tables`).

## Stage 1 (now): new UI on the existing backend
Backend stays Fastify + Socket.io (in-memory rooms), same events. Only additive server changes:

1. **Optional database**: without `DATABASE_URL` the server runs guest-only (auth/rankings answer 503).
2. **Presence relay** (cosmetic, never game state, never card identities), rate-limited per socket:
   - `presence:look {yaw, pitch}`: where each player is looking.
   - `presence:arm {slot, fwd, lat, holding}`: the hand moving a card; feints are visible live.
   - `presence:hover {slot}`: fingering a card in the hand.
   The server rebroadcasts to the room as `presence:*` with the `playerId` attached.

Client (`packages/client`):
- `src/table3d/`: engine ported from the sample (look, cardFace, cards, seats, table, avatar, play,
  post, jobs, audio). Seats come from the server's player order: local player = seat 0, and seats
  follow the server's turn order so antihorario/horario match what players see.
- `TableScene` (vanilla three, mounted by a React component) reacts to store/socket events:
  - `player:hand` at round start → deal from the dealer.
  - `game:cardPlayed` → the owner's gesture (face-down travel, reveal at the owner's play zone).
    Local plays are already animated by the player's own arm.
  - `game:baseResolved` → the winning player's team collects the cards (the gather animation).
  - Hands of up to 6 cards (fan), 2 decks with 8 players.
- Local input: short click plays, hold moves the arm. Releasing over the zone emits `card:play`
  (with the As de Copas it first asks: keep/invert direction).
- Non-card phases as **dark minimal overlays** over the live table: initial draw, bidding and
  kamikaze, Oros chooser, round scoring, game over. HUD: scores, bases won, bids, whose turn.
- Lobby/auth/waiting/config screens restyled with the same tokens (palette, IM Fell / VT323).

Transport isolated in `src/net/` so Stage 2 can swap Socket.io for native WebSockets.

## Stage 2 (later)
Cloudflare Workers + one Durable Object per room (state survives restarts) + D1 for
accounts/rankings/history (`game_records` is never written today). R2 only if heavy assets,
user uploads or replays appear.

## Later
Fully diegetic phases: declare with beans/tokens on the table, choose direction by turning an
object, point at a teammate with the hand.

Noted for the future (not started):
- **Idle animations for the characters** (random, to make the room feel alive): lighting a
  cigarette (with smoke), a comic speech bubble with a curse, slapping a neighbour, a little
  dance, etc. Not during reveals or the decisive moments.
- **Game modules**: turn the table into a platform where each card game is a selectable module
  (La Base is the first). Potentially community modules through the Steam Workshop.
- **Voice**: ask for microphone permission only to animate the speaking player's mask (audio is
  not transmitted at first: people use Discord). Later, optional voice chat for the table and a
  team-only channel.
- **Señas anti-cheat**: done — the server only sends a seña to who can see it (partners, or a
  rival whose look rests on the signer's face). A client can still lie about where it looks, but
  one gaze covers one face and must dwell on it.

## Verification
- `pnpm -r build`, the shared tests (75 passing at import).
- Headless multi-client e2e (4 browsers): create/join, config, start, initial draw, bidding, play a
  base, check the reveal and the gather, with screenshots of each phase.
