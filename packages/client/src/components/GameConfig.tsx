import { useEffect, useState } from 'react';
import { useMenuScene } from '../menu/MenuBackdrop';
import { TableMenu } from '../menu/TableMenu';
import { useGameStore } from '../store/gameStore';
import { useSocket } from '../hooks/useSocket';

export function GameConfig() {
  const socket = useSocket();
  const { roomCode, setCurrentPage } = useGameStore();
  const [loading, setLoading] = useState(false);
  const scene = useMenuScene();

  const [structure, setStructure] = useState<'clasica' | 'alternativa' | 'postpandemia'>('clasica');
  const [acePowers, setAcePowers] = useState({
    espadas: true,
    copas: true,
    oros: true,
  });
  const [kamikazesPerTeam, setKamikazesPerTeam] = useState(2);

  const handleTogglePower = (power: 'espadas' | 'copas' | 'oros') => {
    setAcePowers((prev) => ({
      ...prev,
      [power]: !prev[power],
    }));
  };

  const handleStartGame = () => {
    if (!socket) return;

    setLoading(true);

    // Emit config
    socket.emit('game:config', {
      roomCode,
      structure,
      acePowers,
      kamikazesPerTeam,
    }, (response: any) => {
      if (!response.success) {
          console.error('Error de configuración:', response.error);
        setLoading(false);
        return;
      }

      // Start game
      socket.emit('game:start', {
        roomCode,
      }, (startResponse: any) => {
        setLoading(false);
        if (startResponse.success) {
          setCurrentPage('game');
        } else {
          console.error('No se pudo iniciar:', startResponse.error);
        }
      });
    });
  };

  const handleBack = () => {
    setCurrentPage('game:waiting');
  };

  // 3D: the three powered aces lie on the felt; click an ace to switch its power (it flips over)
  useEffect(() => {
    scene?.setStation('config');
  }, [scene]);
  useEffect(() => {
    scene?.setAces(acePowers);
  }, [scene, acePowers]);
  useEffect(() => {
    if (!scene) return;
    scene.onAcePick = (suit) => handleTogglePower(suit);
    return () => {
      scene.onAcePick = () => undefined;
    };
  }, [scene]); // eslint-disable-line react-hooks/exhaustive-deps

  const sequences = {
    clasica: [1, 3, 5, 5, 3, 1, 1, 3, 5, 5, 3, 1],
    alternativa: [1, 3, 5, 6, 6, 5, 3, 1, 1, 3, 5, 6, 6, 5, 3, 1],
    postpandemia: [1, 2, 3, 4, 5, 6, 6, 5, 4, 3, 2, 1],
  } as const;
  const names = { clasica: 'Clásica', alternativa: 'Alternativa', postpandemia: 'Postpandemia' } as const;
  const on = (k: 'espadas' | 'copas' | 'oros') => (acePowers[k] ? 'activo' : 'apagado');

  return (
    <main className="menu-screen config">
      <TableMenu
        note={`ases boca arriba = poder activo (espadas ${on('espadas')} · copas ${on('copas')} · oros ${on('oros')}) · click en un as para cambiarlo`}
        items={[
          ...(['clasica', 'alternativa', 'postpandemia'] as const).map((mode, i) => ({
            id: `est-${mode}`,
            label: names[mode],
            sub: `${sequences[mode].length} rondas`,
            at: [(i - 1) * 0.3, 0.42] as [number, number],
            selected: structure === mode,
            hint: `${names[mode]}: bases por ronda ${sequences[mode].join(' · ')}`,
            onPick: () => setStructure(mode),
          })),
          ...[0, 1, 2, 3].map((count, i) => ({
            id: `kami-${count}`,
            label: String(count),
            kind: 'chip' as const,
            at: [-0.36 + i * 0.12, 0.62] as [number, number],
            selected: kamikazesPerTeam === count,
            hint: `${count} kamikaze${count === 1 ? '' : 's'} por equipo (todo o nada: 0 o todas las bases)`,
            onPick: () => setKamikazesPerTeam(count),
          })),
          { id: 'iniciar', label: loading ? 'Iniciando…' : 'Iniciar partida', kind: 'stamp', at: [0.3, 0.64], disabled: loading, hint: `Mesa ${roomCode}`, onPick: handleStartGame },
          { id: 'volver', label: 'Volver', at: [-0.56, 0.64], onPick: handleBack },
        ]}
      />
    </main>
  );
}
