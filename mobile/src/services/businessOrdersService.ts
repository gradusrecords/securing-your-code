import { supabase } from '../lib/supabase';
import type { BriefInput } from '../models/brief';

export type BusinessOrder = {
  order_id: string;
  status: string;
  version: number;
  pending_version: number | null;
  brief: BriefInput;
  review_status: string;
  confirmed_count: number;
  selected_count: number;
  created_at: string;
};

export type ConfirmedModel = {
  order_id: string;
  model_id: string;
  display_name: string;
  gender: string;
  height_cm: number;
  photos: string[];
  agency_rating: number | null;
  is_favorite: boolean;
  is_selected: boolean;
  [k: string]: unknown;
};

async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new Error(error.message);
  return data as T;
}

export const createOrder = (b: BriefInput): Promise<string> => rpc<string>('create_order', { p_brief: b });
export const updateOrder = (id: string, b: BriefInput): Promise<number> => rpc<number>('update_order', { p_order_id: id, p_brief: b });
export const cancelOrder = async (id: string): Promise<void> => { await rpc('cancel_order', { p_order_id: id }); };
export const selectModels = async (id: string, modelIds: string[]): Promise<void> => {
  await rpc('select_models', { p_order_id: id, p_model_ids: modelIds });
};

export async function listBusinessOrders(): Promise<BusinessOrder[]> {
  const { data, error } = await supabase.from('business_orders').select('*');
  if (error) throw new Error(error.message);
  return (data ?? []) as BusinessOrder[];
}

export async function listConfirmedModels(orderId: string): Promise<ConfirmedModel[]> {
  const { data, error } = await supabase.from('order_confirmed_models').select('*').eq('order_id', orderId);
  if (error) throw new Error(error.message);
  return (data ?? []) as ConfirmedModel[];
}

export async function askManager(orderId: string, body: string): Promise<void> {
  const text = body.trim();
  if (!text) throw new Error('Message is empty');
  await rpc('ask_question', { p_order_id: orderId, p_body: text });
}
