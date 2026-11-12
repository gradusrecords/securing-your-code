/* ZAYA — чат с ИИ-менеджером по продажам (консалтинг). Самодостаточный: сам добавляет стили и разметку.
   Сервер: POST /api/sales/chat. Если ИИ не настроен (503), предлагает оставить бриф. */
(function () {
  if (window.top !== window.self || window.__zayaSales) return;
  window.__zayaSales = 1;
  var SID_KEY = 'zaya-sales-sid', LOG_KEY = 'zaya-sales-log';
  var T = {
    ru: { btn: 'Чат с менеджером', title: 'ИИ-менеджер ZAYA', sub: 'Вы общаетесь с ИИ. Менеджер подключится к заявке.', ph: 'Напишите сообщение…', send: 'Отправить', close: 'Закрыть', priv: 'Как мы храним данные',
      hi: 'Здравствуйте! Я ИИ-менеджер ZAYA Marketing. Помогу понять, чем мы полезны вашему бренду (Медиа, СММ, PR), и запишу на разбор с менеджером. Чем вы занимаетесь?',
      q: ['Что входит в услуги?', 'Хочу разбор бренда', 'Сколько это стоит?'], err: 'Не получилось отправить. Попробуйте ещё раз.', off: 'Чат сейчас недоступен. Оставьте бриф, и менеджер свяжется с вами.', brief: 'Оставить бриф', lead: 'Заявка передана менеджеру ✓' },
    uz: { btn: 'Menejer bilan chat', title: 'ZAYA AI-menejeri', sub: 'Siz sun’iy intellekt bilan yozishyapsiz. Menejer arizaga ulanadi.', ph: 'Xabar yozing…', send: 'Yuborish', close: 'Yopish', priv: 'Ma’lumotlar qanday saqlanadi',
      hi: 'Assalomu alaykum! Men ZAYA Marketing’ning sun’iy intellekt menejeriman. Brendingizga (Media, SMM, PR) qanday foydali bo‘lishimizni tushuntirib, menejer bilan tahlilga yozib qo‘yaman. Faoliyatingiz qanday?',
      q: ['Xizmatlarga nima kiradi?', 'Brend tahlilini xohlayman', 'Narxi qancha?'], err: 'Yuborib bo‘lmadi. Yana urinib ko‘ring.', off: 'Chat hozir mavjud emas. Brif qoldiring, menejer siz bilan bog‘lanadi.', brief: 'Brif qoldirish', lead: 'Ariza menejerga yuborildi ✓' },
    en: { btn: 'Chat with a manager', title: 'ZAYA AI manager', sub: 'You are chatting with an AI. A human manager will join your request.', ph: 'Write a message…', send: 'Send', close: 'Close', priv: 'How we handle data',
      hi: 'Hello! I am the AI manager of ZAYA Marketing. I will help you see how we can be useful to your brand (Media, SMM, PR) and book a review with a manager. What does your business do?',
      q: ['What do the services include?', 'I want a brand review', 'How much does it cost?'], err: 'Could not send. Please try again.', off: 'The chat is unavailable right now. Leave a brief and a manager will contact you.', brief: 'Leave a brief', lead: 'Request sent to a manager ✓' },
  };
  var lang = function () { var l = document.documentElement.lang; return T[l] ? l : 'ru'; };
  var tx = function (k) { return T[lang()][k]; };
  var store = {
    get: function (k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { sessionStorage.setItem(k, v); } catch (e) {} },
  };
  var sid = store.get(SID_KEY);
  if (!sid) { sid = Array.prototype.map.call(crypto.getRandomValues(new Uint8Array(12)), function (b) { return ('0' + b.toString(16)).slice(-2); }).join(''); store.set(SID_KEY, sid); }
  var log = []; try { log = JSON.parse(store.get(LOG_KEY) || '[]'); } catch (e) { log = []; }

  var css = document.createElement('style');
  css.textContent = [
    '.zs-btn{all:unset;cursor:pointer;position:fixed;right:var(--gutter,20px);bottom:calc(22px + env(safe-area-inset-bottom,0px));z-index:59;width:54px;height:54px;border-radius:50%;box-sizing:border-box;display:grid;place-items:center;background:radial-gradient(circle at 35% 30%,#EBCB92,#B89455);box-shadow:0 0 0 1px rgba(219,181,119,.45),0 8px 22px rgba(0,0,0,.5);opacity:0;transform:scale(.5);pointer-events:none;transition:opacity .6s,transform .7s cubic-bezier(.2,.7,.2,1);-webkit-tap-highlight-color:transparent}',
    '.zs-btn.on{opacity:1;transform:none;pointer-events:auto}.zs-btn:hover{transform:scale(1.06)}.zs-btn:focus-visible{outline:2px solid #fff;outline-offset:3px}',
    '.zs-btn svg{width:24px;height:24px;fill:none;stroke:#0a140f;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}',
    'body.dr-on .zs-btn,body.dr-on .zs-box{z-index:80}',
    '.zs-box{position:fixed;right:var(--gutter,20px);bottom:calc(88px + env(safe-area-inset-bottom,0px));z-index:72;width:min(380px,calc(100vw - 2*var(--gutter,20px)));height:min(560px,calc(100dvh - 130px));display:none;flex-direction:column;background:rgba(8,12,10,.94);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);border:1px solid rgba(219,181,119,.4);color:#EFE6D2;font-family:Jost,system-ui,sans-serif;box-shadow:0 24px 60px rgba(0,0,0,.6)}',
    '.zs-box.open{display:flex;animation:zsIn .45s cubic-bezier(.2,.7,.2,1)}@keyframes zsIn{from{opacity:0;transform:translateY(14px)}}',
    '.zs-h{display:flex;align-items:flex-start;gap:12px;padding:16px 14px 12px 18px;border-bottom:1px solid rgba(219,181,119,.2)}',
    '.zs-h b{display:block;font-family:"Cormorant Garamond",serif;font-weight:500;font-size:22px;line-height:1.1;color:#DBB577}.zs-h small{display:block;margin-top:4px;font-size:11px;line-height:1.35;opacity:.65;letter-spacing:.02em}',
    '.zs-x{all:unset;cursor:pointer;margin-left:auto;padding:2px 8px;font-size:26px;line-height:1;color:#DBB577}.zs-x:focus-visible{outline:2px solid #DBB577}',
    '.zs-log{flex:1;overflow-y:auto;padding:16px 16px 6px;display:flex;flex-direction:column;gap:10px;overscroll-behavior:contain}',
    '.zs-m{max-width:86%;padding:10px 13px;font-size:14px;line-height:1.5;white-space:pre-wrap;word-wrap:break-word;border:1px solid rgba(219,181,119,.22)}',
    '.zs-m.a{align-self:flex-start;background:rgba(219,181,119,.07)}.zs-m.u{align-self:flex-end;background:rgba(219,181,119,.9);color:#0a140f;border-color:transparent}',
    '.zs-m.s{align-self:center;border:0;background:none;font-size:12px;color:#DBB577;opacity:.85}',
    '.zs-m a,.zs-m button{all:unset;cursor:pointer;color:#DBB577;text-decoration:underline}',
    '.zs-typ{align-self:flex-start;display:flex;gap:4px;padding:12px 14px}.zs-typ i{width:6px;height:6px;border-radius:50%;background:#DBB577;opacity:.4;animation:zsD 1.2s infinite}.zs-typ i:nth-child(2){animation-delay:.2s}.zs-typ i:nth-child(3){animation-delay:.4s}@keyframes zsD{40%{opacity:1;transform:translateY(-3px)}}',
    '.zs-q{display:flex;flex-wrap:wrap;gap:8px;padding:2px 16px 8px}.zs-q button{all:unset;cursor:pointer;padding:7px 12px;font-size:12.5px;border:1px solid rgba(219,181,119,.45);color:#DBB577;-webkit-tap-highlight-color:transparent}.zs-q button:hover{background:rgba(219,181,119,.12)}',
    '.zs-f{display:flex;gap:8px;padding:10px 12px calc(12px + env(safe-area-inset-bottom,0px));border-top:1px solid rgba(219,181,119,.2)}',
    '.zs-f input{flex:1;min-width:0;font:inherit;font-size:16px;padding:10px 12px;color:#EFE6D2;background:rgba(255,255,255,.05);border:1px solid rgba(219,181,119,.3);border-radius:0;outline:0}.zs-f input:focus{border-color:#DBB577}',
    '.zs-f button{all:unset;cursor:pointer;padding:0 16px;display:grid;place-items:center;background:#DBB577;color:#0a140f;font-size:12px;letter-spacing:.14em;text-transform:uppercase;font-weight:500}.zs-f button:disabled{opacity:.5;cursor:default}',
    '@media (max-width:520px){.zs-box{bottom:calc(84px + env(safe-area-inset-bottom,0px));height:min(560px,calc(100dvh - 120px))}}',
    '@media (prefers-reduced-motion:reduce){.zs-box.open,.zs-typ i{animation:none}.zs-btn{transition:opacity .2s}}',
  ].join('\n');
  document.head.appendChild(css);

  var el = function (tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  var btn = el('button', 'zs-btn');
  btn.type = 'button';
  btn.setAttribute('aria-expanded', 'false');
  btn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v11H9l-5 4z"/></svg>';
  var box = el('div', 'zs-box'); box.setAttribute('role', 'dialog');
  var head = el('div', 'zs-h'), hw = el('div'), ht = el('b'), hs = el('small'), hx = el('button', 'zs-x', '×'); hx.type = 'button';
  hw.append(ht, hs); head.append(hw, hx);
  var list = el('div', 'zs-log'); list.setAttribute('aria-live', 'polite');
  var quick = el('div', 'zs-q');
  var form = el('form', 'zs-f'), inp = el('input'), sendb = el('button'); inp.type = 'text'; inp.maxLength = 1500; inp.autocomplete = 'off'; sendb.type = 'submit';
  form.append(inp, sendb);
  box.append(head, list, quick, form);
  document.body.append(btn, box);

  function labels() {
    btn.setAttribute('aria-label', tx('btn')); box.setAttribute('aria-label', tx('title'));
    ht.textContent = tx('title'); hs.textContent = tx('sub') + ' '; var pl = el('a', '', tx('priv')); pl.href = 'privacy.html'; pl.target = '_blank'; pl.rel = 'noopener'; pl.style.color = '#DBB577'; hs.appendChild(pl); inp.placeholder = tx('ph'); sendb.textContent = tx('send'); hx.setAttribute('aria-label', tx('close'));
    quick.textContent = '';
    if (!log.some(function (m) { return m.r === 'u'; })) tx('q').forEach(function (q) { var b = el('button', '', q); b.type = 'button'; b.onclick = function () { send(q); }; quick.appendChild(b); });
  }
  function add(role, text) {
    var m = el('div', 'zs-m ' + role, text); list.appendChild(m); list.scrollTop = list.scrollHeight; return m;
  }
  function persist() { store.set(LOG_KEY, JSON.stringify(log.slice(-40))); }
  function draw() {
    list.textContent = '';
    if (!log.length) add('a', tx('hi'));
    log.forEach(function (m) { add(m.r, m.t); });
  }
  var busy = false;
  function send(text) {
    text = String(text || '').trim();
    if (!text || busy) return;
    busy = true; sendb.disabled = true; inp.value = '';
    log.push({ r: 'u', t: text }); persist(); labels(); add('u', text);
    var typ = el('div', 'zs-typ'); typ.append(el('i'), el('i'), el('i')); list.appendChild(typ); list.scrollTop = list.scrollHeight;
    fetch('/api/sales/chat', { method: 'POST', headers: { 'content-type': 'application/json', 'x-zaya': '1' }, body: JSON.stringify({ sid: sid, text: text, lang: lang() }) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { s: r.status, j: j }; }); })
      .then(function (res) {
        typ.remove();
        if (res.s === 503) {
          var m = add('a', tx('off') + ' '); var b = el('button', '', tx('brief')); b.type = 'button';
          b.onclick = function () { close(); var o = document.querySelector('[data-open="brief"]'); if (o) o.click(); };
          m.appendChild(b); return;
        }
        if (!res.j.ok) { add('s', tx('err')); return; }
        log.push({ r: 'a', t: res.j.reply }); add('a', res.j.reply);
        if (res.j.lead) { log.push({ r: 's', t: tx('lead') }); add('s', tx('lead')); }
        persist();
      })
      .catch(function () { typ.remove(); add('s', tx('err')); })
      .then(function () { busy = false; sendb.disabled = false; if (box.classList.contains('open')) inp.focus({ preventScroll: true }); });
  }
  function open() { box.classList.add('open'); btn.setAttribute('aria-expanded', 'true'); draw(); labels(); setTimeout(function () { inp.focus({ preventScroll: true }); }, 60); }
  function close() { box.classList.remove('open'); btn.setAttribute('aria-expanded', 'false'); btn.focus({ preventScroll: true }); }
  btn.onclick = function () { box.classList.contains('open') ? close() : open(); };
  hx.onclick = close;
  form.onsubmit = function (e) { e.preventDefault(); send(inp.value); };
  addEventListener('keydown', function (e) { if (e.key === 'Escape' && box.classList.contains('open')) { e.stopPropagation(); close(); } }, true);
  new MutationObserver(function () { labels(); if (box.classList.contains('open') && !log.length) draw(); }).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
  labels();
  // показываем кнопку, когда закончилось интро
  var shown = false; function show() { if (shown) return; shown = true; btn.classList.add('on'); }
  addEventListener('zaya:ready', show); document.addEventListener('zaya:ready', show);
  setTimeout(function () { if (!document.body.classList.contains('intro-on')) show(); }, 1500);
  setTimeout(show, 9000);
})();
