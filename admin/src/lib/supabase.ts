import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL ?? '';
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';

// Only the public anon key lives in the browser; admin rights come from the signed-in user's role.
export const supabase = createClient(url || 'http://localhost', anonKey || 'missing-anon-key');
