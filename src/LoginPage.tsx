import { useState } from 'react';
import { supabase } from './supabase';

const th = {
  page: '#06040f',
  card: '#110e1e',
  cardBorder: '#2e2a4a',
  heading: '#f0eeff',
  inputBg: '#13101f',
  inputBorder: '#2e2a4a',
  inputText: '#f0eeff',
  labelColor: '#b8b5e0',
  dangerText: '#f87171',
};

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (authError) setError('Invalid email or password.');
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    boxSizing: 'border-box',
    borderRadius: 8,
    border: `1.5px solid ${th.inputBorder}`,
    background: th.inputBg,
    padding: '10px 13px',
    fontSize: '0.9rem',
    outline: 'none',
    color: th.inputText,
    fontFamily: 'inherit',
    marginBottom: '1rem',
  };

  return (
    <div style={{ minHeight: '100vh', background: th.page, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Inter', sans-serif", padding: '1rem' }}>
      <div style={{ background: th.card, border: `1px solid ${th.cardBorder}`, borderRadius: 16, padding: '2rem', width: '100%', maxWidth: 380, boxShadow: '0 8px 40px rgba(0,0,0,0.4)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: '1.5rem' }}>
          <div style={{ width: 34, height: 34, borderRadius: 9, background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', boxShadow: '0 0 16px rgba(139,92,246,0.4)' }}>✨</div>
          <h1 style={{ fontSize: '1.1rem', fontWeight: 800, color: th.heading, margin: 0 }}>FE Team Prompt Catalog</h1>
        </div>

        <form onSubmit={handleLogin}>
          <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: th.labelColor, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>Email</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="fe_team@team.local"
            required
            style={inputStyle}
            onFocus={e => (e.target.style.borderColor = '#7c3aed')}
            onBlur={e => (e.target.style.borderColor = th.inputBorder)}
          />

          <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: th.labelColor, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>Password</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            style={{ ...inputStyle, marginBottom: error ? '0.5rem' : '1.5rem' }}
            onFocus={e => (e.target.style.borderColor = '#7c3aed')}
            onBlur={e => (e.target.style.borderColor = th.inputBorder)}
          />

          {error && <p style={{ margin: '0 0 1rem', fontSize: '0.8rem', color: th.dangerText }}>{error}</p>}

          <button
            type="submit"
            disabled={loading}
            style={{ width: '100%', fontSize: '0.88rem', fontWeight: 700, padding: '10px 0', borderRadius: 8, border: 'none', background: loading ? '#4b4870' : 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: 'white', cursor: loading ? 'not-allowed' : 'pointer', boxShadow: loading ? 'none' : '0 0 10px rgba(139,92,246,0.3)' }}
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
