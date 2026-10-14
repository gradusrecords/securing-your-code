import { supabase } from '../lib/supabase';

export type L3 = { ru: string; uz: string; en: string };
export type DevTask = { id?: string; title: L3; description: L3; points: number; is_active: boolean };
export type Rank = { id: number; name: L3; min_points: number };

export async function listTasks(): Promise<DevTask[]> {
  const { data, error } = await supabase.from('dev_tasks').select('*').order('points');
  if (error) throw new Error(error.message);
  return (data ?? []) as DevTask[];
}
export async function saveTask(t: DevTask): Promise<void> {
  const { error } = await supabase.from('dev_tasks').upsert(t);
  if (error) throw new Error(error.message);
}
export async function listRanks(): Promise<Rank[]> {
  const { data, error } = await supabase.from('ranks').select('*').order('min_points');
  if (error) throw new Error(error.message);
  return (data ?? []) as Rank[];
}
export async function saveRank(r: Rank): Promise<void> {
  const { error } = await supabase.from('ranks').upsert(r);
  if (error) throw new Error(error.message);
}
