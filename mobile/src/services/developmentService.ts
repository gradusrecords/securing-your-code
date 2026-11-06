import { supabase } from '../lib/supabase';
import type { Language } from '../i18n';

type Localized = Partial<Record<Language, string>>;

export type TodayTask = { assignment_id: string; title: string; description: string; points: number; completed: boolean };
export type Progress = {
  total_points: number;
  rank: { id: number; name: string };
  next_rank_points: number | null;
  streak: number;
  badges: string[];
};

const pick = (v: Localized | undefined, lang: Language): string => v?.[lang] || v?.ru || '';

export async function getTodayTasks(lang: Language): Promise<TodayTask[]> {
  const { data, error } = await supabase.rpc('get_today_tasks');
  if (error) throw new Error(error.message);
  return ((data ?? []) as Array<{ assignment_id: string; title: Localized; description: Localized; points: number; completed: boolean }>).map(
    (r) => ({
      assignment_id: r.assignment_id,
      title: pick(r.title, lang),
      description: pick(r.description, lang),
      points: r.points,
      completed: r.completed,
    }),
  );
}

export async function completeTask(assignmentId: string): Promise<{ points_awarded: number; new_badges: string[] }> {
  const { data, error } = await supabase.rpc('complete_task', { p_assignment_id: assignmentId });
  if (error) throw new Error(error.message);
  return { points_awarded: data.points_awarded, new_badges: data.new_badges ?? [] };
}

export async function getProgress(lang: Language): Promise<Progress> {
  const { data, error } = await supabase.rpc('my_progress');
  if (error) throw new Error(error.message);
  return {
    total_points: data.total_points,
    rank: { id: data.rank.id, name: pick(data.rank.name, lang) },
    next_rank_points: data.next_rank_points,
    streak: data.streak,
    badges: data.badges ?? [],
  };
}
