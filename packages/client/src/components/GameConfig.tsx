import { useEffect, useState } from 'react';
import { useMenuScene } from '../menu/MenuBackdrop';
import { TableMenu } from '../menu/TableMenu';
import { useGameStore } from '../store/gameStore';
import { useSocket } from '../hooks/useSocket';

// rows of the config form on the felt (table z, toward you); the aces lie at z 0.14
// (aces: the same z as ACE_Z in MenuScene)
const ROW = { aces: -0.1, structure: 0.29, kamikazes: 0.6, clock: 0.6, actions: 0.84 } as const;
// the form is centred on the felt: titles at the left, their options to the right, and the whole
// block (titles included) balanced around x = 0
const STRUCTURE_BUTTON_PX = 330; // the three structure buttons are the same size (the widest name sets it)
const MAX_KAMIKAZES = 3;
const KAMI_AT: [number, number] = [-0.3, ROW.kamikazes]; // the plane; its count sits at its upper right
const TITLE_X = -0.62; // the titles' left edge
const CLOCK_X = 0;
const RULE_X = 0.3; // kamikazes and clock share one row, each with its title under it
const UNDER = 0.11; // how far toward you a title sits below its button
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
  const [bidClockMs, setBidClockMs] = useState<number>(60_000);
  // how the Pie may answer: the real rule (the sum is one less or one more than the bases) or the looser house one
  const [pieBidRule, setPieBidRule] = useState<'estricta' | 'amplia'>('estricta');

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
      pieBidRule,
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
    scene?.setKamikaze(kamikazesPerTeam, KAMI_AT);
  }, [scene, kamikazesPerTeam]);
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
          { id: 't-kamikazes', label: 'Kamikazes', kind: 'label', centred: true, under: 'kamikazes', at: [KAMI_AT[0], ROW.kamikazes + UNDER], onPick: () => undefined },
          // one plane with its count as an exponent (a small badge that turns half a turn per change)
          // shows how many each team gets: 0 → 1 → 2 → 3 → 0
          {
            id: 'kamikazes',
            label: '',
            kind: 'chip' as const,
            icon: 'plane' as const,
            at: KAMI_AT,
            selected: kamikazesPerTeam > 0,
            crossed: kamikazesPerTeam === 0, // none: dark and crossed out
            hint: `${kamikazesPerTeam === 0 ? 'Sin kamikazes' : `${kamikazesPerTeam} kamikaze${kamikazesPerTeam === 1 ? '' : 's'} por equipo`} (todo o nada: 0 o todas las bases) · click para cambiar`,
            onPick: () => setKamikazesPerTeam((kamikazesPerTeam + 1) % (MAX_KAMIKAZES + 1)),
          },
          { id: 't-reloj', label: 'Reloj', kind: 'label', centred: true, under: 'reloj', at: [CLOCK_X, ROW.clock + UNDER], onPick: () => undefined },
          // one button that cycles through the options (four buttons crowded the form)
          {
            id: 'reloj',
            label: clockName(bidClockMs),
            sub: bidClockMs === 0 ? 'se pide sin apuro' : 'por equipo, toda la partida',
            at: [CLOCK_X, ROW.clock] as [number, number],
            selected: bidClockMs !== 0,
            hint: bidClockMs === 0
              ? 'Sin reloj: se pide sin apuro. Click para darle tiempo a cada equipo'
              : `Cada equipo tiene ${clockName(bidClockMs)} para pedir en toda la partida (corre solo mientras le toca pedir; si se le acaba, pierde). Click para cambiar`,
            onPick: () => setBidClockMs(CLOCK_OPTIONS[(CLOCK_OPTIONS.indexOf(bidClockMs as (typeof CLOCK_OPTIONS)[number]) + 1) % CLOCK_OPTIONS.length]),
          },
          { id: 't-regla', label: 'Pedido del Pie', kind: 'label', centred: true, under: 'regla', at: [RULE_X, ROW.clock + UNDER], onPick: () => undefined },
          {
            id: 'regla',
            label: pieBidRule === 'estricta' ? 'Estricta' : 'Amplia',
            sub: pieBidRule === 'estricta' ? 'suma ±1 al total' : 'cualquiera menos el total',
            at: [RULE_X, ROW.clock] as [number, number],
            selected: pieBidRule === 'estricta',
            hint: pieBidRule === 'estricta'
              ? 'Regla real: lo que pide el Pie, sumado a lo de la Mano, tiene que dar una base menos o una más que las de la ronda. Click para la modalidad amplia'
              : 'Modalidad amplia: el Pie puede pedir cualquier cantidad mientras la suma no sea justo las bases de la ronda. Click para la regla real',
            onPick: () => setPieBidRule(pieBidRule === 'estricta' ? 'amplia' : 'estricta'),
          },
          { id: 'volver', label: 'Volver', straighten: 0.65, at: [-0.28, ROW.actions], onPick: handleBack },
          { id: 'iniciar', label: loading ? 'Iniciando…' : 'Iniciar partida', kind: 'stamp', straighten: 0.65, at: [0.28, ROW.actions], disabled: loading, hint: `Mesa ${roomCode}`, onPick: handleStartGame },
        ]}
      />
    </main>
  );
}
