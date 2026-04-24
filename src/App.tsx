import { useState, useEffect } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import LoginPage from './pages/LoginPage';
import PromptCatalog from './pages/PromptCatalog';
import './App.scss';

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

  if (session === undefined) {
    return (
      <div className="app-loading">
        <div className="app-loading__text">Loading…</div>
      </div>
    );
  }

  if (session === null) return <LoginPage />;

  return <PromptCatalog session={session} onLogout={() => supabase.auth.signOut()} />;
}
