import { useEffect, useState } from 'react';
import { listRanks, listTasks, saveRank, saveTask, type DevTask, type L3, type Rank } from '../api/development';

const LANGS = ['ru', 'uz', 'en'] as const;
const blankTask = (): DevTask => ({ title: { ru: '', uz: '', en: '' }, description: { ru: '', uz: '', en: '' }, points: 3, is_active: true });

export function DevelopmentPage() {
  const [tasks, setTasks] = useState<DevTask[]>([]);
  const [ranks, setRanks] = useState<Rank[]>([]);
  const [draft, setDraft] = useState<DevTask>(blankTask());
  const [error, setError] = useState('');

  const load = () => {
    listTasks().then(setTasks).catch((e: Error) => setError(e.message));
    listRanks().then(setRanks).catch((e: Error) => setError(e.message));
  };
  useEffect(load, []);

  const validate = (t: DevTask): string => {
    if (!t.title.ru.trim()) return 'Название на русском обязательно';
    if (!Number.isInteger(t.points) || t.points < 1 || t.points > 10) return 'Очки: целое число от 1 до 10';
    return '';
  };
  const save = async (t: DevTask, after?: () => void) => {
    const v = validate(t);
    if (v) { setError(v); return; }
    setError('');
    try { await saveTask(t); after?.(); load(); } catch (e) { setError((e as Error).message); }
  };
  const edit = (i: number, over: Partial<DevTask>) => setTasks((ts) => ts.map((t, k) => (k === i ? { ...t, ...over } : t)));
  const setL3 = (v: L3, lang: (typeof LANGS)[number], text: string): L3 => ({ ...v, [lang]: text });

  const form = (t: DevTask, onChange: (o: Partial<DevTask>) => void, id: string, onSave: () => void) => (
    <div className="row" data-testid={`task-${id}`}>
      <div className="grow">
        {LANGS.map((l) => (
          <input key={l} placeholder={`Название (${l})`} value={t.title[l] ?? ''} onChange={(e) => onChange({ title: setL3(t.title, l, e.target.value) })} />
        ))}
        {LANGS.map((l) => (
          <textarea key={l} placeholder={`Описание (${l})`} value={t.description[l] ?? ''} onChange={(e) => onChange({ description: setL3(t.description, l, e.target.value) })} />
        ))}
      </div>
      <input data-testid={`points-${id}`} type="number" style={{ width: 70 }} value={t.points} onChange={(e) => onChange({ points: Number(e.target.value) })} />
      <label><input type="checkbox" checked={t.is_active} onChange={(e) => onChange({ is_active: e.target.checked })} /> активно</label>
      <button data-testid={`save-${id}`} onClick={onSave}>Сохранить</button>
    </div>
  );

  return (
    <section>
      <h2>Развитие</h2>
      {error ? <p className="error" role="alert">{error}</p> : null}
      <h3>Новое задание</h3>
      {form(draft, (o) => setDraft((d) => ({ ...d, ...o })), 'new', () => void save(draft, () => setDraft(blankTask())))}
      <h3>Задания</h3>
      {tasks.map((t, i) => form(t, (o) => edit(i, o), t.id ?? String(i), () => void save(t)))}
      <h3>Ранги</h3>
      {ranks.map((r) => (
        <div key={r.id} className="row">
          <span className="grow">{r.name.ru}</span>
          <input type="number" aria-label={`Порог ${r.name.ru}`} style={{ width: 90 }} value={r.min_points}
            onChange={(e) => setRanks((rs) => rs.map((x) => (x.id === r.id ? { ...x, min_points: Number(e.target.value) } : x)))} />
          <button onClick={async () => {
            if (!Number.isInteger(r.min_points) || r.min_points < 0) { setError('Порог: целое число от 0'); return; }
            setError('');
            try { await saveRank(r); } catch (e) { setError((e as Error).message); }
          }}>Сохранить</button>
        </div>
      ))}
    </section>
  );
}
