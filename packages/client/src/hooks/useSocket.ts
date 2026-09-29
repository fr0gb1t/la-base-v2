import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useGameStore } from '../store/gameStore';
import { getServerUrl } from '../lib/serverUrl';

let globalSocket: Socket | null = null;
let coreListenersRegistered = false;

function ensureCoreListeners(socket: Socket) {
  if (coreListenersRegistered) return;
  coreListenersRegistered = true;

  socket.on('connect', () => {
    console.log('[useSocket] Connected:', socket.id);
    const store = useGameStore.getState();
    store.setSocketConnected(true);

    const reconnectToken = localStorage.getItem('reconnectToken');
    if (reconnectToken) {
      socket.emit('room:reconnect', { reconnectToken }, (response: any) => {
        const latestStore = useGameStore.getState();

        if (!response.success) {
          console.warn('[useSocket] Reconnect failed:', response.error);
          return;
        }

        latestStore.setRoomCode(response.roomCode);
        latestStore.setReconnectToken(reconnectToken);
        latestStore.setRoomPlayers(response.players || []);
        if (response.gameState) {
          latestStore.setGameState(response.gameState);
        }
        if (response.player?.hand) {
          latestStore.setPlayerHand(response.player.hand);
        }
        if (response.player) {
          latestStore.setCurrentPlayer({
            id: response.player.id,
            name: response.player.name,
          });
        }
        latestStore.setCurrentPage(response.gameState ? 'game' : 'game:waiting');
      });
    }
  });

  socket.on('disconnect', () => {
    console.log('[useSocket] Disconnected');
    useGameStore.getState().setSocketConnected(false);
  });

  socket.on('game:state', (state) => {
    console.log('[useSocket] Game state updated', {
      phase: state?.phase,
      bids: state?.bids?.length,
      currentBidPlayerId: state?.currentBidPlayerId,
      currentTurnPlayerId: state?.currentTurnPlayerId,
    });
    const store = useGameStore.getState();
    store.setGameState(state);
    store.setCurrentPage('game');
  });

  socket.on('player:hand', (data: { hand: any[] }) => {
    console.log('[useSocket] Hand received');
    useGameStore.getState().setPlayerHand(data.hand);
  });

  socket.on('room:updated', (data: { players: any[] }) => {
    console.log('[useSocket] Room updated:', data.players.length, 'players');
    useGameStore.getState().setRoomPlayers(data.players);
  });

  socket.on('room:kicked', () => {
    console.log('[useSocket] Kicked from room');
    const store = useGameStore.getState();
    store.setRoomCode(null);
    store.setReconnectToken(null);
    store.setRoomPlayers([]);
    store.setGameState(null);
    store.setPlayerHand([]);
    store.setCurrentPage('lobby');
  });

  socket.on('game:error', (data: { message: string }) => {
    console.error('[useSocket] Game error:', data.message);
  });
}

function getOrCreateSocket() {
  if (globalSocket) {
    ensureCoreListeners(globalSocket);
    return globalSocket;
  }

  const serverUrl = getServerUrl();

  console.log('[useSocket] Client URL:', window.location.origin);
  console.log('[useSocket] Connecting to:', serverUrl);
  const token = localStorage.getItem('token');

  globalSocket = io(serverUrl, {
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: 5,
    auth: token ? { token } : {},
  });

  ensureCoreListeners(globalSocket);
  return globalSocket;
}

export function useSocket() {
  const [socketInstance, setSocketInstance] = useState<Socket | null>(globalSocket);

  useEffect(() => {
    const socket = getOrCreateSocket();
    setSocketInstance(socket);

    // Don't disconnect on unmount - socket is global
    return () => {
      // Do nothing - keep socket alive
    };
  }, []);

  return socketInstance;
}
