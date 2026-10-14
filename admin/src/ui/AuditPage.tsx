import { useEffect, useState } from 'react';
import { listAudit, type AuditRecord } from '../api/audit';

export function AuditPage() {
  const [rows, setRows] = useState<AuditRecord[]>([]);
  const [error, setError] = useState('');
  useEffect(() => { listAudit(100).then(setRows).catch((e: Error) => setError(e.message)); }, []);
  return (
    <section>
      <h2>Журнал</h2>
      {error ? <p className="error" role="alert">{error}</p> : null}
      {rows.map((r) => (
        <div key={r.id} className="row">
          <span className="muted">{new Date(r.created_at).toLocaleString('ru-RU')}</span>
          <b>{r.action}</b>
          <span className="muted">{r.target_type} {r.target_id}</span>
        </div>
      ))}
    </section>
  );
}
