import { useEffect, useRef } from 'react';
import { useGameStore } from '../store/gameStore';
import { useSocket } from './useSocket';

/**
 * Hook to handle game events and update store
 */
export function useGameEvents() {
  const socket = useSocket();
  const {
    setRoundScore,
    setGameOver,
    setBaseResolved,
    setCurrentPage,
    setCurrentBidValue,
  } = useGameStore();

  // Use refs to store handler functions so they keep the same reference
  const handlersRef = useRef<Record<string, Function>>({});

  useEffect(() => {
    if (!socket) return;

    // Create handlers with closure over current store setters
    const handlers = {
      roundScored: (data: any) => {
        setRoundScore({
          nosotrosScore: data.nosotrosScore,
          ellosScore: data.ellosScore,
          totalScores: data.totalScores,
          round: data.round,
        });
      },
      gameOver: (data: any) => {
        setGameOver({
          winner: data.winner,
          reason: data.reason,
          finalScores: data.finalScores,
        });
      },
      baseResolved: (data: any) => {
        setBaseResolved({
          winner: data.winner,
          winnerTeam: data.winnerTeam,
          basesWon: data.basesWon,
          cards: data.cards,
        });
      },
      teamsReady: () => {
        setCurrentPage('game');
      },
      bidValueUpdated: (data: any) => {
        setCurrentBidValue(data.bidValue);
      },
      gameState: (gameState: any) => {
        if (gameState.phase !== 'bidding') {
          setCurrentBidValue(null);
        }
      },
    };

    // Store references for cleanup
    handlersRef.current = handlers;

    // Register all listeners
    socket.on('game:roundScored', handlers.roundScored);
    socket.on('game:gameOver', handlers.gameOver);
    socket.on('game:baseResolved', handlers.baseResolved);
    socket.on('game:teamsReady', handlers.teamsReady);
    socket.on('bid:bidValueUpdated', handlers.bidValueUpdated);
    socket.on('game:state', handlers.gameState);

    // Clean up by removing specific handlers
    return () => {
      const oldHandlers = handlersRef.current;
      socket.off('game:roundScored', oldHandlers.roundScored as any);
      socket.off('game:gameOver', oldHandlers.gameOver as any);
      socket.off('game:baseResolved', oldHandlers.baseResolved as any);
      socket.off('game:teamsReady', oldHandlers.teamsReady as any);
      socket.off('bid:bidValueUpdated', oldHandlers.bidValueUpdated as any);
      socket.off('game:state', oldHandlers.gameState as any);
    };
  }, [socket, setRoundScore, setGameOver, setBaseResolved, setCurrentPage, setCurrentBidValue]);
}
