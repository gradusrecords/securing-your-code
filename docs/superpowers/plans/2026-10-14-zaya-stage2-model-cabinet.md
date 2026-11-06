# ZAYA — Этап 2: кабинет модели Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Модель заполняет анкету с фото, ежедневно получает и выполняет задания «Развития» (очки, ранги, серия дней, значки) и видит разосланные ей заказы с возможностью подтвердить, отказаться или задать вопрос менеджеру.

**Architecture:** Логика «Развития» и ответов на заказы живёт в базе в виде функций (`get_today_tasks`, `complete_task`, `my_progress`, `respond_to_order`, `ask_question`), которые сами проверяют права; приложение только вызывает их через тонкие сервисы. Заказы читаются моделью через представление `model_order_cards` без данных заказчика. Фото лежат в приватном бакете Storage по пути `<model_id>/<file>`.

**Tech Stack:** как в этапе 1 (Expo, TypeScript, Supabase, Jest, pgTAP) плюс expo-image-picker.

**Spec:** `docs/superpowers/specs/2026-10-14-zaya-app-design.md` (разделы 4, 5, 6, 7 «Модель», 9, 10, 11 — этап 2). Предыдущий этап: `docs/superpowers/plans/2026-10-14-zaya-stage1-core.md` (выполнен; журнал результатов в git).

## Global Constraints

- Роли и изоляция как в этапе 1: модель не видит заказчика (ни названия компании, ни секцию `contact` брифа), других моделей и их контакты; бизнесмен фото моделей читает только у опубликованных.
- Ранги (по сумме очков): Новичок → Восходящая звезда → Лицо ZAYA → Икона ZAYA; пороги настраиваются суперадмином (таблица `ranks`). Значки: серия 3, 7, 14, 30 дней подряд; первое задание; полная неделя.
- Ежедневно 1–3 задания на модель; день считается по часовому поясу `Asia/Tashkent`.
- Бриф заказа: секции project, when_where, who, conditions, requirements, contact; гонорар в бриф не входит.
- Моделям до 18 лет обязательны данные родителя или опекуна.
- Языки RU, UZ, EN; тексты заданий хранятся как `jsonb` `{ru, uz, en}`, при отсутствии перевода показывается `ru`.
- Секреты не коммитятся; существующие файлы Juice Shop не изменяются; код в `mobile/` и `supabase/`.
- Тесты базы: `bash supabase/tests/run.sh` (или `supabase test db`); тесты приложения: `npm test --prefix mobile`.

## Review Focus

1. Граница дня по Ташкенту: выполнение в 00:10 по Ташкенту следующего дня продолжает серию, два выполнения в один день серию не удваивают (Задача 1).
2. Повторное выполнение того же задания не начисляет очки дважды; чужое задание выполнить нельзя (Задача 1).
3. Заказ с изменённой версией: у модели ответ получает статус `needs_reconfirm`, карточка помечена «Обновлён», повторный ответ обновляет запись, а не дублирует (Задача 2).
4. В карточке заказа для модели нет секции `contact`, названия компании и ничего о бизнесмене; не получатель заказ не видит; неодобренная модель получает пустой список (Задача 2).
5. Анкета несовершеннолетней модели без данных родителя отклоняется и в приложении, и в базе (Задачи 3–4).
6. Поведение без сети: сохранение анкеты и выполнение задания при ошибке показывают сообщение и не помечают действие выполненным (Задачи 5–6).

---

**Порядок выполнения:** Задачи идут по номерам, но миграции применяются по имени файла (0004 → 0005 → 0006); Задача 3 (миграция 0004) не зависит от Задач 1–2, поэтому порядок задач и миграций не конфликтует.

## File Structure

```
supabase/migrations/
  0004_card_rules_and_photos.sql    проверка возраста/родителя, бакет model-photos и политики
  0005_development.sql              dev_tasks, assignments, ranks, badges, функции
  0006_orders_model_side.sql        orders*, questions, model_order_cards, respond_to_order, ask_question
supabase/seed/dev_content.sql       30 заданий (RU), ранги, значки
supabase/tests/
  0004_card_rules.test.sql, 0005_development.test.sql, 0006_orders.test.sql, 0007_seed.test.sql
  _bootstrap.sql                    (изменить) заглушка схемы storage
mobile/src/
  models/modelCard.ts               типы + validateModelCard
  services/modelCardService.ts      getMyCard, saveMyCard, uploadPhoto
  services/developmentService.ts    getTodayTasks, completeTask, getProgress
  services/ordersService.ts         listMyOrders, respond, askQuestion, groupOrders
mobile/app/(model)/profile.tsx, development.tsx, orders.tsx, orders/[id].tsx
mobile/__tests__/modelCard.test.ts, modelCardService.test.ts, developmentService.test.ts, ordersService.test.ts
```

---

### Task 1: Развитие — таблицы, функции, ранги и значки в базе

**Files:**
- Create: `supabase/migrations/0005_development.sql`
- Test: `supabase/tests/0005_development.test.sql`

**Interfaces:**
- Consumes: `public.profiles`, `public.model_profiles(status)`, `public.my_role()`, `public.is_admin()`.
- Produces:
  - `public.dev_tasks(id uuid pk, title jsonb, description jsonb, points smallint check 1..10, is_active boolean default true)`
  - `public.dev_task_assignments(id uuid pk, model_id uuid, task_id uuid, assigned_on date, completed_at timestamptz null, points_awarded smallint null, unique (model_id, task_id, assigned_on))`
  - `public.ranks(id smallint pk, name jsonb, min_points int)` — 4 строки по умолчанию (0 / 100 / 300 / 700)
  - `public.badges(code text pk, name jsonb)`, `public.user_badges(model_id uuid, badge_code text, earned_on date, pk (model_id, badge_code))`
  - `public.get_today_tasks() returns setof jsonb` — для текущей одобренной модели досоздаёт до 3 заданий на сегодня (по Ташкенту) из активных, не выдававшихся ей за последние 14 дней, возвращает `{assignment_id, title, description, points, completed}`
  - `public.complete_task(p_assignment_id uuid) returns jsonb` — `{points_awarded, total_points, streak, new_badges: text[]}`; идемпотентна
  - `public.my_progress() returns jsonb` — `{total_points, rank: {id, name}, next_rank_points, streak, badges: text[]}`
  - `public.tashkent_today() returns date` (STABLE; в тестах значение можно подменить через `set_config('zaya.today_override', 'YYYY-MM-DD', true)`)

- [ ] **Step 1: Write failing pgTAP tests** (`0005_development.test.sql`), все для модели M (одобренная) под ролью `authenticated`:
  - `get_today_tasks()` при 5 активных заданиях возвращает ровно 3, повторный вызов в тот же день — те же 3 (идемпотентно);
  - неодобренная модель и бизнесмен получают пустой набор;
  - `complete_task` даёт `points_awarded = points` задания, второй вызов для того же assignment возвращает прежнее значение без прироста `total_points`;
  - чужой assignment: `complete_task` другой модели бросает исключение;
  - серия: выполнения в дни D, D+1, D+2 (подмена `zaya.today_override`) дают `streak = 3` и значок `streak_3`; два выполнения в один день не увеличивают `streak`; пропуск дня обнуляет серию до 1;
  - значок `first_task` после первого выполнения; ранг в `my_progress()` меняется при пересечении порога 100 очков;
  - `dev_tasks`, `ranks`, `badges`: модель может читать активные задания и ранги, но не писать; админ пишет.
- [ ] **Step 2: Run** `bash supabase/tests/run.sh` — Expected: тесты 0005 FAIL (функций и таблиц нет).
- [ ] **Step 3: Implement** миграцию с сигнатурами выше. Подход: `tashkent_today()` = `coalesce(nullif(current_setting('zaya.today_override', true), '')::date, (now() at time zone 'Asia/Tashkent')::date)`; серия считается по датам `completed_at at time zone 'Asia/Tashkent'` подряд до сегодняшнего (или вчерашнего, если сегодня ещё не выполнено); значки выдаются внутри `complete_task`; `full_week` — все назначенные задания выполнены в каждый из 7 последних дней. Всё через `security definer`, право `execute` только `authenticated`; прямые insert/update в `dev_task_assignments`, `user_badges` для `authenticated` отозваны. RLS: модель читает свои assignments и значки; админ — всё и пишет `dev_tasks`, `ranks`, `badges`.
- [ ] **Step 4: Run** `bash supabase/tests/run.sh` — Expected: все тесты, включая 0001–0003, `ok`.
- [ ] **Step 5: Commit** `feat(db): development tasks, streaks, ranks and badges`.

---

### Task 2: Заказы со стороны модели — схема, карточка без заказчика, ответы, вопросы

**Files:**
- Create: `supabase/migrations/0006_orders_model_side.sql`
- Test: `supabase/tests/0006_orders.test.sql`

**Interfaces:**
- Consumes: `public.profiles`, `public.business_profiles`, `public.model_profiles(status)`, `public.my_role()`, `public.is_admin()`.
- Produces:
  - `public.orders(id uuid pk, business_id uuid, status order_status, current_version int, created_at)` — enum `order_status`: `draft, in_review, open, selected, completed, cancelled`
  - `public.order_versions(order_id, version int, brief jsonb, review_status review_status, changes jsonb null, pk (order_id, version))`
  - `public.order_recipients(order_id, model_id, pk both)`
  - `public.order_responses(order_id, model_id, version int, status response_status, updated_at, pk (order_id, model_id))` — enum `response_status`: `confirmed, declined, needs_reconfirm`
  - `public.questions(id uuid pk, author_id uuid, order_id uuid null, body text, answer text null, answered_at null, created_at)`
  - View `public.model_order_cards(order_id, version, status, brief, changes, my_response, updated_flag)` — для текущего пользователя-модели: заказы, где он получатель и статус заказа `open`/`selected`/`completed`, версия — последняя с `review_status='approved'`; `brief` = исходный `brief - 'contact'`; `updated_flag = true`, когда ответ модели относится к более старой версии
  - `public.respond_to_order(p_order_id uuid, p_confirm boolean) returns void`
  - `public.ask_question(p_order_id uuid, p_body text) returns uuid`
  - Триггер: при добавлении одобренной версии > 1 ответы `confirmed` этого заказа получают `needs_reconfirm`.

- [ ] **Step 1: Write failing pgTAP tests** (`0006_orders.test.sql`): модель-получатель видит заказ в `model_order_cards`, а `brief` не содержит ключа `contact`, и ни одна колонка/значение не содержит названия компании или `business_id`; не получатель видит 0 строк; неодобренная модель видит 0 строк; бизнесмен-владелец и посторонний бизнесмен не читают `model_order_cards`; `respond_to_order(…, true)` создаёт ответ `confirmed`, повторный вызов с `false` обновляет ту же запись (1 строка, `declined`); после появления одобренной версии 2 ответ становится `needs_reconfirm`, а `updated_flag = true`, и повторный ответ снова `confirmed` на версии 2; не получатель вызывает `respond_to_order` → исключение; `ask_question` создаёт вопрос автора-модели, пустой текст отклоняется; модель не читает чужие вопросы; админ читает все вопросы и отвечает.
- [ ] **Step 2: Run** `bash supabase/tests/run.sh` — Expected: 0006 FAIL.
- [ ] **Step 3: Implement** миграцию с сигнатурами выше. Подход: RLS на всех таблицах включён и по умолчанию закрыт; прямой доступ моделей к `orders`/`order_versions` не выдаётся — только через представление (оно фильтрует по `auth.uid()`, `my_role() = 'model'` и одобренной карточке) и функции `security definer`; политики бизнесмена и операции создания заказов будут добавлены в этапе 3 (в миграции только схема и админ-доступ: админ читает и пишет всё).
- [ ] **Step 4: Run** `bash supabase/tests/run.sh` — Expected: все `ok`.
- [ ] **Step 5: Commit** `feat(db): orders schema with model-side view, responses and questions`.

---

### Task 3: Правила анкеты и фото в Storage

**Files:**
- Create: `supabase/migrations/0004_card_rules_and_photos.sql`
- Modify: `supabase/tests/_bootstrap.sql` (заглушка схемы `storage`: `storage.buckets`, `storage.objects(bucket_id, name, owner)`, `storage.foldername(name text) returns text[]`)
- Test: `supabase/tests/0004_card_rules.test.sql`

**Interfaces:**
- Consumes: `public.model_profiles`, `public.catalog_entries`, `public.my_role()`, `public.is_admin()`.
- Produces: триггер/ограничение на `model_profiles`: если на дату записи возраст < 18, поле `parent_contact` обязано быть непустым; бакет `model-photos` (private); политики `storage.objects`: модель пишет и читает только в папке `<auth.uid()>/`; админ читает и пишет всё; бизнесмен читает только файлы моделей из `catalog_entries.is_published` со статусом `approved`.

- [ ] **Step 1: Write failing pgTAP tests:** вставка карточки с `birth_date`, дающей 17 лет, без `parent_contact` → исключение; с `parent_contact` → успех; карточка 18-летней без родителя → успех; модель вставляет объект `model-photos/<свой uid>/a.jpg` → успех, в папку другого uid → ошибка RLS; бизнесмен читает файл опубликованной одобренной модели, файл неопубликованной не читает; посторонняя модель не читает чужой файл.
- [ ] **Step 2: Run** `bash supabase/tests/run.sh` — Expected: 0004 FAIL.
- [ ] **Step 3: Implement** миграцию и расширить `_bootstrap.sql` заглушкой `storage` (в реальном Supabase схема уже есть, поэтому заглушка применяется только раннером).
- [ ] **Step 4: Run** `bash supabase/tests/run.sh` — Expected: все `ok`.
- [ ] **Step 5: Commit** `feat(db): minor guardian rule and model photo storage policies`.

---

### Task 4: Анкета модели — типы, валидация и сервис

**Files:**
- Create: `mobile/src/models/modelCard.ts`, `mobile/src/services/modelCardService.ts`
- Test: `mobile/__tests__/modelCard.test.ts`, `mobile/__tests__/modelCardService.test.ts`

**Interfaces:**
- Consumes: `supabase` из `mobile/src/lib/supabase.ts`.
- Produces:
  - `type ModelCardInput = { full_name: string; display_name?: string; birth_date: string; gender: 'female' | 'male'; city: string; phone: string; telegram: string; instagram?: string; parent_contact?: string; height_cm: number; weight_kg?: number; bust_cm?: number; waist_cm?: number; hips_cm?: number; shoe_size?: string; hair?: string; eyes?: string; experience: 'none' | 'under_1' | '1_3' | 'over_3'; directions: ('show' | 'photo' | 'ad' | 'clip' | 'promo')[]; other_agency_contract: boolean; portfolio_url?: string; about?: string; photos: string[] }`
  - `type CardErrors = Partial<Record<keyof ModelCardInput, string>>` (значение — ключ перевода, например `'error.required'`)
  - `validateModelCard(input: ModelCardInput, today: Date): CardErrors`
  - `getMyCard(): Promise<(ModelCardInput & { status: 'pending' | 'approved' | 'returned'; review_comment: string | null }) | null>`
  - `saveMyCard(input: ModelCardInput): Promise<void>` (upsert по `id = auth.uid()`; не отправляет `status`/`review_comment`)
  - `uploadPhoto(uri: string, fileName: string): Promise<string>` — загружает в `model-photos/<uid>/<fileName>`, возвращает путь

- [ ] **Step 1: Write failing tests:** `validateModelCard` — пустой `full_name` → `error.required`; рост 99 и 231 → ошибка, 100 и 230 → нет; вес 14 и 201 → ошибка; телефон не вида `+998` и 9 цифр → ошибка, `+998901234567` → нет; пустой Telegram → ошибка; пустые `directions` → ошибка; `photos` пустой → ошибка; возраст 17 лет на дату `today` без `parent_contact` → ошибка в `parent_contact`, с ним → нет; ровно 18 лет в день рождения → родитель не нужен; корректная анкета → `{}`. `saveMyCard` — вызывает `upsert` с `id` текущего пользователя и без `status`/`review_comment`, при ошибке Supabase бросает `Error` с её сообщением; `getMyCard` — `null`, если записи нет; `uploadPhoto` — вызывает `storage.from('model-photos').upload('<uid>/<fileName>', …)` и возвращает путь.
- [ ] **Step 2: Run** `npm test --prefix mobile -- modelCard` — Expected: FAIL (модулей нет).
- [ ] **Step 3: Implement** по сигнатурам выше.
- [ ] **Step 4: Run** `npm test --prefix mobile` — Expected: PASS (все тесты).
- [ ] **Step 5: Commit** `feat(app): model card validation and service`.

---

### Task 5: Экран «Профиль»: анкета, фото, статус проверки

**Files:**
- Modify: `mobile/app/(model)/profile.tsx`, `mobile/src/i18n/{ru,uz,en}.json`
- Create: `mobile/src/ui/PhotoPicker.tsx`
- Test: `mobile/__tests__/profileScreen.test.tsx`

**Interfaces:**
- Consumes: `validateModelCard`, `getMyCard`, `saveMyCard`, `uploadPhoto` (Задача 4); `t`.
- Produces: экран «Профиль» — форма всех полей `ModelCardInput`, до 6 фото (expo-image-picker), баннер статуса (`pending` — «на проверке», `approved`, `returned` — с комментарием менеджера), кнопка «Сохранить».

- [ ] **Step 1: Write failing test** (`@testing-library/react-native`, сервисы мокаются): при пустой форме нажатие «Сохранить» показывает ошибки и не вызывает `saveMyCard`; при валидной форме `saveMyCard` вызывается один раз; при возврате `status: 'returned'` на экране виден `review_comment`; при ошибке `saveMyCard` показывается `error.generic` и баннер «сохранено» не появляется.
- [ ] **Step 2: Run** `npm test --prefix mobile -- profileScreen` — Expected: FAIL.
- [ ] **Step 3: Implement** экран и `PhotoPicker`; установить `@testing-library/react-native` и `react-test-renderer` как dev-зависимости; добавить ключи переводов (подписи полей, статусы, ошибки) во все три файла с одинаковым набором ключей; подключить `expo-image-picker` в `app.json` plugins.
- [ ] **Step 4: Run** `npm test --prefix mobile` и `npx tsc --noEmit` в `mobile/` — Expected: PASS и без ошибок типов.
- [ ] **Step 5: Commit** `feat(app): model profile screen with photos and review status`.

---

### Task 6: Вкладка «Развитие»

**Files:**
- Create: `mobile/src/services/developmentService.ts`
- Modify: `mobile/app/(model)/development.tsx`, `mobile/src/i18n/{ru,uz,en}.json`
- Test: `mobile/__tests__/developmentService.test.ts`, `mobile/__tests__/developmentScreen.test.tsx`

**Interfaces:**
- Consumes: RPC `get_today_tasks`, `complete_task`, `my_progress` (Задача 1).
- Produces:
  - `type TodayTask = { assignment_id: string; title: string; description: string; points: number; completed: boolean }` (поля `title`/`description` уже на выбранном языке, с откатом на `ru`)
  - `type Progress = { total_points: number; rank: { id: number; name: string }; next_rank_points: number | null; streak: number; badges: string[] }`
  - `getTodayTasks(lang: 'ru' | 'uz' | 'en'): Promise<TodayTask[]>`, `completeTask(assignmentId: string): Promise<{ points_awarded: number; new_badges: string[] }>`, `getProgress(lang): Promise<Progress>`

- [ ] **Step 1: Write failing tests:** сервис — выбирает язык `uz`, а при отсутствии перевода откатывается на `ru`; `completeTask` вызывает RPC `complete_task` с `p_assignment_id`; ошибка RPC превращается в `Error`; экран — показывает ранг, очки, серию и список заданий; нажатие «Выполнено» вызывает `completeTask` и помечает задание выполненным только после успешного ответа; при ошибке сети задание остаётся невыполненным и виден `error.generic`; новые значки показываются после выполнения.
- [ ] **Step 2: Run** `npm test --prefix mobile -- development` — Expected: FAIL.
- [ ] **Step 3: Implement** сервис и экран; названия значков и рангов берутся из ответа RPC (`jsonb {ru,uz,en}`), ключи переводов интерфейса добавить во все три файла.
- [ ] **Step 4: Run** `npm test --prefix mobile` и `npx tsc --noEmit` — Expected: PASS.
- [ ] **Step 5: Commit** `feat(app): development tab with daily tasks, ranks and badges`.

---

### Task 7: Вкладка «Заказы» модели

**Files:**
- Create: `mobile/src/services/ordersService.ts`, `mobile/app/(model)/orders/_layout.tsx`, `mobile/app/(model)/orders/index.tsx`, `mobile/app/(model)/orders/[id].tsx`
- Delete: `mobile/app/(model)/orders.tsx` (заменяется каталогом `orders/`)
- Modify: `mobile/src/i18n/{ru,uz,en}.json`
- Test: `mobile/__tests__/ordersService.test.ts`, `mobile/__tests__/ordersScreen.test.tsx`

**Interfaces:**
- Consumes: представление `model_order_cards`, RPC `respond_to_order`, `ask_question` (Задача 2).
- Produces:
  - `type ModelOrder = { order_id: string; version: number; status: string; brief: Brief; changes: unknown | null; my_response: 'confirmed' | 'declined' | 'needs_reconfirm' | null; updated_flag: boolean }`
  - `type Brief` с секциями `project`, `when_where`, `who`, `conditions`, `requirements` (без `contact`)
  - `listMyOrders(): Promise<ModelOrder[]>`; `respondToOrder(orderId: string, confirm: boolean): Promise<void>`; `askQuestion(orderId: string, body: string): Promise<void>`
  - `groupOrders(orders: ModelOrder[]): { new: ModelOrder[]; mine: ModelOrder[]; archive: ModelOrder[] }` — «Новые»: `my_response` пуст или `needs_reconfirm`; «Мои»: `confirmed` и заказ не завершён; «Архив»: `declined` либо заказ `completed`/`cancelled`

- [ ] **Step 1: Write failing tests:** `groupOrders` раскладывает заказы по правилам выше (по одному примеру на каждую группу и пограничный случай `needs_reconfirm` → «Новые» с `updated_flag`); `respondToOrder` вызывает RPC `respond_to_order` с `p_order_id`, `p_confirm`; `askQuestion` отклоняет пустой текст до вызова RPC; экран списка: три вкладки, у обновлённого заказа метка `orders.updated`; экран заказа: показаны секции брифа, нет поля контакта, кнопки «Подтвердить», «Отказаться», форма вопроса менеджеру; при ошибке ответа статус на экране не меняется.
- [ ] **Step 2: Run** `npm test --prefix mobile -- orders` — Expected: FAIL.
- [ ] **Step 3: Implement** сервис и экраны (расширить `(model)/_layout.tsx` под вложенный стек вкладки «Заказы»); тексты переводов во всех трёх файлах.
- [ ] **Step 4: Run** `npm test --prefix mobile`, `npx tsc --noEmit` и `npx expo export --platform android --output-dir /tmp/zaya-export` в `mobile/` — Expected: PASS, без ошибок, бандл собирается.
- [ ] **Step 5: Commit** `feat(app): model orders tab with confirm, decline and questions`.

---

### Task 8: Стартовый контент «Развития» (30 заданий, ранги, значки)

**Files:**
- Create: `supabase/seed/dev_content.sql`
- Test: `supabase/tests/0007_seed.test.sql`

**Interfaces:**
- Consumes: таблицы `dev_tasks`, `ranks`, `badges` (Задача 1).
- Produces: идемпотентный скрипт, который вставляет 30 заданий на русском (`title.ru`, `description.ru`, `points` 1–10; `uz`/`en` — пустые строки), значения рангов (0 / 100 / 300 / 700 очков) и значки `first_task`, `streak_3`, `streak_7`, `streak_14`, `streak_30`, `full_week`. Тематика заданий: личный бренд — оформление профиля Instagram, портфолио, позинг и мимика, чтение коротких уроков, нетворкинг, уход за собой, фото- и видеоупражнения.

- [ ] **Step 1: Write failing test** (`0007_seed.test.sql`): после применения `dev_content.sql` в `dev_tasks` не менее 30 активных строк, у каждой непустой `title->>'ru'` и `points` от 1 до 10; в `ranks` ровно 4 строки с возрастающим `min_points`; в `badges` ровно 6 кодов из списка; повторное применение скрипта не увеличивает число строк.
- [ ] **Step 2: Run** `bash supabase/tests/run.sh` (раннер применяет `supabase/seed/*.sql` перед файлами тестов `0007`) — Expected: FAIL.
- [ ] **Step 3: Implement** `dev_content.sql` (вставки с `on conflict do nothing` по стабильным идентификаторам) и доработать `run.sh`, чтобы он применял `supabase/seed/*.sql` после миграций, но до тестов. Контент помечен как черновик: утверждает заказчик.
- [ ] **Step 4: Run** `bash supabase/tests/run.sh` — Expected: все `ok`.
- [ ] **Step 5: Commit** `feat(db): seed starter development content`.

---

## Self-Review

- **Покрытие спецификации (этап 2):** анкета и фото — Задачи 3–5; «Развитие» с рангами, значками и серией — Задачи 1, 6, 8; заказы модели (список, подтверждение, отказ, вопросы, пометка «Обновлён», скрытие заказчика) — Задачи 2, 7. Создание заказов бизнесменом, подбор получателей и закрепление остаются этапам 3–4.
- **Отступление от спецификации:** отметки выполнения хранятся в `dev_task_assignments` (`completed_at`, `points_awarded`) вместо отдельной таблицы `dev_task_completions` — записи один к одному.
- **Согласованность типов:** имена функций, представления и полей одинаковы в Задачах 1–2 и использующих их Задачах 6–7; `Brief` без секции `contact` совпадает с условием представления.
- **Review Focus:** строки 1–2 покрыты Задачей 1, 3–4 — Задачей 2, 5 — Задачами 3–4, 6 — Задачами 5–6.
- **Не входит в этап 2:** создание заказов и правок бизнесменом, подбор получателей, выбор моделей, push-уведомления, админка, каталог.
