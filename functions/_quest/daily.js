/* ZAYA — the daily rhythm of the quest in Telegram (3 languages):
     morning  09:00  a quote built around today's task + the task itself
     lounge   13:00  a lunch "lounge": how to rest a little and cheer up (13:00–14:00)
     nudge    14:00  a gentle focus reminder if the task is not done, a compliment if it is done
     night    22:00  good night + a thought about how to do the task (today's, or tomorrow's if today's is done)
   The quotes are original sayings (not quotations of real people). */

export const SLOTS = ['morning', 'lounge', 'nudge', 'night'];
const L = l => (['ru', 'uz', 'en'].includes(l) ? l : 'ru');
const bare = x => String(x || '').replace(/[.。]\s*$/, '');

/* one saying per day of the quest, tied to the task of that day */
const QUOTES = {
  ru: [
    'Путь в тридцать дней начинается с одной записанной цели.',
    'Осанка — это характер, который виден издалека.',
    'Лицо говорит раньше, чем ты откроешь рот.',
    'Каждый шаг — подпись под твоим образом.',
    'Свет не создаёт красоту, он помогает ей проявиться.',
    'Учись у лучших, но оставайся собой.',
    'Неделя — маленькая жизнь: подведи итог и иди дальше.',
    'Поза — это мысль, которую тело произносит без слов.',
    'Руки рассказывают то, что лицо не решилось сказать.',
    'Лучший ракурс тот, который ты знаешь и умеешь повторить.',
    'Простота — высшая форма уверенности.',
    'Грация — это поза, которая не боится двигаться.',
    'Мир вокруг — твоя студия, нужно только выйти.',
    'Прогресс виден, когда сравниваешь себя не с другими, а с собой неделю назад.',
    'Хорошая анкета — первое «здравствуйте» агентству.',
    'Профиль — это витрина: пусть она говорит о тебе красиво.',
    'Пятнадцать секунд честности ценнее минуты притворства.',
    'Тебя запомнят не по длине рассказа, а по уверенности голоса.',
    'Пунктуальность — уважение, которое ценят без слов.',
    'Осторожность — тоже часть профессионализма.',
    'Остановись, оглянись и удивись, какой путь уже пройден.',
    'Чистый образ — чистый лист, на котором видно тебя.',
    'Эмоция, в которую веришь ты, убедит и камеру.',
    'Повторение становится привычкой, а привычка — стилем.',
    'Кто знает, что сказать, не боится вопросов.',
    'Три сильных кадра важнее тридцати случайных.',
    'Отдых — часть работы, а не награда за неё.',
    'Опыт приходит, когда делаешь, а не только готовишься.',
    'Расскажи о себе так, чтобы захотелось с тобой работать.',
    'Конец месяца — только начало твоей истории.',
  ],
  uz: [
    'O‘ttiz kunlik yo‘l bitta yozilgan maqsaddan boshlanadi.',
    'Qomat — uzoqdan ko‘rinadigan xarakter.',
    'Yuz sen og‘zingni ochmasdan oldin gapiradi.',
    'Har bir qadam — obrazing ostidagi imzo.',
    'Yorug‘lik go‘zallikni yaratmaydi, uning namoyon bo‘lishiga yordam beradi.',
    'Eng yaxshilardan o‘rgan, lekin o‘zing bo‘lib qol.',
    'Hafta — kichik hayot: xulosa qil va oldinga yur.',
    'Poza — tana so‘zsiz aytadigan fikr.',
    'Qo‘llar yuz aytishga jur’at etmagan narsani so‘zlaydi.',
    'Eng yaxshi rakurs — o‘zing biladigan va takrorlay oladigan rakurs.',
    'Soddalik — ishonchning eng yuksak shakli.',
    'Nafosat — harakatlanishdan qo‘rqmaydigan poza.',
    'Atrofdagi dunyo — sening studiyang, faqat chiqish kerak.',
    'Progress o‘zingni boshqalar bilan emas, bir hafta oldingi o‘zing bilan solishtirganda ko‘rinadi.',
    'Yaxshi anketa — agentlikka aytilgan birinchi «salom».',
    'Profil — vitrina: u sen haqingda chiroyli gapirsin.',
    'O‘n besh soniyalik samimiylik bir daqiqalik yolg‘ondan qimmat.',
    'Seni hikoyaning uzunligi bilan emas, ovozdagi ishonch bilan eslashadi.',
    'Vaqtida kelish — so‘zsiz qadrlanadigan hurmat.',
    'Ehtiyotkorlik ham kasbiylikning bir qismi.',
    'To‘xta, orqangga qara va qanchalik yo‘l bosib o‘tganingga hayron bo‘l.',
    'Toza obraz — seni ko‘rsatadigan toza varaq.',
    'O‘zing ishongan his kamerani ham ishontiradi.',
    'Takrorlash odatga, odat esa uslubga aylanadi.',
    'Nima deyishni biladigan savollardan qo‘rqmaydi.',
    'Uchta kuchli kadr o‘ttizta tasodifiy kadrdan muhimroq.',
    'Dam olish — ishning bir qismi, uning mukofoti emas.',
    'Tajriba faqat tayyorlanganda emas, qilganda keladi.',
    'O‘zing haqingda shunday gapirki, sen bilan ishlagisi kelsin.',
    'Oyning oxiri — sening hikoyangning faqat boshlanishi.',
  ],
  en: [
    'A thirty-day road begins with one written goal.',
    'Posture is character you can see from afar.',
    'Your face speaks before you open your mouth.',
    'Every step is a signature under your image.',
    'Light does not create beauty, it helps it appear.',
    'Learn from the best, but stay yourself.',
    'A week is a small life: sum it up and move on.',
    'A pose is a thought the body says without words.',
    'Hands tell what the face did not dare to say.',
    'The best angle is the one you know and can repeat.',
    'Simplicity is the highest form of confidence.',
    'Grace is a pose that is not afraid to move.',
    'The world around you is your studio, you only have to step out.',
    'Progress shows when you compare yourself not with others but with you a week ago.',
    'A good profile is your first “hello” to the agency.',
    'A profile is a shop window: let it speak of you beautifully.',
    'Fifteen seconds of honesty beat a minute of pretending.',
    'You are remembered not for the length of the story but for the confidence of the voice.',
    'Punctuality is respect that is valued without words.',
    'Caution is also part of professionalism.',
    'Stop, look back and wonder how far you have already come.',
    'A clean look is a clean page on which you can be seen.',
    'An emotion you believe will convince the camera too.',
    'Repetition becomes a habit, and a habit becomes a style.',
    'Those who know what to say do not fear questions.',
    'Three strong shots matter more than thirty random ones.',
    'Rest is part of the work, not a reward for it.',
    'Experience comes when you do, not only when you prepare.',
    'Tell about yourself so that people want to work with you.',
    'The end of the month is only the beginning of your story.',
  ],
};
export const quoteFor = (day, lang) => (QUOTES[L(lang)][day - 1] || QUOTES[L(lang)][0]);

/* ---- 13:00 lounge: eight ways to rest a little and cheer up, rotating by day ---- */
const LOUNGE = {
  ru: [
    '🌿 Обеденный лаунж\nС 13:00 до 14:00 можно выдохнуть. Выпей воды или чай, отойди от экрана на 10 минут и посмотри в окно вдаль. Расслабленное лицо — тоже часть образа.',
    '☕ Лаунж-пауза\nСделай 5 медленных вдохов: вдох на 4 счёта, выдох на 6. Потяни плечи и шею. Отдыхай без чувства вины: так возвращается энергия для второй половины дня.',
    '🎧 Музыкальная пауза\nВключи любимую музыку на пять минут и просто послушай. Мозгу нужны паузы, чтобы запоминать новое.',
    '🚶 Прогулка для бодрости\nПройдись 10 минут: во дворе, по коридору, по лестнице. Движение бодрит лучше кофе.',
    '🍎 Лёгкий обед\nСъешь что-нибудь лёгкое и вкусное, выпей воды. Без диет и строгостей: тело — твой рабочий инструмент, позаботься о нём.',
    '🧘 Растяжка на 5 минут\nШея, плечи, спина, запястья. Отпусти напряжение, которое копилось с утра.',
    '🌤 Глоток света\nВыйди на свежий воздух, подними лицо к свету и закрой глаза на минуту. Свет — лучший бодрящий подарок.',
    '💧 Перезагрузка\nУмойся прохладной водой, выпей стакан воды и потянись. Пара минут — и голова снова свежая.',
  ],
  uz: [
    '🌿 Tushlik lounji\n13:00 dan 14:00 gacha nafas rostlash mumkin. Suv yoki choy ich, ekrandan 10 daqiqaga uzoqlash va derazadan olisga qara. Bo‘shashgan yuz ham obrazning bir qismi.',
    '☕ Lounj-tanaffus\n5 ta sekin nafas ol: 4 hisobda nafas ol, 6 hisobda chiqar. Yelka va bo‘yinni cho‘z. Aybdorlik hissisiz dam ol: shunda kunning ikkinchi yarmi uchun kuch qaytadi.',
    '🎧 Musiqa tanaffusi\nSevimli musiqangni besh daqiqaga qo‘y va shunchaki tingla. Miyaga yangi narsani eslab qolish uchun tanaffus kerak.',
    '🚶 Tetiklik uchun sayr\n10 daqiqa yur: hovlida, koridorda, zinada. Harakat kofedan ko‘ra yaxshiroq tetiklantiradi.',
    '🍎 Yengil tushlik\nYengil va mazali narsa ye, suv ich. Dietasiz va qattiqqo‘llarsiz: tana — sening ish quroling, unga g‘amxo‘rlik qil.',
    '🧘 5 daqiqalik cho‘zilish\nBo‘yin, yelka, orqa, bilak. Ertalabdan to‘plangan zo‘riqishni qo‘yib yubor.',
    '🌤 Yorug‘lik ho‘plami\nToza havoga chiq, yuzingni yorug‘likka ko‘tar va bir daqiqa ko‘zingni yum. Yorug‘lik — eng yaxshi tetiklantiruvchi sovg‘a.',
    '💧 Qayta yuklash\nSalqin suv bilan yuvin, bir stakan suv ich va cho‘zil. Bir-ikki daqiqa — va bosh yana tiniq.',
  ],
  en: [
    '🌿 Lunch lounge\nFrom 13:00 to 14:00 you can breathe out. Have some water or tea, step away from the screen for 10 minutes and look out of the window into the distance. A relaxed face is part of the look too.',
    '☕ Lounge break\nTake 5 slow breaths: in for 4 counts, out for 6. Stretch your shoulders and neck. Rest without guilt: this is how the energy for the second half of the day comes back.',
    '🎧 Music break\nPut on your favourite music for five minutes and simply listen. The brain needs pauses to remember new things.',
    '🚶 A walk to wake up\nWalk for 10 minutes: in the yard, along the corridor, up the stairs. Movement perks you up better than coffee.',
    '🍎 A light lunch\nHave something light and tasty, drink water. No diets and no strictness: your body is your working instrument, take care of it.',
    '🧘 5 minutes of stretching\nNeck, shoulders, back, wrists. Let go of the tension that has been building since the morning.',
    '🌤 A sip of light\nGo out for fresh air, lift your face to the light and close your eyes for a minute. Light is the best gift for waking up.',
    '💧 A reset\nWash your face with cool water, drink a glass of water and stretch. A couple of minutes and your head is fresh again.',
  ],
};
const LOUNGE_END = {
  ru: 'В 14:00 мягко напомню о задании дня. Сейчас просто отдохни.',
  uz: 'Soat 14:00 da kun topshirig‘ini mayin eslataman. Hozir shunchaki dam ol.',
  en: 'At 14:00 I will gently remind you about the task of the day. For now, simply rest.',
};
export const loungeText = (day, lang) => `${LOUNGE[L(lang)][(day - 1) % LOUNGE.ru.length]}\n\n${LOUNGE_END[L(lang)]}`;

/* ---- 14:00: a focus nudge when not done, a compliment when done ---- */
const NUDGE = {
  ru: (n, t, s) => `⏰ 14:00${n ? ', ' + n : ''}. Мягкое напоминание.\nФокус задания дня: «${t}».\nСделай хотя бы первый шаг: ${s}\nДаже пять минут сегодня — уже прогресс. Отметь выполнение в кабинете: zaya.uz → «Кабинет» → «Квест».`,
  uz: (n, t, s) => `⏰ 14:00${n ? ', ' + n : ''}. Mayin eslatma.\nKun topshirig‘ining fokusi: «${t}».\nKamida birinchi qadamni qil: ${s}\nBugun besh daqiqa ham — allaqachon progress. Bajarilganini kabinetda belgila: zaya.uz → «Kabinet» → «Kvest».`,
  en: (n, t, s) => `⏰ 14:00${n ? ', ' + n : ''}. A gentle reminder.\nThe focus of today’s task: “${t}”.\nTake at least the first step: ${s}\nEven five minutes today is already progress. Mark it as done in the cabinet: zaya.uz → “Cabinet” → “Quest”.`,
};
const COMPLIMENT = {
  ru: [
    (n, t) => `✨ ${n ? n + ', з' : 'З'}адание дня «${t}» выполнено, и это видно: в тебе есть та самая дисциплина, которая отличает настоящих профессионалов.`,
    (n, t) => `🌟 Задание «${t}» выполнено${n ? ', ' + n : ''}. Красиво работаешь: спокойно, шаг за шагом, и именно так строятся большие истории.`,
    (n, t) => `💫 ${n ? n + ', о' : 'О'}тличный ритм! Задание «${t}» уже позади, а значит, ты опережаешь самого себя вчерашнего. Это очень красиво.`,
    (n, t) => `🌷 Поздравляем: «${t}» выполнено. В тебе есть характер и вкус к росту, и камера это обязательно заметит.`,
    (n, t) => `🔥 ${n ? n + ', т' : 'Т'}ак держать! «${t}» выполнено, и серия растёт. Такая настойчивость вдохновляет всю команду ZAYA.`,
    (n, t) => `💎 Сегодня сделан шаг вперёд: «${t}» закрыто. Спокойная уверенность — самая дорогая вещь в профессии.`,
    (n, t) => `🌸 Браво! Задание дня «${t}» закрыто. Ты умеешь доводить дело до конца, а это редкое и очень красивое качество.`,
    (n, t) => `🏆 Сегодняшний вклад в себя сделан: «${t}». Продолжай, и через месяц ты удивишься, как далеко продвинешься.`,
  ],
  uz: [
    (n, t) => `✨ ${n ? n + ', k' : 'K'}un topshirig‘i «${t}» bajarildi, va bu ko‘rinib turibdi: senda haqiqiy professionallarni ajratib turadigan intizom bor.`,
    (n, t) => `🌟 «${t}» topshirig‘i bajarildi${n ? ', ' + n : ''}. Chiroyli ishlayapsan: xotirjam, qadamma-qadam, katta hikoyalar aynan shunday quriladi.`,
    (n, t) => `💫 ${n ? n + ', a' : 'A'}joyib sur’at! «${t}» orqada qoldi, demak, sen kechagi o‘zingdan o‘zib ketding. Bu juda chiroyli.`,
    (n, t) => `🌷 Tabriklaymiz: «${t}» bajarildi. Senda xarakter va o‘sishga ishtiyoq bor, kamera buni albatta sezadi.`,
    (n, t) => `🔥 Shunday davom et! «${t}» bajarildi va seriya o‘syapti. Bunday qat’iyat butun ZAYA jamoasini ilhomlantiradi.`,
    (n, t) => `💎 Bugun oldinga qadam tashlandi: «${t}» yopildi. Xotirjam ishonch — kasbdagi eng qimmat narsa.`,
    (n, t) => `🌸 Bravo! Kun topshirig‘i «${t}» yopildi. Ishni oxiriga yetkazishni bilasan, bu kamyob va juda chiroyli fazilat.`,
    (n, t) => `🏆 Bugungi o‘zingga qo‘shgan hissa tayyor: «${t}». Davom et va bir oydan keyin qanchalik oldinga siljiganingga o‘zing hayron bo‘lasan.`,
  ],
  en: [
    (n, t) => `✨ ${n ? n + ', t' : 'T'}oday’s task “${t}” is done, and it shows: you have exactly the discipline that sets real professionals apart.`,
    (n, t) => `🌟 The task “${t}” is complete${n ? ', ' + n : ''}. You work beautifully: calmly, step by step, and this is how big stories are built.`,
    (n, t) => `💫 ${n ? n + ', w' : 'W'}hat a rhythm! “${t}” is behind you, which means you are ahead of yesterday’s you. That is truly beautiful.`,
    (n, t) => `🌷 Congratulations: “${t}” is done. You have character and a taste for growth, and the camera will notice it.`,
    (n, t) => `🔥 Keep it up! “${t}” is done and the streak is growing. Such persistence inspires the whole ZAYA team.`,
    (n, t) => `💎 A step forward has been made today: “${t}” is closed. Calm confidence is the most valuable thing in the profession.`,
    (n, t) => `🌸 Bravo! Today’s task “${t}” is closed. You know how to see things through, a rare and very beautiful quality.`,
    (n, t) => `🏆 Today’s investment in yourself is made: “${t}”. Keep going, and in a month you will be amazed at how far you have come.`,
  ],
};
export const nudgeText = ({ day, task, done, name, lang }) => {
  const l = L(lang), n = name || '';
  if (done) return COMPLIMENT[l][(day - 1) % COMPLIMENT.ru.length](n, task.title);
  return NUDGE[l](n, task.title, bare(task.steps[0]));
};

/* ---- night: good night and a thought about how to do the task ---- */
const NIGHT = {
  ru: {
    todo: (n, t, s) => `🌙 Спокойной ночи${n ? ', ' + n : ''}.\nЗадание «${t}» сегодня осталось в ожидании, и это нормально: завтра новый день.\nПеред сном подумай: как ты выполнишь его? С какого шага начнёшь: «${s}»? Представь, как это получается у тебя легко и красиво.\nПусть сон будет лёгким, а утро бодрым.`,
    done: (n, t, nx) => `🌙 Спокойной ночи${n ? ', ' + n : ''}.\nЗадание «${t}» сегодня выполнено, это настоящий шаг вперёд. Отдых заслужен.\nПеред сном подумай о завтрашнем: «${nx}». Как ты будешь это делать? Какой будет первый шаг? Пусть мысль уснёт вместе с тобой, а утром всё станет яснее.\nХороших снов.`,
    last: (n, t) => `🌙 Спокойной ночи${n ? ', ' + n : ''}.\nЗадание «${t}» выполнено, а завтра квест подойдёт к финалу. Перед сном подумай: какой следующий месяц ты хочешь для себя? Что хочешь освоить в первую очередь?\nХороших снов.`,
  },
  uz: {
    todo: (n, t, s) => `🌙 Xayrli tun${n ? ', ' + n : ''}.\n«${t}» topshirig‘i bugun kutib qoldi, bu normal: ertaga yangi kun.\nUxlashdan oldin o‘yla: uni qanday bajarasan? Qaysi qadamdan boshlaysan: «${s}»? Bu senda yengil va chiroyli chiqayotganini tasavvur qil.\nUyqung yengil, ertalab esa tetik bo‘lsin.`,
    done: (n, t, nx) => `🌙 Xayrli tun${n ? ', ' + n : ''}.\n«${t}» topshirig‘i bugun bajarildi, bu haqiqiy qadam. Dam olish — sen uchun munosib.\nUxlashdan oldin ertangi topshiriq haqida o‘yla: «${nx}». Buni qanday qilasan? Birinchi qadam nima bo‘ladi? Fikr sen bilan birga uxlasin, ertalab hammasi aniqroq bo‘ladi.\nYaxshi tushlar.`,
    last: (n, t) => `🌙 Xayrli tun${n ? ', ' + n : ''}.\n«${t}» topshirig‘i bajarildi, ertaga esa kvest finalga yetadi. Uxlashdan oldin o‘yla: o‘zing uchun qanday keyingi oyni xohlaysan? Birinchi navbatda nimani o‘rganmoqchisan?\nYaxshi tushlar.`,
  },
  en: {
    todo: (n, t, s) => `🌙 Good night${n ? ', ' + n : ''}.\nThe task “${t}” stayed waiting today, and that is fine: tomorrow is a new day.\nBefore you sleep, think: how will you do it? Which step will you start with: “${s}”? Picture it coming out easily and beautifully.\nMay your sleep be light and your morning bright.`,
    done: (n, t, nx) => `🌙 Good night${n ? ', ' + n : ''}.\nThe task “${t}” is done today, a real step forward. The rest is well deserved.\nBefore you sleep, think about tomorrow’s: “${nx}”. How will you do it? What will the first step be? Let the thought fall asleep with you, and in the morning things will be clearer.\nSweet dreams.`,
    last: (n, t) => `🌙 Good night${n ? ', ' + n : ''}.\nThe task “${t}” is done, and tomorrow the quest reaches its finale. Before you sleep, think: what kind of next month do you want for yourself? What do you want to master first?\nSweet dreams.`,
  },
};
export const nightText = ({ day, task, nextTask, done, name, lang }) => {
  const l = L(lang), n = name || '';
  if (!done) return NIGHT[l].todo(n, task.title, bare(task.steps[0]));
  if (!nextTask) return NIGHT[l].last(n, task.title);
  return NIGHT[l].done(n, task.title, nextTask.title);
};
