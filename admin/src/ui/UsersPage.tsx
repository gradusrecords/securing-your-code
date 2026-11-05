import { useEffect, useState } from 'react';
import { listUsers, setBlocked, type AdminUser } from '../api/users';

export function UsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState<string | null>(null);

  useEffect(() => { listUsers().then(setUsers).catch((e: Error) => setError(e.message)); }, []);

  const toggle = async (u: AdminUser) => {
    setError('');
    try {
      await setBlocked(u.user_id, !u.is_blocked);
      setUsers((all) => all.map((x) => (x.user_id === u.user_id ? { ...x, is_blocked: !u.is_blocked } : x)));
      setConfirm(null);
    } catch (e) { setError((e as Error).message); }
  };

  return (
    <section>
      <h2>Пользователи</h2>
      {error ? <p className="error" role="alert">{error}</p> : null}
      {users.map((u) => (
        <div key={u.user_id} className="row">
          <div className="grow"><b>{u.display_name ?? '—'}</b> <span className="muted">{u.email} · {u.role ?? 'роль не выбрана'}</span></div>
          {u.is_blocked ? <span className="tag">заблокирован</span> : null}
          {confirm === u.user_id ? (
            <button data-testid={`block-confirm-${u.user_id}`} onClick={() => toggle(u)}>{u.is_blocked ? 'Да, разблокировать' : 'Да, заблокировать'}</button>
          ) : (
            <button data-testid={`block-${u.user_id}`} onClick={() => setConfirm(u.user_id)}>{u.is_blocked ? 'Разблокировать' : 'Заблокировать'}</button>
          )}
        </div>
      ))}
    </section>
  );
}
