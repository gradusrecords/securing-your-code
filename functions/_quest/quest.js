/* ZAYA — 30-day quest for models: content and the personalisation engine (pure functions, no I/O).
   The plan is the same 30 days for everybody, but every task is built for the person: the level (experience),
   the directions from the application (shows, photo, ads/video, clips, promo, hosting), gender, age (under 18 = safe variants),
   and gaps in the application (no Instagram, no portfolio). New models get a plan automatically from their sheet row. */

import { D_UZ } from './uz.js';
import { D_EN } from './en.js';

export const TOTAL = 30;
export const TZ_OFFSET_H = 5;   // Asia/Tashkent, no daylight saving

const WEEKS = ['Основа', 'Камера и позы', 'Профессия', 'Кастинг'];
export const LEVELS = [['Новичок', 0], ['Стартер', 60], ['Практик', 150], ['Профи', 260], ['Звезда ZAYA', 380]];

/* base steps + optional personal lines:
   lv.new / lv.mid / lv.pro     — by experience
   dir.<show|photo|ad|clip|promo|host> — by direction in the application (the first one the model has)
   sex.f / sex.m                — by gender
   minor                        — for models under 18 (parents involved)
   flag.noInsta / flag.noPortfolio — gaps in the application */
const D = [
  { t: 'Твоя цель на 30 дней',
    steps: ['Открой заметки в телефоне или возьми блокнот.', 'Запиши одну главную цель на 30 дней (например: «уверенно пройти кастинг» или «собрать портфолио из 10 кадров»).', 'Запиши 3 своих сильных стороны во внешности и в характере.'],
    lv: { new: 'Не знаешь, с чего начать? Напиши просто: «хочу чувствовать себя уверенно перед камерой». Этого достаточно.', pro: 'Добавь цель по результату: сколько съёмок, кастингов или подписчиков хочешь получить к концу месяца.' },
    flag: { noPortfolio: 'В твоей анкете пока нет портфолио, пусть одной из целей станет собрать первое.' } },
  { t: 'Осанка: 5 минут у стены',
    steps: ['Встань спиной к стене: затылок, лопатки, ягодицы и пятки касаются стены.', 'Постой 2 минуты, дыши спокойно: вдох на 4 счёта, выдох на 6.', 'Отойди от стены и сохрани это ощущение: пройдись по комнате минуту.'],
    dir: { show: 'Для показов осанка — основа: представь, что макушку тянет к потолку, а плечи спокойно опущены.', host: 'Для ведущих осанка влияет и на голос: свободная грудная клетка даёт ровное дыхание.' },
    sex: { m: 'Парням: не поднимай плечи к ушам, грудь открыта, подбородок параллельно полу.', f: 'Девушкам: следи, чтобы рёбра не уходили вперёд: живот мягко подтянут, поясница спокойная.' } },
  { t: 'Зеркало: язык лица',
    steps: ['Встань перед зеркалом при дневном свете.', 'Сделай 5 выражений: спокойное лицо, лёгкая улыбка, серьёзный взгляд, улыбка глазами, расслабленное лицо.', 'Каждое держи 5 секунд и замечай, где напряжены лоб, челюсть, губы.'],
    lv: { new: 'Если неловко, начни с 2 минут и просто смотри на себя спокойно, без критики.' },
    dir: { ad: 'Для рекламы и видео добавь ещё два выражения: радость и удивление. Эмоция должна доходить до глаз.', photo: 'Для фото потренируй взгляд «сквозь объектив»: смотри не на экран, а в точку камеры.', clip: 'Для клипов добавь выражение «настроение трека»: мечтательное, дерзкое, нежное.' } },
  { t: 'Походка: первый проход',
    steps: ['Найди ровный отрезок в 8–10 шагов (коридор, двор).', 'Пройди его 5 раз: стопы ставятся почти на одну линию, корпус ровный, руки свободны.', 'Сними один проход на видео (15 секунд) с уровня пояса и посмотри запись.'],
    lv: { pro: 'Сними два варианта (в кроссовках и в туфлях/на каблуке) и сравни, где проход выглядит увереннее.' },
    dir: { show: 'Для показов считай шаги под музыку 100–110 ударов в минуту: в конце пауза и поворот на 3 счёта.', clip: 'Для клипов попробуй три характера: «уверенно», «легко», «с настроением», и выбери самый естественный.', promo: 'Для промо потренируй ходьбу «к гостю»: спокойный шаг, открытый взгляд, лёгкая улыбка.' } },
  { t: 'Свет: окно как студия',
    steps: ['Найди окно с мягким дневным светом.', 'Сделай 3 кадра: лицом к свету, боком к свету, вполоборота (можно попросить близкого).', 'Выбери лучший и запиши одним предложением, почему он лучший.'],
    dir: { photo: 'Для фото ищи кадр, где свет мягко ложится на скулы и нет резких теней под глазами.', ad: 'Для рекламы проверь, как выглядит лицо в ровном свете: он «чистый» и хорошо читается.' } },
  { t: 'Вдохновение: мудборд',
    steps: ['Найди 5 фото моделей, чей стиль тебе близок.', 'К каждому запиши, что именно нравится: поза, свет, образ или настроение.', 'Выбери одну черту, которую хочешь повторить на этой неделе.'],
    dir: { show: 'Загляни в видео с показов (Fashion Week): смотри только на походку и осанку, а не на одежду.', ad: 'Найди 2 рекламных ролика, где актёр играет эмоцию, и отметь момент, когда ему веришь.', clip: 'Найди 2 клипа с хорошей пластикой и посмотри, как артист двигается между кадрами.' } },
  { t: 'Итоги первой недели',
    steps: ['Просмотри свои кадры и видео за неделю.', 'Выбери одно лучшее фото и одно лучшее видео.', 'Запиши: что получилось лучше всего и что хочешь улучшить. Потом отдохни, это часть процесса.'],
    lv: { new: 'Для новичка неделя — уже большой шаг: старт сделан. Отметь это.' } },

  { t: 'Пять базовых поз',
    steps: ['Поза 1: вес на одной ноге, вторая слегка согнута.', 'Поза 2: полуоборот плечом к камере.', 'Поза 3: одна рука в кармане или у пояса.', 'Поза 4: лёгкий шаг вперёд.', 'Поза 5: корпус вполоборота, взгляд через плечо. Сними по одному кадру на каждую позу.'],
    dir: { photo: 'Для фотосъёмок меняй наклон головы на 5–10 градусов: лицо сразу выглядит живее.', ad: 'Для рекламы добавь «рабочую» позу: держишь продукт или телефон естественно, без напряжения.' },
    sex: { m: 'Парням: избегай позы «руки по швам», держи одну руку в движении (карман, ремень, воротник).', f: 'Девушкам: следи за линией талии и бедра, слегка смещай вес, чтобы силуэт не был плоским.' } },
  { t: 'Руки: самое трудное',
    steps: ['Посмотри кадры прошлых дней: где руки выглядят напряжёнными?', 'Потренируй 3 положения: у пояса, у волос или воротника, свободно вдоль тела с мягкими пальцами.', 'Сделай по кадру в каждом и сравни. Пальцы не сжимай и не растопыривай, как будто держишь пёрышко.'],
    dir: { ad: 'Для рекламы потренируй естественные жесты: берёшь предмет, показываешь, улыбаешься.', promo: 'Для промо отработай приветственный жест и «приглашающую» руку.' } },
  { t: 'Лицо: анфас, три четверти, профиль',
    steps: ['Сними лицо в трёх положениях: анфас, три четверти, профиль.', 'В каждом слегка вытяни шею вперёд и вниз (подбородок чуть вперёд, а не вверх).', 'Выбери ракурс, в котором лицо выглядит наиболее собранно.'],
    sex: { m: 'Парням: проверь линию челюсти: чуть вперёд и вниз, без напряжения в шее.' },
    dir: { photo: 'Для фото запиши свой «сильный» ракурс: его ты будешь просить фотографа поймать.' } },
  { t: 'Простой образ из своего гардероба',
    steps: ['Собери образ: однотонный верх и джинсы или брюки.', 'Сними 5 кадров при дневном свете: в полный рост, по пояс, крупно.', 'Отметь, какой цвет тебе идёт больше всего.'],
    dir: { show: 'Для показов проверь, не сковывает ли одежда шаг и повороты.' },
    sex: { m: 'Парням: выбери вещи по фигуре: не слишком мешковатые, но и не обтягивающие.', f: 'Девушкам: выбери базовый цвет (чёрный, белый, беж) и проверь, как он смотрится без аксессуаров.' } },
  { t: 'Движение между позами',
    steps: ['Выбери 3 позы из прошлых дней.', 'Плавно переходи между ними (по 3–4 секунды) в течение минуты.', 'Сними 30 секунд видео и найди, где ты «зависаешь» или торопишься.'],
    lv: { pro: 'Усложни: меняй выражение лица вместе с позой.' },
    dir: { clip: 'Для клипов включи музыку и двигайся в ритме: движение должно выглядеть продолжением трека.', show: 'Для показов добавь «стоп-кадр»: пауза 2 секунды в конце проходки.' } },
  { t: 'Фотопрогулка',
    steps: ['Найди место с красивым фоном: стена, парк, двор.', 'Сними 10 кадров в разных позах, не торопясь.', 'Выбери 3 лучших кадра.'],
    minor: 'Выходи снимать вместе с родителями или со взрослым, которому доверяешь.',
    dir: { photo: 'Для фото проверь, как смотрятся кадры с разных расстояний: крупно, по пояс, в полный рост.' } },
  { t: 'Итоги второй недели',
    steps: ['Положи рядом кадры первой и второй недели: что стало лучше?', 'Выбери 3 лучших кадра.', 'Отправь один любимый кадр менеджеру в чат во вкладке «Чат»: получишь обратную связь.'],
    lv: { new: 'Не сравнивай себя с профессионалами: сравнивай с собой неделю назад.' } },

  { t: 'Анкета в порядке',
    steps: ['Открой вкладку «Профиль» в кабинете.', 'Проверь рост, параметры, размер обуви и контакты: всё ли верно.', 'Добавь в «О себе» 2–3 предложения: чем занимаешься, что любишь, в чём твоя сила как модели.'],
    flag: { noPortfolio: 'Отдельно проверь, прикреплены ли у тебя фото: менеджеру проще, когда в профиле есть свежие кадры.' } },
  { t: 'Instagram глазами менеджера',
    steps: ['Открой свой Instagram и спроси себя: что видно в первые 5 секунд?', 'Проверь шапку профиля: имя, город, способ связи.', 'Выбери 9 лучших кадров для сетки в одной цветовой гамме.'],
    flag: { noInsta: 'В анкете у тебя нет Instagram: создай рабочий профиль и пришли ссылку менеджеру в чат.' },
    minor: 'Профиль ведите вместе с родителями; не публикуй домашний адрес, школу и маршруты.' },
  { t: 'Короткое видео для соцсетей',
    steps: ['Сними видео на 15 секунд: представься, улыбнись, покажи образ.', 'Свет — у окна, звук — в тихой комнате.', 'Посмотри запись и отметь, что тебе нравится в кадре.'],
    dir: { clip: 'Для клипов попробуй версию с музыкой и движением.', ad: 'Для рекламы добавь одну живую эмоцию и улыбку.', promo: 'Для промо покажи, как ты приветствуешь гостей.' } },
  { t: 'Визитка на 30 секунд',
    steps: ['Подготовь текст: имя, возраст, город, чем занимаешься, что любишь.', 'Прочти его вслух три раза; в третий раз без бумажки.', 'Запиши видео: взгляд в камеру, спокойный темп.'],
    lv: { pro: 'Запиши визитку на втором языке (русский, узбекский или английский), если им владеешь.' },
    dir: { host: 'Для ведущих следи за дикцией и паузами, говори чуть медленнее, чем кажется нужным.', ad: 'Добавь улыбку и одну эмоциональную фразу.' } },
  { t: 'Как вести себя на кастинге',
    steps: ['Составь чек-лист: документ, телефон и зарядка, вода, удобная обувь, расчёска, косметичка.', 'Договорись с собой: приходить за 15 минут, при опоздании предупреждать.', 'Запиши в заметки: куда, во сколько, к кому идёшь.'],
    dir: { promo: 'Для промо и шоурума добавь три фразы для общения с гостями и тренируй улыбку.', show: 'Для показов подготовь обувь, в которой ходишь уверенно, и носи с собой запасную пару.' } },
  { t: 'Безопасность в профессии',
    steps: ['Перед подписанием любого договора читай его и задавай вопросы; ничего не подписывай в спешке.', 'Не отправляй посторонним документы и откровенные фото.', 'На новые съёмки приходи с сопровождающим и сообщи менеджеру адрес и время.'],
    minor: 'До 18 лет все встречи и съёмки только с родителем или законным представителем.' },
  { t: 'Итоги третьей недели',
    steps: ['Посмотри, сколько заданий выполнено в кабинете.', 'Выбери одно, к которому хочешь вернуться.', 'Напиши менеджеру в чат одну фразу: что даётся легче всего, а что сложнее.'],
    lv: { pro: 'Предложи менеджеру одну идею для съёмки или проекта: какое направление тебе интереснее всего.' } },

  { t: 'Образ для кастинга',
    steps: ['Подбери нейтральный образ: чёрный или белый, без крупных принтов и логотипов.', 'Волосы убраны или лежат естественно, минимум макияжа, лицо чистое.', 'Сними 3 кадра без фильтров: анфас, профиль, в полный рост. Это цифровые снимки, с них всё начинается.'],
    sex: { m: 'Парням: аккуратная щетина или гладко выбритое лицо, свежая стрижка.', f: 'Девушкам: ровная укладка или собранные волосы, нюдовый макияж.' },
    flag: { noPortfolio: 'В анкете пока нет портфолио: эти кадры станут его основой.' } },
  { t: 'Эмоции для камеры',
    steps: ['Встань перед камерой телефона.', 'Сыграй 5 эмоций по 10 секунд: радость, удивление, уверенность, задумчивость, нежность.', 'Посмотри запись без звука: понятна ли эмоция? Повтори самую слабую.'],
    dir: { ad: 'Для рекламы доведи одну эмоцию до «жизни»: подумай о конкретном воспоминании, оно оживит лицо.', photo: 'Для фото выбери одну эмоцию, с которой лицо выглядит лучше всего, и держи её в серии.' } },
  { t: 'Проходка 2.0',
    steps: ['Сделай проходку: 5 шагов к камере, остановка, поворот, 5 шагов обратно.', 'Сними видео сбоку и спереди.', 'Сравни с записью четвёртого дня: что изменилось?'],
    lv: { new: 'Если трудно, положи на пол ориентиры и ходи по ним, пока не станет привычно.' },
    dir: { show: 'Для показов отработай темп, остановку и поворот на 3 счёта ещё 10 минут.', promo: 'Для промо потренируй «выход к гостю»: шаг, улыбка, «Здравствуйте».', clip: 'Для клипов добавь характер: пройди проходку в роли героя клипа.' } },
  { t: 'Вопросы на кастинге',
    steps: ['Ответь вслух на 5 вопросов: расскажи о себе; почему хочешь работать моделью; что умеешь; где видишь себя через год; почему стоит выбрать именно тебя.', 'Запиши ответы на диктофон и послушай.', 'Сократи каждый ответ до 20–30 секунд.'],
    dir: { host: 'Для ведущих добавь один ответ в формате мини-выступления: начало, мысль, вывод.' } },
  { t: 'Три кадра для портфолио',
    steps: ['Сними 3 кадра при дневном свете: крупно лицо, по пояс, в полный рост.', 'Без сильных фильтров и ретуши.', 'Загрузи их в «Профиль → Фото» или пришли менеджеру в чат.'],
    flag: { noPortfolio: 'Пока портфолио нет, это самые важные кадры месяца, постарайся.' },
    dir: { photo: 'Для фото добавь один «характерный» кадр: свой образ, свою позу, своё настроение.' } },
  { t: 'Ресурс и самоуход',
    steps: ['Режим: 7–8 часов сна, вода в течение дня.', 'Простая рутина для кожи и волос утром и вечером.', 'Прогулка 30 минут или лёгкая растяжка. Без жёстких диет: если вес и питание тебя тревожат, поговори с врачом, а не с интернетом.'],
    dir: { show: 'Для показов добавь упражнения на спину и ноги: растяжка помогает держать линию.' } },
  { t: 'Мини-съёмка',
    steps: ['Договорись с другом, подругой или родственником и сними 10 кадров на тему «городской образ».', 'Используй всё, что узнала: свет, позы, руки, эмоции.', 'Выбери 3 лучших и сравни с кадрами пятого дня.'],
    minor: 'Съёмка только в присутствии родителя.',
    dir: { clip: 'Для клипов сними ещё и 20 секунд движения в кадре.' } },
  { t: 'Видеовизитка',
    steps: ['Запиши 45 секунд: имя, город, опыт, что тебе интересно (показы, фото, реклама), приглашение к работе.', 'Свет у окна, спокойный фон, взгляд в камеру.', 'Отправь менеджеру в чат: это можно использовать для заявки на проект.'],
    dir: { host: 'Для ведущих покажи голос: пара предложений в «рабочем» тоне.' } },
  { t: 'Финал и план на следующий месяц',
    steps: ['Посмотри свои кадры первого дня и сегодняшние.', 'Запиши 3 достижения за месяц.', 'Поставь цель на следующий месяц и напиши менеджеру в чат: обсудите план.'],
    lv: { new: 'Путь от «не знаю, с чего начать» до первых кадров и видео — настоящий результат.', pro: 'Ты можешь собрать мини-презентацию: лучшие кадры, видеовизитка и цели, и показать её менеджеру.' } },
];

/* ---------- profile analysis ---------- */
const DIR_ORDER = ['show', 'photo', 'ad', 'clip', 'promo', 'host'];
const DIR_LABEL = { show: 'показы', photo: 'фотосъёмки', ad: 'реклама и видео', clip: 'клипы', promo: 'шоурум и промо', host: 'ведение' };
const SURNAME = /(ов|ова|ев|ева|ёв|ёва|ин|ина|ын|ына|ский|ская|ян|янц|иди|дзе|ко|ук|юк|ич|ой|ых|ова|ева)$/i;
const SHORT_SURNAMES = new Set(['ким', 'пак', 'цой', 'хан', 'сон', 'ли', 'нам']);
const looksSurname = w => SHORT_SURNAMES.has(w.toLowerCase()) || SURNAME.test(w);

/* the first name out of "Name Surname" or "Surname Name" (the sheet has both); empty when unsure */
export function firstName(full) {
  const p = String(full || '').trim().split(/\s+/).filter(Boolean);
  if (!p.length) return '';
  if (p.length === 1) return p[0];
  let n = p[0];
  if (/^[A-Za-z’'‘`-]+$/.test(p[0]) && /^[A-Za-z’'‘`-]+$/.test(p[1])) return p[0];   // Latin names are written "Name Surname"
  if (looksSurname(p[0]) && !looksSurname(p[1])) n = p[1];
  return n.replace(/[^\p{L}’'-]/gu, '');
}

export function profileOf(user, payload = {}) {
  const p = payload || {}, pr = (user && user.profile) || {};
  const age = parseInt(p.age, 10) || 0;
  const g = String(p.gender || '').toLowerCase();
  const exp = String(p.exp || '').toLowerCase();
  const level = !exp || /нет/.test(exp) ? 'new' : /до 1|менее|есть/.test(exp) ? 'mid' : /1\s*[–-]\s*3|больше|более|\d/.test(exp) ? 'pro' : 'mid';
  const dtext = String(p.dirs || '').toLowerCase();
  const dirs = [];
  const add = k => { if (!dirs.includes(k)) dirs.push(k); };
  for (const part of dtext.split(/[,;]+/)) {
    if (/показ/.test(part)) add('show');
    if (/фото/.test(part)) add('photo');
    if (/реклам|видео/.test(part)) add('ad');
    if (/клип/.test(part)) add('clip');
    if (/шоурум|промо/.test(part)) add('promo');
    if (/ведущ|ведени/.test(part)) add('host');
  }
  const name = firstName((user && user.name) || p.name);
  return {
    name,
    gender: /жен/.test(g) ? 'f' : /муж/.test(g) ? 'm' : '',
    age, minor: (age > 0 && age < 18) || /детск/.test(String(p.sheet_status || '').toLowerCase()),
    level, dirs,
    noInsta: !(p.instagram || pr.instagram),
    noPortfolio: !(p.portfolio && !/нет|еще нет|ещё нет/i.test(p.portfolio)),
  };
}

export const LANGS = ['ru', 'uz', 'en'];
export const normLang = l => (LANGS.includes(String(l || '').toLowerCase()) ? String(l).toLowerCase() : 'ru');
const PLANS = { ru: D, uz: D_UZ, en: D_EN };

/* texts around the tasks, in the three site languages */
const S = {
  ru: {
    weeks: WEEKS, levels: LEVELS.map(l => l[0]), dirs: DIR_LABEL, lv: { new: 'без опыта', mid: 'опыт до года', pro: 'есть опыт (от года)' }, noDirs: 'направления не указаны',
    tuned: (lv, ds) => `Задания подобраны по твоей анкете: уровень — ${lv}; направления — ${ds}.`,
    forYou: 'Для тебя', day: 'День', of: 'из', morning: n => `☀️ Доброе утро${n ? ', ' + n : ''}!`,
    missed: n => `Невыполненных заданий: ${n}. Их можно закрыть в любой день.`,
    mark: 'Отметь выполнение в кабинете: zaya.uz → «Кабинет» → «Квест».', stop: 'Остановить задания: /stop',
    fin: (n, d, pts, lv) => `🎉 Квест «30 дней» завершён${n ? ', ' + n : ''}!\nВыполнено заданий: ${d} из ${TOTAL}. Очки: ${pts}. Уровень: ${lv}.\n\nНапиши менеджеру в чат кабинета: обсудим следующий шаг и твой план на месяц.`,
    principle: 'Каждый день узнавать что-то новое — это уже прогресс. Правила игры: /rules, твой прогресс: /progress.',
    enroll: '🎯 Для вас открыт квест «30 дней»: каждое утро — новое задание, подобранное под вашу анкету.',
    stopped: 'Задания остановлены. Вернуть их: /quest', resumed: 'Квест продолжается. Следующее задание придёт утром.', noQuest: 'Квест доступен моделям после входа в кабинет на zaya.uz.',
  },
  uz: {
    weeks: ['Asos', 'Kamera va pozalar', 'Kasb', 'Kasting'], levels: ['Boshlovchi', 'Starter', 'Amaliyotchi', 'Pro', 'ZAYA yulduzi'],
    dirs: { show: 'namoyishlar', photo: 'fotosyomka', ad: 'reklama va video', clip: 'klip', promo: 'shourum va promo', host: 'boshlovchilik' },
    lv: { new: 'tajribasiz', mid: 'tajriba bir yilgacha', pro: 'tajriba bor (bir yildan)' }, noDirs: 'yo‘nalishlar ko‘rsatilmagan',
    tuned: (lv, ds) => `Topshiriqlar anketang bo‘yicha tanlangan: daraja — ${lv}; yo‘nalishlar — ${ds}.`,
    forYou: 'Siz uchun', day: 'Kun', of: '/', morning: n => `☀️ Xayrli tong${n ? ', ' + n : ''}!`,
    missed: n => `Bajarilmagan topshiriqlar: ${n}. Ularni istalgan kuni yopishing mumkin.`,
    mark: 'Bajarilganini kabinetda belgila: zaya.uz → «Kabinet» → «Kvest».', stop: 'Topshiriqlarni to‘xtatish: /stop',
    fin: (n, d, pts, lv) => `🎉 «30 kun» kvesti yakunlandi${n ? ', ' + n : ''}!\nBajarilgan topshiriqlar: ${d} / ${TOTAL}. Ball: ${pts}. Daraja: ${lv}.\n\nKabinet chatida menejerga yoz: keyingi qadam va bir oylik rejangni muhokama qilamiz.`,
    principle: 'Har kuni yangi narsa o‘rganish — bu allaqachon progress. O‘yin qoidalari: /rules, progressing: /progress.',
    enroll: '🎯 Siz uchun «30 kun» kvesti ochildi: har kuni ertalab anketangga mos yangi topshiriq.',
    stopped: 'Topshiriqlar to‘xtatildi. Qaytarish: /quest', resumed: 'Kvest davom etadi. Keyingi topshiriq ertalab keladi.', noQuest: 'Kvest kabinetga kirgandan keyin modellar uchun ochiladi (zaya.uz).',
  },
  en: {
    weeks: ['Foundation', 'Camera and poses', 'Profession', 'Casting'], levels: ['Rookie', 'Starter', 'Practitioner', 'Pro', 'ZAYA Star'],
    dirs: { show: 'runway', photo: 'photo shoots', ad: 'ads and video', clip: 'music videos', promo: 'showroom and promo', host: 'hosting' },
    lv: { new: 'no experience', mid: 'under a year of experience', pro: 'experienced (a year or more)' }, noDirs: 'no directions listed',
    tuned: (lv, ds) => `The tasks are built from your application: level — ${lv}; directions — ${ds}.`,
    forYou: 'For you', day: 'Day', of: 'of', morning: n => `☀️ Good morning${n ? ', ' + n : ''}!`,
    missed: n => `Tasks not yet done: ${n}. You can catch up any day.`,
    mark: 'Mark it as done in the cabinet: zaya.uz → “Cabinet” → “Quest”.', stop: 'Pause the tasks: /stop',
    fin: (n, d, pts, lv) => `🎉 The “30 days” quest is complete${n ? ', ' + n : ''}!\nTasks done: ${d} of ${TOTAL}. Points: ${pts}. Level: ${lv}.\n\nWrite to the manager in the cabinet chat: we will discuss your next step and your plan for the month.`,
    principle: 'Learning something new every day is already progress. The rules of the game: /rules, your progress: /progress.',
    enroll: '🎯 The “30 days” quest is open for you: a new task every morning, built from your application.',
    stopped: 'Tasks paused. Resume them with /quest', resumed: 'The quest goes on. The next task arrives in the morning.', noQuest: 'The quest opens for models after logging in to the cabinet at zaya.uz.',
  },
};
export const msgs = lang => S[normLang(lang)];

export function describeProfile(pf, lang = 'ru') {
  const x = S[normLang(lang)];
  return { level: x.lv[pf.level], dirs: pf.dirs.length ? pf.dirs.map(d => x.dirs[d]).join(', ') : x.noDirs };
}

/* ---------- one task for one person ---------- */
export function taskFor(day, pf, lang = 'ru') {
  lang = normLang(lang);
  const d = PLANS[lang][day - 1], x = S[lang];
  if (!d) return null;
  const extras = [];
  if (day === 1) { const z = describeProfile(pf, lang); extras.push(x.tuned(z.level, z.dirs)); }
  if (d.lv && d.lv[pf.level]) extras.push(d.lv[pf.level]);
  if (d.dir) { const k = (pf.dirs.length ? pf.dirs : DIR_ORDER).find(q => d.dir[q]); if (k) extras.push(d.dir[k]); }
  if (d.sex && pf.gender && d.sex[pf.gender]) extras.push(d.sex[pf.gender]);
  if (pf.minor && d.minor) extras.push('👪 ' + d.minor);
  if (d.flag) {
    if (pf.noInsta && d.flag.noInsta) extras.push(d.flag.noInsta);
    if (pf.noPortfolio && d.flag.noPortfolio) extras.push(d.flag.noPortfolio);
  }
  return { day, week: Math.ceil(day / 7), theme: x.weeks[Math.min(3, Math.floor((day - 1) / 7))], title: d.t, steps: d.steps.slice(), extras, final: day === TOTAL };
}

export function taskText(task, pf, opts = {}) {
  const x = S[normLang(opts.lang)];
  const hi = opts.morning ? `${x.morning(pf.name)}\n` : '';
  const qt = opts.quote ? `✨ «${opts.quote}»\n\n` : '';
  const lines = [`${hi}${qt}${x.day} ${task.day} ${x.of} ${TOTAL} · ${task.theme}`, '', task.title, ''];
  task.steps.forEach((s, i) => lines.push(`${i + 1}. ${s}`));
  if (task.extras.length) { lines.push('', `✨ ${x.forYou}:`); task.extras.forEach(e => lines.push('• ' + e)); }
  if (opts.missed > 1) lines.push('', x.missed(opts.missed));
  lines.push('', x.mark, x.stop);
  return lines.join('\n');
}

export function finalText(pf, st, lang = 'ru') {
  const x = S[normLang(lang)];
  return x.fin(pf.name, st.doneCount, st.points, x.levels[st.levelIdx]);
}

/* ---------- the rules of the game and the warnings (3 languages) ---------- */
/* Honest framing: the quest is a real professional path, activity is seen by the managers, and the team decides about cooperation.
   No concrete promises (jobs, money, ranks) are made: the rules say they will be added along the way. */
const RULES = {
  ru: { title: 'Как устроена игра', blocks: [
    { h: 'Главная идея', t: 'Каждый день ты узнаёшь что-то новое о профессии. Даже маленький шаг — уже прогресс. Квест — это не игра ради очков, а твой настоящий путь модели: то, что ты тренируешь здесь, пригодится на кастингах и съёмках.' },
    { h: 'Уровни — это рост', t: 'Новичок → Стартер → Практик → Профи → Звезда ZAYA. Уровень показывает, насколько ты вошёл(ла) в профессию. Менеджеры агентства видят твой уровень, серию дней и заметки.' },
    { h: 'Что мы ждём', t: 'Выполняй задания каждый день, а если пропустил(а), наверстай. Пиши заметки: так видно, что ты действительно работаешь. Приходи вовремя, предупреждай, если не можешь, и будь вежлив(а) с менеджерами и другими моделями.' },
    { h: 'Если ты пропадаешь', t: 'Нет активности 3 дня — мы напомним. 7 дней — менеджер свяжется лично. 14 дней и больше без причины — агентство может прекратить сотрудничество. Если есть причина (болезнь, учёба, экзамены), просто напиши менеджеру в чат кабинета: мы пойдём навстречу.' },
    { h: 'Недобросовестное поведение', t: 'Невыполнение договорённостей, срыв съёмок или кастингов, грубость и обман — основание для прекращения сотрудничества. Решение принимает команда ZAYA.' },
    { h: 'Игра будет расти', t: 'Мы развиваемся вместе с вами. Новые возможности и правила будут появляться по ходу игры, и мы сообщим о них заранее.' },
  ] },
  uz: { title: 'O‘yin qanday ishlaydi', blocks: [
    { h: 'Asosiy g‘oya', t: 'Har kuni kasb haqida yangi narsa o‘rganasan. Hatto kichik qadam ham — progress. Kvest ball uchun o‘yin emas, sening haqiqiy model yo‘ling: bu yerda mashq qilganing kastinglar va syomkalarda asqotadi.' },
    { h: 'Darajalar — o‘sish', t: 'Boshlovchi → Starter → Amaliyotchi → Pro → ZAYA yulduzi. Daraja kasbga qanchalik kirib borganingni ko‘rsatadi. Agentlik menejerlari darajangni, ketma-ket kunlarni va eslatmalaringni ko‘radi.' },
    { h: 'Biz nimani kutamiz', t: 'Topshiriqlarni har kuni bajar, o‘tkazib yuborsang, yetib ol. Eslatma yoz: shunda haqiqatan ishlayotganing ko‘rinadi. O‘z vaqtida kel, kela olmasang ogohlantir, menejerlar va boshqa modellar bilan hurmat bilan muloqot qil.' },
    { h: 'Agar yo‘qolib qolsang', t: '3 kun faolsizlik — eslatamiz. 7 kun — menejer shaxsan bog‘lanadi. Sababsiz 14 kun va undan ko‘p — agentlik hamkorlikni to‘xtatishi mumkin. Sabab bo‘lsa (kasallik, o‘qish, imtihon), kabinet chatida menejerga yoz: kelishamiz.' },
    { h: 'Insofsiz xatti-harakat', t: 'Kelishuvlarni bajarmaslik, syomka yoki kastingni buzish, qo‘pollik va aldov — hamkorlikni to‘xtatish uchun asos. Qarorni ZAYA jamoasi qabul qiladi.' },
    { h: 'O‘yin o‘sib boradi', t: 'Biz siz bilan birga rivojlanamiz. Yangi imkoniyatlar va qoidalar o‘yin davomida paydo bo‘ladi, ular haqida oldindan xabar beramiz.' },
  ] },
  en: { title: 'How the game works', blocks: [
    { h: 'The main idea', t: 'Every day you learn something new about the profession. Even a small step is progress. The quest is not a game for points, it is your real path as a model: what you practise here will help you at castings and shoots.' },
    { h: 'Levels are growth', t: 'Rookie → Starter → Practitioner → Pro → ZAYA Star. Your level shows how far into the profession you have come. The agency managers see your level, your streak and your notes.' },
    { h: 'What we expect', t: 'Do the tasks every day, and if you miss one, catch up. Write notes: it shows that you really work. Arrive on time, warn us if you cannot, and be polite to the managers and the other models.' },
    { h: 'If you disappear', t: 'No activity for 3 days: we will remind you. 7 days: a manager will contact you personally. 14 days or more without a reason: the agency may end the cooperation. If there is a reason (illness, studies, exams), just write to the manager in the cabinet chat: we will meet you halfway.' },
    { h: 'Unfair conduct', t: 'Breaking agreements, missing shoots or castings, rudeness and deceit are grounds for ending the cooperation. The ZAYA team makes the decision.' },
    { h: 'The game will grow', t: 'We are growing together with you. New opportunities and rules will appear along the way, and we will tell you about them in advance.' },
  ] },
};
const MEANING = {
  ru: ['Первые шаги', 'Привычка закреплена', 'Уверенная практика', 'Готовность к проектам', 'Пример для других'],
  uz: ['Birinchi qadamlar', 'Odat mustahkamlandi', 'Ishonchli amaliyot', 'Loyihalarga tayyorlik', 'Boshqalar uchun namuna'],
  en: ['First steps', 'The habit is set', 'Confident practice', 'Ready for projects', 'An example for others'],
};
export const rulesOf = lang => ({ ...RULES[normLang(lang)], meaning: MEANING[normLang(lang)] });
export const rulesText = lang => {
  const r = RULES[normLang(lang)], m = MEANING[normLang(lang)], x = S[normLang(lang)];
  return [`📘 ${r.title}`, '', ...r.blocks.flatMap(b => [`${b.h}`, b.t, '']), x.levels.map((l, i) => `${i + 1}. ${l}: ${m[i]}`).join('\n')].join('\n');
};
/* inactivity warnings: what a model receives after 3, 7 and 14 idle days */
export const WARN_DAYS = [3, 7, 14];
const WARN = {
  ru: { 3: n => `${n ? n + ', м' : 'М'}ы заметили, что тебя не было в квесте 3 дня. Один небольшой шаг сегодня вернёт ритм: открой задание в кабинете. Если что-то мешает, напиши менеджеру.`,
        7: n => `${n ? n + ', т' : 'Т'}ебя нет в квесте уже 7 дней, и менеджер свяжется с тобой. Помни: каждый день узнавать что-то новое — это и есть прогресс в профессии. Если есть причина, напиши в чат кабинета.`,
        14: n => `${n ? n + ', у' : 'У'}же 14 дней без активности. Если мы не получим ответа, агентство может прекратить сотрудничество. Напиши менеджеру в чат кабинета, чтобы договориться.` },
  uz: { 3: n => `${n ? n + ', ' : ''}sen kvestda 3 kun ko‘rinmading. Bugun bitta kichik qadam ritmni qaytaradi: kabinetdagi topshiriqni och. Nimadir xalaqit bersa, menejerga yoz.`,
        7: n => `${n ? n + ', ' : ''}sen kvestda 7 kundan beri yo‘qsan, menejer sen bilan bog‘lanadi. Esda tut: har kuni yangi narsa o‘rganish — kasbdagi progressning o‘zi. Sabab bo‘lsa, kabinet chatiga yoz.`,
        14: n => `${n ? n + ', ' : ''}14 kundan beri faollik yo‘q. Javob olmasak, agentlik hamkorlikni to‘xtatishi mumkin. Kelishish uchun kabinet chatida menejerga yoz.` },
  en: { 3: n => `${n ? n + ', w' : 'W'}e noticed you have been away from the quest for 3 days. One small step today will bring the rhythm back: open the task in the cabinet. If something is in the way, write to the manager.`,
        7: n => `${n ? n + ', y' : 'Y'}ou have been away from the quest for 7 days, and a manager will contact you. Remember: learning something new every day is progress in the profession. If there is a reason, write in the cabinet chat.`,
        14: n => `${n ? n + ', i' : 'I'}t has been 14 days without activity. If we get no reply, the agency may end the cooperation. Write to the manager in the cabinet chat so we can agree on a way forward.` },
};
export const warnText = (days, name, lang) => WARN[normLang(lang)][days](name);
export const staffRiskText = (name, phone, idle, days) => `⚠️ ${name || '+' + phone} (+${phone}): нет активности в квесте ${idle} дн.` + (days >= 14 ? ' Модель получила последнее предупреждение. Рекомендуем связаться: решение о сотрудничестве за вами.' : days >= 7 ? ' Модель предупреждена, нужен личный контакт менеджера.' : '');
export function progressText(pf, st, day, lang) {
  const x = S[normLang(lang)], m = MEANING[normLang(lang)];
  const nx = st.nextAt != null ? `\n${st.nextAt - st.points} → ${x.levels[st.levelIdx + 1]}` : '';
  return `${x.day} ${day} ${x.of} ${TOTAL}\n⭐ ${st.points} · ${x.levels[st.levelIdx]} (${m[st.levelIdx]})\n🔥 ${st.streak} · ✓ ${st.doneCount}/${TOTAL}${nx}`;
}

/* ---------- one-off announcements to all the catalog models (sent by the morning run from the given date, once per person) ---------- */
export const ANNOUNCEMENTS = [{ id: 'participation-1', date: '2026-11-06' }];
const ANN = {
  'participation-1': {
    ru: n => `Доброе утро${n ? ', ' + n : ''}! 🤍 Важное от команды ZAYA.\n\nСейчас от тебя требуется одно: активное участие в проектах агентства. Отвечай менеджерам, приходи на кастинги и съёмки, выполняй задания квеста каждый день. Именно это помогает достигать большого успеха, и мы рядом на каждом шаге.`,
    uz: n => `Xayrli tong${n ? ', ' + n : ''}! 🤍 ZAYA jamoasidan muhim xabar.\n\nHozir sendan bitta narsa talab qilinadi: agentlik loyihalarida faol ishtirok etish. Menejerlarga javob ber, kasting va syomkalarga kel, kvest topshiriqlarini har kuni bajar. Aynan shu katta muvaffaqiyatga erishishga yordam beradi, biz har qadamda yoningdamiz.`,
    en: n => `Good morning${n ? ', ' + n : ''}! 🤍 An important note from the ZAYA team.\n\nRight now we ask one thing of you: active participation in the agency’s projects. Reply to the managers, come to castings and shoots, do the quest tasks every day. This is what helps you reach great success, and we are with you every step of the way.`,
  },
};
export const announceText = (id, name, lang) => ANN[id][normLang(lang)](name);

/* ---------- progress ---------- */
export function pointsOf(done) {
  const s = new Set(done);
  let pts = s.size * 10;
  for (let w = 1; w <= 4; w++) { let all = true; for (let d = 7 * w - 6; d <= 7 * w; d++) if (!s.has(d)) all = false; if (all) pts += 20; }
  if (s.size >= TOTAL) pts += 50;
  // streak bonus: +50 for every 5 days in a row (a run of 10 gives 100, a run of 5 + a break + 5 gives 100)
  let run = 0;
  for (let d = 1; d <= TOTAL + 1; d++) {
    if (s.has(d)) run++;
    else { pts += Math.floor(run / 5) * 50; run = 0; }
  }
  return pts;
}
export function levelOf(pts) { let i = 0; LEVELS.forEach((l, k) => { if (pts >= l[1]) i = k; }); return i; }
export function streakOf(done, day) {
  const s = new Set(done);
  let d = s.has(day) ? day : day - 1, n = 0;
  while (d >= 1 && s.has(d)) { n++; d--; }
  return n;
}
export function progressOf(done, day) {
  const pts = pointsOf(done), li = levelOf(pts);
  return { doneCount: new Set(done).size, points: pts, levelIdx: li, level: LEVELS[li][0], nextAt: LEVELS[li + 1] ? LEVELS[li + 1][1] : null, streak: streakOf(done, day) };
}

/* ---------- Tashkent calendar ---------- */
export const todayYmd = (ms = Date.now()) => new Date(ms + TZ_OFFSET_H * 3600e3).toISOString().slice(0, 10);
export function dayNumber(startYmd, nowYmd = todayYmd()) {
  const a = Date.parse(startYmd + 'T00:00:00Z'), b = Date.parse(nowYmd + 'T00:00:00Z');
  return Math.floor((b - a) / 86400e3) + 1;
}
