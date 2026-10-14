import { useEffect, useState } from 'react';
import {
  approveOrder, cancelOrder, completeOrder, finalizeSelection, listOrders, returnOrder, suggestRecipients,
  type AdminOrder, type Suggestion,
} from '../api/orders';

const STATUS: Record<string, string> = {
  in_review: 'На проверке', open: 'Открыт', selected: 'Выбор сделан', completed: 'Выполнен', cancelled: 'Отменён',
};

export function OrdersPage() {
  const [orders, setOrders] = useState<AdminOrder[] | null>(null);
  const [error, setError] = useState('');
  const [reviewing, setReviewing] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [ticked, setTicked] = useState<string[]>([]);
  const [comment, setComment] = useState('');
  const [confirmCancel, setConfirmCancel] = useState<string | null>(null);

  const reload = () => listOrders().then(setOrders).catch((e: Error) => setError(e.message));
  useEffect(() => { void reload(); }, []);

  const act = async (fn: () => Promise<void>, after?: () => void) => {
    setError('');
    try { await fn(); after?.(); await reload(); } catch (e) { setError((e as Error).message); }
  };

  const startReview = async (o: AdminOrder) => {
    setError(''); setReviewing(o.order_id); setTicked([]); setComment('');
    try { setSuggestions(await suggestRecipients(o.order_id)); } catch (e) { setError((e as Error).message); }
  };

  const needsReview = (o: AdminOrder) => o.status === 'in_review' || (o.pending_version != null && o.status === 'open');

  return (
    <section>
      <h2>Заказы</h2>
      {error ? <p className="error" role="alert">{error}</p> : null}
      {(orders ?? []).map((o) => (
        <div key={o.order_id} data-testid={`order-${o.order_id}`}>
          <div className="row">
            <div className="grow">
              <b>{o.project_title}</b> <span className="tag">{STATUS[o.status] ?? o.status}</span>
              {o.pending_version != null && o.status !== 'in_review' ? <span className="tag"> правки v{o.pending_version}</span> : null}
              <div className="muted">{o.business_name}{o.company ? `, ${o.company}` : ''} · {o.project_type} · подтвердили: {o.confirmed_count} · выбрано: {o.selected_count} · закреплено: {o.finalized_count}</div>
            </div>
            {needsReview(o) ? <button data-testid={`review-${o.order_id}`} onClick={() => startReview(o)}>Проверить</button> : null}
            {o.status === 'selected' ? <button data-testid={`finalize-${o.order_id}`} onClick={() => act(() => finalizeSelection(o.order_id))}>Закрепить</button> : null}
            {o.status === 'open' || o.status === 'selected' ? <button data-testid={`complete-${o.order_id}`} onClick={() => act(() => completeOrder(o.order_id))}>Завершить</button> : null}
            {['in_review', 'open', 'selected'].includes(o.status) && confirmCancel !== o.order_id ? (
              <button data-testid={`cancel-${o.order_id}`} onClick={() => setConfirmCancel(o.order_id)}>Отменить</button>
            ) : null}
            {confirmCancel === o.order_id ? (
              <button data-testid={`cancel-confirm-${o.order_id}`} onClick={() => act(() => cancelOrder(o.order_id), () => setConfirmCancel(null))}>Да, отменить</button>
            ) : null}
          </div>
          {reviewing === o.order_id ? (
            <div className="row" style={{ display: 'block' }}>
              <p className="muted">Получатели (подсказка по полу, направлению и городу):</p>
              {suggestions.map((s) => (
                <label key={s.model_id} style={{ display: 'flex', gap: 8, textTransform: 'none', letterSpacing: 0 }}>
                  <input type="checkbox" checked={ticked.includes(s.model_id)}
                    onChange={() => setTicked((t) => (t.includes(s.model_id) ? t.filter((x) => x !== s.model_id) : [...t, s.model_id]))} />
                  {s.display_name} · {s.height_cm} см · совпадение {s.score}
                </label>
              ))}
              <button data-testid={`approve-${o.order_id}`} disabled={o.status === 'in_review' && ticked.length === 0}
                onClick={() => act(() => approveOrder(o.order_id, ticked), () => setReviewing(null))}>Одобрить и разослать</button>
              <input placeholder="Комментарий для возврата" value={comment} onChange={(e) => setComment(e.target.value)} />
              <button data-testid={`return-${o.order_id}`} onClick={() => {
                if (!comment.trim()) { setError('Укажите комментарий'); return; }
                void act(() => returnOrder(o.order_id, comment.trim()), () => setReviewing(null));
              }}>Вернуть с комментарием</button>
            </div>
          ) : null}
        </div>
      ))}
    </section>
  );
}
