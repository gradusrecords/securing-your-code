// Supabase Edge Function (Deno). Schedule it every minute with pg_cron (see docs/zaya-setup.md).
// Uses the service-role key from the function environment; never exposed to clients.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { buildMessages, chunk, interpretTickets } from './logic.js';

type Row = { id: string; user_id: string; title: string; body: string; data: Record<string, unknown> | null };

const EXPO_URL = 'https://exp.host/--/api/v2/push/send';

Deno.serve(async (req: Request) => {
  const secret = Deno.env.get('SEND_PUSH_SECRET');
  if (secret && req.headers.get('authorization') !== `Bearer ${secret}`) {
    return new Response('forbidden', { status: 403 });
  }
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  const { data, error } = await db.from('notifications').select('id,user_id,title,body,data')
    .is('sent_at', null).is('error', null).order('created_at').limit(200);
  if (error) return new Response(error.message, { status: 500 });
  const rows = (data ?? []) as Row[];
  if (rows.length === 0) return Response.json({ sent: 0, failed: 0, skipped: 0 });

  const userIds = [...new Set(rows.map((r: Row) => r.user_id))];
  const { data: profiles } = await db.from('profiles').select('id,push_token').in('id', userIds);
  const tokens: Record<string, string> = {};
  ((profiles ?? []) as { id: string; push_token: string | null }[]).forEach((p) => { if (p.push_token) tokens[p.id] = p.push_token; });

  const { messages, skipped } = buildMessages(rows, tokens);
  const now = new Date().toISOString();
  let sentCount = 0;
  let failedCount = 0;

  // Notifications of users without a token are closed so that they are not retried forever.
  if (skipped.length > 0) await db.from('notifications').update({ error: 'no push token' }).in('id', skipped);

  for (const part of chunk(messages, 100)) {
    const ids = part.map((m) => String((m.data as Record<string, unknown>).notification_id));
    let tickets: unknown[] = [];
    try {
      const res = await fetch(EXPO_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json',
          ...(Deno.env.get('EXPO_ACCESS_TOKEN') ? { Authorization: `Bearer ${Deno.env.get('EXPO_ACCESS_TOKEN')}` } : {}) },
        body: JSON.stringify(part),
      });
      tickets = ((await res.json()) as { data?: unknown[] }).data ?? [];
    } catch (e) {
      // Network failure: leave the rows unsent so the next run retries them.
      console.error('expo push request failed', e);
      continue;
    }
    const r = interpretTickets(ids, tickets as never);
    if (r.sent.length > 0) await db.from('notifications').update({ sent_at: now }).in('id', r.sent);
    for (const f of r.failed) await db.from('notifications').update({ sent_at: now, error: f.error }).eq('id', f.id);
    if (r.invalidTokenIds.length > 0) {
      const bad = rows.filter((row: Row) => r.invalidTokenIds.includes(row.id)).map((row: Row) => row.user_id);
      await db.from('profiles').update({ push_token: null }).in('id', bad);
    }
    sentCount += r.sent.length;
    failedCount += r.failed.length;
  }
  return Response.json({ sent: sentCount, failed: failedCount, skipped: skipped.length });
});
