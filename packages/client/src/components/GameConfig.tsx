import { useEffect, useState } from 'react';
import { useMenuScene } from '../menu/MenuBackdrop';
import { TableMenu } from '../menu/TableMenu';
import { useGameStore } from '../store/gameStore';
import { useSocket } from '../hooks/useSocket';

// rows of the config form on the felt (table z, toward you); the aces lie at z 0.14
// (aces: the same z as ACE_Z in MenuScene)
const ROW = { aces: -0.1, structure: 0.34, kamikazes: 0.55, clock: 0.69, actions: 0.85 } as const;
// the form is centred on the felt: titles at the left, their options to the right, and the whole
// block (titles included) balanced around x = 0
const STRUCTURE_BUTTON_PX = 330; // the three structure buttons are the same size (the widest name sets it)
const TITLE_X = -0.62; // the titles' left edge
const OPT_X = 0.14; // the middle of the options column
// the bidding clock: total per team for the whole game (0 = no clock)
const CLOCK_OPTIONS = [0, 60_000, 120_000, 300_000] as const;
const clockName = (ms: number) => (ms === 0 ? 'sin tiempo' : `${ms / 60_000} min`);

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
  const [bidClockMs, setBidClockMs] = useState<number>(0);

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
      bidClockMs,
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

  return (
    <main className="menu-screen config">
      <TableMenu
        note="ases boca arriba = poder activo · click en un as para cambiarlo"
        items={[
          // a form laid on the felt: one row per choice, its title on the left (titles never sit
          // above or below a row, where the buttons and their shadows would cover them)
          { id: 't-ases', label: 'Poderes', kind: 'label', at: [TITLE_X + 0.14, ROW.aces], rowHeight: 0.2, onPick: () => undefined },
          { id: 't-estructura', label: 'Estructura', kind: 'label', at: [TITLE_X, ROW.structure], onPick: () => undefined },
          ...(['clasica', 'alternativa', 'postpandemia'] as const).map((mode, i) => ({
            id: `est-${mode}`,
            label: names[mode],
            sub: `${sequences[mode].length} rondas`,
            width: STRUCTURE_BUTTON_PX,
            at: [(i - 1) * 0.28, ROW.structure] as [number, number],
            selected: structure === mode,
            hint: `${names[mode]}: bases por ronda ${sequences[mode].join(' · ')}`,
            onPick: () => setStructure(mode),
          })),
          { id: 't-kamikazes', label: `Kamikazes: ${kamikazesPerTeam === 0 ? 'ninguno' : kamikazesPerTeam}`, kind: 'label', at: [TITLE_X, ROW.kamikazes], onPick: () => undefined },
          // like a star rating: the first k planes are lit; clicking the last lit one turns it off
          ...[1, 2, 3].map((k) => ({
            id: `kami-${k}`,
            label: '',
            kind: 'chip' as const,
            icon: 'plane' as const,
            at: [OPT_X + (k - 2) * 0.14, ROW.kamikazes] as [number, number],
            selected: kamikazesPerTeam >= k,
            crossed: kamikazesPerTeam < k, // off: dark and crossed out
            hint:
              kamikazesPerTeam === k
                ? `quitar uno: ${k - 1 === 0 ? 'sin kamikazes' : `${k - 1} por equipo`}`
                : `${k} kamikaze${k === 1 ? '' : 's'} por equipo (todo o nada: 0 o todas las bases)`,
            onPick: () => setKamikazesPerTeam(kamikazesPerTeam === k ? k - 1 : k),
          })),
          { id: 't-reloj', label: 'Reloj', kind: 'label', at: [TITLE_X, ROW.clock], onPick: () => undefined },
          // one button that cycles through the options (four buttons crowded the form)
          {
            id: 'reloj',
            label: clockName(bidClockMs),
            sub: bidClockMs === 0 ? 'se pide sin apuro' : 'por equipo, toda la partida',
            at: [OPT_X, ROW.clock] as [number, number],
            selected: bidClockMs !== 0,
            hint: bidClockMs === 0
              ? 'Sin reloj: se pide sin apuro. Click para darle tiempo a cada equipo'
              : `Cada equipo tiene ${clockName(bidClockMs)} para pedir en toda la partida (corre solo mientras le toca pedir; si se le acaba, pierde). Click para cambiar`,
            onPick: () => setBidClockMs(CLOCK_OPTIONS[(CLOCK_OPTIONS.indexOf(bidClockMs as (typeof CLOCK_OPTIONS)[number]) + 1) % CLOCK_OPTIONS.length]),
          },
          { id: 'volver', label: 'Volver', at: [-0.28, ROW.actions], onPick: handleBack },
          { id: 'iniciar', label: loading ? 'Iniciando…' : 'Iniciar partida', kind: 'stamp', at: [0.28, ROW.actions], disabled: loading, hint: `Mesa ${roomCode}`, onPick: handleStartGame },
        ]}
      />
    </main>
  );
}
