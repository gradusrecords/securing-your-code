import { useEffect, useState } from 'react';
import { listModels, reviewModel, saveCatalogEntry, type AdminModel } from '../api/models';

export function ModelsPage() {
  const [models, setModels] = useState<AdminModel[] | null>(null);
  const [error, setError] = useState('');
  const [comments, setComments] = useState<Record<string, string>>({});
  const [ratings, setRatings] = useState<Record<string, string>>({});

  useEffect(() => { listModels().then(setModels).catch((e: Error) => setError(e.message)); }, []);

  const patch = (id: string, over: Partial<AdminModel>) =>
    setModels((ms) => ms?.map((m) => (m.model_id === id ? { ...m, ...over } : m)) ?? ms);

  const act = async (fn: () => Promise<void>, after: () => void) => {
    setError('');
    try { await fn(); after(); } catch (e) { setError((e as Error).message); }
  };

  const ratingOf = (m: AdminModel) => ratings[m.model_id] ?? String(m.agency_rating ?? 9);

  const save = (m: AdminModel, rating: number, published: boolean) => {
    if (!Number.isInteger(rating) || rating < 0 || rating > 10) { setError('Рейтинг должен быть целым числом от 0 до 10'); return; }
    void act(() => saveCatalogEntry(m.model_id, { agency_rating: rating, agency_note: m.agency_note, is_published: published }),
      () => patch(m.model_id, { agency_rating: rating, is_published: published }));
  };

  const sorted = [...(models ?? [])].sort((a, b) => Number(b.status === 'pending') - Number(a.status === 'pending'));

  return (
    <section>
      <h2>Модели</h2>
      {error ? <p className="error" role="alert">{error}</p> : null}
      {sorted.map((m) => (
        <div key={m.model_id} className="row" data-testid={`model-${m.model_id}`}>
          <div className="grow">
            <b>{m.display_name ?? m.full_name}</b> {m.status === 'pending' ? <span className="tag">на проверке</span> : null}
            <div className="muted">{m.full_name} · {m.city} · {m.height_cm} см · {m.directions.join(', ')}</div>
            <div className="muted">{m.phone} · {m.telegram}{m.instagram ? ` · ${m.instagram}` : ''}{m.parent_contact ? ` · опекун: ${m.parent_contact}` : ''}</div>
            {m.review_comment ? <div className="muted">Комментарий: {m.review_comment}</div> : null}
          </div>
          {m.status === 'pending' ? (
            <>
              <input placeholder="Комментарий для возврата" value={comments[m.model_id] ?? ''}
                onChange={(e) => setComments((c) => ({ ...c, [m.model_id]: e.target.value }))} />
              <button data-testid={`approve-${m.model_id}`}
                onClick={() => act(() => reviewModel(m.model_id, 'approved', undefined), () => patch(m.model_id, { status: 'approved' }))}>Одобрить</button>
              <button data-testid={`return-${m.model_id}`} onClick={() => {
                const c = (comments[m.model_id] ?? '').trim();
                if (!c) { setError('Укажите комментарий'); return; }
                void act(() => reviewModel(m.model_id, 'returned', c), () => patch(m.model_id, { status: 'returned', review_comment: c }));
              }}>Вернуть</button>
            </>
          ) : null}
          {m.status === 'approved' ? (
            <>
              <input data-testid={`rating-${m.model_id}`} type="number" style={{ width: 70 }} value={ratingOf(m)}
                onChange={(e) => setRatings((r) => ({ ...r, [m.model_id]: e.target.value }))} />
              <button data-testid={`fav-${m.model_id}`} onClick={() => save(m, 10, m.is_published)}>★ Фаворит</button>
              <label><input type="checkbox" checked={m.is_published} onChange={(e) => save(m, Number(ratingOf(m)), e.target.checked)} /> В каталоге</label>
              <button data-testid={`save-${m.model_id}`} onClick={() => save(m, Number(ratingOf(m)), m.is_published)}>Сохранить</button>
            </>
          ) : null}
        </div>
      ))}
    </section>
  );
}
