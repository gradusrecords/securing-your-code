import { useAdminSession } from './auth/useAdminSession';
import { Login } from './ui/Login';
import { Shell } from './ui/Shell';
import { supabase } from './lib/supabase';

export function App() {
  const state = useAdminSession();
  if (state.status === 'loading') return <p className="card">…</p>;
  if (state.status === 'signedOut') return <Login />;
  if (state.status === 'forbidden') {
    return (
      <div className="card">
        <h1>Нет доступа</h1>
        <p>Эта панель только для суперадмина ZAYA.</p>
        <button onClick={() => { void supabase.auth.signOut(); }}>Выйти</button>
      </div>
    );
  }
  return <Shell email={state.email} />;
}
