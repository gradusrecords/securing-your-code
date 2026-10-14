import { supabase } from '../lib/supabase';
import type { Language } from '../i18n';

export type Idea = { id: string; kind: 'pr' | 'media' | 'motivation'; title: string; body: string };
type Localized = Partial<Record<Language, string>>;
const pick = (v: Localized | undefined, lang: Language) => v?.[lang] || v?.ru || '';

export async function listIdeas(lang: Language): Promise<Idea[]> {
  const { data, error } = await supabase.from('content_items').select('*').order('sort');
  if (error) throw new Error(error.message);
  return ((data ?? []) as Array<{ id: string; kind: Idea['kind']; title: Localized; body: Localized }>).map((r) => ({
    id: r.id, kind: r.kind, title: pick(r.title, lang), body: pick(r.body, lang),
  }));
}
