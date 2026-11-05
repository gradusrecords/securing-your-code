import { supabase } from '../lib/supabase';

export type AuditRecord = { id: number; actor_id: string | null; action: string; target_type: string | null; target_id: string | null; details: unknown; created_at: string };

export async function listAudit(limit: number): Promise<AuditRecord[]> {
  const { data, error } = await supabase.from('audit_log').select('*').order('created_at', { ascending: false }).limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as AuditRecord[];
}
