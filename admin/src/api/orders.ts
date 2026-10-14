import { supabase } from '../lib/supabase';

export type AdminOrder = {
  order_id: string; business_name: string; company: string | null; status: string; version: number;
  pending_version: number | null; review_status: string; project_title: string; project_type: string;
  created_at: string; confirmed_count: number; selected_count: number; finalized_count: number;
};
export type Suggestion = { model_id: string; display_name: string; gender: string; height_cm: number; score: number };

async function rpc(fn: string, args: Record<string, unknown>) {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new Error(error.message);
  return data;
}

export async function listOrders(): Promise<AdminOrder[]> {
  const { data, error } = await supabase.from('admin_orders').select('*').order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as AdminOrder[];
}
export const suggestRecipients = async (orderId: string) =>
  (await rpc('admin_suggest_recipients', { p_order_id: orderId })) as Suggestion[];
export const approveOrder = async (orderId: string, recipients: string[]) => { await rpc('admin_approve_order', { p_order_id: orderId, p_recipients: recipients }); };
export const returnOrder = async (orderId: string, comment: string) => { await rpc('admin_return_order', { p_order_id: orderId, p_comment: comment }); };
export const finalizeSelection = async (orderId: string) => { await rpc('admin_finalize_selection', { p_order_id: orderId }); };
export const completeOrder = async (orderId: string) => { await rpc('admin_complete_order', { p_order_id: orderId }); };
export const cancelOrder = async (orderId: string) => { await rpc('admin_cancel_order', { p_order_id: orderId }); };
