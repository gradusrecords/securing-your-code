import { supabase } from '../lib/supabase';

export type AdminModel = {
  model_id: string; full_name: string; display_name: string | null; gender: string; city: string; phone: string;
  telegram: string; instagram: string | null; birth_date: string; parent_contact: string | null; height_cm: number;
  experience: string; directions: string[]; photos: string[]; status: 'pending' | 'approved' | 'returned';
  review_comment: string | null; agency_rating: number | null; agency_note: string | null; is_published: boolean; created_at: string;
};

export async function listModels(): Promise<AdminModel[]> {
  const { data, error } = await supabase.from('admin_models').select('*').order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as AdminModel[];
}

export async function reviewModel(id: string, status: 'approved' | 'returned', comment?: string): Promise<void> {
  const { error } = await supabase.rpc('review_model', { target: id, new_status: status, comment: comment ?? null });
  if (error) throw new Error(error.message);
}

export async function saveCatalogEntry(
  id: string, entry: { agency_rating: number; agency_note: string | null; is_published: boolean },
): Promise<void> {
  const { error } = await supabase.from('catalog_entries').upsert({ model_id: id, ...entry }, { onConflict: 'model_id' });
  if (error) throw new Error(error.message);
}
