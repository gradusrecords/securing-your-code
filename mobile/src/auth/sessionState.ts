import { supabase } from '../lib/supabase';
import { getMyRole, type Role } from './authService';

export type SessionState =
  | { status: 'loading' }
  | { status: 'signedOut' }
  | { status: 'needsRole' }
  | { status: 'ready'; role: Role };

export function routeFor(state: SessionState): string {
  switch (state.status) {
    case 'loading': return '/splash';
    case 'signedOut': return '/(auth)/login';
    case 'needsRole': return '/(auth)/choose-role';
    case 'ready':
      if (state.role === 'model') return '/(model)/development';
      if (state.role === 'business') return '/(business)/orders';
      return '/(auth)/admin-note';
  }
}

export async function loadSessionState(): Promise<SessionState> {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session) return { status: 'signedOut' };
    const role = await getMyRole();
    return role ? { status: 'ready', role } : { status: 'needsRole' };
  } catch {
    return { status: 'signedOut' };
  }
}
