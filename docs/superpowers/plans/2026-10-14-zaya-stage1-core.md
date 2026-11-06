# ZAYA — Этап 1: ядро (проект, вход, роли, база и RLS) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Рабочий каркас: мобильное приложение Expo с входом (Google, Apple, email), выбором роли и экранами-оболочками по ролям, поверх Supabase-базы с правилами доступа (RLS), которые уже на этом этапе не дают бизнесмену читать контакты моделей.

**Architecture:** Монорепозиторий с `mobile/` (Expo, TypeScript), `supabase/` (миграции SQL и тесты pgTAP). Роль хранится в `profiles.role` и задаётся триггером при регистрации (только `model` или `business`; `admin` назначается вручную). Публичные данные моделей для бизнесмена отдаются только через представление `public_model_cards`. Админка (`admin/`) в этом этапе не создаётся.

**Tech Stack:** Expo SDK (React Native), TypeScript, expo-router, @supabase/supabase-js, expo-apple-authentication, @react-native-google-signin/google-signin, i18next, Jest (jest-expo), Supabase CLI, pgTAP.

**Spec:** `docs/superpowers/specs/2026-10-14-zaya-app-design.md` (разделы 3, 4, 5, 7, 9, 10, 11 — этап 1).

## Global Constraints

- Роли: `model`, `business`, `admin` (суперадмин один, назначается вручную, при регистрации выбрать нельзя).
- Вход: Google, Apple (Sign in with Apple обязателен), email и пароль.
- Языки интерфейса: RU, UZ, EN.
- Цвета: чёрный `#050505`, золотой `#DBB577`, тёмно-зелёный `#0B2F23` / `#0E3829`; шрифты Cormorant Garamond и Jost; слоган «Твоя высота начинается здесь».
- Изоляция реализуется RLS в PostgreSQL и ограниченными представлениями, а не только интерфейсом.
- Бизнесмен не видит телефон, Telegram, Instagram, дату рождения, данные родителя моделей.
- Секреты и ключи не хранятся в репозитории (только переменные окружения; в репозитории `.env.example`).
- Код проекта в каталогах `mobile/` и `supabase/`; существующие файлы репозитория (OWASP Juice Shop) не изменяются.

## Review Focus

1. Регистрация с `role = 'admin'` в метаданных пользователя: роль должна стать `model` или регистрация отклонена, но не `admin` (тест в Задаче 2).
2. Заблокированный пользователь (`is_blocked = true`): не читает ничего, кроме собственного профиля (Задача 3).
3. Apple при повторном входе не присылает email и имя: профиль уже существует и не ломается (Задача 5).
4. После входа через Google/Apple роль ещё не выбрана: приложение показывает экран выбора роли, а не падает (Задача 6).
5. Истёкшая или отозванная сессия при запуске: приложение показывает экран входа (Задача 6).

---

## File Structure

```
mobile/                           Expo-приложение
  app.json, package.json, tsconfig.json, jest.config.js
  .env.example                    EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY, GOOGLE_WEB_CLIENT_ID
  src/lib/supabase.ts             клиент Supabase
  src/lib/theme.ts                цвета, шрифты
  src/i18n/index.ts, ru.json, uz.json, en.json
  src/auth/authService.ts         email/Google/Apple вход, выход, роль
  src/auth/useSession.ts          хук состояния сессии и роли
  app/_layout.tsx                 корневой layout, роутинг по состоянию
  app/splash.tsx                  экран загрузки
  app/(auth)/login.tsx, register.tsx, choose-role.tsx, admin-note.tsx
  app/(model)/_layout.tsx, development.tsx, orders.tsx, profile.tsx
  app/(business)/_layout.tsx, orders.tsx, catalog.tsx, ideas.tsx
  __tests__/                      тесты Jest
supabase/
  config.toml
  migrations/0001_profiles.sql
  migrations/0002_cards_and_catalog.sql
  seed.sql
  tests/0001_profiles.test.sql, 0002_isolation.test.sql
scripts/promote-admin.sql         назначение суперадмина вручную
README.md (каталог проекта: docs/zaya-setup.md)
```

---

### Task 1: Каркас проекта и инструменты

**Files:**
- Create: `mobile/` (через `npx create-expo-app@latest app --template tabs` с последующей очисткой примеров), `mobile/jest.config.js`, `mobile/.env.example`
- Create: `supabase/config.toml` (через `supabase init`)
- Create: `docs/zaya-setup.md`
- Test: `mobile/__tests__/smoke.test.ts`

**Interfaces:**
- Produces: рабочие команды `npm test --prefix mobile` (Jest) и `supabase test db` (pgTAP); `mobile/src/lib/theme.ts` экспортирует `theme: { colors: { black: '#050505'; gold: '#DBB577'; green: '#0B2F23'; green2: '#0E3829'; cream: '#EEE7DA' }; fonts: { serif: string; sans: string } }`.

- [ ] **Step 1: Write the failing test** `mobile/__tests__/smoke.test.ts`: импортирует `theme` из `../src/lib/theme` и проверяет `theme.colors.gold === '#DBB577'` и `theme.colors.black === '#050505'`.
- [ ] **Step 2: Run** `npm test --prefix mobile` — ожидается FAIL (модуль не найден).
- [ ] **Step 3: Create** Expo-проект в `mobile/` (TypeScript, expo-router), удалить шаблонные экраны-примеры, настроить `jest-expo`; реализовать `theme` в `mobile/src/lib/theme.ts`. Добавить `mobile/.env.example` с тремя переменными из File Structure. Выполнить `supabase init` в корне. Описать в `docs/zaya-setup.md` запуск (Docker для `supabase start`, `npm test`).
- [ ] **Step 4: Run** `npm test --prefix mobile` — ожидается PASS.
- [ ] **Step 5: Commit** `feat: scaffold Expo app and Supabase project`.

---

### Task 2: Профили, роли и вход без самоназначения admin

**Files:**
- Create: `supabase/migrations/0001_profiles.sql`
- Test: `supabase/tests/0001_profiles.test.sql`

**Interfaces:**
- Produces: тип `public.user_role` (`'model' | 'business' | 'admin'`); таблица `public.profiles(id uuid pk references auth.users, role public.user_role null, language text default 'ru', push_token text null, is_blocked boolean default false, created_at timestamptz)`; функция `public.is_admin() returns boolean` (SECURITY DEFINER, `true` если `role='admin'` и не заблокирован для `auth.uid()`); функция `public.set_my_role(new_role public.user_role) returns void` (разрешает только `model` / `business`, только если роль ещё `null`).

- [ ] **Step 1: Write failing pgTAP tests** в `0001_profiles.test.sql`:
  - вставка в `auth.users` с `raw_user_meta_data->>'role' = 'business'` создаёт строку в `profiles` с `role = 'business'`;
  - вставка с `role = 'admin'` создаёт профиль с `role is null` (метаданные не дают admin);
  - вставка без роли (социальный вход) создаёт профиль с `role is null`;
  - пользователь A (под `authenticated`, `auth.uid()=A`) не читает профиль B (0 строк), читает свой;
  - `set_my_role('admin')` бросает исключение; `set_my_role('model')` при `role is null` проходит, повторный вызов бросает исключение;
  - `is_admin()` возвращает `false` для заблокированного админа.
- [ ] **Step 2: Run** `supabase test db` — ожидается FAIL (объекты не существуют).
- [ ] **Step 3: Implement** миграцию: тип, таблица, RLS (`select` и `update` языка/токена только для `id = auth.uid()` и не заблокированных; админ читает всё через `is_admin()`), триггер `handle_new_user` на `auth.users` (роль из метаданных принимается только `model` и `business`, всё остальное → `null`), `is_admin()`, `set_my_role()`. Пользователю запрещено менять собственные `role` и `is_blocked` через `update` (колонночные права или `with check`).
- [ ] **Step 4: Run** `supabase test db` — ожидается PASS.
- [ ] **Step 5: Commit** `feat(db): profiles, roles and signup trigger with RLS`.

---

### Task 3: Карточки моделей, бизнес-профили, каталог и изоляция

**Files:**
- Create: `supabase/migrations/0002_cards_and_catalog.sql`
- Test: `supabase/tests/0002_isolation.test.sql`

**Interfaces:**
- Consumes: `public.profiles`, `public.is_admin()`.
- Produces: таблицы `public.model_profiles` (все поля анкеты из раздела 5 спецификации; `status` `pending|approved|returned`, `review_comment`), `public.business_profiles`, `public.catalog_entries(model_id uuid pk, agency_rating smallint check 0..10, agency_note text, is_published boolean default false)`; представление `public.public_model_cards` — только `model_id, display_name, height_cm, bust_cm, waist_cm, hips_cm, hair, eyes, directions, experience, photos, agency_rating, agency_note, is_favorite` для карточек со `status='approved'` и `is_published=true`; `is_favorite = agency_rating = 10`.

- [ ] **Step 1: Write failing pgTAP tests** в `0002_isolation.test.sql`:
  - модель читает и обновляет только свою `model_profiles` и не читает чужую;
  - бизнесмен выполняет `select * from model_profiles` и получает 0 строк;
  - бизнесмен читает `public_model_cards` и видит опубликованную одобренную модель; не видит `pending` и неопубликованных; в представлении нет колонок `phone`, `telegram`, `instagram`, `birth_date`, `parent_contact` (проверка по `information_schema.columns`);
  - модель не читает `business_profiles` и чужие карточки; бизнесмен читает только свой `business_profiles`;
  - админ читает всё и может выставить `agency_rating` и `is_published`;
  - модель и бизнесмен не могут писать в `catalog_entries`;
  - заблокированный пользователь не читает ничего, кроме собственного профиля; не видит `public_model_cards`.
- [ ] **Step 2: Run** `supabase test db` — ожидается FAIL.
- [ ] **Step 3: Implement** миграцию с RLS по правилам раздела 4 спецификации. Представление создаётся с `security_invoker = false` и собственным фильтром по роли (`business` или `admin`, не заблокирован) внутри `where`, чтобы модели и анонимы получали пустой результат. Модель не может сама менять `status`, `review_comment`; смена статуса — только админом.
- [ ] **Step 4: Run** `supabase test db` — ожидается PASS.
- [ ] **Step 5: Commit** `feat(db): model/business profiles, catalog and isolation rules`.

---

### Task 4: Сервис авторизации по email

**Files:**
- Create: `mobile/src/lib/supabase.ts`, `mobile/src/auth/authService.ts`
- Test: `mobile/__tests__/authService.test.ts`

**Interfaces:**
- Consumes: Supabase-клиент из `supabase.ts`.
- Produces: `export type Role = 'model' | 'business' | 'admin'`; `signUpWithEmail(email: string, password: string, role: 'model' | 'business'): Promise<void>`; `signInWithEmail(email: string, password: string): Promise<void>`; `signOut(): Promise<void>`; `getMyRole(): Promise<Role | null>` (читает `profiles.role` текущего пользователя); `setMyRole(role: 'model' | 'business'): Promise<void>` (вызывает RPC `set_my_role`).

- [ ] **Step 1: Write failing tests** (Supabase-клиент мокается): `signUpWithEmail` вызывает `auth.signUp` с `options.data = { role }`; `signInWithEmail` пробрасывает ошибку Supabase как `Error` с её сообщением; `getMyRole` возвращает `null`, если профиль без роли; `setMyRole` вызывает `rpc('set_my_role', { new_role })`.
- [ ] **Step 2: Run** `npm test --prefix mobile -- authService` — ожидается FAIL.
- [ ] **Step 3: Implement** функции с сигнатурами выше; клиент создаётся из `EXPO_PUBLIC_SUPABASE_URL` и `EXPO_PUBLIC_SUPABASE_ANON_KEY`, хранилище сессии `AsyncStorage`, `autoRefreshToken: true`.
- [ ] **Step 4: Run** тесты — ожидается PASS.
- [ ] **Step 5: Commit** `feat(app): email auth service`.

---

### Task 5: Вход через Google и Apple

**Files:**
- Modify: `mobile/src/auth/authService.ts`, `mobile/app.json`
- Test: `mobile/__tests__/socialAuth.test.ts`

**Interfaces:**
- Consumes: Supabase-клиент.
- Produces: `signInWithGoogle(): Promise<void>`; `signInWithApple(): Promise<void>`; обе получают токен у провайдера и вызывают `supabase.auth.signInWithIdToken({ provider, token })`; при отмене пользователем возвращают без ошибки (`void`), не бросают.

- [ ] **Step 1: Write failing tests** (модули провайдеров и Supabase мокаются): `signInWithGoogle` вызывает `signInWithIdToken` с `provider: 'google'` и полученным `idToken`; `signInWithApple` вызывает его с `provider: 'apple'` и `identityToken`; при коде отмены провайдера (`ERR_REQUEST_CANCELED`, `SIGN_IN_CANCELLED`) функции завершаются без исключения и без вызова Supabase; при ответе Apple без `email` и `fullName` вызов всё равно выполняется (повторный вход).
- [ ] **Step 2: Run** `npm test --prefix mobile -- socialAuth` — ожидается FAIL.
- [ ] **Step 3: Implement** функции; в `app.json` добавить плагины `expo-apple-authentication` и `@react-native-google-signin/google-signin`, `ios.usesAppleSignIn: true`, идентификаторы `ios.bundleIdentifier` и `android.package` значением `uz.zaya.app`. Идентификаторы OAuth-клиентов брать из `.env` (`GOOGLE_WEB_CLIENT_ID`, `GOOGLE_IOS_CLIENT_ID`).
- [ ] **Step 4: Run** тесты — ожидается PASS.
- [ ] **Step 5: Commit** `feat(app): Google and Apple sign-in`.

---

### Task 6: Состояние сессии, роутинг по ролям, оболочки, i18n

**Files:**
- Create: `mobile/src/auth/useSession.ts`, `mobile/src/i18n/{index.ts,ru.json,uz.json,en.json}`, `mobile/app/_layout.tsx`, `mobile/app/splash.tsx`, `mobile/app/(auth)/{login,register,choose-role,admin-note}.tsx`, `mobile/app/(model)/{_layout,development,orders,profile}.tsx`, `mobile/app/(business)/{_layout,orders,catalog,ideas}.tsx`
- Test: `mobile/__tests__/routing.test.ts`, `mobile/__tests__/i18n.test.ts`

**Interfaces:**
- Consumes: `getMyRole`, `setMyRole`, `signOut` из `authService`.
- Produces: `type SessionState = { status: 'loading' } | { status: 'signedOut' } | { status: 'needsRole' } | { status: 'ready'; role: Role }`; `useSession(): SessionState`; чистая функция `routeFor(state: SessionState): string` с отображением `loading → '/splash'`, `signedOut → '/(auth)/login'`, `needsRole → '/(auth)/choose-role'`, `ready/model → '/(model)/development'`, `ready/business → '/(business)/orders'`, `ready/admin → '/(auth)/admin-note'`; `t(key: string): string`, `setLanguage(lang: 'ru' | 'uz' | 'en'): void`.

- [ ] **Step 1: Write failing tests:** `routeFor` для всех пяти состояний возвращает значения выше; `useSession` при отсутствии сессии/ошибке обновления токена даёт `signedOut`, при сессии без роли — `needsRole`; `t('slogan')` на RU возвращает «Твоя высота начинается здесь», на EN — «Your heights begin here», на UZ — «Sening cho‘qqing shu yerdan boshlanadi»; во всех трёх файлах переводов одинаковый набор ключей.
- [ ] **Step 2: Run** `npm test --prefix mobile -- routing i18n` — ожидается FAIL.
- [ ] **Step 3: Implement** `useSession` (подписка на `onAuthStateChange`, загрузка роли через `getMyRole`, ошибка/таймаут → `signedOut`), `routeFor`, i18n (i18next; язык по умолчанию — русский), и экраны-оболочки: вкладки модели «Развитие / Заказы / Профиль» и бизнесмена «Заказы / Каталог / Идеи» с заголовками и пустыми состояниями, экран входа с тремя способами (email, Google, Apple; Apple-кнопка только на iOS), регистрацию с выбором роли, экран `choose-role`, переключатель языка. Админ в мобильном приложении видит заметку «Используйте веб-админку» и кнопку выхода. Стиль — по `theme`.
- [ ] **Step 4: Run** `npm test --prefix mobile` — ожидается PASS (все тесты).
- [ ] **Step 5: Commit** `feat(app): session routing, role shells and i18n`.

---

### Task 7: Назначение суперадмина и проверка окружения

**Files:**
- Create: `scripts/promote-admin.sql`, `supabase/seed.sql`
- Modify: `docs/zaya-setup.md`
- Test: `supabase/tests/0003_admin_promotion.test.sql`

**Interfaces:**
- Consumes: `public.profiles`, `public.is_admin()`.
- Produces: функция `public.promote_to_admin(target_email text) returns void`, доступная только роли `service_role` (не `authenticated` и не `anon`).

- [ ] **Step 1: Write failing pgTAP tests:** `promote_to_admin('a@x')` под `service_role` делает профиль админом; вызов под `authenticated` бросает исключение (нет прав); вызов для несуществующего email бросает исключение.
- [ ] **Step 2: Run** `supabase test db` — ожидается FAIL.
- [ ] **Step 3: Implement** функцию в новой миграции `supabase/migrations/0003_promote_admin.sql`, права `revoke ... from public, anon, authenticated`; `scripts/promote-admin.sql` содержит вызов-пример без реальных адресов; `seed.sql` создаёт по одному тестовому пользователю каждой роли для локальной разработки; в `docs/zaya-setup.md` описать пошагово: создание проекта Supabase, включение провайдеров Google и Apple, привязку переменных окружения, назначение суперадмина.
- [ ] **Step 4: Run** `supabase test db` и `npm test --prefix mobile` — оба PASS.
- [ ] **Step 5: Commit** `feat: admin promotion function and setup docs`.

---

## Self-Review (результат)

- **Покрытие спецификации (этап 1):** проект и каркас — Задача 1; роли и RLS — Задачи 2–3; вход Google/Apple/email — Задачи 4–5; роутинг по ролям, оболочки, языки, стиль — Задача 6; суперадмин — Задача 7. Каталог в 3D, заказы, админка, push и сборки вынесены в следующие этапы по разделу 11 спецификации.
- **Согласованность типов:** `Role`, `SessionState`, `routeFor`, `setMyRole`/`set_my_role`, `is_admin`, `public_model_cards` используются одинаково во всех задачах.
- **Review Focus:** строки 1–2 покрыты Задачами 2–3, строки 3–5 — Задачами 5–6.
- **Не входит в этап 1:** таблицы заказов, развития, вопросов, уведомлений; веб-админка; 3D-каталог; сборки APK/TestFlight.
