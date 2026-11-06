import { useEffect, useState } from 'react';
import { listContent, saveContent, type ContentItem } from '../api/content';
import type { L3 } from '../api/development';

const LANGS = ['ru', 'uz', 'en'] as const;
const KINDS: ContentItem['kind'][] = ['motivation', 'pr', 'media'];
const blank = (): ContentItem => ({ kind: 'pr', title: { ru: '', uz: '', en: '' }, body: { ru: '', uz: '', en: '' }, sort: 100, is_published: true });

export function ContentPage() {
  const [items, setItems] = useState<ContentItem[]>([]);
  const [draft, setDraft] = useState<ContentItem>(blank());
  const [error, setError] = useState('');

  const load = () => { listContent().then(setItems).catch((e: Error) => setError(e.message)); };
  useEffect(load, []);

  const save = async (it: ContentItem, after?: () => void) => {
    if (!it.title.ru.trim() || !it.body.ru.trim()) { setError('Заголовок и текст на русском обязательны'); return; }
    setError('');
    try { await saveContent(it); after?.(); load(); } catch (e) { setError((e as Error).message); }
  };
  const setL3 = (v: L3, lang: (typeof LANGS)[number], text: string): L3 => ({ ...v, [lang]: text });

  const form = (it: ContentItem, onChange: (o: Partial<ContentItem>) => void, id: string, onSave: () => void) => (
    <div className="row" data-testid={`content-${id}`}>
      <select value={it.kind} onChange={(e) => onChange({ kind: e.target.value as ContentItem['kind'] })}>
        {KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
      </select>
      <div className="grow">
        {LANGS.map((l) => <input key={l} data-testid={`title-${l}-${id}`} placeholder={`Заголовок (${l})`} value={it.title[l] ?? ''} onChange={(e) => onChange({ title: setL3(it.title, l, e.target.value) })} />)}
        {LANGS.map((l) => <textarea key={l} data-testid={`body-${l}-${id}`} placeholder={`Текст (${l})`} value={it.body[l] ?? ''} onChange={(e) => onChange({ body: setL3(it.body, l, e.target.value) })} />)}
      </div>
      <input type="number" style={{ width: 70 }} aria-label="Порядок" value={it.sort} onChange={(e) => onChange({ sort: Number(e.target.value) })} />
      <label><input type="checkbox" checked={it.is_published} onChange={(e) => onChange({ is_published: e.target.checked })} /> опубликовано</label>
      <button data-testid={`save-${id}`} onClick={onSave}>Сохранить</button>
    </div>
  );

  return (
    <section>
      <h2>Контент</h2>
      {error ? <p className="error" role="alert">{error}</p> : null}
      <h3>Новая запись</h3>
      {form(draft, (o) => setDraft((d) => ({ ...d, ...o })), 'new', () => void save(draft, () => setDraft(blank())))}
      <h3>Записи</h3>
      {items.map((it, i) => form(it, (o) => setItems((all) => all.map((x, k) => (k === i ? { ...x, ...o } : x))), it.id ?? String(i), () => void save(it)))}
    </section>
  );
}
