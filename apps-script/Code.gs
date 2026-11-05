/**
 * ZAYA — приём форм с сайта в Google Sheets.
 *   type "apply" (анкета модели)   -> лист "Info"   (существующий список моделей, колонки A:Y)
 *   type "brief" (бриф бизнеса)    -> лист "Бизнес" (создаётся автоматически)
 * Деплой и настройка: apps-script/README.md
 */
const SHEET_ID = '1c-1iHhszTuB8ywd2Cp3FP7ac5wWA1pED3g4N8b2A46E';
const MODELS_SHEET = 'Info';
const BUSINESS_SHEET = 'Бизнес';
const TZ = 'Asia/Tashkent';
const NOTIFY_EMAIL = ''; // необязательно: e-mail менеджера для уведомления о новой заявке
const NEW_MODEL_STATUS = 'Новая заявка'; // значение в колонке «Отбор»
const NEW_BRIEF_STATUS = 'Новая';

const BUSINESS_HEADERS = ['Заявка №', 'Отправлено', 'Статус', 'Имя', 'Компания', 'Должность', 'Телефон',
  'Telegram', 'E-mail', 'Город', 'Сфера бизнеса', 'Команда', 'Что нужно', 'Задача', 'Бюджет', 'Сроки',
  'Как связаться', 'Язык', 'Менеджер', 'Комментарий'];

function doGet(e) {
  const p = (e && e.parameter) || {};
  if (p.action === 'lookup') return json_(lookup_(p));
  if (p.action === 'byphone') return json_(byPhone_(p));
  return json_({ ok: true, service: 'zaya-forms' });
}

/**
 * Поиск строки по коду заявки (для личного кабинета на zaya.uz).
 * Вызывается только сервером сайта: нужен ключ из «Свойств скрипта» (API_KEY), который совпадает с SHEET_KEY в Cloudflare.
 *   Z-XXXXX -> лист Info (модели), B-XXXXX -> лист «Бизнес»
 */
function lookup_(p) {
  const key = PropertiesService.getScriptProperties().getProperty('API_KEY');
  if (!key || String(p.key || '') !== key) return { ok: false, error: 'forbidden' };
  const code = String(p.code || '').trim().toUpperCase();
  if (!/^[ZB]-[A-Z0-9]{4,8}$/.test(code)) return { ok: false, error: 'bad code' };
  const kind = code.charAt(0) === 'Z' ? 'apply' : 'brief';
  const sh = SpreadsheetApp.openById(SHEET_ID).getSheetByName(kind === 'apply' ? MODELS_SHEET : BUSINESS_SHEET);
  if (!sh) return { ok: false, error: 'sheet not found' };
  const values = sh.getDataRange().getDisplayValues();
  let h = 0; // строка заголовков: первая из первых пяти, где в колонке A написано «Заявка №»
  for (let i = 0; i < Math.min(5, values.length); i++) if (String(values[i][0]).trim() === 'Заявка №') { h = i; break; }
  const head = values[h];
  for (let i = h + 1; i < values.length; i++) {
    if (String(values[i][0]).trim().toUpperCase() === code) {
      const row = {};
      head.forEach((name, j) => { if (name) row[String(name).trim()] = String(values[i][j] == null ? '' : values[i][j]).trim(); });
      return { ok: true, kind: kind, row: row };
    }
  }
  return { ok: false, error: 'not found' };
}

/**
 * Все заявки, где указан этот номер (в колонке «Телефон» или «Родитель») — в обоих листах.
 * Нужен для автоматической привязки при входе в кабинет. Тот же ключ API_KEY.
 */
function byPhone_(p) {
  const key = PropertiesService.getScriptProperties().getProperty('API_KEY');
  if (!key || String(p.key || '') !== key) return { ok: false, error: 'forbidden' };
  const want = String(p.phone || '').replace(/\D/g, '').slice(-9);
  if (want.length !== 9) return { ok: false, error: 'bad phone' };
  const ss = SpreadsheetApp.openById(SHEET_ID), items = [];
  [[MODELS_SHEET, 'apply'], [BUSINESS_SHEET, 'brief']].forEach(function (pair) {
    const sh = ss.getSheetByName(pair[0]);
    if (!sh) return;
    const values = sh.getDataRange().getDisplayValues();
    let h = 0;
    for (let i = 0; i < Math.min(5, values.length); i++) if (String(values[i][0]).trim() === 'Заявка №') { h = i; break; }
    const head = values[h].map(function (x) { return String(x).trim(); });
    const ci = head.indexOf('Телефон'), pi = head.indexOf('Родитель');
    for (let i = h + 1; i < values.length && items.length < 20; i++) {
      const code = String(values[i][0]).trim().toUpperCase();
      if (!/^[ZB]-[A-Z0-9]{4,8}$/.test(code)) continue;
      const text = (ci >= 0 ? values[i][ci] : '') + ' ; ' + (pi >= 0 ? values[i][pi] : '');
      if (!numbers_(text).some(function (d) { return d === want; })) continue;
      const row = {};
      head.forEach(function (name, j) { if (name) row[name] = String(values[i][j] == null ? '' : values[i][j]).trim(); });
      items.push({ kind: pair[1], row: row });
    }
  });
  return { ok: true, items: items };
}

// все номера, записанные в тексте (несколько номеров через / , ; «и»; пробелы внутри номера допустимы) — по 9 последних цифр
function numbers_(text) {
  const out = [];
  String(text || '').split(/[\/,;]|\sи\s|\s{2,}/).forEach(function (part) {
    const d = part.replace(/\D/g, '');
    if (d.length >= 9) out.push(d.slice(-9));
  });
  (String(text || '').replace(/[^\d]/g, ' ').match(/\d{9,12}/g) || []).forEach(function (d) { out.push(d.slice(-9)); });
  return out;
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    const d = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (d.website) return json_({ ok: true }); // honeypot
    if (d.type !== 'apply' && d.type !== 'brief') throw new Error('bad type');
    if (!d.consent) throw new Error('consent required');

    const phone = clip_(d.phone, 40);
    const digits = phone.replace(/\D/g, '');
    if (clip_(d.name, 120).length < 2) throw new Error('name required');
    if (digits.length < 9) throw new Error('phone required');

    // защита от двойной отправки / спама с одного номера
    const cache = CacheService.getScriptCache();
    const key = 'dup:' + d.type + ':' + digits;
    if (cache.get(key)) return json_({ ok: true, duplicate: true });

    lock.waitLock(20000);
    const ss = SpreadsheetApp.openById(SHEET_ID);
    const result = d.type === 'apply' ? saveModel_(ss, d, phone) : saveBrief_(ss, d, phone);
    cache.put(key, '1', 120);
    notify_(d.type, result);
    return json_({ ok: true, id: result.id });
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message || err) });
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}

function saveModel_(ss, d, phone) {
  const sh = ss.getSheetByName(MODELS_SHEET);
  if (!sh) throw new Error('sheet not found: ' + MODELS_SHEET);
  const birth = parseDate_(d.birth);
  if (!birth) throw new Error('birth date required');
  const age = ageOf_(birth);
  if (age < 0 || age > 90) throw new Error('bad birth date');
  if (age < 18 && clip_(d.parent, 200).length < 5) throw new Error('parent required');
  const height = num_(d.height);
  if (!height) throw new Error('height required');

  const id = newId_(sh, 'Z');
  // порядок колонок = существующий лист «Info» (A:Y)
  const row = [
    id,                                              // Заявка №
    now_(),                                          // Отправлено
    clip_(d.telegram, 60),                           // Telegram
    clip_(d.name, 120),                              // Имя и фамилия
    Utilities.formatDate(birth, 'UTC', 'dd.MM.yyyy'),// Дата рождения
    age,                                             // Возраст
    clip_(d.gender, 20),                             // Пол
    phone,                                           // Телефон
    clip_(d.instagram, 80),                          // Instagram
    clip_(d.city, 60),                               // Город
    clip_(d.parent, 200),                            // Родитель
    height,                                          // Рост
    num_(d.weight),                                  // Вес
    clip_(d.params, 30),                             // Параметры (Г-Т-Б)
    clip_(d.shoe, 20),                               // Обувь
    clip_(d.hair, 60),                               // Волосы
    clip_(d.eyes, 60),                               // Глаза
    clip_(d.exp, 40),                                // Опыт
    clip_(d.dirs, 200),                              // Направления
    clip_(d.contract, 10) || 'Нет',                  // Контракт с агентством
    clip_(d.portfolio, 300),                         // Портфолио
    clip_(d.about, 1500),                            // О себе
    '',                                              // Подтвердил(а) приход — заполняет менеджер
    clip_(d.lang, 5) || 'ru',                        // Язык
    NEW_MODEL_STATUS                                 // Отбор
  ];
  append_(sh, row);
  return { id: id, name: row[3], phone: phone, kind: 'Модель' };
}

function saveBrief_(ss, d, phone) {
  let sh = ss.getSheetByName(BUSINESS_SHEET);
  if (!sh) {
    sh = ss.insertSheet(BUSINESS_SHEET);
    sh.getRange(1, 1, 1, BUSINESS_HEADERS.length).setValues([BUSINESS_HEADERS]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  if (clip_(d.task, 1500).length < 3) throw new Error('task required');
  const id = newId_(sh, 'B');
  const row = [
    id, now_(), NEW_BRIEF_STATUS,
    clip_(d.name, 120), clip_(d.company, 120), clip_(d.position, 80), phone,
    clip_(d.telegram, 60), clip_(d.email, 120), clip_(d.city, 60), clip_(d.industry, 120),
    clip_(d.team, 20), clip_(d.dirs, 200), clip_(d.task, 1500), clip_(d.budget, 40), clip_(d.timing, 40),
    clip_(d.contact, 20), clip_(d.lang, 5) || 'ru', '', ''
  ];
  append_(sh, row);
  return { id: id, name: row[3], phone: phone, kind: 'Бизнес' };
}

// ---------- helpers ----------
function append_(sh, row) {
  const r = sh.getLastRow() + 1;
  // формат «текст»: пользовательский ввод не может стать формулой, телефоны не теряют «+»
  sh.getRange(r, 1, 1, row.length).setNumberFormat('@').setValues([row]);
}

function newId_(sh, prefix) {
  const existing = {};
  const last = sh.getLastRow();
  if (last > 0) sh.getRange(1, 1, last, 1).getValues().forEach(function (v) { existing[String(v[0])] = 1; });
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  for (let t = 0; t < 50; t++) {
    let id = prefix + '-';
    for (let i = 0; i < 5; i++) id += abc.charAt(Math.floor(Math.random() * abc.length));
    if (!existing[id]) return id;
  }
  throw new Error('id generation failed');
}

function clip_(v, n) { return String(v == null ? '' : v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, n); }
function num_(v) { const n = parseFloat(String(v).replace(',', '.')); return isFinite(n) && n > 0 ? n : ''; }
function now_() { return Utilities.formatDate(new Date(), TZ, 'dd.MM.yyyy HH:mm'); }

function parseDate_(s) { // ожидается yyyy-mm-dd
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || ''));
  if (!m) return null;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCMonth() === +m[2] - 1 ? d : null;
}

function ageOf_(birth) {
  const n = new Date();
  let a = n.getUTCFullYear() - birth.getUTCFullYear();
  if (n.getUTCMonth() < birth.getUTCMonth() || (n.getUTCMonth() === birth.getUTCMonth() && n.getUTCDate() < birth.getUTCDate())) a--;
  return a;
}

function notify_(type, r) {
  if (!NOTIFY_EMAIL) return;
  try {
    MailApp.sendEmail(NOTIFY_EMAIL, 'ZAYA: новая заявка ' + r.id + ' (' + r.kind + ')',
      r.kind + ': ' + r.name + '\nТелефон: ' + r.phone + '\nТаблица: https://docs.google.com/spreadsheets/d/' + SHEET_ID);
  } catch (_) {}
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
