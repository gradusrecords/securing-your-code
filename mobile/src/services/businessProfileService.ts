import { supabase } from '../lib/supabase';
import type { BusinessProfileInput } from '../models/businessProfile';

async function currentUserId(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  const id = data.user?.id;
  if (!id) throw new Error('Not signed in');
  return id;
}

export async function getMyBusinessProfile(): Promise<BusinessProfileInput | null> {
  const id = await currentUserId();
  const { data, error } = await supabase.from('business_profiles').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as BusinessProfileInput | null) ?? null;
}

export async function saveMyBusinessProfile(input: BusinessProfileInput): Promise<void> {
  const id = await currentUserId();
  const { error } = await supabase.from('business_profiles').upsert({ ...input, id }, { onConflict: 'id' });
  if (error) throw new Error(error.message);
}
