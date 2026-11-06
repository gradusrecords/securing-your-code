// Pure helpers for the send-push Edge Function (kept free of Deno APIs so they can be tested with node).

export function chunk(items, size = 100) {
  const out = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

// rows: notifications; tokens: { user_id: expoPushToken }
export function buildMessages(rows, tokens) {
  const messages = [];
  const skipped = [];
  for (const r of rows) {
    const to = tokens[r.user_id];
    if (!to) { skipped.push(r.id); continue; }
    messages.push({
      to, title: r.title, body: r.body, sound: 'default',
      data: { ...(r.data ?? {}), notification_id: r.id },
    });
  }
  return { messages, skipped };
}

// ids[i] is the notification behind tickets[i]; missing tickets count as failures so nothing is lost silently.
export function interpretTickets(ids, tickets) {
  const sent = [];
  const failed = [];
  const invalidTokenIds = [];
  ids.forEach((id, i) => {
    const t = tickets[i];
    if (t && t.status === 'ok') { sent.push(id); return; }
    const error = t ? (t.message || t.details?.error || 'unknown error') : 'no ticket returned';
    failed.push({ id, error });
    if (t?.details?.error === 'DeviceNotRegistered') invalidTokenIds.push(id);
  });
  return { sent, failed, invalidTokenIds };
}
