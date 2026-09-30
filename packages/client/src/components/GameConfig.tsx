import { useEffect, useState } from 'react';
import { GiCrossedSwords, GiChaliceDrops, GiTwoCoins, GiDynamite, GiCardPlay, GiReturnArrow } from 'react-icons/gi';
import { useMenuScene } from '../menu/MenuBackdrop';
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

  // 3D: the three powered aces lie on the felt; switching a power off turns its ace face down
  useEffect(() => {
    scene?.setStation('config');
  }, [scene]);
  useEffect(() => {
    scene?.setAces(acePowers);
  }, [scene, acePowers]);

  const sequences = {
    clasica: [1, 3, 5, 5, 3, 1, 1, 3, 5, 5, 3, 1],
    alternativa: [1, 3, 5, 6, 6, 5, 3, 1, 1, 3, 5, 6, 6, 5, 3, 1],
    postpandemia: [1, 2, 3, 4, 5, 6, 6, 5, 4, 3, 2, 1],
  } as const;
  const names = { clasica: 'Clásica', alternativa: 'Alternativa', postpandemia: 'Postpandemia' } as const;
  const powers = [
    { key: 'espadas' as const, Icon: GiCrossedSwords, name: 'As de Espadas', desc: 'mata al ancho de bastos si sale después' },
    { key: 'copas' as const, Icon: GiChaliceDrops, name: 'As de Copas', desc: 'puede invertir el sentido de la ronda' },
    { key: 'oros' as const, Icon: GiTwoCoins, name: 'As de Oros', desc: 'si su equipo gana, elige quién abre' },
  ];

  return (
    <main className="menu-screen config">
      <section className="ledger side" aria-label="Reglas de la casa">
        <h2>Reglas de la casa <small>· mesa {roomCode}</small></h2>

        <fieldset className="ledger-group">
          <legend>Estructura</legend>
          <div className="choice-row" role="radiogroup">
            {(['clasica', 'alternativa', 'postpandemia'] as const).map((mode) => (
              <button key={mode} type="button" role="radio" aria-checked={structure === mode} className={`choice ${structure === mode ? 'on' : ''}`} onClick={() => setStructure(mode)}>
                {names[mode]}
                <small>{sequences[mode].length} rondas</small>
              </button>
            ))}
          </div>
          <p className="sequence" aria-label="Bases por ronda">
            {sequences[structure].map((n, i) => (
              <span key={i} className="seq-n">{n}</span>
            ))}
          </p>
        </fieldset>

        <fieldset className="ledger-group">
          <legend>Ases con poder</legend>
          <div className="power-list">
            {powers.map(({ key, Icon, name, desc }) => (
              <button key={key} type="button" role="switch" aria-checked={acePowers[key]} className={`power ${acePowers[key] ? 'on' : ''}`} onClick={() => handleTogglePower(key)}>
                <Icon aria-hidden className="power-icon" />
                <span className="power-text">
                  <b>{name}</b>
                  <small>{desc}</small>
                </span>
                <span className="power-state">{acePowers[key] ? 'activo' : 'apagado'}</span>
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="ledger-group">
          <legend><GiDynamite aria-hidden /> Kamikazes por equipo</legend>
          <div className="choice-row" role="radiogroup">
            {[0, 1, 2, 3].map((count) => (
              <button key={count} type="button" role="radio" aria-checked={kamikazesPerTeam === count} className={`choice small ${kamikazesPerTeam === count ? 'on' : ''}`} onClick={() => setKamikazesPerTeam(count)}>
                {count}
              </button>
            ))}
          </div>
        </fieldset>

        <button type="button" className="stamp-btn" onClick={handleStartGame} disabled={loading}>
          <GiCardPlay aria-hidden /> {loading ? 'Iniciando…' : 'Iniciar partida'}
        </button>
        <button type="button" className="text-btn" onClick={handleBack}>
          <GiReturnArrow aria-hidden /> volver a la sala
        </button>
      </section>
    </main>
  );
}
