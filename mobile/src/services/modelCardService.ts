import { supabase } from '../lib/supabase';
import type { ModelCardInput } from '../models/modelCard';

export type StoredCard = ModelCardInput & {
  status: 'pending' | 'approved' | 'returned';
  review_comment: string | null;
};

async function currentUserId(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  const id = data.user?.id;
  if (!id) throw new Error('Not signed in');
  return id;
}

export async function getMyCard(): Promise<StoredCard | null> {
  const id = await currentUserId();
  const { data, error } = await supabase.from('model_profiles').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as StoredCard | null) ?? null;
}

export async function saveMyCard(input: ModelCardInput): Promise<void> {
  const id = await currentUserId();
  const { error } = await supabase.from('model_profiles').upsert({ ...input, id }, { onConflict: 'id' });
  if (error) throw new Error(error.message);
}

export async function uploadPhoto(uri: string, fileName: string): Promise<string> {
  const id = await currentUserId();
  const path = `${id}/${fileName}`;
  const body = await (await fetch(uri)).arrayBuffer();
  const { error } = await supabase.storage.from('model-photos').upload(path, body, {
    contentType: 'image/jpeg',
    upsert: true,
  });
  if (error) throw new Error(error.message);
  return path;
}
