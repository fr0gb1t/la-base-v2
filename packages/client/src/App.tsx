import { useEffect } from 'react';
import { useGameStore } from './store/gameStore';
import { AuthModal } from './components/AuthModal';
import { Lobby } from './components/Lobby';
import { RoomWaiting } from './components/RoomWaiting';
import { GameConfig } from './components/GameConfig';
import { GamePage } from './components/GamePage';
import { useSocket } from './hooks/useSocket';

function App() {
  const currentPage = useGameStore((state) => state.currentPage);
  const loadFromStorage = useGameStore((state) => state.loadFromStorage);

  // Initialize Socket.io connection
  useSocket();

  // Rehydrate from localStorage on mount
  useEffect(() => {
    loadFromStorage();
  }, [loadFromStorage]);

  return (
    <>
      {currentPage === 'auth' && <AuthModal />}
      {currentPage === 'lobby' && <Lobby />}
      {currentPage === 'game:waiting' && <RoomWaiting />}
      {currentPage === 'game:config' && <GameConfig />}
      {currentPage === 'game' && <GamePage />}
    </>
  );
}

export default App;
