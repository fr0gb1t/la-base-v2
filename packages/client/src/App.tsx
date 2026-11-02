import { useEffect } from 'react';
import { useGameStore } from './store/gameStore';
import { useStagedPage } from './hooks/useStagedPage';
import { AuthModal } from './components/AuthModal';
import { Lobby } from './components/Lobby';
import { RoomWaiting } from './components/RoomWaiting';
import { GameConfig } from './components/GameConfig';
import { GamePage } from './components/GamePage';
import { useSocket } from './hooks/useSocket';
import { useMusicMood } from './hooks/useMusicMood';
import { MenuBackdrop } from './menu/MenuBackdrop';
import { RulebookHost } from './components/rulebook/Rulebook';
import { MenuTelevisions } from './components/MenuTelevisions';
import { SettingsHost } from './settings/SettingsPanel';

function App() {
  const targetPage = useGameStore((state) => state.currentPage);
  // what is on screen: the way into the table goes behind a veil that hides the one heavy moment (lib/pageStage.ts)
  const { page: currentPage, veil } = useStagedPage(targetPage);
  const loadFromStorage = useGameStore((state) => state.loadFromStorage);

  // Initialize Socket.io connection
  useSocket();

  // The score follows the game
  useMusicMood();

  // Rehydrate from localStorage on mount
  useEffect(() => {
    loadFromStorage();
  }, [loadFromStorage]);

  return (
    <>
      {/* the menu's 3D basement lives behind every screen except the game table itself */}
      {currentPage !== 'game' && <MenuBackdrop />}
      {currentPage !== 'game' && <MenuTelevisions />}
      {currentPage === 'auth' && <AuthModal />}
      {currentPage === 'lobby' && <Lobby />}
      {currentPage === 'game:waiting' && <RoomWaiting />}
      {currentPage === 'game:config' && <GameConfig />}
      {currentPage === 'game' && <GamePage />}
      <SettingsHost />
      <RulebookHost />
      <div className={`page-veil page-veil-${veil}`} aria-hidden="true" />
    </>
  );
}

export default App;
