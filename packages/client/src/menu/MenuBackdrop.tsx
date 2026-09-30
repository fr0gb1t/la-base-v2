import { useEffect, useRef, useState } from 'react';
import { MenuScene } from './MenuScene';

// One 3D basement shared by every menu screen: mounted once, the screens drive it through
// useMenuScene() (station, your name, seats, players, aces) while keeping their DOM on top.

let current: MenuScene | null = null;
const listeners = new Set<(s: MenuScene | null) => void>();

export function useMenuScene() {
  const [scene, setScene] = useState<MenuScene | null>(current);
  useEffect(() => {
    listeners.add(setScene);
    setScene(current);
    return () => {
      listeners.delete(setScene);
    };
  }, []);
  return scene;
}

export function MenuBackdrop() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const scene = new MenuScene(ref.current);
    current = scene;
    listeners.forEach((l) => l(scene));
    return () => {
      scene.dispose();
      current = null;
      listeners.forEach((l) => l(null));
    };
  }, []);
  return <div ref={ref} className="menu-backdrop" aria-hidden="true" />;
}
