/* ZAYA — backend of the personal cabinet (Cloudflare Pages Functions + D1 + R2).
   Everything lives under /api/*. See cabinet/README.md for setup.
   Bindings:  DB (D1), BUCKET (R2, optional: without it photos are kept in D1)
   Secrets:   BOT_TOKEN, TG_SECRET, PEPPER
   Variables: BOT_USERNAME, MANAGER_PHONES (digits, comma separated), FORM_URL (optional Apps Script), TG_API (dev only)
   Secret:    SHEET_KEY (same value as the API_KEY script property in the Google Apps Script: lets the server read a sheet row by its application code) */

const enc = new TextEncoder();
const NOW = () => Math.floor(Date.now() / 1000);
const DEFAULT_FORM_URL = 'https://script.google.com/macros/s/AKfycby8ZKOH6brIK0ETc7cLBffeiNX0bWkStD18CPIh7RBBX3Kwq80ShNBwooOHV1dkJzwKzA/exec';

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY AUTOINCREMENT, phone TEXT UNIQUE NOT NULL, role TEXT NOT NULL DEFAULT 'user', name TEXT, tg_id TEXT, tg_chat TEXT, profile TEXT NOT NULL DEFAULT '{}', created_at INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS sessions(hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL, expires INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS otps(phone TEXT PRIMARY KEY, hash TEXT NOT NULL, expires INTEGER NOT NULL, attempts INTEGER NOT NULL DEFAULT 0)`,
  `CREATE TABLE IF NOT EXISTS links(token TEXT PRIMARY KEY, phone TEXT NOT NULL, chat TEXT, expires INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS apps(id INTEGER PRIMARY KEY AUTOINCREMENT, phone TEXT NOT NULL, kind TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'new', name TEXT, lang TEXT, payload TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS apps_phone ON apps(phone)`,
  `CREATE TABLE IF NOT EXISTS messages(id INTEGER PRIMARY KEY AUTOINCREMENT, thread INTEGER NOT NULL, from_role TEXT NOT NULL, from_id INTEGER, body TEXT NOT NULL, created_at INTEGER NOT NULL, seen INTEGER NOT NULL DEFAULT 0)`,
  `CREATE INDEX IF NOT EXISTS msg_thread ON messages(thread, id)`,
  `CREATE TABLE IF NOT EXISTS photos(id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, key TEXT NOT NULL, mime TEXT NOT NULL, size INTEGER NOT NULL, created_at INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS hits(k TEXT PRIMARY KEY, n INTEGER NOT NULL, reset_at INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS photo_data(photo_id INTEGER PRIMARY KEY, b64 TEXT NOT NULL)`,
];
let schemaReady = false;
async function ensureSchema(env) {
  if (schemaReady) return;
  await env.DB.batch(SCHEMA.map(s => env.DB.prepare(s)));
  for (const col of ['code TEXT', 'synced_at INTEGER']) {       // columns added later: ignore "duplicate column"
    try { await env.DB.prepare(`ALTER TABLE apps ADD COLUMN ${col}`).run(); } catch (e) { /* already there */ }
  }
  await env.DB.prepare('CREATE UNIQUE INDEX IF NOT EXISTS apps_code ON apps(code) WHERE code IS NOT NULL').run();
  schemaReady = true;
}

/* ---------- small helpers ---------- */
const json = (o, status = 200, headers = {}) =>
  new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers } });
const fail = (status, error) => json({ ok: false, error }, status);
const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
const sha = async s => hex(await crypto.subtle.digest('SHA-256', enc.encode(s)));
const rnd = (n = 32) => hex(crypto.getRandomValues(new Uint8Array(n)));
const code6 = () => String(crypto.getRandomValues(new Uint32Array(1))[0] % 1000000).padStart(6, '0');
const same = (a, b) => { if (a.length !== b.length) return false; let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i); return r === 0; };
const normPhone = p => {
  let d = String(p || '').replace(/\D/g, '');
  if (d.length === 9) d = '998' + d;
  return /^998\d{9}$/.test(d) ? d : null;
};
const clip = (v, n) => String(v == null ? '' : v).trim().slice(0, n);
const ip = req => req.headers.get('CF-Connecting-IP') || 'local';
const lang3 = l => (['ru', 'uz', 'en'].includes(l) ? l : 'ru');

async function hit(env, key, limit, windowSec) {
  const now = NOW();
  if (Math.random() < 0.02) await env.DB.prepare('DELETE FROM hits WHERE reset_at<?').bind(now).run();
  const r = await env.DB.prepare('SELECT n, reset_at FROM hits WHERE k=?').bind(key).first();
  if (!r || r.reset_at <= now) {
    await env.DB.prepare('INSERT OR REPLACE INTO hits(k,n,reset_at) VALUES(?,?,?)').bind(key, 1, now + windowSec).run();
    return true;
  }
  if (r.n >= limit) return false;
  await env.DB.prepare('UPDATE hits SET n=n+1 WHERE k=?').bind(key).run();
  return true;
}

async function body(req, max = 40000) {
  const t = await req.text();
  if (t.length > max) throw new Error('too large');
  try { return JSON.parse(t || '{}'); } catch { throw new Error('bad json'); }
}

/* ---------- Telegram ---------- */
async function tg(env, method, payload) {
  if (!env.BOT_TOKEN) return { ok: false };
  const base = env.TG_API || 'https://api.telegram.org';
  try {
    const r = await fetch(`${base}/bot${env.BOT_TOKEN}/${method}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
    return await r.json();
  } catch { return { ok: false }; }
}
const say = (env, chat, text, extra = {}) => tg(env, 'sendMessage', { chat_id: chat, text, ...extra });

/* ---------- sessions ---------- */
const isManagerPhone = (env, phone) => String(env.MANAGER_PHONES || '').split(/[,\s]+/).map(normPhone).filter(Boolean).includes(phone);
function cookie(req, name) {
  const m = (req.headers.get('cookie') || '').match(new RegExp('(?:^|; )' + name + '=([^;]+)'));
  return m ? m[1] : null;
}
async function me(req, env) {
  const t = cookie(req, 'zs');
  if (!t || !/^[a-f0-9]{64}$/.test(t)) return null;
  const h = await sha(t);
  return await env.DB.prepare('SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.hash=? AND s.expires>?').bind(h, NOW()).first();
}
async function startSession(req, env, userId) {
  const t = rnd(32), exp = NOW() + 30 * 86400;
  await env.DB.prepare('INSERT INTO sessions(hash,user_id,expires) VALUES(?,?,?)').bind(await sha(t), userId, exp).run();
  await env.DB.prepare('DELETE FROM sessions WHERE expires<?').bind(NOW()).run();
  const secure = new URL(req.url).protocol === 'https:' ? '; Secure' : '';
  return `zs=${t}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${30 * 86400}${secure}`;
}

/* ---------- statuses ---------- */
const STATUS = {
  apply: ['new', 'review', 'casting', 'contract', 'portfolio', 'reserve', 'declined'],
  brief: ['new', 'review', 'work', 'done', 'declined'],
};
const STATUS_TEXT = {
  new: ['Заявка получена', 'Ariza qabul qilindi', 'Application received'],
  review: ['На рассмотрении', 'Ko‘rib chiqilmoqda', 'Under review'],
  casting: ['Приглашение на кастинг', 'Kastingga taklif', 'Invited to casting'],
  contract: ['Договор', 'Shartnoma', 'Contract'],
  portfolio: ['Портфолио', 'Portfolio', 'Portfolio'],
  reserve: ['В резерве', 'Zaxirada', 'In reserve'],
  work: ['Проект в работе', 'Loyiha ishda', 'Project in progress'],
  done: ['Проект завершён', 'Loyiha yakunlandi', 'Project completed'],
  declined: ['Отклонена', 'Rad etildi', 'Declined'],
};
const L = l => ({ ru: 0, uz: 1, en: 2 })[l] ?? 0;

/* sanitize a form payload: flat object of short strings */
function cleanPayload(d) {
  const out = {};
  for (const [k, v] of Object.entries(d)) {
    if (!/^[a-zA-Z0-9_]{1,40}$/.test(k) || ['website', 'consent', 'type', 'lang'].includes(k)) continue;
    if (Array.isArray(v)) out[k] = v.slice(0, 20).map(x => clip(x, 200));
    else if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') out[k] = clip(v, 2000);
  }
  return out;
}

/* ---------- routes ---------- */
export async function onRequest(ctx) {
  const { request: req, env } = ctx;
  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/api\/?/, '').replace(/\/+$/, '');
  const method = req.method;
  try {
    if (!env.DB) return fail(503, 'database is not configured');
    await ensureSchema(env);

    /* Telegram webhook: authenticated by the secret token header, not by cookies */
    if (path === 'tg/webhook' && method === 'POST') return tgWebhook(req, env);
    if (path === 'tg/setup' && method === 'GET') return tgSetup(req, env, url);

    if (method !== 'GET' && method !== 'HEAD') {
      if (req.headers.get('x-zaya') !== '1') return fail(403, 'forbidden');
      const o = req.headers.get('origin');
      if (o && new URL(o).host !== url.host) return fail(403, 'forbidden');
    }

    if (path === 'submit' && method === 'POST') return submit(req, env, ctx);
    if (path === 'auth/start' && method === 'POST') return authStart(req, env);
    if (path === 'auth/verify' && method === 'POST') return authVerify(req, env);
    if (path === 'auth/logout' && method === 'POST') {
      const t = cookie(req, 'zs');
      if (t && /^[a-f0-9]{64}$/.test(t)) await env.DB.prepare('DELETE FROM sessions WHERE hash=?').bind(await sha(t)).run();
      return json({ ok: true }, 200, { 'set-cookie': 'zs=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0' });
    }

    const user = await me(req, env);
    if (path === 'me' && method === 'GET') return json(user ? { ok: true, user: pubUser(user) } : { ok: false });   // 200 either way: no console noise for visitors
    if (!user) return fail(401, 'auth');

    if (path === 'my' && method === 'GET') return myData(env, user);
    if (path === 'profile' && method === 'POST') return saveProfile(req, env, user);
    if (path === 'link' && method === 'POST') return linkCode(req, env, user);
    if (path === 'sync' && method === 'POST') return syncMine(env, user);
    if (path === 'photos' && method === 'POST') return uploadPhoto(req, env, user);
    let m;
    if ((m = path.match(/^photos\/(\d+)$/))) {
      if (method === 'GET') return getPhoto(env, user, +m[1]);
      if (method === 'DELETE') return delPhoto(env, user, +m[1]);
    }
    if (path === 'messages' && method === 'GET') return listMessages(env, user.id, 'user');
    if (path === 'messages' && method === 'POST') return sendUserMessage(req, env, user, ctx);

    if (path.startsWith('admin/')) {
      if (user.role !== 'manager') return fail(403, 'forbidden');
      if (path === 'admin/apps' && method === 'GET') return adminApps(env, url);
      if ((m = path.match(/^admin\/apps\/(\d+)$/)) && method === 'GET') return adminApp(env, +m[1]);
      if ((m = path.match(/^admin\/apps\/(\d+)\/status$/)) && method === 'POST') return adminStatus(req, env, +m[1], ctx);
      if (path === 'admin/threads' && method === 'GET') return adminThreads(env);
      if (path === 'admin/link' && method === 'POST') return adminLink(req, env);
      if (path === 'admin/messages' && method === 'GET') return listMessages(env, +url.searchParams.get('user') || 0, 'manager');
      if (path === 'admin/messages' && method === 'POST') return sendManagerMessage(req, env, user, ctx);
    }
    return fail(404, 'not found');
  } catch (e) {
    const msg = String(e && e.message || e);
    if (msg === 'too large') return fail(413, msg);
    if (msg === 'bad json') return fail(400, msg);
    return fail(500, 'server error');
  }
}

const pubUser = u => ({ id: u.id, phone: u.phone, name: u.name || '', role: u.role, profile: safeJson(u.profile) });
const safeJson = s => { try { return JSON.parse(s || '{}'); } catch { return {}; } };

/* ---------- public form submit (stores in D1 and forwards to Google Sheets) ---------- */
async function submit(req, env, ctx) {
  const d = await body(req);
  if (d.website) return json({ ok: true });
  const type = d.type;
  if (type !== 'apply' && type !== 'brief') return fail(400, 'bad type');
  if (!d.consent) return fail(400, 'consent required');
  const phone = normPhone(d.phone);
  const name = clip(d.name, 120);
  if (name.length < 2 || !phone) return fail(400, 'name and phone required');
  if (!(await hit(env, 'sub:' + ip(req), 12, 3600))) return fail(429, 'too many requests');
  const dup = await env.DB.prepare('SELECT id FROM apps WHERE phone=? AND kind=? AND created_at>?').bind(phone, type, NOW() - 120).first();
  if (dup) return json({ ok: true, duplicate: true, id: dup.id });
  const lang = lang3(d.lang);
  const r = await env.DB.prepare('INSERT INTO apps(phone,kind,status,name,lang,payload,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)')
    .bind(phone, type, 'new', name, lang, JSON.stringify(cleanPayload(d)), NOW(), NOW()).run();
  // forward the original payload to the Google Sheet (server to server, best effort)
  const target = env.FORM_URL || DEFAULT_FORM_URL;
  if (target) ctx.waitUntil(fetch(target, { method: 'POST', headers: { 'content-type': 'text/plain;charset=utf-8' }, body: JSON.stringify(d), redirect: 'follow' }).catch(() => {}));
  // tell managers
  ctx.waitUntil(notifyManagers(env, `🆕 ${type === 'apply' ? 'Анкета модели' : 'Бриф бизнеса'}: ${name}, +${phone}`));
  return json({ ok: true, id: r.meta.last_row_id });
}

async function notifyManagers(env, text) {
  const rows = await env.DB.prepare("SELECT tg_chat FROM users WHERE role='manager' AND tg_chat IS NOT NULL").all();
  await Promise.all((rows.results || []).map(r => say(env, r.tg_chat, text)));
}

/* ---------- login: phone + code delivered by the Telegram bot ---------- */
async function authStart(req, env) {
  const d = await body(req, 2000);
  const phone = normPhone(d.phone);
  if (!phone) return fail(400, 'bad phone');
  if (!(await hit(env, 'as:ip:' + ip(req), 30, 3600)) || !(await hit(env, 'as:' + phone, 6, 3600))) return fail(429, 'too many requests');
  const user = await env.DB.prepare('SELECT * FROM users WHERE phone=?').bind(phone).first();
  if (user && user.tg_chat) {
    const sent = await sendCode(env, phone, user.tg_chat);
    if (sent) return json({ ok: true, mode: 'telegram' });
  }
  const bot = String(env.BOT_USERNAME || '').trim().replace(/^@/, '');
  if (!bot) return fail(503, 'bot is not configured');
  const token = rnd(12);
  await env.DB.prepare('INSERT INTO links(token,phone,expires) VALUES(?,?,?)').bind(token, phone, NOW() + 900).run();
  return json({ ok: true, mode: 'link', url: `https://t.me/${bot}?start=${token}` });
}

async function sendCode(env, phone, chat) {
  const code = code6();
  await env.DB.prepare('INSERT OR REPLACE INTO otps(phone,hash,expires,attempts) VALUES(?,?,?,0)').bind(phone, await sha(code + (env.PEPPER || '') + phone), NOW() + 300).run();
  const r = await say(env, chat, `ZAYA — код входа: ${code}\nДействует 5 минут. Никому его не сообщайте.`, { reply_markup: { remove_keyboard: true } });
  return !!(r && r.ok);
}

async function authVerify(req, env) {
  const d = await body(req, 2000);
  const phone = normPhone(d.phone), code = String(d.code || '').replace(/\D/g, '');
  if (!phone || code.length !== 6) return fail(400, 'bad request');
  if (!(await hit(env, 'av:' + phone, 12, 3600)) || !(await hit(env, 'av:ip:' + ip(req), 60, 3600))) return fail(429, 'too many requests');
  const o = await env.DB.prepare('SELECT * FROM otps WHERE phone=?').bind(phone).first();
  if (!o || o.expires < NOW() || o.attempts >= 5) return fail(400, 'code expired');
  await env.DB.prepare('UPDATE otps SET attempts=attempts+1 WHERE phone=?').bind(phone).run();
  if (!same(o.hash, await sha(code + (env.PEPPER || '') + phone))) return fail(400, 'wrong code');
  await env.DB.prepare('DELETE FROM otps WHERE phone=?').bind(phone).run();
  let user = await env.DB.prepare('SELECT * FROM users WHERE phone=?').bind(phone).first();
  if (!user) return fail(400, 'no account');
  const role = isManagerPhone(env, phone) ? 'manager' : 'user';
  if (role !== user.role) await env.DB.prepare('UPDATE users SET role=? WHERE id=?').bind(role, user.id).run();
  user = { ...user, role };
  try { await autoLink(env, user); } catch {}   // everything written with this number is ready right after login
  const c = await startSession(req, env, user.id);
  return json({ ok: true, user: pubUser(user) }, 200, { 'set-cookie': c });
}

async function tgSetup(req, env, url) {
  if (!env.TG_SECRET || !same(url.searchParams.get('key') || '', env.TG_SECRET)) return fail(403, 'forbidden');
  const r = await tg(env, 'setWebhook', { url: `${url.origin}/api/tg/webhook`, secret_token: env.TG_SECRET, allowed_updates: ['message'], drop_pending_updates: true });
  return json({ ok: true, telegram: r });
}

async function tgWebhook(req, env) {
  if (!env.TG_SECRET || !same(req.headers.get('x-telegram-bot-api-secret-token') || '', env.TG_SECRET)) return fail(403, 'forbidden');
  const u = await body(req, 20000);
  const m = u.message;
  if (!m || !m.chat || m.chat.type !== 'private') return json({ ok: true });
  const chat = String(m.chat.id);
  if (m.contact) {
    if (!m.from || m.contact.user_id !== m.from.id) { await say(env, chat, 'Отправьте свой номер кнопкой «Поделиться номером».'); return json({ ok: true }); }
    const phone = normPhone(m.contact.phone_number);
    const link = phone && await env.DB.prepare('SELECT * FROM links WHERE chat=? AND expires>? ORDER BY expires DESC').bind(chat, NOW()).first();
    if (!link) { await say(env, chat, 'Ссылка устарела. Вернитесь на zaya.uz и нажмите «Войти» ещё раз.', { reply_markup: { remove_keyboard: true } }); return json({ ok: true }); }
    if (link.phone !== phone) { await say(env, chat, 'Этот номер не совпадает с введённым на сайте. Вернитесь на zaya.uz и введите свой номер.', { reply_markup: { remove_keyboard: true } }); return json({ ok: true }); }
    const role = isManagerPhone(env, phone) ? 'manager' : 'user';
    const ex = await env.DB.prepare('SELECT id FROM users WHERE phone=?').bind(phone).first();
    if (ex) await env.DB.prepare('UPDATE users SET tg_id=?, tg_chat=?, role=? WHERE id=?').bind(String(m.from.id), chat, role, ex.id).run();
    else {
      const first = clip((m.from.first_name || '') + ' ' + (m.from.last_name || ''), 120);
      const apps = await env.DB.prepare('SELECT name FROM apps WHERE phone=? ORDER BY id DESC LIMIT 1').bind(phone).first();
      await env.DB.prepare('INSERT INTO users(phone,role,name,tg_id,tg_chat,created_at) VALUES(?,?,?,?,?,?)').bind(phone, role, (apps && apps.name) || first, String(m.from.id), chat, NOW()).run();
    }
    await env.DB.prepare('DELETE FROM links WHERE token=?').bind(link.token).run();
    await sendCode(env, phone, chat);
    return json({ ok: true });
  }
  const text = String(m.text || '');
  const start = text.match(/^\/start(?:\s+([a-f0-9]{24}))?/);
  if (start) {
    const token = start[1];
    const link = token && await env.DB.prepare('SELECT * FROM links WHERE token=? AND expires>?').bind(token, NOW()).first();
    if (link) {
      await env.DB.prepare('UPDATE links SET chat=? WHERE token=?').bind(chat, token).run();
      await say(env, chat, 'Чтобы войти в кабинет ZAYA, подтвердите номер телефона кнопкой ниже. Мы пришлём код сюда.', {
        reply_markup: { keyboard: [[{ text: '📱 Поделиться номером', request_contact: true }]], resize_keyboard: true, one_time_keyboard: true },
      });
    } else {
      await say(env, chat, 'ZAYA. Личный кабинет открывается на zaya.uz — нажмите «Войти» и введите свой номер телефона.');
    }
    return json({ ok: true });
  }
  await say(env, chat, 'Это служебный бот ZAYA. Пишите менеджеру прямо в кабинете на zaya.uz.');
  return json({ ok: true });
}

/* ---------- application code: pull the person's record from the Google Sheet ---------- */
const SHEET_MAP = {
  apply: { 'Имя и фамилия': 'name', 'Дата рождения': 'birth', 'Возраст': 'age', 'Пол': 'gender', 'Телефон': 'phone', 'Instagram': 'instagram', 'Telegram': 'telegram', 'Город': 'city', 'Родитель': 'parent', 'Рост': 'height', 'Вес': 'weight', 'Параметры (Г-Т-Б)': 'params', 'Обувь': 'shoe', 'Волосы': 'hair', 'Глаза': 'eyes', 'Опыт': 'exp', 'Направления': 'dirs', 'Контракт с агентством': 'contract', 'Портфолио': 'portfolio', 'О себе': 'about' },
  brief: { 'Имя': 'name', 'Компания': 'company', 'Должность': 'position', 'Телефон': 'phone', 'Telegram': 'telegram', 'E-mail': 'email', 'Город': 'city', 'Сфера бизнеса': 'industry', 'Команда': 'team', 'Что нужно': 'dirs', 'Задача': 'task', 'Бюджет': 'budget', 'Сроки': 'timing', 'Как связаться': 'contact' },
};
function sheetStatus(kind, raw) {
  const s = String(raw || '').toLowerCase();
  if (kind === 'apply') {
    if (!s) return 'new';
    if (/нет/.test(s)) return 'declined';
    if (/контракт/.test(s)) return 'contract';
    if (/запас|резерв/.test(s)) return 'reserve';
    if (/вопрос|детск/.test(s)) return 'review';
    return 'new';
  }
  if (!s || /нов/.test(s)) return 'new';
  if (/готов|заверш|закрыт|выполн/.test(s)) return 'done';
  if (/работ/.test(s)) return 'work';
  if (/отказ|нет/.test(s)) return 'declined';
  return 'review';
}
const last9 = v => String(v || '').replace(/\D/g, '').slice(-9);
/* every phone number written in a text (several numbers may be separated by / , ; spaces) */
function numbersIn(text) {
  const out = new Set();
  for (const part of String(text || '').split(/[\/,;]|\sи\s|\s{2,}/)) { const d = part.replace(/\D/g, ''); if (d.length >= 9) out.add(d.slice(-9)); }
  const all = String(text || '').replace(/[^\d]/g, ' ').match(/\d{9,12}/g) || [];
  all.forEach(d => out.add(d.slice(-9)));
  return out;
}
async function fetchSheet(env, code) {
  if (!env.SHEET_KEY) return { ok: false, error: 'sheet is not configured' };
  const u = new URL(env.FORM_URL || DEFAULT_FORM_URL);
  u.searchParams.set('action', 'lookup'); u.searchParams.set('code', code); u.searchParams.set('key', env.SHEET_KEY);
  try {
    const r = await fetch(u.toString(), { redirect: 'follow', signal: AbortSignal.timeout(9000) });
    return await r.json();
  } catch { return { ok: false, error: 'sheet unavailable' }; }
}
/* every sheet row (models and business) where this phone is the applicant's or the parent's number */
async function fetchSheetByPhone(env, phone) {
  if (!env.SHEET_KEY) return [];
  const u = new URL(env.FORM_URL || DEFAULT_FORM_URL);
  u.searchParams.set('action', 'byphone'); u.searchParams.set('phone', last9(phone)); u.searchParams.set('key', env.SHEET_KEY);
  try {
    const r = await fetch(u.toString(), { redirect: 'follow', signal: AbortSignal.timeout(8000) });
    const j = await r.json();
    return j && j.ok && Array.isArray(j.items) ? j.items.slice(0, 20) : [];
  } catch { return []; }
}
/* the person logged in with a Telegram-verified number: attach all the sheet applications written with that number */
async function autoLink(env, user) {
  let n = 0;
  for (const it of await fetchSheetByPhone(env, user.phone)) {
    const row = it && it.row || {}, code = String(row['Заявка №'] || '').trim().toUpperCase();
    if (!CODE_RE.test(code)) continue;
    const allowed = new Set([...numbersIn(row['Телефон']), ...numbersIn(row['Родитель'])]);
    if (!allowed.has(last9(user.phone))) continue;
    const taken = await env.DB.prepare('SELECT phone FROM apps WHERE code=?').bind(code).first();
    if (taken && taken.phone !== user.phone) continue;
    await saveLinked(env, user.phone, code, code.charAt(0) === 'B' ? 'brief' : 'apply', row);
    n++;
  }
  return n;
}
function rowToApp(kind, row) {
  const payload = {};
  for (const [h, k] of Object.entries(SHEET_MAP[kind])) { const v = clip(row[h], 2000); if (v) payload[k] = v; }
  const raw = clip(kind === 'apply' ? row['Отбор'] : row['Статус'], 100);
  if (raw) payload.sheet_status = raw;
  return { payload, raw, status: sheetStatus(kind, raw), name: clip(payload.name, 120), lang: lang3(String(row['Язык'] || '').trim().toLowerCase()) };
}
/* create or refresh the cabinet record of a sheet row; the sheet is the source of truth for linked applications */
async function saveLinked(env, phone, code, kind, row) {
  const m = rowToApp(kind, row);
  const ex = await env.DB.prepare('SELECT id,status,payload FROM apps WHERE code=?').bind(code).first();
  if (ex) {
    const before = safeJson(ex.payload).sheet_status || '';
    // keep a status set in the cabinet unless the sheet's own status changed since the last sync
    const status = (m.raw || '') !== before ? m.status : ex.status;
    await env.DB.prepare('UPDATE apps SET status=?, name=?, payload=?, updated_at=?, synced_at=? WHERE id=?').bind(status, m.name, JSON.stringify(m.payload), NOW(), NOW(), ex.id).run();
  } else {
    // the same application was already saved from the site form (no code yet): give it the code instead of making a duplicate
    const own = await env.DB.prepare('SELECT id FROM apps WHERE phone=? AND kind=? AND code IS NULL ORDER BY id DESC LIMIT 1').bind(phone, kind).first();
    if (own) {
      await env.DB.prepare('UPDATE apps SET code=?, status=?, name=?, lang=?, payload=?, updated_at=?, synced_at=? WHERE id=?').bind(code, m.status, m.name, m.lang, JSON.stringify(m.payload), NOW(), NOW(), own.id).run();
    } else
    await env.DB.prepare('INSERT INTO apps(phone,kind,status,name,lang,payload,created_at,updated_at,code,synced_at) VALUES(?,?,?,?,?,?,?,?,?,?)')
      .bind(phone, kind, m.status, m.name, m.lang, JSON.stringify(m.payload), NOW(), NOW(), code, NOW()).run();
  }
  // fill the (still empty) profile fields from the sheet
  const u = await env.DB.prepare('SELECT id,name,profile FROM users WHERE phone=?').bind(phone).first();
  if (u) {
    const prof = safeJson(u.profile), p = m.payload, put = (k, v) => { if (v && !prof[k]) prof[k] = clip(v, k === 'about' ? 1500 : 200); };
    put('city', p.city); put('instagram', p.instagram); put('telegram', p.telegram); put('height', p.height); put('weight', p.weight);
    put('shoes', p.shoe); put('hair', p.hair); put('eyes', p.eyes); put('company', p.company); put('position', p.position); put('email', p.email); put('about', p.about);
    if (p.params) { const g = String(p.params).split(/[-–\/ ]+/).filter(Boolean); put('bust', g[0]); put('waist', g[1]); put('hips', g[2]); }
    // the real name from the application wins over the Telegram name, unless the person has typed their own name in the profile
    let name = u.name;
    if (!prof.name_set && !prof.name_app && m.name) { name = m.name; prof.name_app = '1'; }   // only the first linked application names the person
    await env.DB.prepare('UPDATE users SET name=?, profile=? WHERE id=?').bind(name || m.name, JSON.stringify(prof), u.id).run();
  }
}
const CODE_RE = /^[ZB]-[A-Z0-9]{4,8}$/;
async function linkCode(req, env, user) {
  const d = await body(req, 1000);
  const code = String(d.code || '').trim().toUpperCase().replace(/[\u2010-\u2015\u2212\s]+/g, '-');
  if (!CODE_RE.test(code)) return fail(400, 'bad code');
  if (!(await hit(env, 'lk:' + user.id, 10, 3600)) || !(await hit(env, 'lk:ip:' + ip(req), 40, 3600))) return fail(429, 'too many requests');
  const taken = await env.DB.prepare('SELECT phone FROM apps WHERE code=?').bind(code).first();
  if (taken && taken.phone !== user.phone) return fail(409, 'already linked');
  const r = await fetchSheet(env, code);
  if (!r || !r.ok) return fail(r && r.error === 'not found' ? 404 : r && r.error === 'sheet is not configured' ? 503 : r && r.error === 'sheet unavailable' ? 502 : 404, (r && r.error) || 'not found');
  const kind = r.kind === 'brief' ? 'brief' : 'apply';
  // the number from the application must be the number that logged in (or the parent's number written in the application)
  const row = r.row || {};
  const mine = last9(user.phone);
  const allowed = new Set([...numbersIn(row['Телефон']), ...numbersIn(row['Родитель'])]);
  if (!allowed.has(mine)) return fail(403, 'phone mismatch');
  await saveLinked(env, user.phone, code, kind, row);
  return json({ ok: true });
}
async function syncMine(env, user) {
  if (!(await hit(env, 'sy:' + user.id, 30, 3600))) return fail(429, 'too many requests');
  // pick up applications that appeared in the sheet after login (at most once in 10 minutes)
  if (await hit(env, 'ph:' + user.id, 1, 600)) { try { await autoLink(env, user); } catch {} }
  // remove a leftover duplicate: the same application saved from the form (no code) next to its linked copy
  await env.DB.prepare('DELETE FROM apps WHERE phone=? AND code IS NULL AND EXISTS (SELECT 1 FROM apps b WHERE b.phone=apps.phone AND b.kind=apps.kind AND b.code IS NOT NULL AND b.name=apps.name)').bind(user.phone).run();
  const rows = await env.DB.prepare('SELECT code,kind FROM apps WHERE phone=? AND code IS NOT NULL AND (synced_at IS NULL OR synced_at<?) LIMIT 5').bind(user.phone, NOW() - 120).all();
  let n = 0;
  for (const a of rows.results || []) {
    const r = await fetchSheet(env, a.code);
    if (r && r.ok) { await saveLinked(env, user.phone, a.code, r.kind === 'brief' ? 'brief' : 'apply', r.row || {}); n++; }
  }
  return json({ ok: true, synced: n });
}
/* manager links a code to a person by hand (phone may differ) */
async function adminLink(req, env) {
  const d = await body(req, 1000);
  const code = String(d.code || '').trim().toUpperCase().replace(/[\u2010-\u2015\u2212\s]+/g, '-');
  if (!CODE_RE.test(code) || !+d.user) return fail(400, 'bad request');
  const target = await env.DB.prepare('SELECT * FROM users WHERE id=?').bind(+d.user).first();
  if (!target) return fail(404, 'not found');
  const r = await fetchSheet(env, code);
  if (!r || !r.ok) return fail(r && r.error === 'sheet is not configured' ? 503 : 404, (r && r.error) || 'not found');
  const taken = await env.DB.prepare('SELECT id FROM apps WHERE code=?').bind(code).first();
  if (taken) await env.DB.prepare('UPDATE apps SET phone=? WHERE id=?').bind(target.phone, taken.id).run();
  await saveLinked(env, target.phone, code, r.kind === 'brief' ? 'brief' : 'apply', r.row || {});
  return json({ ok: true });
}

/* ---------- user data ---------- */
async function myData(env, user) {
  const apps = await env.DB.prepare('SELECT id,kind,status,name,lang,payload,created_at,updated_at,code FROM apps WHERE phone=? ORDER BY id DESC').bind(user.phone).all();
  const photos = await env.DB.prepare('SELECT id,created_at FROM photos WHERE user_id=? ORDER BY id').bind(user.id).all();
  const unread = await env.DB.prepare("SELECT COUNT(*) c FROM messages WHERE thread=? AND from_role='manager' AND seen=0").bind(user.id).first();
  return json({
    ok: true, user: pubUser(user),
    apps: (apps.results || []).map(a => ({ ...a, payload: safeJson(a.payload), statuses: STATUS[a.kind === 'apply' ? 'apply' : 'brief'] })),
    photos: photos.results || [], unread: unread ? unread.c : 0,
  });
}

const PROFILE_KEYS = ['city', 'instagram', 'telegram', 'height', 'weight', 'bust', 'waist', 'hips', 'shoes', 'hair', 'eyes', 'company', 'position', 'email', 'about'];
async function saveProfile(req, env, user) {
  const d = await body(req, 8000);
  const prof = safeJson(user.profile);
  for (const k of PROFILE_KEYS) if (k in d) prof[k] = clip(d[k], k === 'about' ? 1500 : 200);
  const name = d.name != null ? clip(d.name, 120) : user.name;
  if (d.name != null && name && name !== user.name) prof.name_set = '1';
  await env.DB.prepare('UPDATE users SET name=?, profile=? WHERE id=?').bind(name, JSON.stringify(prof), user.id).run();
  return json({ ok: true, user: pubUser({ ...user, name, profile: JSON.stringify(prof) }) });
}

/* ---------- photos (private, in R2) ---------- */
function sniff(b) {
  if (b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF) return ['image/jpeg', 'jpg'];
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47) return ['image/png', 'png'];
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return ['image/webp', 'webp'];
  return null;
}
const D1_PHOTO_MAX = 1.4 * 1024 * 1024;   // without R2 the photo is stored in D1 (the browser shrinks photos to ~0.5 MB first)
const toB64 = u8 => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };
const fromB64 = b => Uint8Array.from(atob(b), c => c.charCodeAt(0));
async function uploadPhoto(req, env, user) {
  if (!(await hit(env, 'ph:' + user.id, 30, 3600))) return fail(429, 'too many requests');
  const cnt = await env.DB.prepare('SELECT COUNT(*) c FROM photos WHERE user_id=?').bind(user.id).first();
  if (cnt.c >= 10) return fail(400, 'photo limit');
  const fd = await req.formData();
  const f = fd.get('photo');
  if (!f || typeof f === 'string') return fail(400, 'no file');
  if (f.size > 6 * 1024 * 1024 || (!env.BUCKET && f.size > D1_PHOTO_MAX)) return fail(413, 'file too large');
  const buf = new Uint8Array(await f.arrayBuffer());
  const t = sniff(buf);
  if (!t) return fail(400, 'unsupported file');
  if (env.BUCKET) {
    const key = `u${user.id}/${rnd(12)}.${t[1]}`;
    await env.BUCKET.put(key, buf, { httpMetadata: { contentType: t[0] } });
    const r = await env.DB.prepare('INSERT INTO photos(user_id,key,mime,size,created_at) VALUES(?,?,?,?,?)').bind(user.id, key, t[0], buf.length, NOW()).run();
    return json({ ok: true, id: r.meta.last_row_id });
  }
  const r = await env.DB.prepare('INSERT INTO photos(user_id,key,mime,size,created_at) VALUES(?,?,?,?,?)').bind(user.id, 'd1', t[0], buf.length, NOW()).run();
  await env.DB.prepare('INSERT INTO photo_data(photo_id,b64) VALUES(?,?)').bind(r.meta.last_row_id, toB64(buf)).run();
  return json({ ok: true, id: r.meta.last_row_id });
}
async function getPhoto(env, user, id) {
  const p = await env.DB.prepare('SELECT * FROM photos WHERE id=?').bind(id).first();
  if (!p || (p.user_id !== user.id && user.role !== 'manager')) return fail(404, 'not found');
  const hd = { 'content-type': p.mime, 'cache-control': 'private, max-age=3600', 'x-content-type-options': 'nosniff', 'content-disposition': 'inline' };
  if (p.key === 'd1') {
    const d = await env.DB.prepare('SELECT b64 FROM photo_data WHERE photo_id=?').bind(id).first();
    return d ? new Response(fromB64(d.b64), { headers: hd }) : fail(404, 'not found');
  }
  const o = env.BUCKET && await env.BUCKET.get(p.key);
  return o ? new Response(o.body, { headers: hd }) : fail(404, 'not found');
}
async function delPhoto(env, user, id) {
  const p = await env.DB.prepare('SELECT * FROM photos WHERE id=? AND user_id=?').bind(id, user.id).first();
  if (!p) return fail(404, 'not found');
  if (p.key === 'd1') await env.DB.prepare('DELETE FROM photo_data WHERE photo_id=?').bind(id).run();
  else if (env.BUCKET) await env.BUCKET.delete(p.key);
  await env.DB.prepare('DELETE FROM photos WHERE id=?').bind(id).run();
  return json({ ok: true });
}

/* ---------- chat ---------- */
async function listMessages(env, thread, as) {
  if (!thread) return fail(400, 'bad thread');
  const rows = await env.DB.prepare('SELECT id,from_role,body,created_at FROM messages WHERE thread=? ORDER BY id DESC LIMIT 200').bind(thread).all();
  // opening the chat marks the other side's messages as seen
  await env.DB.prepare('UPDATE messages SET seen=1 WHERE thread=? AND from_role=? AND seen=0').bind(thread, as === 'user' ? 'manager' : 'user').run();
  return json({ ok: true, messages: (rows.results || []).reverse() });
}
async function sendUserMessage(req, env, user, ctx) {
  const d = await body(req, 5000);
  const text = clip(d.body, 2000);
  if (!text) return fail(400, 'empty');
  if (!(await hit(env, 'msg:' + user.id, 40, 3600))) return fail(429, 'too many requests');
  const r = await env.DB.prepare("INSERT INTO messages(thread,from_role,from_id,body,created_at) VALUES(?,?,?,?,?)").bind(user.id, 'user', user.id, text, NOW()).run();
  ctx.waitUntil(notifyManagers(env, `💬 ${user.name || '+' + user.phone}: ${text.slice(0, 300)}`));
  return json({ ok: true, id: r.meta.last_row_id });
}
async function sendManagerMessage(req, env, manager, ctx) {
  const d = await body(req, 5000);
  const text = clip(d.body, 2000), to = +d.user;
  if (!text || !to) return fail(400, 'bad request');
  const target = await env.DB.prepare('SELECT * FROM users WHERE id=?').bind(to).first();
  if (!target) return fail(404, 'not found');
  const r = await env.DB.prepare("INSERT INTO messages(thread,from_role,from_id,body,created_at) VALUES(?,?,?,?,?)").bind(to, 'manager', manager.id, text, NOW()).run();
  if (target.tg_chat) ctx.waitUntil(say(env, target.tg_chat, 'ZAYA: у вас новое сообщение от менеджера. Откройте кабинет на zaya.uz → «Чат».'));
  return json({ ok: true, id: r.meta.last_row_id });
}

/* ---------- manager panel ---------- */
async function adminApps(env, url) {
  const kind = url.searchParams.get('kind'), status = url.searchParams.get('status'), q = clip(url.searchParams.get('q'), 60);
  const w = [], b = [];
  if (kind === 'apply' || kind === 'brief') { w.push('a.kind=?'); b.push(kind); }
  if (status && /^[a-z]+$/.test(status)) { w.push('a.status=?'); b.push(status); }
  if (q) { w.push('(a.name LIKE ? OR a.phone LIKE ?)'); b.push(`%${q}%`, `%${q.replace(/\D/g, '')}%`); }
  const rows = await env.DB.prepare(`SELECT a.id,a.kind,a.status,a.name,a.phone,a.created_at,a.updated_at,(SELECT id FROM users WHERE phone=a.phone) AS user_id FROM apps a ${w.length ? 'WHERE ' + w.join(' AND ') : ''} ORDER BY a.id DESC LIMIT 200`).bind(...b).all();
  return json({ ok: true, apps: rows.results || [] });
}
async function adminApp(env, id) {
  const a = await env.DB.prepare('SELECT * FROM apps WHERE id=?').bind(id).first();
  if (!a) return fail(404, 'not found');
  const u = await env.DB.prepare('SELECT id,phone,name,profile FROM users WHERE phone=?').bind(a.phone).first();
  const photos = u ? (await env.DB.prepare('SELECT id FROM photos WHERE user_id=? ORDER BY id').bind(u.id).all()).results : [];
  return json({ ok: true, app: { ...a, payload: safeJson(a.payload), statuses: STATUS[a.kind === 'apply' ? 'apply' : 'brief'] }, user: u ? { id: u.id, phone: u.phone, name: u.name, profile: safeJson(u.profile) } : null, photos });
}
async function adminStatus(req, env, id, ctx) {
  const d = await body(req, 1000);
  const a = await env.DB.prepare('SELECT * FROM apps WHERE id=?').bind(id).first();
  if (!a) return fail(404, 'not found');
  const list = STATUS[a.kind === 'apply' ? 'apply' : 'brief'];
  if (!list.includes(d.status)) return fail(400, 'bad status');
  await env.DB.prepare('UPDATE apps SET status=?, updated_at=? WHERE id=?').bind(d.status, NOW(), id).run();
  const u = await env.DB.prepare('SELECT tg_chat FROM users WHERE phone=?').bind(a.phone).first();
  if (u && u.tg_chat && d.status !== a.status) ctx.waitUntil(say(env, u.tg_chat, `ZAYA: статус вашей заявки — «${STATUS_TEXT[d.status][L(a.lang)]}». Подробности в кабинете на zaya.uz.`));
  return json({ ok: true });
}
async function adminThreads(env) {
  const rows = await env.DB.prepare(`SELECT u.id,u.name,u.phone,u.role,
    (SELECT body FROM messages WHERE thread=u.id ORDER BY id DESC LIMIT 1) AS last_body,
    (SELECT created_at FROM messages WHERE thread=u.id ORDER BY id DESC LIMIT 1) AS last_at,
    (SELECT COUNT(*) FROM messages WHERE thread=u.id AND from_role='user' AND seen=0) AS unread
    FROM users u WHERE EXISTS(SELECT 1 FROM messages WHERE thread=u.id) ORDER BY last_at DESC LIMIT 200`).all();
  return json({ ok: true, threads: rows.results || [] });
}
