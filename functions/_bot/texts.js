/* ZAYA — личный кабинет внутри Telegram-бота: подписи кнопок и тексты (RU/UZ/EN).
   Меню — обычная клавиатура под полем ввода (работает без настройки вебхука), «Выполнено» дублируется
   кнопкой под заданием (inline, нужен allowed_updates: callback_query). */

const LANGS = ['ru', 'uz', 'en'];
const norm = l => (LANGS.includes(l) ? l : 'ru');

const BTN = {
  ru: { task: '📌 Задание дня', done: '✅ Выполнено', prog: '🏆 Прогресс', rules: '📜 Правила', apps: '📄 Мои заявки', chat: '💬 Менеджеру', pause: '⏸ Пауза', resume: '▶️ Продолжить', lang: '🌐 Язык', site: '🖥 Кабинет на сайте', undo: '↩️ Отменить' },
  uz: { task: '📌 Kun topshirig‘i', done: '✅ Bajarildi', prog: '🏆 Natija', rules: '📜 Qoidalar', apps: '📄 Arizalarim', chat: '💬 Menejerga', pause: '⏸ Pauza', resume: '▶️ Davom etish', lang: '🌐 Til', site: '🖥 Saytdagi kabinet', undo: '↩️ Bekor qilish' },
  en: { task: '📌 Task of the day', done: '✅ Done', prog: '🏆 Progress', rules: '📜 Rules', apps: '📄 My applications', chat: '💬 Manager', pause: '⏸ Pause', resume: '▶️ Resume', lang: '🌐 Language', site: '🖥 Website cabinet', undo: '↩️ Undo' },
};
export const LANG_BTN = { 'Русский': 'ru', 'O‘zbekcha': 'uz', 'English': 'en' };

const BY_TEXT = new Map();
for (const l of LANGS) for (const [k, v] of Object.entries(BTN[l])) if (k !== 'undo') BY_TEXT.set(v, k);

/* кнопка меню → действие (task, done, prog, rules, apps, chat, pause, resume, lang, site) или язык (lang:ru …) */
export function actionOf(text) {
  const t = String(text || '').trim();
  if (LANG_BTN[t]) return 'setlang:' + LANG_BTN[t];
  return BY_TEXT.get(t) || null;
}

export function menuKeyboard(lang, st = {}) {
  const b = BTN[norm(lang)];
  const rows = st.quest
    ? [[b.task, b.done], [b.prog, b.rules], [b.apps, b.chat], [st.paused ? b.resume : b.pause, b.lang]]
    : [[b.apps, b.chat], [b.lang, b.site]];
  return { keyboard: rows.map(r => r.map(text => ({ text }))), resize_keyboard: true, is_persistent: true };
}
export const langKeyboard = () => ({ keyboard: [Object.keys(LANG_BTN).map(text => ({ text }))], resize_keyboard: true, one_time_keyboard: true });
export const doneButton = (lang, day, done) => ({ inline_keyboard: [[done
  ? { text: BTN[norm(lang)].undo, callback_data: 'u:' + day }
  : { text: BTN[norm(lang)].done, callback_data: 'd:' + day }]] });

export const BT = {
  ru: {
    menu: n => `ZAYA — ваш личный кабинет${n ? ', ' + n : ''}. Всё нужное под полем ввода: выберите действие.`,
    chatPrompt: 'Напишите сообщение прямо сюда, и оно уйдёт менеджеру ZAYA. Ответ придёт в этот же чат.',
    sent: 'Передано менеджеру ✓ Ответ придёт сюда.',
    noApps: 'Заявок пока нет. Подать анкету или бриф можно на zaya.uz.',
    appsTitle: 'Ваши заявки:',
    kind: { apply: 'Анкета модели', brief: 'Бриф бизнеса' },
    noQuest: 'Квест «30 дней» доступен моделям каталога. Если вы модель и квеста нет, напишите менеджеру.',
    alreadyDone: day => `День ${day} уже отмечен выполненным ✓`,
    doneOk: day => `✅ День ${day} выполнен. Так держать!`,
    finished: 'Квест «30 дней» завершён. Ваш итог ниже.',
    paused: 'Задания на паузе. Вернуть: кнопка «Продолжить».',
    pickLang: 'Выберите язык / Tilni tanlang / Choose a language:',
    langSet: 'Язык изменён: русский.',
    site: 'Кабинет на сайте: https://zaya.uz/#cabinet\nВход по номеру телефона, код придёт сюда, в бот.',
    staff: 'Вы в команде ZAYA. Рабочая панель менеджера: https://zaya.uz/#cabinet',
    managerMsg: t => `💬 Менеджер ZAYA:\n${t}\n\nОтветить можно прямо здесь.`,
    shareToOpen: 'Чтобы открыть личный кабинет в боте (статус заявки, чат с менеджером), нажмите «Поделиться номером» ниже.',
    share: '📱 Поделиться номером',
    limit: 'Слишком много сообщений. Попробуйте позже.',
  },
  uz: {
    menu: n => `ZAYA — shaxsiy kabinetingiz${n ? ', ' + n : ''}. Kerakli narsa hammasi yozuv maydoni ostida: amalni tanlang.`,
    chatPrompt: 'Xabarni shu yerga yozing, u ZAYA menejeriga yetkaziladi. Javob shu chatga keladi.',
    sent: 'Menejerga yuborildi ✓ Javob shu yerga keladi.',
    noApps: 'Hozircha ariza yo‘q. Anketa yoki brifni zaya.uz da yuborishingiz mumkin.',
    appsTitle: 'Arizalaringiz:',
    kind: { apply: 'Model anketasi', brief: 'Biznes brifi' },
    noQuest: '«30 kun» kvesti katalog modellari uchun. Siz model bo‘lsangiz va kvest bo‘lmasa, menejerga yozing.',
    alreadyDone: day => `${day}-kun allaqachon bajarilgan deb belgilangan ✓`,
    doneOk: day => `✅ ${day}-kun bajarildi. Davom eting!`,
    finished: '«30 kun» kvesti yakunlandi. Natijangiz quyida.',
    paused: 'Topshiriqlar pauzada. Qaytarish: «Davom etish» tugmasi.',
    pickLang: 'Выберите язык / Tilni tanlang / Choose a language:',
    langSet: 'Til o‘zgartirildi: o‘zbekcha.',
    site: 'Saytdagi kabinet: https://zaya.uz/#cabinet\nTelefon raqami bilan kirish, kod shu botga keladi.',
    staff: 'Siz ZAYA jamoasidasiz. Menejer paneli: https://zaya.uz/#cabinet',
    managerMsg: t => `💬 ZAYA menejeri:\n${t}\n\nShu yerning o‘zida javob yozishingiz mumkin.`,
    shareToOpen: 'Botdagi shaxsiy kabinetni (ariza holati, menejer bilan chat) ochish uchun pastdagi «Raqamni ulashish» tugmasini bosing.',
    share: '📱 Raqamni ulashish',
    limit: 'Xabarlar juda ko‘p. Keyinroq urinib ko‘ring.',
  },
  en: {
    menu: n => `ZAYA — your personal cabinet${n ? ', ' + n : ''}. Everything you need is under the input field: pick an action.`,
    chatPrompt: 'Write your message right here and it goes to a ZAYA manager. The reply arrives in this chat.',
    sent: 'Passed to the manager ✓ The reply will arrive here.',
    noApps: 'No applications yet. You can submit an application or a brief at zaya.uz.',
    appsTitle: 'Your applications:',
    kind: { apply: 'Model application', brief: 'Business brief' },
    noQuest: 'The “30 days” quest is for the models of the catalog. If you are a model and have no quest, write to the manager.',
    alreadyDone: day => `Day ${day} is already marked as done ✓`,
    doneOk: day => `✅ Day ${day} done. Keep going!`,
    finished: 'The “30 days” quest is complete. Your result is below.',
    paused: 'Tasks are paused. Resume with the “Resume” button.',
    pickLang: 'Выберите язык / Tilni tanlang / Choose a language:',
    langSet: 'Language set: English.',
    site: 'Website cabinet: https://zaya.uz/#cabinet\nSign in with your phone number; the code arrives here in the bot.',
    staff: 'You are on the ZAYA team. Manager panel: https://zaya.uz/#cabinet',
    managerMsg: t => `💬 ZAYA manager:\n${t}\n\nYou can reply right here.`,
    shareToOpen: 'To open your personal cabinet in the bot (application status, chat with the manager), press “Share number” below.',
    share: '📱 Share number',
    limit: 'Too many messages. Please try later.',
  },
};
export const bt = l => BT[norm(l)];
