import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { loadSessionState, type SessionState } from './sessionState';

export { routeFor, type SessionState } from './sessionState';

export function useSession(): SessionState {
  const [state, setState] = useState<SessionState>({ status: 'loading' });

  useEffect(() => {
    let alive = true;
    const refresh = () => loadSessionState().then((s) => alive && setState(s));
    refresh();
    const { data } = supabase.auth.onAuthStateChange(() => { refresh(); });
    return () => { alive = false; data.subscription.unsubscribe(); };
  }, []);

  return state;
}
