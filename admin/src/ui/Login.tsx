import { useState } from 'react';
import { supabase } from '../lib/supabase';

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (err) setError(err.message);
  };

  return (
    <form className="card" onSubmit={submit}>
      <h1>Вход</h1>
      <label>E-mail<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
      <label>Пароль<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
      {error ? <p className="error" role="alert">{error}</p> : null}
      <button type="submit" disabled={busy}>Войти</button>
    </form>
  );
}
