import { supabase } from '../lib/supabase';

export type Role = 'model' | 'business' | 'admin';

export async function signUpWithEmail(
  email: string,
  password: string,
  role: 'model' | 'business',
): Promise<void> {
  const { error } = await supabase.auth.signUp({ email, password, options: { data: { role } } });
  if (error) throw new Error(error.message);
}

export async function signInWithEmail(email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw new Error(error.message);
}

export async function getMyRole(): Promise<Role | null> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return null;
  const { data, error } = await supabase.from('profiles').select('role').eq('id', userId).single();
  if (error) throw new Error(error.message);
  return (data?.role as Role | null) ?? null;
}

export async function setMyRole(role: 'model' | 'business'): Promise<void> {
  const { error } = await supabase.rpc('set_my_role', { new_role: role });
  if (error) throw new Error(error.message);
}
