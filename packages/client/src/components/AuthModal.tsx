import { useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { getServerUrl } from '../lib/serverUrl';

type AuthTab = 'login' | 'register' | 'guest';

export function AuthModal() {
  const [tab, setTab] = useState<AuthTab>('guest');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { setAuthStatus, setCurrentPlayer, setCurrentPage } = useGameStore();

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-950 flex items-center justify-center p-4">
      <div className="bg-slate-900 rounded-lg shadow-xl w-full max-w-md">
        <div className="bg-slate-900 text-white p-6">
          <h1 className="text-3xl font-bold text-center">La Base</h1>
          <p className="text-center text-slate-400 text-sm">Juego de cartas multijugador</p>
        </div>

        {/* Tabs */}
        <div className="flex border-b">
          <button
            onClick={() => setTab('guest')}
            className={`flex-1 py-3 font-semibold transition ${
              tab === 'guest'
                ? 'border-b-2 border-emerald-600 text-emerald-600'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            Invitado
          </button>
          <button
            onClick={() => setTab('login')}
            className={`flex-1 py-3 font-semibold transition ${
              tab === 'login'
                ? 'border-b-2 border-emerald-600 text-emerald-600'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            Iniciar sesión
          </button>
          <button
            onClick={() => setTab('register')}
            className={`flex-1 py-3 font-semibold transition ${
              tab === 'register'
                ? 'border-b-2 border-emerald-600 text-emerald-600'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            Registrarse
          </button>
        </div>

        {/* Forms */}
        <div className="p-6">
          {error && <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">{error}</div>}

          {/* Guest Tab */}
          {tab === 'guest' && (
            <form onSubmit={handleGuest}>
              <div className="mb-4">
                <label className="block text-slate-300 font-semibold mb-2">Nombre de jugador</label>
                <input
                  type="text"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  placeholder="Ingresá tu nombre"
                  className="w-full px-4 py-2 border border-slate-700 rounded focus:outline-none focus:border-emerald-600"
                />
              </div>
              <button
                type="submit"
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 rounded transition"
              >
                Jugar como invitado
              </button>
              <p className="text-xs text-slate-500 text-center mt-4">Las partidas de invitado no guardan ranking</p>
            </form>
          )}

          {/* Login Tab */}
          {tab === 'login' && (
            <form onSubmit={handleLogin}>
              <div className="mb-4">
                <label className="block text-slate-300 font-semibold mb-2">Email</label>
                <input
                  type="email"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="w-full px-4 py-2 border border-slate-700 rounded focus:outline-none focus:border-emerald-600"
                />
              </div>
              <div className="mb-6">
                <label className="block text-slate-300 font-semibold mb-2">Contraseña</label>
                <input
                  type="password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-2 border border-slate-700 rounded focus:outline-none focus:border-emerald-600"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 text-white font-bold py-2 rounded transition"
              >
                {loading ? 'Entrando...' : 'Entrar'}
              </button>
            </form>
          )}

          {/* Register Tab */}
          {tab === 'register' && (
            <form onSubmit={handleRegister}>
              <div className="mb-4">
                <label className="block text-slate-300 font-semibold mb-2">Usuario</label>
                <input
                  type="text"
                  value={registerUsername}
                  onChange={(e) => setRegisterUsername(e.target.value)}
                  placeholder="tu usuario"
                  className="w-full px-4 py-2 border border-slate-700 rounded focus:outline-none focus:border-emerald-600"
                />
              </div>
              <div className="mb-4">
                <label className="block text-slate-300 font-semibold mb-2">Email</label>
                <input
                  type="email"
                  value={registerEmail}
                  onChange={(e) => setRegisterEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="w-full px-4 py-2 border border-slate-700 rounded focus:outline-none focus:border-emerald-600"
                />
              </div>
              <div className="mb-6">
                <label className="block text-slate-300 font-semibold mb-2">Contraseña</label>
                <input
                  type="password"
                  value={registerPassword}
                  onChange={(e) => setRegisterPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-2 border border-slate-700 rounded focus:outline-none focus:border-emerald-600"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-slate-600 text-white font-bold py-2 rounded transition"
              >
                {loading ? 'Creando cuenta...' : 'Crear cuenta'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
