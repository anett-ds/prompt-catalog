import { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import './LoginPage.scss';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'dark');
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (authError) setError('Invalid email or password.');
  };

  return (
    <div className="login-page">
      <div className="login-page__card">
        <div className="login-page__logo">
          <div className="login-page__logo-icon">✨</div>
          <h1 className="login-page__title">FE Team Prompt Catalog</h1>
        </div>

        <form onSubmit={handleLogin}>
          <label className="login-page__label">Email</label>
          <input
            className="input-base login-page__input"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="fe_team@team.local"
            required
          />

          <label className="login-page__label">Password</label>
          <input
            className={`input-base login-page__input${error ? ' login-page__input--has-error' : ''}`}
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="••••••••"
            required
          />

          {error && <p className="login-page__error">{error}</p>}

          <button
            className={`login-page__submit${loading ? ' login-page__submit--loading' : ''}`}
            type="submit"
            disabled={loading}
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
