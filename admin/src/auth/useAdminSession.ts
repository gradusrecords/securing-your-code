import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export type AdminState =
  | { status: 'loading' }
  | { status: 'signedOut' }
  | { status: 'forbidden' }
  | { status: 'admin'; email: string };

export async function resolveAdminState(): Promise<AdminState> {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session) return { status: 'signedOut' };
    const { data: profile, error: perr } = await supabase
      .from('profiles').select('role,is_blocked').eq('id', data.session.user.id).single();
    if (perr || !profile) return { status: 'signedOut' };
    return profile.role === 'admin' && !profile.is_blocked
      ? { status: 'admin', email: data.session.user.email ?? '' }
      : { status: 'forbidden' };
  } catch {
    return { status: 'signedOut' };
  }
}

export function useAdminSession(): AdminState {
  const [state, setState] = useState<AdminState>({ status: 'loading' });
  useEffect(() => {
    let alive = true;
    const refresh = () => { void resolveAdminState().then((s) => alive && setState(s)); };
    refresh();
    const { data } = supabase.auth.onAuthStateChange(() => refresh());
    return () => { alive = false; data.subscription.unsubscribe(); };
  }, []);
  return state;
}
