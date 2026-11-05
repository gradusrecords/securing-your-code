import { supabase } from '../lib/supabase';

export type BriefSection = Record<string, unknown>;
// The `contact` section is stripped on the server and never reaches the model.
export type Brief = {
  project?: BriefSection;
  when_where?: BriefSection;
  who?: BriefSection;
  conditions?: BriefSection;
  requirements?: BriefSection;
};

export type ModelOrder = {
  order_id: string;
  version: number;
  status: string;
  brief: Brief;
  changes: unknown | null;
  my_response: 'confirmed' | 'declined' | 'needs_reconfirm' | null;
  updated_flag: boolean;
};

export async function listMyOrders(): Promise<ModelOrder[]> {
  const { data, error } = await supabase.from('model_order_cards').select('*');
  if (error) throw new Error(error.message);
  return (data ?? []) as ModelOrder[];
}

export async function respondToOrder(orderId: string, confirm: boolean): Promise<void> {
  const { error } = await supabase.rpc('respond_to_order', { p_order_id: orderId, p_confirm: confirm });
  if (error) throw new Error(error.message);
}

export async function askQuestion(orderId: string, body: string): Promise<void> {
  const text = body.trim();
  if (!text) throw new Error('Question is empty');
  const { error } = await supabase.rpc('ask_question', { p_order_id: orderId, p_body: text });
  if (error) throw new Error(error.message);
}

const FINISHED = ['completed', 'cancelled'];

export function groupOrders(orders: ModelOrder[]): { new: ModelOrder[]; mine: ModelOrder[]; archive: ModelOrder[] } {
  const g = { new: [] as ModelOrder[], mine: [] as ModelOrder[], archive: [] as ModelOrder[] };
  for (const o of orders) {
    if (o.my_response === 'declined' || FINISHED.includes(o.status)) g.archive.push(o);
    else if (o.my_response === 'confirmed') g.mine.push(o);
    else g.new.push(o);
  }
  return g;
}
