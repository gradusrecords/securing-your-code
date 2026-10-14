# ZAYA — Этап 4: веб-админка суперадмина и 3D-каталог Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline execution chosen by the human partner). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Суперадмин проверяет карточки моделей и заказы (в том числе правки), выбирает получателей, закрепляет выбранных моделей, отвечает на вопросы, управляет заданиями, контентом и пользователями; бизнесмен видит в приложении 3D-каталог ZAYA с сайта, питающийся данными из базы.

**Architecture:** Все действия админа — это функции `security definer` в базе (проверка `is_admin()`, запись в `audit_log`), веб-админка — тонкий React-клиент к ним через supabase-js. 3D-каталог — существующий HTML сайта, из которого вырезаны зашитые данные моделей; приложение встраивает его через WebView и подаёт данные `window.ZAYA_CATALOG` из `public_model_cards` и подписанных ссылок на фото.

**Tech Stack:** SQL/pgTAP; админка — Vite, React 18, TypeScript, @supabase/supabase-js, Vitest + Testing Library; приложение — react-native-webview; проверка 3D-страницы — Playwright (headless Chromium).

**Spec:** `docs/superpowers/specs/2026-10-14-zaya-app-design.md` (разделы 6, 8, 9, 10, 11 — этап 4). Предыдущие планы (этапы 1–3) выполнены.

## Global Constraints

- Админ-действия только для `is_admin()` (роль `admin`, не заблокирован); все изменяющие действия пишутся в `audit_log(actor_id, action, target_type, target_id, details, created_at)`.
- Статусы заказа: `in_review → open → selected → completed/cancelled`. Одобрение первой версии открывает заказ; одобрение версии > 1 сбрасывает подтверждения (триггер уже есть) и уведомление уйдёт в этапе 5.
- Подбор получателей: подсказка по полу, росту (если указан в брифе), направлению работы (тип проекта ∈ направлений модели) и городу; список утверждает админ.
- Веб-админка: секреты только через `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (шаблон `.env.example`); service-role ключ в клиент не попадает никогда.
- В репозиторий не коммитятся персональные данные моделей: из 3D-каталога вырезаны все зашитые имена и тексты.
- Языки админки: русский (достаточно для менеджеров ZAYA); поля контента редактируются на RU/UZ/EN.
- Существующие файлы Juice Shop не изменяются; код в `admin/`, `mobile/`, `supabase/`.
- Тесты: `bash supabase/tests/run.sh`; `npm test --prefix mobile`; `npm test --prefix admin`; `npx tsc --noEmit` в `mobile/` и `admin/`.

## Review Focus

1. Не-админ (модель, бизнесмен, заблокированный админ) вызывает любую `admin_*` функцию и читает `admin_*` представления: отказ (Задачи 1–2).
2. Одобрение заказа без получателей или получателем, не одобренной моделью: отказ; повторное одобрение уже открытого заказа ничего не дублирует (Задача 1).
3. Закрепление выбора возможно только после выбора бизнесмена; после закрепления бизнесмен не меняет выбор (Задача 1).
4. Админка при отсутствии сессии или при роли, отличной от `admin`, показывает вход / отказ в доступе и не загружает данные (Задача 3).
5. Любая админ-операция при ошибке показывает ошибку и не меняет состояние на экране (Задачи 4–5).
6. 3D-каталог с пустым списком моделей не падает, а показывает пустой каталог; страница не обращается к сети, кроме шрифтов, three.js и подписанных ссылок на фото (Задача 6).

---

## Task 1: Админ-процесс заказов в базе

**Files:** Create `supabase/migrations/0012_admin_orders.sql`; Test `supabase/tests/0012_admin_orders.test.sql`

**Interfaces:**
- Consumes: `orders`, `order_versions`, `order_recipients`, `order_selections`, `model_profiles`, `catalog_entries`, `is_admin()`.
- Produces:
  - `alter table order_versions add column review_comment text`
  - `public.audit_log(id bigserial pk, actor_id uuid, action text, target_type text, target_id text, details jsonb, created_at timestamptz default now())`, чтение только админу; `public.write_audit(p_action text, p_target_type text, p_target_id text, p_details jsonb) returns void` (security definer, вызывается из admin-функций)
  - `public.admin_suggest_recipients(p_order_id uuid) returns table(model_id uuid, display_name text, gender text, height_cm int, score int)` — одобренные модели, отсортированные по `score` (пол +3 если совпал с `who.gender`; направление +3 если тип проекта есть в `directions`; город +1; рейтинг агентства/10 как довесок), только `is_admin()`
  - `public.admin_approve_order(p_order_id uuid, p_recipients uuid[] default '{}') returns void` — последняя `pending` версия → `approved`, при статусе `in_review` заказ → `open`, получатели добавляются (ровно одобренные модели; для первого одобрения список не пуст); идемпотентна
  - `public.admin_return_order(p_order_id uuid, p_comment text) returns void` — последняя `pending` версия → `returned` с комментарием
  - `public.admin_finalize_selection(p_order_id uuid) returns void` — заказ `selected`: все выбранные `finalized = true`
  - `public.admin_complete_order(p_order_id uuid) returns void`, `public.admin_cancel_order(p_order_id uuid) returns void`
  - View `public.admin_orders(order_id, business_name, company, status, version, pending_version, review_status, project_title, project_type, created_at, confirmed_count, selected_count, finalized_count)` — только админу

- [ ] **Step 1: Write failing pgTAP tests:** не-админ (модель, бизнесмен, заблокированный админ) получает исключение на каждую `admin_*` функцию и 0 строк из `admin_orders` и `audit_log`; `admin_suggest_recipients` ставит выше модель с совпавшими полом и направлением и не возвращает неодобренных; `admin_approve_order` без получателей на `in_review` → исключение; с неодобренной моделью → исключение; корректный вызов: версия `approved`, заказ `open`, получатели добавлены, запись в `audit_log`; повторный вызов не создаёт дублей (`order_recipients` count не растёт); версия 2 `pending` одобряется → `confirmed` ответы получают `needs_reconfirm`; `admin_return_order` ставит `returned` и комментарий; `admin_finalize_selection` на заказе без выбора бизнеса → исключение, после `select_models` бизнесмена → `finalized = true`; после финализации `select_models` бизнесмена бросает исключение; `complete`/`cancel` меняют статус и пишут аудит.
- [ ] **Step 2: Run** `bash supabase/tests/run.sh` — Expected: тесты 0012 FAIL.
- [ ] **Step 3: Implement** миграцию по сигнатурам; админ-функции `security definer`, права `execute` только `authenticated` (внутри проверка `is_admin()`); представление фильтрует по `is_admin()`.
- [ ] **Step 4: Run** `bash supabase/tests/run.sh` — Expected: все `ok`.
- [ ] **Step 5: Commit** `feat(db): admin order workflow with audit log`.

## Task 2: Админ-функции: вопросы, пользователи, проверка моделей с аудитом

**Files:** Create `supabase/migrations/0013_admin_misc.sql`; Test `supabase/tests/0013_admin_misc.test.sql`

**Interfaces:**
- Consumes: `questions`, `profiles`, `auth.users`, `review_model`, `write_audit` (Задача 1).
- Produces:
  - `public.admin_answer_question(p_question_id uuid, p_answer text) returns void` (пустой ответ отклоняется)
  - `public.admin_set_blocked(p_user_id uuid, p_blocked boolean) returns void` (нельзя заблокировать самого себя)
  - `public.review_model(...)` пересоздаётся с записью в `audit_log` (та же сигнатура)
  - Views (только админу): `public.admin_questions(question_id, author_id, author_role, author_name, order_id, body, answer, answered_at, created_at)`, `public.admin_users(user_id, email, role, is_blocked, display_name, created_at)`, `public.admin_models(model_id, full_name, display_name, gender, city, phone, telegram, instagram, birth_date, parent_contact, height_cm, experience, directions, photos, status, review_comment, agency_rating, agency_note, is_published, created_at)`

- [ ] **Step 1: Write failing pgTAP tests:** не-админ получает исключение / 0 строк на функции и представления; админ отвечает на вопрос (ответ и `answered_at` сохранены, аудит записан), пустой ответ → исключение; блокировка пользователя меняет `profiles.is_blocked`, заблокированный далее не видит `public_model_cards`; админ не может заблокировать себя; `review_model` пишет запись в `audit_log`; `admin_models` отдаёт контакты (для админа), а у бизнесмена 0 строк.
- [ ] **Step 2: Run** — Expected: FAIL.
- [ ] **Step 3: Implement** по сигнатурам.
- [ ] **Step 4: Run** `bash supabase/tests/run.sh` — Expected: все `ok`.
- [ ] **Step 5: Commit** `feat(db): admin questions, users and audited model review`.

## Task 3: Каркас веб-админки: вход и доступ только для админа

**Files:** Create `admin/package.json`, `admin/tsconfig.json`, `admin/vite.config.ts`, `admin/index.html`, `admin/.env.example`, `admin/.gitignore`, `admin/src/main.tsx`, `admin/src/App.tsx`, `admin/src/lib/supabase.ts`, `admin/src/auth/useAdminSession.ts`, `admin/src/ui/Login.tsx`, `admin/src/ui/Shell.tsx`; Test `admin/src/auth/useAdminSession.test.ts`, `admin/src/App.test.tsx`

**Interfaces:**
- Produces: `type AdminState = { status: 'loading' } | { status: 'signedOut' } | { status: 'forbidden' } | { status: 'admin'; email: string }`; `resolveAdminState(): Promise<AdminState>` (сессия есть и `profiles.role === 'admin'` и не заблокирован → `admin`; сессия есть, роль другая → `forbidden`; иначе `signedOut`; любая ошибка → `signedOut`); `useAdminSession(): AdminState`; компонент `App` показывает `Login`, экран отказа или `Shell` с навигацией по разделам (Модели, Заказы, Вопросы, Развитие, Контент, Пользователи, Журнал); в `Shell` доступна кнопка выхода.

- [ ] **Step 1: Write failing tests:** `resolveAdminState` — нет сессии → `signedOut`; сессия + роль `model` → `forbidden`; сессия + роль `admin` → `admin`; ошибка запроса профиля → `signedOut`; `App` при `signedOut` показывает форму входа и не вызывает загрузку данных; при `forbidden` — текст отказа и кнопку выхода; при `admin` — навигацию из 7 разделов.
- [ ] **Step 2: Run** `npm test --prefix admin` — Expected: FAIL (проекта нет).
- [ ] **Step 3: Implement** каркас (Vite + React + TS + Vitest + jsdom + Testing Library), стиль по бренду (чёрный `#050505`, золотой `#DBB577`, зелёный `#0B2F23`).
- [ ] **Step 4: Run** `npm test --prefix admin`, `npx tsc --noEmit` и `npm run build --prefix admin` — Expected: PASS, сборка успешна.
- [ ] **Step 5: Commit** `feat(admin): scaffold with admin-only access`.

## Task 4: Админка: Модели и Заказы

**Files:** Create `admin/src/api/models.ts`, `admin/src/api/orders.ts`, `admin/src/ui/ModelsPage.tsx`, `admin/src/ui/OrdersPage.tsx`; Modify `admin/src/ui/Shell.tsx`; Test `admin/src/ui/ModelsPage.test.tsx`, `admin/src/ui/OrdersPage.test.tsx`

**Interfaces:**
- Consumes: представления/функции Задач 1–2.
- Produces: `listModels(): Promise<AdminModel[]>`, `reviewModel(id, status: 'approved' | 'returned', comment?: string)`, `saveCatalogEntry(id, { agency_rating, agency_note, is_published })`; `listOrders(): Promise<AdminOrder[]>`, `suggestRecipients(orderId)`, `approveOrder(orderId, recipients)`, `returnOrder(orderId, comment)`, `finalizeSelection(orderId)`, `completeOrder(orderId)`, `cancelOrder(orderId)`. Страница «Модели»: очередь `pending` сверху, карточка с контактами, кнопки «Одобрить», «Вернуть» (комментарий обязателен), редактирование рейтинга 0–10, «Фаворит» (рейтинг 10), публикация в каталоге. Страница «Заказы»: очередь заказов на проверку и версий `pending`, подсказка получателей с чекбоксами, «Одобрить и разослать», «Вернуть с комментарием», для `selected` — «Закрепить», для открытых — «Завершить» и «Отменить» (с подтверждением).

- [ ] **Step 1: Write failing tests:** страница моделей показывает очередь и контакты; «Вернуть» без комментария не вызывает API; «Одобрить» вызывает `reviewModel` и после успеха убирает модель из очереди; при ошибке API модель остаётся в очереди и показывается ошибка; рейтинг вне 0–10 не сохраняется; страница заказов: «Одобрить и разослать» блокирована, пока не отмечен получатель; вызывает `approveOrder` с отмеченными id; «Закрепить» виден только для `selected`; «Отменить» требует второго нажатия.
- [ ] **Step 2: Run** `npm test --prefix admin` — Expected: FAIL.
- [ ] **Step 3: Implement** API-обёртки и страницы.
- [ ] **Step 4: Run** `npm test --prefix admin`, `npx tsc --noEmit`, `npm run build --prefix admin` — Expected: PASS.
- [ ] **Step 5: Commit** `feat(admin): models and orders management`.

## Task 5: Админка: Вопросы, Развитие, Контент, Пользователи, Журнал

**Files:** Create `admin/src/api/{questions,development,content,users,audit}.ts`, `admin/src/ui/{QuestionsPage,DevelopmentPage,ContentPage,UsersPage,AuditPage}.tsx`; Modify `admin/src/ui/Shell.tsx`; Test `admin/src/ui/{QuestionsPage,DevelopmentPage,ContentPage,UsersPage,AuditPage}.test.tsx`

**Interfaces:**
- Produces: `listQuestions()`/`answerQuestion(id, answer)`; `listTasks()`/`saveTask(task)` (поля RU/UZ/EN для названия и описания, очки 1–10, активность), `listRanks()`/`saveRank(rank)`; `listContent()`/`saveContent(item)` (вид `pr|media|motivation`, тексты RU/UZ/EN, порядок, публикация); `listUsers()`/`setBlocked(id, blocked)`; `listAudit(limit)`. Каждая страница показывает ошибку при сбое и не меняет локальное состояние.

- [ ] **Step 1: Write failing tests:** неотвеченные вопросы сверху, пустой ответ не отправляется, успешный ответ помечает вопрос отвеченным; задание с очками 0 или 11 не сохраняется, с корректными — вызывает `saveTask`; контент с пустым русским текстом не сохраняется; блокировка вызывает `setBlocked` после подтверждения и показывает статус; журнал показывает последние записи; при ошибке API на каждой странице видно сообщение и состояние не меняется.
- [ ] **Step 2: Run** `npm test --prefix admin` — Expected: FAIL.
- [ ] **Step 3: Implement** API-обёртки и страницы (запись `dev_tasks`, `ranks`, `content_items` напрямую по RLS админа; блокировки и ответы через функции Задачи 2).
- [ ] **Step 4: Run** `npm test --prefix admin`, `npx tsc --noEmit`, `npm run build --prefix admin` — Expected: PASS.
- [ ] **Step 5: Commit** `feat(admin): questions, development, content, users and audit pages`.

## Task 6: 3D-каталог в приложении

**Files:** Create `mobile/scripts/build-catalog-html.mjs`, `mobile/src/catalog/catalogHtml.ts` (генерируется), `mobile/src/catalog/payload.ts`, `mobile/src/catalog/Catalog3D.tsx`, `mobile/scripts/catalog-smoke.mjs`; Modify `mobile/app/(business)/catalog.tsx`, `mobile/package.json`; Test `mobile/__tests__/catalogPayload.test.ts`, `mobile/__tests__/catalog3d.test.tsx`

**Interfaces:**
- Produces:
  - `buildCatalogHtml(source: string): string` — из `catalog.html` сайта: данные `W` и `M` заменяются на `(window.ZAYA_CATALOG||{}).W||[]` / `.M||[]`, рейтинги `RW`/`RM` на `.RW`/`.RM`, загрузка фото берёт адрес из элемента `m[6]` (подписанные ссылки) с `crossOrigin="anonymous"`; ни одного зашитого имени модели не остаётся
  - `toCatalogPayload(models: CatalogModelFull[], urls: Record<string, string[]>): { W: Row[]; M: Row[]; RW: number[]; RM: number[] }` — `Row = [nameRu, nameUz, heightCm, directions, [eff ru, eff uz], [rec ru, rec uz], photoUrls]`; пол `female` → `W`, `male` → `M`; рейтинг `agency_rating ?? 9`; пустое описание заменяется нейтральным текстом; направления сохраняются, неизвестные отбрасываются
  - `Catalog3D` — компонент: загружает `listCatalog()`, подписывает фото (`createSignedUrl`, 3600 с), отдаёт WebView страницу `catalogHtml` и инжектирует `window.ZAYA_CATALOG` до загрузки; переключатель «3D / Список» в `catalog.tsx`

- [ ] **Step 1: Write failing tests:** `toCatalogPayload` — раскладывает по полу, сохраняет порядок и рейтинги, подставляет 9 при `null`, отбрасывает неизвестные направления, пустой список → `{W:[],M:[],RW:[],RM:[]}`; `buildCatalogHtml` на мини-исходнике с объявленными `W`/`M`/`RW`/`RM` и `photos/` — результат не содержит исходных имён и читает `ZAYA_CATALOG`; экран каталога по умолчанию показывает переключатель, режим «Список» остаётся прежним; `Catalog3D` при ошибке загрузки показывает `error.generic`.
- [ ] **Step 2: Run** `npm test --prefix mobile -- catalog` — Expected: FAIL.
- [ ] **Step 3: Implement** генератор (читает `catalog.html` из публикации сайта, сохраняет результат в `src/catalog/catalogHtml.ts` как строку; сам исходник с именами в репозиторий не кладётся), payload и компонент; установить `react-native-webview`; `catalog-smoke.mjs` открывает сгенерированную страницу в headless Chromium (Playwright) с тестовым `ZAYA_CATALOG` и с пустым, проверяет отсутствие ошибок в консоли и наличие canvas.
- [ ] **Step 4: Run** `npm test --prefix mobile`, `npx tsc --noEmit`, `node mobile/scripts/catalog-smoke.mjs`, `npx expo export --platform android` — Expected: PASS; смоук без ошибок консоли.
- [ ] **Step 5: Commit** `feat(app): embed the 3D catalog fed from the database`.

---

## Self-Review

- **Покрытие (этап 4):** админка по разделам спецификации §8 — модели, заказы, вопросы, развитие, контент, пользователи, журнал (Задачи 3–5) поверх функций базы (Задачи 1–2); 3D-каталог — Задача 6. Уведомления, переводы интерфейса и сборки — этап 5.
- **Согласованность:** имена функций и представлений в Задачах 1–2 совпадают с API-обёртками Задач 4–5; ключи `AdminState` одинаковы в Задаче 3.
- **Review Focus:** 1 — Задачи 1–2; 2–3 — Задача 1; 4 — Задача 3; 5 — Задачи 4–5; 6 — Задача 6.
