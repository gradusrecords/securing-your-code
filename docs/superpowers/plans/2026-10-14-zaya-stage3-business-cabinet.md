# ZAYA — Этап 3: кабинет бизнесмена Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (chosen by the human partner: inline execution). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Бизнесмен заполняет профиль, создаёт заказ по брифу, правит его (с повторной проверкой), видит подтвердивших моделей без контактов, выбирает моделей, задаёт вопросы менеджеру, смотрит каталог и вкладку «Идеи».

**Architecture:** Всё взаимодействие бизнесмена с заказами идёт через функции и представления в базе, которые сами фильтруют по `auth.uid()`; прямых политик на таблицы заказов бизнесмену не выдаётся. Правка заказа после рассылки создаёт новую версию в статусе `pending` (модели видят прежнюю, пока админ не одобрит — этап 4). «Каталог» в этом этапе — нативный список из `public_model_cards`; 3D-книга встраивается в этапе 4.

**Tech Stack:** как в этапах 1–2.

**Spec:** `docs/superpowers/specs/2026-10-14-zaya-app-design.md` (разделы 4–7 «Бизнесмен», 9–11 — этап 3). Предыдущие планы этапов 1–2 выполнены.

## Global Constraints

- Бизнесмен не видит у моделей телефон, Telegram, Instagram, дату рождения, данные родителя, настоящее имя — только поля `public_model_cards`.
- Гонорар в бриф не входит; секция `contact` брифа видна только владельцу заказа и админу.
- Поля брифа: `project{title,type,description,references}`, `when_where{date,time,duration,city,address}`, `who{gender,age,height,measurements,hair,eyes,experience,count}`, `conditions{meals,transfer,usage_rights}`, `requirements{dresscode,makeup_stylist,restrictions}`, `contact{name,phone,channel}`. Тип работы `project.type` ∈ `show|photo|ad|clip|promo`.
- Обязательные поля: `project.title`, `project.type`, `when_where.date`, `when_where.city`, `who.count` ≥ 1, `contact.name`, `contact.phone`.
- Статусы заказа: `in_review → open → selected → completed/cancelled`; правки открытого заказа создают версию `pending`.
- Языки RU, UZ, EN; одинаковый набор ключей. Секреты не коммитятся; код в `mobile/` и `supabase/`.
- Тесты: `bash supabase/tests/run.sh`, `npm test --prefix mobile`, `npx tsc --noEmit` в `mobile/`.

## Review Focus

1. Чужой заказ: другой бизнесмен не читает, не правит, не отменяет и не выбирает моделей (Задача 1).
2. Выбор неподтвердившей модели или модели из чужого заказа отклоняется (Задача 1).
3. Правка открытого заказа не меняет то, что видит модель, до одобрения; правка заказа на проверке меняет черновик на месте (Задача 1).
4. В списке подтвердивших моделей нет контактов и настоящего имени (Задача 1).
5. Пустой или неполный бриф не отправляется ни из приложения, ни в базе (Задачи 1, 4).
6. Ошибка сети при создании заказа не дублирует заказ при повторной отправке кнопки (Задача 5).

---

## Task 1: Заказы бизнесмена в базе

**Files:** Create `supabase/migrations/0009_business_orders.sql`; Test `supabase/tests/0009_business_orders.test.sql`

**Interfaces:**
- Consumes: `orders`, `order_versions`, `order_responses`, `public_model_cards`, `my_role()`, `is_admin()`, `questions`.
- Produces:
  - `public.order_selections(order_id uuid, model_id uuid, finalized boolean default false, pk (order_id, model_id))`
  - `public.create_order(p_brief jsonb) returns uuid` — только бизнесмен с `business_profiles`; проверяет обязательные поля; создаёт заказ `in_review`, версия 1 `pending`
  - `public.update_order(p_order_id uuid, p_brief jsonb) returns int` — владелец; заказ `in_review`: правит версию на месте; заказ `open`: новая версия `pending` с `changes` (jsonb ключей-путей, отличающихся от последней версии); иначе исключение; возвращает номер версии
  - `public.cancel_order(p_order_id uuid) returns void` — владелец, статус `in_review|open`
  - `public.select_models(p_order_id uuid, p_model_ids uuid[]) returns void` — владелец, статус `open`, каждая модель с ответом `confirmed` на текущую одобренную версию; заменяет выбор; заказ → `selected`
  - View `public.business_orders(order_id, status, version, pending_version, brief, review_status, confirmed_count, selected_count, created_at)` — заказы вызывающего бизнесмена с последней версией и числом подтвердивших
  - View `public.order_confirmed_models(order_id, model_id, display_name, gender, height_cm, bust_cm, waist_cm, hips_cm, hair, eyes, directions, experience, photos, agency_rating, is_favorite, is_selected)` — подтвердившие модели заказов вызывающего бизнесмена
  - `public.ask_question` расширяется: вопрос может задать и владелец-бизнесмен по своему заказу

- [ ] **Step 1: Write failing pgTAP tests:** владелец создаёт заказ с полным брифом → строка в `business_orders` статус `in_review`; бриф без `project.title` или с `who.count = 0` → исключение; модель/посторонний бизнесмен вызывают `create_order` → исключение (модель) / видят 0 заказов (чужой); чужой бизнесмен `update_order`, `cancel_order`, `select_models` → исключение; `update_order` у `in_review` не создаёт вторую версию (1 строка в `order_versions`), у `open` создаёт версию 2 `pending` с непустым `changes`, а `model_order_cards` для получателя по-прежнему показывает версию 1; `select_models` с неподтвердившей моделью → исключение, с подтвердившей → успех, `order_confirmed_models.is_selected = true`, статус `selected`; в `order_confirmed_models` нет колонок phone, telegram, instagram, birth_date, parent_contact, full_name; бизнесмен задаёт вопрос по своему заказу → `ask_question` возвращает id, по чужому → исключение; прямой `select` из `orders`/`order_versions`/`order_responses` у бизнесмена даёт 0 строк.
- [ ] **Step 2: Run** `bash supabase/tests/run.sh` — Expected: тесты 0009 FAIL.
- [ ] **Step 3: Implement** миграцию по сигнатурам выше. Все функции `security definer`, права `execute` только `authenticated`; представления фильтруют по `auth.uid()` и `my_role() = 'business'`; `changes` — jsonb `{ "<section>.<key>": <new value> }`.
- [ ] **Step 4: Run** `bash supabase/tests/run.sh` — Expected: все `ok`.
- [ ] **Step 5: Commit** `feat(db): business orders, selection and confirmed-models view`.

## Task 2: Идеи — контент и политики

**Files:** Create `supabase/migrations/0010_content_items.sql`, `supabase/seed/ideas_content.sql`; Test `supabase/tests/0010_content.test.sql`

**Interfaces:**
- Produces: `public.content_items(id uuid pk, kind text check in ('pr','media','motivation'), title jsonb, body jsonb, sort int default 0, is_published boolean default true)`; читают бизнесмены и админ опубликованное, пишет админ.

- [ ] **Step 1: Write failing tests:** бизнесмен читает опубликованные записи и не читает неопубликованные; модель не читает; бизнесмен не пишет; админ пишет; после seed не менее 15 опубликованных записей всех трёх видов, у каждой непустой `title->>'ru'` и `body->>'ru'`; повторное применение seed ничего не добавляет.
- [ ] **Step 2: Run** — Expected: FAIL.
- [ ] **Step 3: Implement** миграцию и seed (идемпотентный по `md5`-идентификаторам): 6 PR-рекомендаций, 5 по медиа, 6 мотивационных текстов против стереотипов («Говорим стереотипам нет. Работаем без границ.» и др.). Тексты — черновик на утверждение.
- [ ] **Step 4: Run** `bash supabase/tests/run.sh` — Expected: все `ok`.
- [ ] **Step 5: Commit** `feat(db): ideas content for business`.

## Task 3: Профиль бизнесмена в приложении

**Files:** Create `mobile/src/models/businessProfile.ts`, `mobile/src/services/businessProfileService.ts`, `mobile/app/(business)/profile.tsx`; Modify `mobile/app/(business)/_layout.tsx`, `mobile/src/i18n/{ru,uz,en}.json`; Test `mobile/__tests__/businessProfile.test.ts`, `mobile/__tests__/businessProfileScreen.test.tsx`

**Interfaces:**
- Produces: `type BusinessProfileInput = { full_name: string; company?: string; position?: string; phone: string; telegram?: string; email?: string; city?: string; industry?: string }`; `validateBusinessProfile(input): Partial<Record<keyof BusinessProfileInput, string>>` (имя обязательно; телефон `+998` и 9 цифр; e-mail, если указан, содержит `@`); `getMyBusinessProfile(): Promise<BusinessProfileInput | null>`; `saveMyBusinessProfile(input): Promise<void>` (upsert по `id = auth.uid()`).

- [ ] **Step 1: Write failing tests:** валидация (пустое имя, плохой телефон, плохой e-mail, корректный → `{}`); сервис: upsert с `id` текущего пользователя; экран: пустая форма показывает ошибки и не сохраняет, валидная сохраняется один раз, ошибка сети показывает `error.generic` без баннера «сохранено».
- [ ] **Step 2: Run** `npm test --prefix mobile -- businessProfile` — Expected: FAIL.
- [ ] **Step 3: Implement**; добавить вкладку «Профиль» в `(business)/_layout.tsx` и ключи переводов.
- [ ] **Step 4: Run** `npm test --prefix mobile` и `npx tsc --noEmit` — Expected: PASS.
- [ ] **Step 5: Commit** `feat(app): business profile`.

## Task 4: Бриф заказа — модель, валидация и сервис

**Files:** Create `mobile/src/models/brief.ts`, `mobile/src/services/businessOrdersService.ts`; Test `mobile/__tests__/brief.test.ts`, `mobile/__tests__/businessOrdersService.test.ts`

**Interfaces:**
- Produces: `type BriefInput` (секции из Global Constraints); `validateBrief(b: BriefInput): Record<string, string>` (ключ вида `'project.title'`, значение — ключ перевода `error.required`/`error.range`); `emptyBrief(): BriefInput`; `type BusinessOrder = { order_id: string; status: string; version: number; pending_version: number | null; brief: BriefInput; review_status: string; confirmed_count: number; selected_count: number; created_at: string }`; `type ConfirmedModel = { order_id: string; model_id: string; display_name: string; gender: string; height_cm: number; photos: string[]; agency_rating: number; is_favorite: boolean; is_selected: boolean; [k: string]: unknown }`; `createOrder(b): Promise<string>`, `updateOrder(id, b): Promise<number>`, `cancelOrder(id): Promise<void>`, `listBusinessOrders(): Promise<BusinessOrder[]>`, `listConfirmedModels(orderId): Promise<ConfirmedModel[]>`, `selectModels(orderId, ids: string[]): Promise<void>`, `askManager(orderId, body): Promise<void>` (использует `ask_question`).

- [ ] **Step 1: Write failing tests:** `validateBrief` — пустой бриф даёт ошибки на все 7 обязательных полей; `who.count = 0` → `error.range`; корректный → `{}`; неизвестный `project.type` → ошибка; сервис — `createOrder` вызывает RPC `create_order` с `p_brief`, возвращает id; `updateOrder` — `update_order`; `listConfirmedModels` фильтрует по `order_id`; `selectModels` — `select_models` с `p_model_ids`; пустое сообщение в `askManager` отклоняется до RPC; ошибка RPC становится `Error`.
- [ ] **Step 2: Run** `npm test --prefix mobile -- brief businessOrders` — Expected: FAIL.
- [ ] **Step 3: Implement** по сигнатурам.
- [ ] **Step 4: Run** `npm test --prefix mobile` — Expected: PASS.
- [ ] **Step 5: Commit** `feat(app): brief validation and business orders service`.

## Task 5: Экраны «Заказы» бизнесмена

**Files:** Create `mobile/app/(business)/orders/{_layout.tsx,index.tsx,new.tsx,[id].tsx}`; Delete `mobile/app/(business)/orders.tsx`; Modify `mobile/src/i18n/{ru,uz,en}.json`; Test `mobile/__tests__/businessOrdersScreen.test.tsx`

**Interfaces:**
- Consumes: сервис и модель из Задачи 4; `getMyBusinessProfile` (Задача 3).
- Produces: список заказов (статус, версия, «изменён, на проверке», число подтвердивших), кнопка «Создать заказ» (ведёт на форму, недоступна пока профиль пуст — показывает подсказку заполнить профиль), форма брифа (создание и редактирование по тем же полям), экран заказа: бриф, подтвердившие модели с кнопкой выбора, «Отправить выбор», «Изменить», «Отменить», «Вопрос менеджеру».

- [ ] **Step 1: Write failing tests:** список показывает статус и число подтвердивших, метку `orders.pending_changes` для `pending_version`; форма с пустым брифом показывает ошибки и не вызывает `createOrder`; валидная форма вызывает `createOrder` один раз даже при двойном нажатии «Отправить» (кнопка блокируется на время запроса); при ошибке сети форма остаётся с данными и показывает `error.generic`; экран заказа показывает подтвердивших моделей без контактных полей, выбор модели и «Отправить выбор» вызывает `selectModels` с отмеченными id; отмена вызывает `cancelOrder` после подтверждения; без заполненного профиля кнопка «Создать заказ» показывает подсказку.
- [ ] **Step 2: Run** `npm test --prefix mobile -- businessOrdersScreen` — Expected: FAIL.
- [ ] **Step 3: Implement** экраны и переводы (подписи секций и полей брифа, статусы заказа, ошибки).
- [ ] **Step 4: Run** `npm test --prefix mobile`, `npx tsc --noEmit` — Expected: PASS.
- [ ] **Step 5: Commit** `feat(app): business orders tab with brief form and model selection`.

## Task 6: Вкладки «Каталог» и «Идеи»

**Files:** Create `mobile/src/services/catalogService.ts`, `mobile/src/services/contentService.ts`; Modify `mobile/app/(business)/{catalog,ideas}.tsx`, `mobile/src/i18n/{ru,uz,en}.json`; Test `mobile/__tests__/catalogService.test.ts`, `mobile/__tests__/contentService.test.ts`, `mobile/__tests__/businessTabs.test.tsx`

**Interfaces:**
- Produces: `listCatalog(): Promise<CatalogModel[]>` из `public_model_cards` (`model_id, display_name, gender, height_cm, directions, photos, agency_rating, is_favorite`), фильтрация на клиенте `filterCatalog(models, { gender?, favoriteOnly? })`; `listIdeas(lang): Promise<{ id: string; kind: 'pr'|'media'|'motivation'; title: string; body: string }[]>` с откатом на `ru`.

- [ ] **Step 1: Write failing tests:** `filterCatalog` по полу и «только фавориты»; `listCatalog` читает `public_model_cards`; `listIdeas` выбирает язык с откатом на русский и сортирует по `sort`; экраны: каталог показывает карточки и пустое состояние, «Идеи» группирует записи по видам, при ошибке показывают `error.generic`.
- [ ] **Step 2: Run** `npm test --prefix mobile -- catalog content businessTabs` — Expected: FAIL.
- [ ] **Step 3: Implement** сервисы и экраны.
- [ ] **Step 4: Run** `npm test --prefix mobile`, `npx tsc --noEmit`, `npx expo export --platform android --output-dir /tmp/zaya-export` в `mobile/` — Expected: PASS, бандл собирается.
- [ ] **Step 5: Commit** `feat(app): business catalog and ideas tabs`.

---

## Self-Review

- **Покрытие (этап 3):** профиль, бриф, заказы, правки, выбор, вопросы, каталог (нативный), идеи — Задачи 1–6. Проверка заказов и правок админом, закрепление моделей, 3D-каталог — этап 4; push — этап 5.
- **Согласованность:** имена функций/представлений в Задачах 1, 4, 5 совпадают; `confirmed_count` и `is_selected` одинаково названы в SQL и TS.
- **Review Focus:** 1–4 — Задача 1; 5 — Задачи 1 и 4; 6 — Задача 5.
