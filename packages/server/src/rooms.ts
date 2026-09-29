/**
 * Room Manager - In-memory game room storage and lifecycle
 */

import { v4 as uuidv4 } from 'uuid';
import type { GameState, Player, AcePowers, Card } from '@la-base/shared';
import { createGameState } from '@la-base/shared';
import type { GameStructure } from '@la-base/shared';

export interface RoomPlayer extends Player {
  socketId: string;
  isConnected: boolean;
  lastActivity: Date;
}

export interface GameRoom {
  roomCode: string;
  players: RoomPlayer[];
  gameState: GameState | null;
  host: string; // hostId (playerId)
  createdAt: Date;
  lastActivity: Date;
  maxPlayers: number;
  structure: GameStructure;
  customStructure?: number[];
  acePowers: AcePowers;
  kamikazesPerTeam: number;
  initialDrawDeck: Card[];
}

export class RoomManager {
  private rooms: Map<string, GameRoom> = new Map();
  private reconnectTokens: Map<string, { roomCode: string; playerId: string }> = new Map();
  private readonly ROOM_CODE_LENGTH = 6;
  private readonly RECONNECT_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

  /**
   * Generate a unique room code
   */
  private generateRoomCode(): string {
    let code = '';
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    for (let i = 0; i < this.ROOM_CODE_LENGTH; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    // Ensure uniqueness
    if (this.rooms.has(code)) {
      return this.generateRoomCode();
    }
    return code;
  }

  /**
   * Create a new room
   */
  createRoom(hostId: string, hostName: string, playerCount: number, structure: GameStructure = 'clasica', customStructure?: number[]): GameRoom {
    const roomCode = this.generateRoomCode();
    const now = new Date();

    const host: RoomPlayer = {
      id: hostId,
      name: hostName,
      team: 'random', // All players start in random team, will be assigned at game start
      hand: [],
      isMano: true,
      reconnectToken: uuidv4(),
      isAuthenticated: true,
      socketId: '', // Will be set when they connect via Socket.io
      isConnected: false,
      lastActivity: now,
    };

    const room: GameRoom = {
      roomCode,
      players: [host],
      gameState: null,
      host: hostId,
      createdAt: now,
      lastActivity: now,
      maxPlayers: playerCount,
      structure,
      customStructure,
      acePowers: { espadas: false, copas: false, oros: false },
      kamikazesPerTeam: 2,
      initialDrawDeck: [],
    };

    this.rooms.set(roomCode, room);
    this.reconnectTokens.set(host.reconnectToken, { roomCode, playerId: hostId });

    return room;
  }

  /**
   * Get room by code
   */
  getRoom(roomCode: string): GameRoom | null {
    return this.rooms.get(roomCode) || null;
  }

  /**
   * Join a room
   */
  joinRoom(roomCode: string, playerId: string, playerName: string, socketId: string, isAuthenticated: boolean = false, userId?: string): RoomPlayer | null {
    const room = this.rooms.get(roomCode);
    if (!room) return null;

    // Check if player already in room
    const existing = room.players.find((p) => p.id === playerId);
    if (existing) {
      existing.socketId = socketId;
      existing.isConnected = true;
      existing.lastActivity = new Date();
      return existing;
    }

    // Check if room is full
    if (room.players.length >= room.maxPlayers) {
      return null;
    }

    // All players start in random team, will be assigned at game start
    const newPlayer: RoomPlayer = {
      id: playerId,
      name: playerName,
      team: 'random',
      hand: [],
      isMano: false,
      reconnectToken: uuidv4(),
      isAuthenticated,
      userId,
      socketId,
      isConnected: true,
      lastActivity: new Date(),
    };

    room.players.push(newPlayer);
    room.lastActivity = new Date();
    this.reconnectTokens.set(newPlayer.reconnectToken, { roomCode, playerId });

    return newPlayer;
  }

  /**
   * Disconnect a player (but keep reconnect token alive)
   */
  disconnectPlayer(roomCode: string, playerId: string): void {
    const room = this.rooms.get(roomCode);
    if (!room) return;

    const player = room.players.find((p) => p.id === playerId);
    if (player) {
      player.isConnected = false;
      player.socketId = '';
      room.lastActivity = new Date();
    }
  }

  /**
   * Reconnect a player using token
   */
  reconnectPlayer(reconnectToken: string, socketId: string): RoomPlayer | null {
    const tokenData = this.reconnectTokens.get(reconnectToken);
    if (!tokenData) return null;

    const room = this.rooms.get(tokenData.roomCode);
    if (!room) return null;

    const player = room.players.find((p) => p.id === tokenData.playerId);
    if (player) {
      player.socketId = socketId;
      player.isConnected = true;
      player.lastActivity = new Date();
      room.lastActivity = new Date();
      return player;
    }

    return null;
  }

  /**
   * Remove a player from room
   */
  removePlayer(roomCode: string, playerId: string): void {
    const room = this.rooms.get(roomCode);
    if (!room) return;

    const index = room.players.findIndex((p) => p.id === playerId);
    if (index !== -1) {
      const player = room.players[index];
      this.reconnectTokens.delete(player.reconnectToken);
      room.players.splice(index, 1);
      room.lastActivity = new Date();

      // Delete room if empty
      if (room.players.length === 0) {
        this.rooms.delete(roomCode);
      } else if (room.host === playerId) {
        room.host = room.players[0].id;
      }
    }
  }

  /**
   * Start game - initialize game state
   */
  startGame(roomCode: string, structure: GameStructure = 'clasica', customStructure?: number[], acePowers?: AcePowers, kamikazesPerTeam?: number): GameState | null {
    const room = this.rooms.get(roomCode);
    if (!room || room.players.length < 2) return null;

    // Update room settings if provided
    if (structure) room.structure = structure;
    if (customStructure) room.customStructure = customStructure;
    if (acePowers) room.acePowers = acePowers;
    if (kamikazesPerTeam !== undefined) room.kamikazesPerTeam = kamikazesPerTeam;

    // Create initial game state
    const gameState = createGameState(room.players, room.structure, room.acePowers, room.customStructure, room.kamikazesPerTeam);
    room.gameState = gameState;
    room.lastActivity = new Date();

    return gameState;
  }

  /**
   * Update game state for a room
   */
  updateGameState(roomCode: string, gameState: GameState): void {
    const room = this.rooms.get(roomCode);
    if (room) {
      room.gameState = gameState;
      room.lastActivity = new Date();
    }
  }

  /**
   * Get player's private hand
   */
  getPlayerHand(roomCode: string, playerId: string): any[] | null {
    const room = this.rooms.get(roomCode);
    if (!room || !room.gameState) return null;

    const player = room.players.find((p) => p.id === playerId);
    return player?.hand || null;
  }

  /**
   * Clean up abandoned rooms (older than reconnect timeout)
   */
  cleanupAbandonedRooms(): void {
    const now = new Date();
    const abandoned: string[] = [];

    for (const [roomCode, room] of this.rooms.entries()) {
      const timeSinceLastActivity = now.getTime() - room.lastActivity.getTime();
      if (timeSinceLastActivity > this.RECONNECT_TIMEOUT_MS) {
        abandoned.push(roomCode);
      }
    }

    abandoned.forEach((roomCode) => {
      const room = this.rooms.get(roomCode);
      if (room) {
        // Clean up reconnect tokens
        room.players.forEach((player) => {
          this.reconnectTokens.delete(player.reconnectToken);
        });
        this.rooms.delete(roomCode);
      }
    });
  }

  /**
   * Get all active rooms (for admin/debug)
   */
  getAllRooms(): GameRoom[] {
    return Array.from(this.rooms.values());
  }

  /**
   * Get room count (for monitoring)
   */
  getRoomCount(): number {
    return this.rooms.size;
  }
}

// Singleton instance
export const roomManager = new RoomManager();

// Cleanup interval (every 5 minutes)
setInterval(() => {
  roomManager.cleanupAbandonedRooms();
}, 5 * 60 * 1000);
