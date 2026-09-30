import { create } from 'zustand';
import type { GameState, Card } from '@la-base/shared';

export type AuthStatus = 'guest' | 'authenticated' | 'logged_out';
export type AppPage = 'auth' | 'lobby' | 'game:waiting' | 'game:config' | 'game' | 'rankings';

export interface RoomPlayer {
  id: string;
  name: string;
  team: string;
  isConnected: boolean;
  isBot?: boolean;
  handCount?: number;
}

interface GameStore {
  // Auth
  authStatus: AuthStatus;
  currentPlayer: {
    id: string;
    name: string;
    token?: string;
  } | null;
  setAuthStatus: (status: AuthStatus) => void;
  setCurrentPlayer: (player: { id: string; name: string; token?: string } | null) => void;

  // Room
  roomCode: string | null;
  reconnectToken: string | null;
  roomPlayers: RoomPlayer[];
  setRoomCode: (code: string | null) => void;
  setReconnectToken: (token: string | null) => void;
  setRoomPlayers: (players: RoomPlayer[]) => void;

  // Game State
  gameState: GameState | null;
  setGameState: (state: GameState | null) => void;
  playerHand: Card[];
  setPlayerHand: (cards: Card[]) => void;

  // Round Scoring
  roundScore: {
    nosotrosScore: number;
    ellosScore: number;
    totalScores: { nosotros: number; ellos: number };
    round: number;
  } | null;
  setRoundScore: (score: {
    nosotrosScore: number;
    ellosScore: number;
    totalScores: { nosotros: number; ellos: number };
    round: number;
  } | null) => void;

  // Game Over
  gameOver: {
    winner: string;
    reason: string;
    finalScores: { nosotros: number; ellos: number };
  } | null;
  setGameOver: (result: {
    winner: string;
    reason: string;
    finalScores: { nosotros: number; ellos: number };
  } | null) => void;

  // Base Resolution
  baseResolved: {
    winner: string;
    winnerTeam: string;
    basesWon: { nosotros: number; ellos: number };
    cards: Array<{ playerId: string; card: { value: any; suit: string }; order: number }>;
  } | null;
  setBaseResolved: (result: {
    winner: string;
    winnerTeam: string;
    basesWon: { nosotros: number; ellos: number };
    cards: Array<{ playerId: string; card: { value: any; suit: string }; order: number }>;
  } | null) => void;

  // Bidding Status
  currentBidValue: number | null;
  setCurrentBidValue: (value: number | null) => void;

  // UI Navigation
  currentPage: AppPage;
  setCurrentPage: (page: AppPage) => void;

  // Socket Connection Status
  isSocketConnected: boolean;
  setSocketConnected: (connected: boolean) => void;

  // Persistence
  loadFromStorage: () => void;

  // Reset
  reset: () => void;
}

export const useGameStore = create<GameStore>((set) => ({
  // Auth
  authStatus: 'logged_out',
  currentPlayer: null,
  setAuthStatus: (status) => set({ authStatus: status }),
  setCurrentPlayer: (player) => set({ currentPlayer: player }),

  // Room
  roomCode: null,
  reconnectToken: null,
  roomPlayers: [],
  setRoomCode: (code) => {
    // Store room code for reconnection during active game
    if (code) localStorage.setItem('roomCode', code);
    else localStorage.removeItem('roomCode');
    set({ roomCode: code });
  },
  setReconnectToken: (token) => {
    // Store token to allow reconnection if player disconnects during game
    if (token) localStorage.setItem('reconnectToken', token);
    else localStorage.removeItem('reconnectToken');
    set({ reconnectToken: token });
  },
  setRoomPlayers: (players) => set({ roomPlayers: players }),

  // Game State
  gameState: null,
  setGameState: (state) => set({ gameState: state }),
  playerHand: [],
  setPlayerHand: (cards) => set({ playerHand: cards }),

  // Round Scoring
  roundScore: null,
  setRoundScore: (score) => set({ roundScore: score }),

  // Game Over
  gameOver: null,
  setGameOver: (result) => set({ gameOver: result }),

  // Base Resolution
  baseResolved: null,
  setBaseResolved: (result) => set({ baseResolved: result }),

  // Bidding Status
  currentBidValue: null,
  setCurrentBidValue: (value) => set({ currentBidValue: value }),

  // UI
  currentPage: 'auth',
  setCurrentPage: (page) => set({ currentPage: page }),

  // Socket
  isSocketConnected: false,
  setSocketConnected: (connected) => set({ isSocketConnected: connected }),

  // Persistence
  loadFromStorage: () => {
    const token = localStorage.getItem('token');
    const userId = localStorage.getItem('userId');
    const username = localStorage.getItem('username');
    const guestName = localStorage.getItem('guestName');
    const roomCode = localStorage.getItem('roomCode');
    const reconnectToken = localStorage.getItem('reconnectToken');

    if (token && userId && username) {
      // Authenticated user
      set({
        authStatus: 'authenticated',
        currentPlayer: {
          id: userId,
          name: username,
          token,
        },
        roomCode: roomCode || null,
        reconnectToken: reconnectToken || null,
        currentPage: 'lobby', // useSocket's room:reconnect moves you to the table if the room still exists
      });
    } else if (guestName) {
      // Guest user - use SAME guest ID to maintain identity
      const storedGuestId = localStorage.getItem('guestId');
      const guestId = storedGuestId || 'guest_' + Date.now();

      if (!storedGuestId) {
        localStorage.setItem('guestId', guestId);
      }

      set({
        authStatus: 'guest',
        currentPlayer: {
          id: guestId,
          name: guestName,
        },
        roomCode: roomCode || null,
        reconnectToken: reconnectToken || null,
        currentPage: 'lobby', // useSocket's room:reconnect moves you to the table if the room still exists
      });
    }
  },

  // Reset
  reset: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userId');
    localStorage.removeItem('username');
    localStorage.removeItem('guestName');

    set({
      authStatus: 'logged_out',
      currentPlayer: null,
      roomCode: null,
      reconnectToken: null,
      roomPlayers: [],
      gameState: null,
      playerHand: [],
      currentPage: 'auth',
      isSocketConnected: false,
    });
  },
}));
