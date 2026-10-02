import { useEffect, useState } from 'react';
import { useMenuScene } from '../menu/MenuBackdrop';
import { TableMenu } from '../menu/TableMenu';
import { useGameStore } from '../store/gameStore';
import { useSocket } from '../hooks/useSocket';

// rows of the config form on the felt (table z, toward you); the aces lie at z 0.14
const ROW = { aces: 0.14, structure: 0.4, kamikazes: 0.58, actions: 0.76 } as const;

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
          // a form laid on the felt: one row per choice, its title on the left (titles never sit
          // above or below a row, where the buttons and their shadows would cover them)
          { id: 't-ases', label: 'Poderes', kind: 'label', at: [-0.56, ROW.aces], raise: 0, onPick: () => undefined },
          { id: 't-estructura', label: 'Estructura', kind: 'label', at: [-0.56, ROW.structure], raise: 0, onPick: () => undefined },
          ...(['clasica', 'alternativa', 'postpandemia'] as const).map((mode, i) => ({
            id: `est-${mode}`,
            label: names[mode],
            sub: `${sequences[mode].length} rondas`,
            at: [[-0.3, -0.05, 0.24][i], ROW.structure] as [number, number],
            selected: structure === mode,
            hint: `${names[mode]}: bases por ronda ${sequences[mode].join(' · ')}`,
            onPick: () => setStructure(mode),
          })),
          { id: 't-kamikazes', label: `Kamikazes: ${kamikazesPerTeam === 0 ? 'ninguno' : kamikazesPerTeam}`, kind: 'label', at: [-0.5, ROW.kamikazes], raise: 0, onPick: () => undefined },
          // like a star rating: the first k planes are lit; clicking the last lit one turns it off
          ...[1, 2, 3].map((k) => ({
            id: `kami-${k}`,
            label: '',
            kind: 'chip' as const,
            icon: 'plane' as const,
            at: [-0.2 + (k - 1) * 0.12, ROW.kamikazes] as [number, number],
            selected: kamikazesPerTeam >= k,
            crossed: kamikazesPerTeam < k, // off: dark and crossed out
            hint:
              kamikazesPerTeam === k
                ? `quitar uno: ${k - 1 === 0 ? 'sin kamikazes' : `${k - 1} por equipo`}`
                : `${k} kamikaze${k === 1 ? '' : 's'} por equipo (todo o nada: 0 o todas las bases)`,
            onPick: () => setKamikazesPerTeam(kamikazesPerTeam === k ? k - 1 : k),
          })),
          { id: 'volver', label: 'Volver', at: [-0.36, ROW.actions], onPick: handleBack },
          { id: 'iniciar', label: loading ? 'Iniciando…' : 'Iniciar partida', kind: 'stamp', at: [0.24, ROW.actions], disabled: loading, hint: `Mesa ${roomCode}`, onPick: handleStartGame },
        ]}
      />
    </main>
  );
}
