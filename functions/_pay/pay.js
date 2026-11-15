/* ZAYA Academy — онлайн-оплата: Payme и Click (Uzum — после получения их документации по договору).
   Сервис включается сам, когда в Cloudflare заданы его секреты; без секретов он выключен.
   Цены живут только здесь: сумму из браузера сервер не принимает.

   ВАЖНО: протоколы Payme (Merchant API, JSON-RPC) и Click (Shop API, prepare/complete) написаны по их открытой
   документации по памяти. Перед приёмом настоящих платежей сверить с документацией в кабинете мерчанта
   и прогнать в их тестовой среде. */

export const PRODUCTS = {
  start: { amount: 3600000, name: ['Курс Start (8 недель)', 'Start kursi (8 hafta)', 'Start course (8 weeks)'] },
  start_half: { amount: 1900000, name: ['Курс Start, первый взнос из двух', 'Start kursi, ikki to‘lovdan birinchisi', 'Start course, first of two instalments'] },
  hostess: { amount: 2400000, name: ['Курс Hostess & Events (4 недели)', 'Hostess & Events kursi (4 hafta)', 'Hostess & Events course (4 weeks)'] },
  kids: { amount: 960000, name: ['Детская школа, абонемент 8 занятий', 'Bolalar maktabi, 8 mashg‘ulotli abonement', 'Children’s school, 8-class pass'], parent: true },
};
const L = l => ({ ru: 0, uz: 1, en: 2 })[l] ?? 0;
export const productName = (key, lang) => (PRODUCTS[key] ? PRODUCTS[key].name[L(lang)] : key);

export const PAY_SCHEMA = [
  `CREATE TABLE IF NOT EXISTS orders(id INTEGER PRIMARY KEY AUTOINCREMENT, product TEXT NOT NULL, amount INTEGER NOT NULL, name TEXT NOT NULL, phone TEXT NOT NULL, parent TEXT, lang TEXT, provider TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'new', created_at INTEGER NOT NULL, paid_at INTEGER)`,
  `CREATE TABLE IF NOT EXISTS pay_tx(id INTEGER PRIMARY KEY AUTOINCREMENT, provider TEXT NOT NULL, ext_id TEXT NOT NULL, order_id INTEGER NOT NULL, amount INTEGER NOT NULL, state INTEGER NOT NULL, create_time INTEGER NOT NULL, perform_time INTEGER NOT NULL DEFAULT 0, cancel_time INTEGER NOT NULL DEFAULT 0, reason INTEGER, UNIQUE(provider, ext_id))`,
];

/* какие сервисы включены (заданы все их секреты) */
export function providers(env) {
  const out = [];
  if (env.PAYME_MERCHANT_ID && env.PAYME_KEY) out.push('payme');
  if (env.CLICK_SERVICE_ID && env.CLICK_MERCHANT_ID && env.CLICK_SECRET_KEY) out.push('click');
  return out;
}

const b64 = s => btoa(unescape(encodeURIComponent(s)));
export function payLink(env, provider, order, origin) {
  const back = `${origin}/#paid`;
  if (provider === 'payme') {
    const base = env.PAYME_CHECKOUT || 'https://checkout.paycom.uz';
    return `${base}/${b64(`m=${env.PAYME_MERCHANT_ID};ac.order_id=${order.id};a=${order.amount * 100};l=${order.lang || 'ru'};c=${back}`)}`;
  }
  if (provider === 'click') {
    const u = new URL(env.CLICK_CHECKOUT || 'https://my.click.uz/services/pay');
    u.searchParams.set('service_id', env.CLICK_SERVICE_ID); u.searchParams.set('merchant_id', env.CLICK_MERCHANT_ID);
    u.searchParams.set('amount', String(order.amount)); u.searchParams.set('transaction_param', String(order.id)); u.searchParams.set('return_url', back);
    return u.toString();
  }
  return null;
}

const NOW = () => Math.floor(Date.now() / 1000);
const same = (a, b) => { a = String(a); b = String(b); if (a.length !== b.length) return false; let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i); return r === 0; };
const jres = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
const getOrder = (env, id) => (Number.isInteger(id) && id > 0 ? env.DB.prepare('SELECT * FROM orders WHERE id=?').bind(id).first() : null);

async function markPaid(env, order, onPaid) {
  const r = await env.DB.prepare("UPDATE orders SET status='paid', paid_at=? WHERE id=? AND status!='paid'").bind(NOW(), order.id).run();
  if (r.meta && r.meta.changes === 1 && onPaid) { try { await onPaid({ ...order, status: 'paid' }); } catch { /* уведомление не должно ломать ответ сервису */ } }
}

/* ---------------- Payme: Merchant API (JSON-RPC 2.0) ---------------- */
const PAYME_TIMEOUT_MS = 12 * 3600 * 1000;
const pErr = (id, code, ru, data) => jres({ jsonrpc: '2.0', id: id ?? null, error: { code, message: { ru, uz: ru, en: ru }, ...(data ? { data } : {}) } });
const pOk = (id, result) => jres({ jsonrpc: '2.0', id: id ?? null, result });
const txView = t => ({ create_time: t.create_time, perform_time: t.perform_time, cancel_time: t.cancel_time, transaction: String(t.id), state: t.state, reason: t.reason ?? null });

export async function handlePayme(env, req, onPaid, onCancel) {
  let body; try { body = JSON.parse(await req.text()); } catch { return pErr(null, -32700, 'Ошибка разбора запроса'); }
  const id = body && body.id;
  const auth = req.headers.get('authorization') || '';
  if (!env.PAYME_KEY || !same(auth, 'Basic ' + btoa('Paycom:' + env.PAYME_KEY))) return pErr(id, -32504, 'Недостаточно привилегий');
  const p = (body && body.params) || {}, method = body && body.method;
  const findTx = () => env.DB.prepare("SELECT * FROM pay_tx WHERE provider='payme' AND ext_id=?").bind(String(p.id || '')).first();
  const checkOrder = async () => {
    const order = await getOrder(env, Number(p.account && p.account.order_id));
    if (!order) return { err: pErr(id, -31050, 'Заказ не найден', 'order_id') };
    if (order.status === 'paid') return { err: pErr(id, -31051, 'Заказ уже оплачен', 'order_id') };
    if (order.status === 'cancelled') return { err: pErr(id, -31052, 'Заказ отменён', 'order_id') };
    if (Number(p.amount) !== order.amount * 100) return { err: pErr(id, -31001, 'Неверная сумма') };
    return { order };
  };

  if (method === 'CheckPerformTransaction') { const c = await checkOrder(); return c.err || pOk(id, { allow: true }); }

  if (method === 'CreateTransaction') {
    let tx = await findTx();
    if (tx) {
      if (tx.state !== 1) return pErr(id, -31008, 'Невозможно выполнить операцию');
      if (Date.now() - tx.create_time > PAYME_TIMEOUT_MS) {
        await env.DB.prepare('UPDATE pay_tx SET state=-1, reason=4, cancel_time=? WHERE id=?').bind(Date.now(), tx.id).run();
        await env.DB.prepare("UPDATE orders SET status='new' WHERE id=? AND status='pending'").bind(tx.order_id).run();
        return pErr(id, -31008, 'Транзакция просрочена');
      }
      return pOk(id, { create_time: tx.create_time, transaction: String(tx.id), state: tx.state });
    }
    const c = await checkOrder(); if (c.err) return c.err;
    const busy = await env.DB.prepare("SELECT id FROM pay_tx WHERE order_id=? AND state=1 AND create_time>?").bind(c.order.id, Date.now() - PAYME_TIMEOUT_MS).first();
    if (busy) return pErr(id, -31099, 'По заказу уже идёт оплата', 'order_id');
    const now = Date.now();
    try { await env.DB.prepare("INSERT INTO pay_tx(provider,ext_id,order_id,amount,state,create_time) VALUES('payme',?,?,?,1,?)").bind(String(p.id), c.order.id, c.order.amount, now).run(); }
    catch { tx = await findTx(); if (!tx) return pErr(id, -31008, 'Невозможно выполнить операцию'); return pOk(id, { create_time: tx.create_time, transaction: String(tx.id), state: tx.state }); }
    await env.DB.prepare("UPDATE orders SET status='pending', provider='payme' WHERE id=? AND status='new'").bind(c.order.id).run();
    tx = await findTx();
    return pOk(id, { create_time: tx.create_time, transaction: String(tx.id), state: 1 });
  }

  if (method === 'PerformTransaction') {
    const tx = await findTx(); if (!tx) return pErr(id, -31003, 'Транзакция не найдена');
    if (tx.state === 2) return pOk(id, { transaction: String(tx.id), perform_time: tx.perform_time, state: 2 });
    if (tx.state !== 1) return pErr(id, -31008, 'Невозможно выполнить операцию');
    if (Date.now() - tx.create_time > PAYME_TIMEOUT_MS) {
      await env.DB.prepare('UPDATE pay_tx SET state=-1, reason=4, cancel_time=? WHERE id=?').bind(Date.now(), tx.id).run();
      await env.DB.prepare("UPDATE orders SET status='new' WHERE id=? AND status='pending'").bind(tx.order_id).run();
      return pErr(id, -31008, 'Транзакция просрочена');
    }
    const now = Date.now();
    const u = await env.DB.prepare('UPDATE pay_tx SET state=2, perform_time=? WHERE id=? AND state=1').bind(now, tx.id).run();
    const cur = await findTx();
    if (u.meta && u.meta.changes === 1) { const order = await getOrder(env, tx.order_id); if (order) await markPaid(env, order, onPaid); }
    return pOk(id, { transaction: String(cur.id), perform_time: cur.perform_time, state: cur.state });
  }

  if (method === 'CancelTransaction') {
    const tx = await findTx(); if (!tx) return pErr(id, -31003, 'Транзакция не найдена');
    if (tx.state < 0) return pOk(id, { transaction: String(tx.id), cancel_time: tx.cancel_time, state: tx.state });
    const now = Date.now(), ns = tx.state === 1 ? -1 : -2;
    await env.DB.prepare('UPDATE pay_tx SET state=?, reason=?, cancel_time=? WHERE id=? AND state>0').bind(ns, Number.isInteger(p.reason) ? p.reason : null, now, tx.id).run();
    const order = await getOrder(env, tx.order_id);
    if (order) {
      await env.DB.prepare('UPDATE orders SET status=? WHERE id=?').bind(ns === -1 ? 'new' : 'cancelled', order.id).run();
      if (ns === -2 && onCancel) { try { await onCancel(order); } catch { /* noop */ } }
    }
    const cur = await findTx();
    return pOk(id, { transaction: String(cur.id), cancel_time: cur.cancel_time, state: cur.state });
  }

  if (method === 'CheckTransaction') { const tx = await findTx(); return tx ? pOk(id, txView(tx)) : pErr(id, -31003, 'Транзакция не найдена'); }

  if (method === 'GetStatement') {
    const rows = (await env.DB.prepare("SELECT * FROM pay_tx WHERE provider='payme' AND create_time>=? AND create_time<=? ORDER BY create_time").bind(Number(p.from) || 0, Number(p.to) || Date.now()).all()).results || [];
    return pOk(id, { transactions: rows.map(t => ({ id: t.ext_id, time: t.create_time, amount: t.amount * 100, account: { order_id: String(t.order_id) }, ...txView(t) })) });
  }
  return pErr(id, -32601, 'Метод не найден');
}

/* ---------------- Click: Shop API (prepare / complete) ---------------- */
const md5 = async s => [...new Uint8Array(await crypto.subtle.digest('MD5', new TextEncoder().encode(s)))].map(b => b.toString(16).padStart(2, '0')).join('');
export async function handleClick(env, req, phase, onPaid) {
  let f = {};
  try {
    const ct = req.headers.get('content-type') || '', raw = await req.text();
    if (ct.includes('json')) f = JSON.parse(raw || '{}'); else for (const [k, v] of new URLSearchParams(raw)) f[k] = v;
  } catch { f = {}; }
  const base = { click_trans_id: f.click_trans_id, merchant_trans_id: f.merchant_trans_id };
  const out = (error, error_note, extra = {}) => jres({ ...base, ...extra, error, error_note });
  if (!env.CLICK_SECRET_KEY) return out(-8, 'Not configured');
  const action = String(f.action ?? ''), isComplete = phase === 'complete';
  if (action !== (isComplete ? '1' : '0')) return out(-3, 'Action not found');
  if (String(f.service_id) !== String(env.CLICK_SERVICE_ID)) return out(-8, 'Wrong service');
  const sign = await md5(String(f.click_trans_id) + String(f.service_id) + env.CLICK_SECRET_KEY + String(f.merchant_trans_id) + (isComplete ? String(f.merchant_prepare_id) : '') + String(f.amount) + action + String(f.sign_time));
  if (!same(sign, String(f.sign_string || '').toLowerCase())) return out(-1, 'SIGN CHECK FAILED!');
  const order = await getOrder(env, Number(f.merchant_trans_id));
  if (!order) return out(-5, 'Order does not exist');
  if (Math.round(parseFloat(f.amount) * 100) !== order.amount * 100) return out(-2, 'Incorrect parameter amount');
  const ext = String(f.click_trans_id);
  const findTx = () => env.DB.prepare("SELECT * FROM pay_tx WHERE provider='click' AND ext_id=?").bind(ext).first();

  if (!isComplete) {
    if (order.status === 'paid') return out(-4, 'Already paid');
    if (order.status === 'cancelled') return out(-9, 'Transaction cancelled');
    let tx = await findTx();
    if (!tx) {
      try { await env.DB.prepare("INSERT INTO pay_tx(provider,ext_id,order_id,amount,state,create_time) VALUES('click',?,?,?,1,?)").bind(ext, order.id, order.amount, Date.now()).run(); } catch { /* повтор запроса */ }
      await env.DB.prepare("UPDATE orders SET status='pending', provider='click' WHERE id=? AND status='new'").bind(order.id).run();
      tx = await findTx();
    }
    if (!tx) return out(-7, 'Failed to update');
    if (tx.state < 0) return out(-9, 'Transaction cancelled');
    return out(0, 'Success', { merchant_prepare_id: tx.id });
  }

  const tx = await findTx();
  if (!tx || String(tx.id) !== String(f.merchant_prepare_id)) return out(-6, 'Transaction does not exist');
  if (tx.state === 2) return out(-4, 'Already paid', { merchant_confirm_id: tx.id });
  if (tx.state < 0) return out(-9, 'Transaction cancelled');
  if (Number(f.error) < 0) {            // Click сообщает, что платёж не прошёл
    await env.DB.prepare('UPDATE pay_tx SET state=-1, cancel_time=? WHERE id=? AND state=1').bind(Date.now(), tx.id).run();
    await env.DB.prepare("UPDATE orders SET status='new' WHERE id=? AND status='pending'").bind(order.id).run();
    return out(-9, 'Transaction cancelled');
  }
  const u = await env.DB.prepare('UPDATE pay_tx SET state=2, perform_time=? WHERE id=? AND state=1').bind(Date.now(), tx.id).run();
  if (u.meta && u.meta.changes === 1) await markPaid(env, order, onPaid);
  return out(0, 'Success', { merchant_confirm_id: tx.id });
}
