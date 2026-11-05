import { supabase } from '../lib/supabase';

export type AdminQuestion = {
  question_id: string; author_id: string; author_role: string; author_name: string | null; order_id: string | null;
  body: string; answer: string | null; answered_at: string | null; created_at: string;
};

export async function listQuestions(): Promise<AdminQuestion[]> {
  const { data, error } = await supabase.from('admin_questions').select('*').order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as AdminQuestion[];
}
export async function answerQuestion(id: string, answer: string): Promise<void> {
  const { error } = await supabase.rpc('admin_answer_question', { p_question_id: id, p_answer: answer });
  if (error) throw new Error(error.message);
}
