import { useEffect, useState } from 'react';
import { GiQuillInk, GiKey, GiScrollUnfurled } from 'react-icons/gi';
import { useMenuScene } from '../menu/MenuBackdrop';
import { useGameStore } from '../store/gameStore';
import { getServerUrl } from '../lib/serverUrl';

type AuthTab = 'login' | 'register' | 'guest';

export function AuthModal() {
  const [tab, setTab] = useState<AuthTab>('guest');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { setAuthStatus, setCurrentPlayer, setCurrentPage } = useGameStore();
  const scene = useMenuScene();

  // Login form
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Register form
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [registerUsername, setRegisterUsername] = useState('');

  // Guest form
  const [guestName, setGuestName] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch(`${getServerUrl()}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: loginEmail,
          password: loginPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'No se pudo iniciar sesión');
        return;
      }

      localStorage.setItem('token', data.token);
      localStorage.setItem('userId', data.userId);
      localStorage.setItem('username', data.username);

      setAuthStatus('authenticated');
      setCurrentPlayer({
        id: data.userId,
        name: data.username,
        token: data.token,
      });
      setCurrentPage('lobby');
    } catch (err) {
      setError('No se pudo iniciar sesión: error del servidor');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch(`${getServerUrl()}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: registerEmail,
          username: registerUsername,
          password: registerPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'No se pudo crear la cuenta');
        return;
      }

      localStorage.setItem('token', data.token);
      localStorage.setItem('userId', data.userId);
      localStorage.setItem('username', data.username);

      setAuthStatus('authenticated');
      setCurrentPlayer({
        id: data.userId,
        name: data.username,
        token: data.token,
      });
      setCurrentPage('lobby');
    } catch (err) {
      setError('No se pudo crear la cuenta: error del servidor');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleGuest = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!guestName.trim()) {
      setError('Ingresá un nombre');
      return;
    }

    localStorage.setItem('guestName', guestName);

    setAuthStatus('guest');
    setCurrentPlayer({
      id: 'guest_' + Date.now(),
      name: guestName,
    });
    setCurrentPage('lobby');
  };

  // the 3D table: circle slowly over the empty table; your name is chalked at your place as you type
  useEffect(() => {
    scene?.setStation('entrada');
  }, [scene]);
  useEffect(() => {
    scene?.setMyName(tab === 'register' ? registerUsername : guestName);
  }, [scene, guestName, registerUsername, tab]);

  const tabBtn = (id: AuthTab, label: string) => (
    <button type="button" className={`ledger-tab ${tab === id ? 'on' : ''}`} onClick={() => { setTab(id); setError(''); }}>
      {label}
    </button>
  );

  return (
    <main className="menu-screen entrada">
      <header className="menu-hero">
        <h1 className="menu-title">La Base</h1>
        <p className="menu-sub">un juego de cartas españolas · 4, 6 u 8 jugadores · en un sótano</p>
      </header>

      <section className="ledger" aria-label="Anotarse">
        <h2><GiQuillInk aria-hidden /> Libreta de socios</h2>
        <nav className="ledger-tabs">
          {tabBtn('guest', 'invitado')}
          {tabBtn('login', 'entrar')}
          {tabBtn('register', 'registrarse')}
        </nav>

        {error && <p className="ledger-error" role="alert">{error}</p>}

        {tab === 'guest' && (
          <form onSubmit={handleGuest}>
            <label className="ledger-field">
              <span>Tu nombre</span>
              <input type="text" value={guestName} onChange={(e) => setGuestName(e.target.value)} placeholder="Ingresá tu nombre" maxLength={14} autoFocus />
            </label>
            <button type="submit" className="stamp-btn">Jugar como invitado</button>
            <p className="ledger-note">Las partidas de invitado no guardan ranking.</p>
          </form>
        )}

        {tab === 'login' && (
          <form onSubmit={handleLogin}>
            <label className="ledger-field">
              <span>Email</span>
              <input type="email" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} placeholder="your@email.com" required />
            </label>
            <label className="ledger-field">
              <span>Contraseña</span>
              <input type="password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} placeholder="••••••••" required />
            </label>
            <button type="submit" disabled={loading} className="stamp-btn"><GiKey aria-hidden /> {loading ? 'Entrando…' : 'Entrar'}</button>
          </form>
        )}

        {tab === 'register' && (
          <form onSubmit={handleRegister}>
            <label className="ledger-field">
              <span>Usuario</span>
              <input type="text" value={registerUsername} onChange={(e) => setRegisterUsername(e.target.value)} placeholder="tu usuario" maxLength={14} required />
            </label>
            <label className="ledger-field">
              <span>Email</span>
              <input type="email" value={registerEmail} onChange={(e) => setRegisterEmail(e.target.value)} placeholder="your@email.com" required />
            </label>
            <label className="ledger-field">
              <span>Contraseña</span>
              <input type="password" value={registerPassword} onChange={(e) => setRegisterPassword(e.target.value)} placeholder="••••••••" required />
            </label>
            <button type="submit" disabled={loading} className="stamp-btn"><GiScrollUnfurled aria-hidden /> {loading ? 'Anotando…' : 'Crear cuenta'}</button>
          </form>
        )}
      </section>
    </main>
  );
}
