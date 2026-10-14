import { supabase } from '../lib/supabase';
import type { L3 } from './development';

export type ContentItem = { id?: string; kind: 'pr' | 'media' | 'motivation'; title: L3; body: L3; sort: number; is_published: boolean };

export async function listContent(): Promise<ContentItem[]> {
  const { data, error } = await supabase.from('content_items').select('*').order('sort');
  if (error) throw new Error(error.message);
  return (data ?? []) as ContentItem[];
}
export async function saveContent(item: ContentItem): Promise<void> {
  const { error } = await supabase.from('content_items').upsert(item);
  if (error) throw new Error(error.message);
}
