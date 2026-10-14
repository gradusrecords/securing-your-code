// Pure helpers for the iOS installer (kept separate so they can be tested).

export function nodeVersionOk(version) {
  const major = Number(String(version).replace(/^v/, '').split('.')[0]);
  return Number.isFinite(major) && major >= 20;
}

export function normalizeSupabaseUrl(input) {
  const raw = String(input ?? '').trim().replace(/\/+$/, '');
  if (!raw) throw new Error('Введите Project URL проекта Supabase (URL не может быть пустым).');
  if (/supabase\.com\/dashboard/i.test(raw)) {
    throw new Error('Это адрес страницы панели. Нужен Project URL вида https://<проект>.supabase.co (Project Settings → API).');
  }
  let url;
  try { url = new URL(raw); } catch { throw new Error('URL должен начинаться с https://'); }
  if (url.protocol !== 'https:') throw new Error('URL должен начинаться с https://');
  return raw;
}

export function checkAnonKey(input) {
  const key = String(input ?? '').trim();
  const bad = () => new Error('Нужен публичный ключ anon (длинная строка из трёх частей через точку; Project Settings → API → anon public).');
  const parts = key.split('.');
  if (parts.length !== 3) throw bad();
  let payload;
  try { payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')); } catch { throw bad(); }
  if (!payload || typeof payload !== 'object') throw bad();
  if (payload.role === 'service_role') {
    throw new Error('Это секретный ключ service_role! Он даёт полный доступ к базе и НЕ должен попадать в приложение. Возьмите ключ anon public.');
  }
  if (payload.role !== 'anon') throw bad();
  return key;
}
