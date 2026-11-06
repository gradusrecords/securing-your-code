import { supabase } from '../lib/supabase';

export type AdminUser = { user_id: string; email: string | null; role: string | null; is_blocked: boolean; display_name: string | null; created_at: string };

export async function listUsers(): Promise<AdminUser[]> {
  const { data, error } = await supabase.from('admin_users').select('*').order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as AdminUser[];
}
export async function setBlocked(userId: string, blocked: boolean): Promise<void> {
  const { error } = await supabase.rpc('admin_set_blocked', { p_user_id: userId, p_blocked: blocked });
  if (error) throw new Error(error.message);
}
