/**
 * Socket.io event handlers for La Base game
 */

import type { Server as SocketIOServer, Socket } from 'socket.io';
import { roomManager } from './rooms.js';
import { BOT_TOKEN, botNameFor, spawnBot } from './bots.js';
import { SenaDelivery } from './senaDelivery.js';
import type { RoomPlayer } from './rooms.js';
import { BID_CLOCK_OPTIONS, avatarOrRandom, randomAvatar, sanitizeAvatar, CLOCK_AFTER_DEAL_MS, isPieBidRule, cardRank, clockLeft, dealAnimationMs, isSena, pressClock, startClock, type AssignedTeam, type GameState, type Card } from '@la-base/shared';
import {
  createShuffledDeck,
  dealCards,
  validatePieBid,
  getValidPieBidRange,
  completeBase,
  updateBasesWon,
  isRoundComplete,
  scoreRound,
  applyRoundScores,
  checkKamikazeViolation,
  resetRoundState,
  getNextPlayerInTurn,
  allPlayersPlayed,
  getFirstPlayerFromOtherTeam,
} from './game-logic.js';

type ClockTimers = { start?: ReturnType<typeof setTimeout>; flag?: ReturnType<typeof setTimeout> };
const clockTimers = new Map<string, ClockTimers>();
function clearClock(roomCode: string) {
  const t = clockTimers.get(roomCode);
  if (t?.start) clearTimeout(t.start);
  if (t?.flag) clearTimeout(t.flag);
  clockTimers.delete(roomCode);
}

export function setupSocketHandlers(io: SocketIOServer) {
  // señas go only to the players who can see them (see senaDelivery.ts)
  const senaDelivery = new SenaDelivery(
    (socketId, payload) => io.to(socketId).emit('sena:made', payload),
    undefined,
    (signerSocketId, info) => io.to(signerSocketId).emit('sena:seen', info), // a rival caught your seña
  );
  io.on('connection', (socket: Socket) => {
    socket.onAny((_event: string, payload: unknown) => {
      const code = (payload as { roomCode?: unknown } | null)?.roomCode;
      if (typeof code === 'string') roomManager.touch(code);
    });
    console.log(`Player connected: ${socket.id}`);

    const publicRoomPlayers = (players: any[]) => players.map((p) => ({
      id: p.id,
      name: p.name,
      team: p.team,
      isConnected: p.isConnected,
      isBot: Boolean(p.isBot),
      avatar: p.avatar,
      handCount: p.hand.length,
    }));

    const sendPrivateHands = (room: any) => {
      room.players.forEach((player: any) => {
        const playerSocket = io.sockets.sockets.get(player.socketId);
        if (playerSocket) {
          playerSocket.emit('player:hand', { hand: player.hand, dealerPlayerId: room.gameState?.dealerPlayerId ?? null, roundIndex: room.gameState?.roundIndex ?? 0 });
        }
      });
    };

    const dealCurrentRound = (room: any) => {
      if (!room.gameState) return;
      const cardsPerPlayer = room.gameState.structureSequence[room.gameState.roundIndex];
      dealCards(room.players, cardsPerPlayer);
      sendPrivateHands(room);
    };

    // ---- the bidding clock (chess clock) ----------------------------------------------------
    const otherTeam = (t: AssignedTeam): AssignedTeam => (t === 'nosotros' ? 'ellos' : 'nosotros');
    const manoTeamOf = (room: any): AssignedTeam | null =>
      (room.players.find((p: RoomPlayer) => p.id === room.gameState?.currentManoPlayerId)?.team as AssignedTeam) ?? null;

    /** The flag falls: the team whose time ran out while bidding loses the game. */
    const flagFall = (roomCode: string, team: AssignedTeam) => {
      const room = roomManager.getRoom(roomCode);
      const st = room?.gameState;
      const c = st?.bidClock;
      if (!room || !st || !c || st.phase !== 'bidding' || c.running !== team) return;
      if (clockLeft(c, team, Date.now()) > 0) return armFlag(roomCode); // pressed meanwhile
      st.bidClock = pressClock(c, Date.now(), null);
      clearClock(roomCode);
      io.to(roomCode).emit('game:gameOver', { winner: otherTeam(team), reason: 'Time out', finalScores: st.scores, flaggedTeam: team });
      st.phase = 'game_over';
      io.to(roomCode).emit('game:state', st);
    };

    /** (Re)arm the timer for whoever's time is running now. */
    const armFlag = (roomCode: string) => {
      const timers = clockTimers.get(roomCode) ?? {};
      if (timers.flag) clearTimeout(timers.flag);
      const c = roomManager.getRoom(roomCode)?.gameState?.bidClock;
      if (c?.running) {
        const team = c.running;
        timers.flag = setTimeout(() => flagFall(roomCode, team), clockLeft(c, team, Date.now()) + 50);
      } else timers.flag = undefined;
      clockTimers.set(roomCode, timers);
    };

    /**
     * A bidding phase begins: the Mano's team's time starts once the cards have been dealt
     * (nobody can bid during the deal animation).
     */
    const startBidClock = (roomCode: string) => {
      const room = roomManager.getRoom(roomCode);
      const st = room?.gameState;
      if (!room || !st?.bidClock) return;
      clearClock(roomCode);
      const team = manoTeamOf(room);
      if (!team) return;
      const deal = dealAnimationMs(Math.max(2, room.players.length), st.structureSequence[st.roundIndex] ?? 1);
      const timers = { start: setTimeout(() => {
        const cur = roomManager.getRoom(roomCode)?.gameState;
        if (!cur?.bidClock || cur.phase !== 'bidding' || cur.bids.length !== 0 || cur.bidClock.running) return;
        cur.bidClock = startClock(cur.bidClock, team, Date.now());
        armFlag(roomCode);
        io.to(roomCode).emit('game:state', cur);
      }, deal + CLOCK_AFTER_DEAL_MS) } as ClockTimers;
      clockTimers.set(roomCode, timers);
    };

    const beginBiddingAfterInitialDraw = (roomCode: string) => {
      const room = roomManager.getRoom(roomCode);
      if (!room || !room.gameState || room.gameState.phase !== 'initial_draw') return;

      room.gameState.phase = 'bidding';
      room.gameState.currentTurnPlayerId = room.gameState.currentManoPlayerId;
      room.gameState.currentBidPlayerId = room.gameState.currentManoPlayerId;
      dealCurrentRound(room);
      startBidClock(roomCode);

      io.to(roomCode).emit('room:updated', {
        players: publicRoomPlayers(room.players),
      });
      io.to(roomCode).emit('game:state', room.gameState);
    };

    const getInitialDrawWinner = (drawnCards: NonNullable<GameState['initialDraw']>['drawnCards']) => {
      return drawnCards.reduce((best, current) => {
        const bestRank = cardRank(best.card);
        const currentRank = cardRank(current.card);
        if (currentRank > bestRank) return current;
        if (currentRank === bestRank && current.order < best.order) return current;
        return best;
      }, drawnCards[0]);
    };

    const getFirstConnectedPlayerFromOtherTeam = (
      players: RoomPlayer[],
      currentPlayerId: string,
      direction: 'antihorario' | 'horario'
    ): RoomPlayer | null => {
      const currentPlayer = players.find((player) => player.id === currentPlayerId);
      if (!currentPlayer) return null;

      let nextPlayer = getNextPlayerInTurn(players, currentPlayerId, direction, currentPlayerId);
      for (let i = 0; i < players.length - 1; i++) {
        if (!nextPlayer) return null;
        if (nextPlayer.team !== currentPlayer.team && nextPlayer.isConnected) {
          return nextPlayer;
        }
        nextPlayer = getNextPlayerInTurn(players, nextPlayer.id, direction, currentPlayerId);
      }

      return null;
    };

    const continueAfterBaseResolution = (roomCode: string) => {
      const room = roomManager.getRoom(roomCode);
      if (!room || !room.gameState) return;

      const maxBases = room.gameState.structureSequence[room.gameState.roundIndex];
      room.gameState.currentBaseCards = [];
      room.gameState.phase = 'playing';

      io.to(roomCode).emit('game:nextBase', {
        basesPlayed: room.gameState.basesWon.nosotros + room.gameState.basesWon.ellos,
        basesRemaining: maxBases - (room.gameState.basesWon.nosotros + room.gameState.basesWon.ellos),
      });
      io.to(roomCode).emit('game:state', room.gameState);
    };

    const resolveCompletedBase = (roomCode: string): { success: boolean; error?: string } => {
      const room = roomManager.getRoom(roomCode);
      if (!room || !room.gameState) {
        return { success: false, error: 'Game not found' };
      }

      if (room.gameState.currentBaseCards.length !== room.players.length) {
        return { success: false, error: 'Faltan jugadores por jugar' };
      }

      const { winner, winnerTeam } = completeBase(
        room.gameState.currentBaseCards,
        room.gameState,
        room.players
      );

      updateBasesWon(room.gameState, winnerTeam);
      room.gameState.currentManoPlayerId = winner.id;
      room.gameState.currentTurnPlayerId = winner.id;
      room.gameState.lastBaseWinnerPlayerId = winner.id;

      io.to(roomCode).emit('game:baseResolved', {
        winner: winner.name,
        winnerPlayerId: winner.id,
        winnerTeam,
        basesWon: room.gameState.basesWon,
        cards: room.gameState.currentBaseCards,
      });

      const maxBases = room.gameState.structureSequence[room.gameState.roundIndex];
      const basesPlayed = room.gameState.basesWon.nosotros + room.gameState.basesWon.ellos;
      const gateBase = {
        readyPlayerIds: [] as string[],
        baseCards: [...room.gameState.currentBaseCards],
        winnerPlayerId: winner.id,
        winnerTeam: winnerTeam as 'nosotros' | 'ellos',
        baseNumber: basesPlayed,
        basesInRound: maxBases,
      };

      if (isRoundComplete(room.gameState, maxBases)) {
        const { nosotrosScore, ellosScore } = scoreRound(room.gameState);
        const kamikazeViolation = checkKamikazeViolation(room.gameState);

        if (kamikazeViolation) {
          const manoBid = room.gameState.bids[0];
          io.to(roomCode).emit('game:gameOver', {
            winner: manoBid.team === 'nosotros' ? 'ellos' : 'nosotros',
            reason: 'Kamikaze violation - Mano lost by 2+ bases',
            finalScores: room.gameState.scores,
          });

          room.gameState.phase = 'game_over';
          io.to(roomCode).emit('game:state', room.gameState);
          return { success: true };
        }

        applyRoundScores(room.gameState, nosotrosScore, ellosScore);

        io.to(roomCode).emit('game:roundScored', {
          nosotrosScore,
          ellosScore,
          totalScores: room.gameState.scores,
          round: room.gameState.roundIndex,
        });

        const lastRound = room.gameState.roundIndex >= room.gameState.structureSequence.length - 1;
        const tied = room.gameState.scores.nosotros === room.gameState.scores.ellos;
        if (lastRound && tied && !room.gameState.tiebreak) {
          // tie: two more rounds with the structure's most bases (the deal keeps rotating, so the
          // Mano alternates between the teams); the game goes on below as after any round
          const most = Math.max(...room.gameState.structureSequence);
          room.gameState.structureSequence = [...room.gameState.structureSequence, most, most];
          room.gameState.tiebreak = true;
          io.to(roomCode).emit('game:tiebreak', { rounds: 2, bases: most, scores: room.gameState.scores });
        } else if (lastRound) {
          // after the tiebreak a tie stands: both teams win (rulebook FAQ)
          const { nosotros, ellos } = room.gameState.scores;
          io.to(roomCode).emit('game:gameOver', {
            winner: nosotros > ellos ? 'nosotros' : ellos > nosotros ? 'ellos' : 'empate',
            reason: nosotros === ellos ? 'Tie after tiebreak' : room.gameState.tiebreak ? 'Tiebreak complete' : 'All rounds complete',
            finalScores: room.gameState.scores,
          });

          room.gameState.phase = 'game_over';
          io.to(roomCode).emit('game:state', room.gameState);
          return { success: true };
        }

        // v2: wait until everybody has read the round before dealing the next one
        room.gameState.readyGate = {
          kind: 'round',
          ...gateBase,
          round: {
            index: room.gameState.roundIndex,
            bids: [...room.gameState.bids],
            basesWon: { ...room.gameState.basesWon },
            points: { nosotros: nosotrosScore, ellos: ellosScore },
            totals: { ...room.gameState.scores },
          },
        };
        room.gameState.phase = 'round_scoring';
        io.to(roomCode).emit('game:state', room.gameState);
        return { success: true };
      }

      // v2: wait until everybody has seen the base (cards stay on the table)
      room.gameState.readyGate = { kind: 'base', ...gateBase };
      room.gameState.phase = 'base_resolution';
      io.to(roomCode).emit('game:state', room.gameState);
      return { success: true };
    };

    /** Everyone confirmed: collect the base and go on (Oros choice, next base, or next round). */
    const releaseReadyGate = (roomCode: string) => {
      const room = roomManager.getRoom(roomCode);
      const gate = room?.gameState?.readyGate;
      if (!room || !room.gameState || !gate) return;
      room.gameState.readyGate = null;
      io.to(roomCode).emit('game:gateReleased', { kind: gate.kind, winnerPlayerId: gate.winnerPlayerId });

      if (gate.kind === 'round') {
        resetRoundState(room.gameState);
        // the deal rotates (antihorario) and the first player to receive cards is the new Mano —
        // never the last base's winner (an As de Oros on the last base has no effect)
        const prevDealer = room.gameState.dealerPlayerId ?? room.players[0].id;
        const dealer = getNextPlayerInTurn(room.players, prevDealer, 'antihorario', prevDealer) ?? room.players[0];
        const mano = getNextPlayerInTurn(room.players, dealer.id, 'antihorario', dealer.id) ?? dealer;
        room.gameState.dealerPlayerId = dealer.id;
        room.gameState.currentManoPlayerId = mano.id;
        room.players.forEach((p) => (p.isMano = p.id === mano.id));
        room.gameState.phase = 'bidding';
        room.gameState.currentTurnPlayerId = room.gameState.currentManoPlayerId;
        room.gameState.currentBidPlayerId = room.gameState.currentManoPlayerId;
        dealCurrentRound(room);
        startBidClock(roomCode);
        io.to(roomCode).emit('room:updated', { players: publicRoomPlayers(room.players) });
        io.to(roomCode).emit('game:roundComplete', { nextRound: room.gameState.roundIndex });
        io.to(roomCode).emit('game:state', room.gameState);
        return;
      }

      const asOrosCard = gate.baseCards.find((played) => played.card.suit === 'oros' && played.card.value === 1);
      const asOrosPlayer = asOrosCard ? room.players.find((player) => player.id === asOrosCard.playerId) : null;
      if (room.gameState.acePowers.oros && asOrosPlayer && asOrosPlayer.team === gate.winnerTeam) {
        room.gameState.pendingOrosChoice = {
          chooserPlayerId: asOrosPlayer.id,
          team: asOrosPlayer.team,
          options: room.players.filter((player) => player.team === asOrosPlayer.team).map((player) => player.id),
        };
        room.gameState.currentBaseCards = [];
        room.gameState.phase = 'base_resolution';
        io.to(roomCode).emit('game:state', room.gameState);
        return;
      }
      continueAfterBaseResolution(roomCode);
    };

    /** Release the gate when every connected player is ready (disconnected players never block it). */
    const checkReadyGate = (roomCode: string) => {
      const room = roomManager.getRoom(roomCode);
      const gate = room?.gameState?.readyGate;
      if (!room || !gate) return;
      const pending = room.players.filter((p) => p.isConnected && !gate.readyPlayerIds.includes(p.id));
      if (pending.length === 0) releaseReadyGate(roomCode);
    };

    /**
     * room:create - Create a new game room
     */
    socket.on('room:create', (payload: { playerName: string; playerCount: number; avatar?: unknown }, callback) => {
      try {
        const playerId = socket.id; // Use socket ID as player ID
        const room = roomManager.createRoom(playerId, payload.playerName, payload.playerCount, 'clasica');
        const player = room.players[0];
        player.socketId = socket.id;
        player.isConnected = true;
        player.avatar = avatarOrRandom(payload.avatar); // a made-up face never gets past here

        // Join socket to room
        socket.join(room.roomCode);

        // Emit initial room state
        io.to(room.roomCode).emit('room:updated', {
          players: publicRoomPlayers(room.players),
        });

        callback({
          success: true,
          roomCode: room.roomCode,
          reconnectToken: player.reconnectToken,
          player,
          players: publicRoomPlayers(room.players),
        });

        console.log(`Room created: ${room.roomCode} by ${payload.playerName}`);
      } catch (err) {
        callback({ success: false, error: (err as Error).message });
      }
    });

    /**
     * room:join - Join an existing room
     */
    socket.on('room:join', (payload: { roomCode: string; playerName: string; isBot?: boolean; avatar?: unknown }, callback) => {
      try {
        const playerId = socket.id;
        const player = roomManager.joinRoom(payload.roomCode, playerId, payload.playerName, socket.id);
        // only our own in-process bots (holding the startup secret) may flag themselves as bots
        if (player && payload.isBot && socket.handshake.auth?.botToken === BOT_TOKEN) player.isBot = true;
        // everyone has a face: the one they sent if it is well formed, the one they already had, or a random one (bots)
        if (player) player.avatar = sanitizeAvatar(payload.avatar) ?? player.avatar ?? randomAvatar();

        if (!player) {
          console.log(`[room:join] FAILED: Cannot join room ${payload.roomCode}`);
          callback({ success: false, error: 'No se puede entrar a la sala' });
          return;
        }

        const room = roomManager.getRoom(payload.roomCode);
        if (!room) {
          console.log(`[room:join] FAILED: Room ${payload.roomCode} not found`);
          callback({ success: false, error: 'Sala no encontrada' });
          return;
        }

        // Join socket to room
        socket.join(payload.roomCode);
        console.log(`[room:join] Player ${payload.playerName} joined room ${payload.roomCode}. Total players: ${room.players.length}`);

        // Notify all players in room
        const playerData = publicRoomPlayers(room.players);

        console.log(`[room:join] Emitting room:updated to ${payload.roomCode} with ${playerData.length} players`);
        io.to(payload.roomCode).emit('room:updated', {
          players: playerData,
        });

        callback({
          success: true,
          roomCode: payload.roomCode,
          reconnectToken: player.reconnectToken,
          player,
          players: playerData,
        });
      } catch (err) {
        console.log(`[room:join] ERROR:`, (err as Error).message);
        callback({ success: false, error: (err as Error).message });
      }
    });

    /**
     * room:addBot - Host adds an in-app bot to the room (before the game starts)
     */
    socket.on('room:addBot', async (payload: { roomCode: string }, callback?: (res: { success: boolean; error?: string }) => void) => {
      try {
        const room = roomManager.getRoom(payload?.roomCode);
        const requester = room?.players.find((p) => p.socketId === socket.id);
        if (!room || !requester || room.host !== requester.id) {
          callback?.({ success: false, error: 'Sólo el anfitrión puede agregar bots' });
          return;
        }
        if (room.gameState) {
          callback?.({ success: false, error: 'La partida ya empezó' });
          return;
        }
        if (room.players.length >= room.maxPlayers) {
          callback?.({ success: false, error: 'La sala está llena' });
          return;
        }
        const name = botNameFor(room.roomCode, room.players.map((p) => p.name));
        callback?.(await spawnBot(room.roomCode, name));
      } catch (err) {
        callback?.({ success: false, error: (err as Error).message });
      }
    });

    /**
     * room:reconnect - Reconnect with token
     */
    socket.on('room:reconnect', (payload: { reconnectToken: string }, callback) => {
      try {
        const player = roomManager.reconnectPlayer(payload.reconnectToken, socket.id);

        if (!player) {
          callback({ success: false, error: 'Reconexión inválida o vencida' });
          return;
        }

        // Find room code from reconnect token (we need to search, this is a bit inefficient but works for MVP)
        // In production, store this in the token payload
        const rooms = roomManager.getAllRooms();
        const room = rooms.find((r) => r.players.some((p) => p.id === player.id));

        if (!room) {
          callback({ success: false, error: 'Sala no encontrada' });
          return;
        }

        socket.join(room.roomCode);

        // Send full room state to reconnected player
        io.to(room.roomCode).emit('room:updated', {
          players: publicRoomPlayers(room.players),
        });

        // Send game state if game started
        if (room.gameState) {
          socket.emit('game:state', room.gameState);
          // Send private hand
          socket.emit('player:hand', { hand: player.hand });
        }

        callback({
          success: true,
          roomCode: room.roomCode,
          player,
          players: publicRoomPlayers(room.players),
          gameState: room.gameState,
        });

        console.log(`Player ${player.name} reconnected to room ${room.roomCode}`);
      } catch (err) {
        callback({ success: false, error: (err as Error).message });
      }
    });

    /**
     * room:leave - Leave the current room.
     */
    socket.on('room:leave', (payload: { roomCode: string }, callback) => {
      try {
        const room = roomManager.getRoom(payload.roomCode);
        if (!room) {
          callback?.({ success: true });
          return;
        }

        const player = room.players.find((p) => p.socketId === socket.id);
        if (player) {
          if (room.gameState) {
            roomManager.disconnectPlayer(payload.roomCode, player.id);
          } else {
            roomManager.removePlayer(payload.roomCode, player.id);
          }
          socket.leave(payload.roomCode);
        }

        const updatedRoom = roomManager.getRoom(payload.roomCode);
        if (updatedRoom) {
          io.to(payload.roomCode).emit('room:updated', {
            players: publicRoomPlayers(updatedRoom.players),
          });
        }

        callback?.({ success: true });
      } catch (err) {
        callback?.({ success: false, error: (err as Error).message });
      }
    });

    /**
     * room:kick - Host removes a player from the waiting room.
     */
    socket.on('room:kick', (payload: { roomCode: string; playerId: string }, callback) => {
      try {
        const room = roomManager.getRoom(payload.roomCode);
        if (!room) {
          callback?.({ success: false, error: 'Sala no encontrada' });
          return;
        }

        const requester = room.players.find((player) => player.socketId === socket.id);
        if (!requester || room.host !== requester.id) {
          callback?.({ success: false, error: 'Solo el anfitrión puede echar jugadores' });
          return;
        }

        if (room.gameState) {
          callback?.({ success: false, error: 'No se puede echar jugadores con la partida iniciada' });
          return;
        }

        if (payload.playerId === room.host) {
          callback?.({ success: false, error: 'No puedes echarte a ti mismo' });
          return;
        }

        const player = room.players.find((p) => p.id === payload.playerId);
        if (!player) {
          callback?.({ success: false, error: 'Jugador no encontrado' });
          return;
        }

        const playerSocket = io.sockets.sockets.get(player.socketId);
        if (playerSocket) {
          playerSocket.emit('room:kicked', { roomCode: payload.roomCode });
          playerSocket.leave(payload.roomCode);
        }

        roomManager.removePlayer(payload.roomCode, payload.playerId);

        const updatedRoom = roomManager.getRoom(payload.roomCode);
        if (updatedRoom) {
          io.to(payload.roomCode).emit('room:updated', {
            players: publicRoomPlayers(updatedRoom.players),
          });
        }

        callback?.({ success: true });
      } catch (err) {
        callback?.({ success: false, error: (err as Error).message });
      }
    });

    /**
     * game:config - Host configures game settings
     */
    socket.on('game:config', (payload: { roomCode: string; structure: string; acePowers: any; customStructure?: number[]; kamikazesPerTeam?: number; bidClockMs?: number; pieBidRule?: string }, callback) => {
      try {
        const room = roomManager.getRoom(payload.roomCode);
        const requester = room?.players.find((player) => player.socketId === socket.id);
        if (!room || !requester || room.host !== requester.id) {
          callback({ success: false, error: 'Not room host' });
          return;
        }

        room.structure = payload.structure as any;
        room.acePowers = payload.acePowers;
        if (payload.customStructure) {
          room.customStructure = payload.customStructure;
        }
        if (payload.kamikazesPerTeam !== undefined) {
          room.kamikazesPerTeam = Math.max(0, Math.min(3, payload.kamikazesPerTeam));
        }
        if (payload.pieBidRule !== undefined) {
          room.pieBidRule = isPieBidRule(payload.pieBidRule) ? payload.pieBidRule : 'estricta';
        }
        if (payload.bidClockMs !== undefined) {
          const allowed = (BID_CLOCK_OPTIONS as readonly number[]).includes(payload.bidClockMs) || (process.env.LABASE_TEST === '1' && payload.bidClockMs > 0) // tests: short clocks
          room.bidClockMs = allowed ? payload.bidClockMs : 0;
        }

        io.to(payload.roomCode).emit('game:config', {
          structure: room.structure,
          acePowers: room.acePowers,
          kamikazesPerTeam: room.kamikazesPerTeam,
          bidClockMs: room.bidClockMs,
          pieBidRule: room.pieBidRule,
        });

        callback({ success: true });
        console.log(`Game config set in room ${payload.roomCode}`);
      } catch (err) {
        callback({ success: false, error: (err as Error).message });
      }
    });

    /**
     * Reorder players so teams alternate around the table
     * Ensures no two players from same team sit consecutively
     */
    const reorderPlayersForTeamBalance = (players: RoomPlayer[]): RoomPlayer[] => {
      // Group players by team
      const nosotrosPlayers = players.filter(p => p.team === 'nosotros');
      const ellosPlayers = players.filter(p => p.team === 'ellos');

      const result: RoomPlayer[] = [];
      let nosotrosIdx = 0;
      let ellosIdx = 0;

      // Alternate between teams, starting with the team that has more players
      const startWithNosotros = nosotrosPlayers.length >= ellosPlayers.length;

      while (nosotrosIdx < nosotrosPlayers.length || ellosIdx < ellosPlayers.length) {
        if (startWithNosotros) {
          if (nosotrosIdx < nosotrosPlayers.length) result.push(nosotrosPlayers[nosotrosIdx++]);
          if (ellosIdx < ellosPlayers.length) result.push(ellosPlayers[ellosIdx++]);
        } else {
          if (ellosIdx < ellosPlayers.length) result.push(ellosPlayers[ellosIdx++]);
          if (nosotrosIdx < nosotrosPlayers.length) result.push(nosotrosPlayers[nosotrosIdx++]);
        }
      }

      return result;
    };

    /**
     * game:start - Host starts the game
     */
    socket.on('game:start', (payload: { roomCode: string }, callback) => {
      try {
        const room = roomManager.getRoom(payload.roomCode);
        const requester = room?.players.find((player) => player.socketId === socket.id);
        if (!room || !requester || room.host !== requester.id) {
          callback({ success: false, error: 'Not room host' });
          return;
        }

        // Auto-assign random team selections conditioned by fixed team balance
        // Count current fixed team members
        let nosotrosCount = room.players.filter(p => p.team === 'nosotros').length;
        let ellosCount = room.players.filter(p => p.team === 'ellos').length;
        const randomPlayers = room.players.filter(p => p.team === 'random');

        // Assign each random player to the team with fewer members
        randomPlayers.forEach((player) => {
          if (nosotrosCount < ellosCount) {
            player.team = 'nosotros';
            nosotrosCount++;
          } else if (ellosCount < nosotrosCount) {
            player.team = 'ellos';
            ellosCount++;
          } else {
            // Equal teams, randomly assign
            const assignToNosotros = Math.random() < 0.5;
            player.team = assignToNosotros ? 'nosotros' : 'ellos';
            if (assignToNosotros) nosotrosCount++;
            else ellosCount++;
          }
          console.log(`Auto-assigned player ${player.name} to team: ${player.team}`);
        });

        // Reorder players so teams alternate around the table
        room.players = reorderPlayersForTeamBalance(room.players);
        console.log(`Players reordered for team alternation: ${room.players.map(p => `${p.name}(${p.team})`).join(' -> ')}`);

        const gameState = roomManager.startGame(payload.roomCode, room.structure, room.customStructure, room.acePowers, room.kamikazesPerTeam);

        if (!gameState) {
          callback({ success: false, error: 'No se pudo iniciar la partida' });
          return;
        }

        const hostPlayer = room.players.find((player) => player.id === room.host) || room.players[0];
        room.initialDrawDeck = createShuffledDeck();

        gameState.phase = 'initial_draw';
        gameState.currentTurnPlayerId = hostPlayer.id;
        gameState.currentBidPlayerId = null;
        gameState.initialDraw = {
          currentDrawerPlayerId: hostPlayer.id,
          drawnCards: [],
          dealerPlayerId: null,
          manoPlayerId: null,
          completed: false,
        };

        io.to(payload.roomCode).emit('room:updated', {
          players: publicRoomPlayers(room.players),
        });

        // Send game state to all players
        io.to(payload.roomCode).emit('game:state', gameState);

        callback({ success: true, gameState });
        console.log(`Initial draw started in room ${payload.roomCode} from host ${hostPlayer.name}`);
      } catch (err) {
        callback({ success: false, error: (err as Error).message });
      }
    });

    /**
     * draw:initialCard - Initial draw to decide who deals and who is Mano.
     */
    socket.on('draw:initialCard', (payload: { roomCode: string }, callback) => {
      try {
        const room = roomManager.getRoom(payload.roomCode);
        if (!room || !room.gameState || !room.gameState.initialDraw) {
          callback({ success: false, error: 'Sorteo no disponible' });
          return;
        }

        if (room.gameState.phase !== 'initial_draw') {
          callback({ success: false, error: 'El sorteo inicial no está activo' });
          return;
        }

        const player = room.players.find((p) => p.socketId === socket.id);
        if (!player) {
          callback({ success: false, error: 'Jugador no encontrado en la sala' });
          return;
        }

        const initialDraw = room.gameState.initialDraw;
        if (initialDraw.completed) {
          callback({ success: false, error: 'El sorteo ya terminó' });
          return;
        }

        if (initialDraw.currentDrawerPlayerId !== player.id) {
          const currentDrawer = room.players.find((p) => p.id === initialDraw.currentDrawerPlayerId);
          callback({ success: false, error: `Le toca sacar a ${currentDrawer?.name || 'otro jugador'}` });
          return;
        }

        if (initialDraw.drawnCards.some((drawn) => drawn.playerId === player.id)) {
          callback({ success: false, error: 'Ya sacaste una carta' });
          return;
        }

        if (room.initialDrawDeck.length === 0) {
          room.initialDrawDeck = createShuffledDeck();
        }

        const card = room.initialDrawDeck.pop();
        if (!card) {
          callback({ success: false, error: 'No quedan cartas para sortear' });
          return;
        }

        initialDraw.drawnCards.push({
          playerId: player.id,
          card,
          order: initialDraw.drawnCards.length,
        });

        if (initialDraw.drawnCards.length === room.players.length) {
          const winnerDraw = getInitialDrawWinner(initialDraw.drawnCards);
          const dealerPlayer = room.players.find((p) => p.id === winnerDraw.playerId) || player;
          const manoPlayer = getNextPlayerInTurn(
            room.players,
            dealerPlayer.id,
            'antihorario',
            dealerPlayer.id
          ) || dealerPlayer;

          initialDraw.completed = true;
          initialDraw.currentDrawerPlayerId = null;
          initialDraw.dealerPlayerId = dealerPlayer.id;
          room.gameState.dealerPlayerId = dealerPlayer.id;
          initialDraw.manoPlayerId = manoPlayer.id;

          room.gameState.currentManoPlayerId = manoPlayer.id;
          room.gameState.currentTurnPlayerId = manoPlayer.id;
          room.gameState.currentBidPlayerId = null;
          room.players.forEach((roomPlayer) => {
            roomPlayer.isMano = roomPlayer.id === manoPlayer.id;
          });

          console.log(`[initialDraw] ${dealerPlayer.name} reparte. Mano: ${manoPlayer.name}`);
          io.to(payload.roomCode).emit('game:state', room.gameState);

          setTimeout(() => {
            beginBiddingAfterInitialDraw(payload.roomCode);
          }, 1800);
        } else {
          const nextPlayer = getNextPlayerInTurn(
            room.players,
            player.id,
            'antihorario',
            room.host
          );
          initialDraw.currentDrawerPlayerId = nextPlayer?.id || null;
          room.gameState.currentTurnPlayerId = nextPlayer?.id || player.id;
          io.to(payload.roomCode).emit('game:state', room.gameState);
        }

        callback({ success: true, card });
      } catch (err) {
        callback({ success: false, error: (err as Error).message });
      }
    });

    /**
     * player:selectTeam - Player selects their team (nosotros, ellos, or random)
     * No callback - client validates before sending
     * Random assignments are resolved at game start based on fixed team balance
     */
    socket.on('player:selectTeam', (payload: { roomCode: string; playerId: string; teamChoice: 'nosotros' | 'ellos' | 'random' }) => {
      try {
        // Only verify ownership, no error callbacks
        if (socket.id !== payload.playerId) return;

        const room = roomManager.getRoom(payload.roomCode);
        if (!room) return;

        const player = room.players.find((p) => p.id === payload.playerId);
        if (!player) return;

        // Update team selection
        player.team = payload.teamChoice;
        console.log(`Player ${player.name} selected team: ${player.team}`);

        // Emit updated room state to all players
        io.to(payload.roomCode).emit('room:updated', {
          players: publicRoomPlayers(room.players),
        });
      } catch (err) {
        console.error('Error in player:selectTeam:', (err as Error).message);
      }
    });

    /**
     * bid:declare - Declare bid (Mano or Pie)
     */
    socket.on(
      'bid:declare',
      (payload: { roomCode: string; bidValue: number; isKamikaze?: boolean }, callback) => {
        try {
          const room = roomManager.getRoom(payload.roomCode);
          if (!room || !room.gameState) {
            callback({ success: false, error: 'Game not found or not started' });
            return;
          }

          const player = room.players.find((p) => p.socketId === socket.id);
          if (!player) {
            callback({ success: false, error: 'Jugador no encontrado en la sala' });
            return;
          }

          if (room.gameState.phase !== 'bidding') {
            callback({ success: false, error: 'El canto no está activo' });
            return;
          }

          const manoPlayer = room.players.find((p) => p.id === room.gameState!.currentManoPlayerId);
          const manoTeam = manoPlayer?.team;
          if (!manoTeam) {
            callback({ success: false, error: 'Mano player not found' });
            return;
          }

          const expectedTeam = room.gameState.bids.length === 0
            ? manoTeam
            : manoTeam === 'nosotros' ? 'ellos' : 'nosotros';

          if (player.team !== expectedTeam) {
            callback({ success: false, error: `Falta cantar: ${expectedTeam}` });
            return;
          }

          if (room.gameState.currentBidPlayerId !== player.id) {
            const bidPlayer = room.players.find((p) => p.id === room.gameState!.currentBidPlayerId);
            callback({ success: false, error: `Falta cantar: ${bidPlayer?.name || 'otro jugador'}` });
            return;
          }

          const maxBases = room.gameState.structureSequence[room.gameState.roundIndex];
          if (payload.bidValue < 0 || payload.bidValue > maxBases) {
            callback({ success: false, error: `Bid must be between 0 and ${maxBases}` });
            return;
          }

          if (room.gameState.bids.length === 1) {
            const manoBid = room.gameState.bids[0];
            const rule = room.gameState.pieBidRule ?? 'estricta';
            if (!validatePieBid(manoBid.value, payload.bidValue, maxBases, rule)) {
              const allowed = getValidPieBidRange(manoBid.value, maxBases, rule);
              callback({ success: false, error: `Pie can bid ${allowed.join(' or ')} (Mano + Pie must ${rule === 'estricta' ? `be ${maxBases - 1} or ${maxBases + 1}` : `not equal ${maxBases}`})` });
              return;
            }
          }

          // By game time, all teams are assigned (random gets resolved at game start)
          const assignedTeam = player.team as 'nosotros' | 'ellos';

          if (payload.isKamikaze) {
            if (room.gameState.bids.length !== 0) {
              callback({ success: false, error: 'Only Mano can declare Kamikaze' });
              return;
            }
            if (payload.bidValue !== 0 && payload.bidValue !== maxBases) {
              callback({ success: false, error: `Kamikaze must be 0 or ${maxBases}` });
              return;
            }
            if (room.gameState.kamikazesRemaining[assignedTeam] <= 0) {
              callback({ success: false, error: 'No Kamikazes remaining' });
              return;
            }
            room.gameState.kamikazesRemaining[assignedTeam]--;
          }

          const bid: any = {
            team: assignedTeam,
            value: payload.bidValue,
            isKamikaze: payload.isKamikaze || false,
            playerId: player.id,
          };
          if (bid.isKamikaze) {
            room.gameState.kamikazeCalls = [...(room.gameState.kamikazeCalls ?? []), { playerId: player.id, team: assignedTeam, round: room.gameState.roundIndex }];
          }

          room.gameState.bids.push(bid);
          // the bid presses the clock: the other team's time runs, or (second bid) it stops
          if (room.gameState.bidClock) {
            const next = room.gameState.bids.length === 1 ? otherTeam(assignedTeam) : null;
            const timers = clockTimers.get(payload.roomCode);
            if (timers?.start) clearTimeout(timers.start);
            room.gameState.bidClock = pressClock(room.gameState.bidClock, Date.now(), next);
            armFlag(payload.roomCode);
          }

          if (room.gameState.bids.length === 1) {
            const piePlayer = getFirstConnectedPlayerFromOtherTeam(
              room.players,
              room.gameState.currentManoPlayerId,
              room.gameState.playDirection
            ) || getFirstPlayerFromOtherTeam(
              room.players,
              room.gameState.currentManoPlayerId,
              room.gameState.playDirection
            );
            room.gameState.currentBidPlayerId = piePlayer?.id || null;
          }

          // If both teams have declared, move to playing phase
          if (room.gameState.bids.length === 2) {
            room.gameState.phase = 'playing';
            room.gameState.currentBidPlayerId = null;
            // Set current turn to mano (first player to bid) to open the first base
            room.gameState.currentTurnPlayerId = room.gameState.currentManoPlayerId;
            console.log(`[bid:declare] Both bids declared. Starting playing phase. Mano (${room.players.find((p) => p.id === room.gameState!.currentManoPlayerId)?.name}) opens first base`);
          }

          io.to(payload.roomCode).emit('game:bidDeclared', {
            team: player.team,
            bidValue: payload.bidValue,
            isKamikaze: payload.isKamikaze || false,
            totalBids: room.gameState.bids.length,
            playerId: player.id,
          });

          io.to(payload.roomCode).emit('game:state', room.gameState);

          // If both bids declared, auto-transition to playing after a brief delay
          if (room.gameState.bids.length === 2) {
            setTimeout(() => {
              if (room.gameState && room.gameState.phase === 'playing') {
                io.to(payload.roomCode).emit('game:state', room.gameState);
              }
            }, 1000);
          }

          callback({ success: true });
        } catch (err) {
          callback({ success: false, error: (err as Error).message });
        }
      }
    );

    /**
     * bid:bidValueChanged - Broadcast live bid value changes
     */
    socket.on('bid:bidValueChanged', (payload: { roomCode: string; bidValue: number; playerId: string }) => {
      try {
        io.to(payload.roomCode).emit('bid:bidValueUpdated', {
          bidValue: payload.bidValue,
          playerId: payload.playerId,
        });
      } catch (err) {
        console.error('Error in bid:bidValueChanged:', (err as Error).message);
      }
    });

    /**
     * card:play - Play a card
     */
    socket.on('card:play', (payload: { roomCode: string; card: Card; copasDirection?: 'mantener' | 'invertir' }, callback) => {
      try {
        console.log(`[card:play] ${socket.id} trying to play ${payload.card.value}${payload.card.suit} in room ${payload.roomCode}`);

        const room = roomManager.getRoom(payload.roomCode);
        if (!room || !room.gameState) {
          console.log(`[card:play] Room not found: ${payload.roomCode}`);
          callback({ success: false, error: 'Game not found or not started' });
          return;
        }

        const player = room.players.find((p) => p.socketId === socket.id);
        if (!player) {
          console.log(`[card:play] Player not found in room: ${socket.id}`);
          callback({ success: false, error: 'Jugador no encontrado en la sala' });
          return;
        }

        if (room.gameState.phase !== 'playing') {
          console.log(`[card:play] Wrong phase: ${room.gameState.phase}`);
          callback({ success: false, error: 'It is not time to play cards' });
          return;
        }

        if (room.gameState.currentTurnPlayerId !== player.id) {
          const currentTurnPlayer = room.players.find((p) => p.id === room.gameState!.currentTurnPlayerId);
          console.log(`[card:play] Not player's turn. Current: ${currentTurnPlayer?.name}`);
          callback({ success: false, error: `It is ${currentTurnPlayer?.name || 'another player'}'s turn` });
          return;
        }

        if (room.gameState.currentBaseCards.some((played) => played.playerId === player.id)) {
          console.log(`[card:play] Player already played in this base`);
          callback({ success: false, error: 'You already played in this base' });
          return;
        }

        // Validate card is in hand
        const cardInHand = player.hand.some((c) => c.suit === payload.card.suit && c.value === payload.card.value);
        if (!cardInHand) {
          console.log(`[card:play] Card not in hand`);
          callback({ success: false, error: 'Card not in hand' });
          return;
        }

        const cardIndex = player.hand.findIndex(
          (c) => c.suit === payload.card.suit && c.value === payload.card.value
        );

        // Add to played cards
        const playedCard = {
          playerId: player.id,
          card: payload.card,
          order: room.gameState.currentBaseCards.length,
        };

        room.gameState.currentBaseCards.push(playedCard);
        player.hand.splice(cardIndex, 1);
        console.log(`[card:play] Card played successfully by ${player.name}`);

        if (
          room.gameState.acePowers.copas &&
          payload.card.suit === 'copas' &&
          payload.card.value === 1 &&
          payload.copasDirection === 'invertir'
        ) {
          room.gameState.playDirection = room.gameState.playDirection === 'antihorario' ? 'horario' : 'antihorario';
          console.log(`[card:play] Play direction inverted to ${room.gameState.playDirection}`);
        }

        if (allPlayersPlayed(room.gameState.currentBaseCards, room.players.length)) {
          console.log(`[card:play] All players played, resolving base`);
          room.gameState.phase = 'base_resolution';
          setTimeout(() => {
            try {
              const result = resolveCompletedBase(payload.roomCode);
              if (!result.success) {
                console.log(`[base:autoResolve] ${result.error}`);
              }
            } catch (timeoutErr) {
              console.error(`[base:autoResolve] Error:`, timeoutErr);
            }
          }, 900);
        } else {
          // next in the (possibly just inverted) direction who hasn't played in this base yet:
          // after an As de Copas flips the direction, the neighbour may already have played
          const played = new Set(room.gameState.currentBaseCards.map((c) => c.playerId));
          let nextPlayer = getNextPlayerInTurn(room.players, player.id, room.gameState.playDirection, room.gameState.currentManoPlayerId);
          for (let i = 0; nextPlayer && played.has(nextPlayer.id) && i < room.players.length; i++) {
            nextPlayer = getNextPlayerInTurn(room.players, nextPlayer.id, room.gameState.playDirection, room.gameState.currentManoPlayerId);
          }
          if (nextPlayer && !played.has(nextPlayer.id)) {
            room.gameState.currentTurnPlayerId = nextPlayer.id;
            console.log(`[card:play] Next player: ${nextPlayer.name}`);
          }
        }

        // Notify all players
        io.to(payload.roomCode).emit('game:cardPlayed', {
          playerId: player.id,
          playerName: player.name,
          card: payload.card,
          order: playedCard.order,
          cardsPlayed: room.gameState.currentBaseCards.length,
        });
        io.to(payload.roomCode).emit('room:updated', {
          players: publicRoomPlayers(room.players),
        });
        io.to(payload.roomCode).emit('game:state', room.gameState);
        socket.emit('player:hand', { hand: player.hand });

        callback({ success: true, playedCard });
      } catch (err) {
        console.error(`[card:play] Caught error:`, err);
        callback({ success: false, error: (err as Error).message });
      }
    });

    /**
     * base:complete - Resolve a base and check if round complete
     */
    socket.on('base:complete', (payload: { roomCode: string }, callback) => {
      try {
        const room = roomManager.getRoom(payload.roomCode);
        if (!room || !room.gameState) {
          callback({ success: false, error: 'Game not found' });
          return;
        }

        if (room.gameState.currentBaseCards.length !== room.players.length) {
          callback({ success: false, error: 'Faltan jugadores por jugar' });
          return;
        }

        callback(resolveCompletedBase(payload.roomCode));
      } catch (err) {
        callback({ success: false, error: (err as Error).message });
      }
    });

    /**
     * ace:oros:choose - As de Oros owner chooses who opens next base.
     */
    socket.on('ace:oros:choose', (payload: { roomCode: string; playerId: string }, callback) => {
      try {
        const room = roomManager.getRoom(payload.roomCode);
        if (!room || !room.gameState || !room.gameState.pendingOrosChoice) {
          callback({ success: false, error: 'No Oros choice pending' });
          return;
        }

        const chooser = room.players.find((player) => player.socketId === socket.id);
        const pending = room.gameState.pendingOrosChoice;
        if (!chooser || chooser.id !== pending.chooserPlayerId) {
          callback({ success: false, error: 'Only the As de Oros player can choose' });
          return;
        }

        if (!pending.options.includes(payload.playerId)) {
          callback({ success: false, error: 'Elección inválida' });
          return;
        }

        room.gameState.currentManoPlayerId = payload.playerId;
        room.gameState.currentTurnPlayerId = payload.playerId;
        room.gameState.pendingOrosChoice = null;
        continueAfterBaseResolution(payload.roomCode);

        callback({ success: true });
      } catch (err) {
        callback({ success: false, error: (err as Error).message });
      }
    });

    /**
     * game:ready - A player confirms they saw the base/round result (v2 ready gate)
     */
    socket.on('game:ready', (payload: { roomCode: string }, callback?: (res: { success: boolean; error?: string }) => void) => {
      try {
        const room = roomManager.getRoom(payload?.roomCode);
        const gate = room?.gameState?.readyGate;
        const player = room?.players.find((p) => p.socketId === socket.id);
        if (!room || !gate || !player) {
          callback?.({ success: false, error: 'No hay nada que confirmar' });
          return;
        }
        if (!gate.readyPlayerIds.includes(player.id)) gate.readyPlayerIds.push(player.id);
        io.to(room.roomCode).emit('game:state', room.gameState);
        callback?.({ success: true });
        checkReadyGate(room.roomCode);
      } catch (err) {
        callback?.({ success: false, error: (err as Error).message });
      }
    });

    /**
     * test:rig - TEST ONLY (LABASE_TEST=1): set every player's hand to reproduce exact situations.
     */
    if (process.env.LABASE_TEST === '1') {
      socket.on('test:rig', (payload: { roomCode: string; hands: Record<string, Card[]>; roundIndex?: number; scores?: { nosotros: number; ellos: number } }, callback?: (r: unknown) => void) => {
        const room = roomManager.getRoom(payload.roomCode);
        if (!room) return callback?.({ success: false });
        if (room.gameState && typeof payload.roundIndex === 'number') room.gameState.roundIndex = payload.roundIndex;
        if (room.gameState && payload.scores) room.gameState.scores = { ...payload.scores };
        room.players.forEach((p) => {
          if (payload.hands[p.id]) {
            p.hand = payload.hands[p.id];
            io.sockets.sockets.get(p.socketId)?.emit('player:hand', { hand: p.hand });
          }
        });
        callback?.({ success: true, order: room.players.map((p) => ({ id: p.id, team: p.team })) });
      });
    }

    /**
     * Presence relay (v2 3D table): where each player looks, their card hand/arm and hovered card.
     * Purely cosmetic: never game state, never card identities. Validated, clamped and rate-limited.
     */
    const lastPresence = new Map<string, number>();
    const PRESENCE_MIN_MS = 40; // ≤ 25 msgs/s per kind per socket
    const finite = (v: unknown, min: number, max: number): number | null =>
      typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : null;
    const relayPresence = (kind: 'look' | 'arm' | 'hover', payload: any, data: Record<string, unknown> | null) => {
      if (!data || typeof payload?.roomCode !== 'string') return;
      const now = Date.now();
      if (now - (lastPresence.get(kind) ?? 0) < PRESENCE_MIN_MS) return;
      lastPresence.set(kind, now);
      const room = roomManager.getRoom(payload.roomCode);
      const player = room?.players.find((p) => p.socketId === socket.id);
      if (!room || !player) return;
      socket.to(room.roomCode).emit(`presence:${kind}`, { playerId: player.id, ...data });
    };
    socket.on('presence:look', (payload: any) => {
      const yaw = finite(payload?.yaw, -Math.PI, Math.PI);
      const pitch = finite(payload?.pitch, -1.6, 1.6);
      if (yaw === null || pitch === null) return;
      relayPresence('look', payload, { yaw, pitch });
      // where they look decides which señas reach them
      const room = typeof payload?.roomCode === 'string' ? roomManager.getRoom(payload.roomCode) : undefined;
      const player = room?.players.find((p) => p.socketId === socket.id);
      if (room?.gameState && player) senaDelivery.look(room, player.id, { yaw, pitch });
    });
    socket.on('presence:arm', (payload: any) => {
      const slot = finite(payload?.slot, -1, 5);
      const fwd = finite(payload?.fwd, -1, 1);
      const lat = finite(payload?.lat, -1, 1);
      const valid = slot !== null && fwd !== null && lat !== null;
      relayPresence('arm', payload, valid ? { slot: Math.round(slot), fwd, lat, holding: payload?.holding === true } : null);
    });
    /**
     * Client-side errors (a 3D frame that threw, a lost WebGL context, uncaught errors) logged here
     * so problems seen only in a player's browser can be diagnosed. Rate-limited, size-capped.
     */
    let clientErrors = 0;
    const clientErrorWindow = setInterval(() => (clientErrors = 0), 60_000);
    socket.on('disconnect', () => clearInterval(clientErrorWindow));
    socket.on('client:error', (payload: any) => {
      if (++clientErrors > 20) return;
      const str = (v: unknown, n: number) => (typeof v === 'string' ? v.slice(0, n) : '');
      const room = typeof payload?.roomCode === 'string' ? roomManager.getRoom(payload.roomCode) : undefined;
      const who = room?.players.find((p) => p.socketId === socket.id)?.name ?? socket.id;
      console.error(`[client-error] ${who} (${str(payload?.where, 20)}): ${str(payload?.message, 300)}\n  ua: ${str(payload?.ua, 200)}\n${str(payload?.stack, 2000)}`);
    });

    socket.on('presence:hover', (payload: any) => {
      const slot = finite(payload?.slot, -1, 5);
      relayPresence('hover', payload, slot === null ? null : { slot: Math.round(slot) });
    });

    /**
     * Señas: a facial signal. The server decides who receives it (partners always; a rival only
     * while looking at the signer's face), so a seña never reaches a machine that can't see it.
     * Nothing checks that it matches the hand: bluffing is part of the game.
     */
    let lastSena = 0;
    const SENA_MIN_MS = 700;
    socket.on('sena:make', (payload: any, callback?: (res: { success: boolean; error?: string }) => void) => {
      const room = typeof payload?.roomCode === 'string' ? roomManager.getRoom(payload.roomCode) : undefined;
      const player = room?.players.find((p) => p.socketId === socket.id);
      if (!room || !player || !room.gameState) return callback?.({ success: false, error: 'Not in a game' });
      if (!isSena(payload?.sena)) return callback?.({ success: false, error: 'Unknown seña' });
      const t = Date.now();
      if (t - lastSena < SENA_MIN_MS) return callback?.({ success: false, error: 'Too fast' });
      lastSena = t;
      // made facing where the signer looks (head turn from their seat), when they say so
      const yaw = finite(payload?.yaw, -Math.PI, Math.PI);
      const pitch = finite(payload?.pitch, -1.6, 1.6);
      senaDelivery.make(room, player.id, payload.sena, yaw !== null && pitch !== null ? { yaw, pitch } : undefined);
      callback?.({ success: true });
    });

    /**
     * Asking for señas: knocking on the table (seen and heard by everyone). Partners answer with
     * their señas; bots do it on their own.
     */
    let lastAsk = 0;
    const ASK_MIN_MS = 2000;
    socket.on('sena:ask', (payload: any, callback?: (res: { success: boolean; error?: string }) => void) => {
      const room = typeof payload?.roomCode === 'string' ? roomManager.getRoom(payload.roomCode) : undefined;
      const player = room?.players.find((p) => p.socketId === socket.id);
      if (!room || !player || !room.gameState) return callback?.({ success: false, error: 'Not in a game' });
      const t = Date.now();
      if (t - lastAsk < ASK_MIN_MS) return callback?.({ success: false, error: 'Too fast' });
      lastAsk = t;
      socket.to(room.roomCode).emit('sena:asked', { playerId: player.id });
      callback?.({ success: true });
    });

    /**
     * Handle disconnection
     */
    socket.on('disconnect', () => {
      console.log(`Player disconnected: ${socket.id}`);

      // Find and disconnect player from all rooms
      const rooms = roomManager.getAllRooms();
      rooms.forEach((room) => {
        const player = room.players.find((p) => p.socketId === socket.id);
        if (player) {
          roomManager.disconnectPlayer(room.roomCode, player.id);
          checkReadyGate(room.roomCode);
          io.to(room.roomCode).emit('room:playerDisconnected', {
            playerId: player.id,
            playerName: player.name,
          });
          io.to(room.roomCode).emit('room:updated', {
            players: publicRoomPlayers(room.players),
          });
        }
      });
    });
  });
}
