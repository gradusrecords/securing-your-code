# ZAYA — Этап 5: уведомления, переводы и подготовка релиза Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline execution chosen by the human partner). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Пользователи получают push-уведомления о ключевых событиях, интерфейс и стартовый контент полностью доступны на RU/UZ/EN, а проект готов к сборке APK (Android) и TestFlight (iPhone) без магазинов.

**Architecture:** События порождают строки в таблице `notifications` (триггеры и функции в базе, тексты локализованы по `profiles.language`). Edge Function `send-push` забирает неотправленные строки, шлёт их через Expo Push API и помечает отправленными. Приложение регистрирует push-токен в `profiles.push_token`. Сборки — через EAS (`eas.json`), инструкции в `docs/zaya-release.md`.

**Tech Stack:** SQL/pgTAP; Supabase Edge Function (Deno, логика в чистом JS, тесты `node --test`); expo-notifications, expo-device; EAS Build.

**Spec:** `docs/superpowers/specs/2026-10-14-zaya-app-design.md` (разделы 3, 9, 11 — этап 5). Этапы 1–4 выполнены.

## Global Constraints

- Уведомления: новый заказ (получателю), заказ изменён (получателям после одобрения версии > 1), вы утверждены (после закрепления выбора), ответ менеджера (автору вопроса), задание на сегодня (одобренным моделям); тексты на RU/UZ/EN по `profiles.language`, при неизвестном языке — RU.
- Заблокированные пользователи и пользователи без push-токена уведомлений не получают (строка создаётся, но не отправляется).
- В тексте уведомления модели не попадают название компании и контакты заказчика.
- Секреты (Expo access token для отправки, ключи Apple/Google) не коммитятся; в клиент попадают только `EXPO_PUBLIC_*`.
- Bundle id / package: `uz.zaya.app`; версия приложения `1.0.0`.
- Тесты: `bash supabase/tests/run.sh`, `node --test supabase/functions`, `npm test --prefix mobile`, `npm test --prefix admin`, `npx tsc --noEmit` в `mobile/` и `admin/`.
- Существующие файлы Juice Shop не изменяются; новые CI-файлы добавляются отдельным файлом.

## Review Focus

1. Уведомление о новом заказе уходит только получателям и только пока заказ `open`; повторное одобрение не дублирует уведомления (Задача 1).
2. Текст уведомления модели не содержит названия компании, телефона и имени заказчика (Задача 1).
3. Строка уведомления не отправляется дважды при повторном запуске функции и при частичном сбое Expo (Задача 2).
4. Устаревший или недействительный push-токен (`DeviceNotRegistered`) очищается и не блокирует остальные отправки (Задача 2).
5. Отказ пользователя в разрешении на уведомления не ломает вход и не показывает ошибку (Задача 3).
6. В экране заказа модели названия полей брифа локализованы, а значения-булевы читаются по-человечески (Задача 4).

---

## Task 1: Уведомления в базе

**Files:** Create `supabase/migrations/0015_notifications.sql`; Test `supabase/tests/0015_notifications.test.sql`

**Interfaces:**
- Consumes: `order_recipients`, `order_versions`, `order_selections`, `orders`, `questions`, `profiles(language, push_token, is_blocked)`, `model_profiles`, `dev_task_assignments`.
- Produces:
  - `public.notifications(id uuid pk, user_id uuid, kind text check in ('order_new','order_changed','order_selected','question_answered','daily_task'), title text, body text, data jsonb, created_at timestamptz, sent_at timestamptz null, error text null)`; читает только владелец (свои) и админ
  - `public.notif_text(p_kind text, p_lang text) returns table(title text, body text)` (RU/UZ/EN; неизвестный язык → RU)
  - `public.enqueue_notification(p_user uuid, p_kind text, p_data jsonb) returns void` — подставляет язык получателя; не создаёт строку для заблокированных
  - Триггеры: `order_recipients` after insert, если заказ `open` → `order_new` (data `{order_id}`); `order_versions` когда `review_status` становится `approved` и `version > 1` → `order_changed` всем получателям; `order_selections` когда `finalized` становится `true` → `order_selected` выбранной модели; `questions` когда `answer` заполняется → `question_answered` автору
  - `public.notify_daily_tasks() returns int` — создаёт `daily_task` для одобренных не заблокированных моделей, у которых на сегодня (по Ташкенту) есть невыполненные назначения или ещё нет назначений, не чаще одного раза в день; возвращает число созданных

- [ ] **Step 1: Write failing pgTAP tests:** одобрение заказа (`admin_approve_order`) создаёт по одному `order_new` каждому получателю и ни одному неполучателю; повторное одобрение того же заказа не создаёт новых строк; одобрение версии 2 создаёт `order_changed` только получателям; `finalized = true` создаёт `order_selected` выбранной модели; `admin_answer_question` создаёт `question_answered` автору; язык `uz` даёт узбекский текст, неизвестный язык — русский; тексты и `data` уведомлений модели не содержат названия компании, телефона, имени заказчика; заблокированному получателю строка не создаётся; `notify_daily_tasks()` создаёт строки для одобренных моделей, второй вызов в тот же день возвращает 0; пользователь читает только свои уведомления, чужие — нет; админ читает все.
- [ ] **Step 2: Run** `bash supabase/tests/run.sh` — Expected: тесты 0015 FAIL.
- [ ] **Step 3: Implement** миграцию по сигнатурам.
- [ ] **Step 4: Run** `bash supabase/tests/run.sh` — Expected: все `ok`.
- [ ] **Step 5: Commit** `feat(db): notification queue with localized texts and event triggers`.

## Task 2: Edge Function `send-push`

**Files:** Create `supabase/functions/send-push/logic.js`, `supabase/functions/send-push/logic.d.ts`, `supabase/functions/send-push/index.ts`, `supabase/functions/send-push/logic.test.js`; Modify `docs/zaya-setup.md`

**Interfaces:**
- Produces (`logic.js`, чистые функции): `buildMessages(rows: {id, user_id, title, body, data}[], tokens: Record<string, string>): { messages: ExpoMessage[]; skipped: string[] }` (строки без токена попадают в `skipped`); `chunk<T>(items: T[], size: number): T[][]` (размер 100); `interpretTickets(ids: string[], tickets: {status: 'ok' | 'error'; message?: string; details?: {error?: string}}[]): { sent: string[]; failed: { id: string; error: string }[]; invalidTokenIds: string[] }` (`DeviceNotRegistered` → `invalidTokenIds`).
- `index.ts` (Deno): читает до 200 неотправленных строк, берёт токены, шлёт чанками в `https://exp.host/--/api/v2/push/send`, помечает `sent_at` для успешных и `error` для неуспешных, очищает токены с `DeviceNotRegistered`; авторизуется service-role ключом из окружения; идемпотентна (отправленные не трогает).

- [ ] **Step 1: Write failing tests** (`node --test`): `buildMessages` — сообщение имеет `to`, `title`, `body`, `data`, `sound: 'default'`; строка без токена → `skipped`; пустой ввод → пусто; `chunk` — 250 элементов дают 3 чанка 100/100/50; `interpretTickets` — `ok` попадает в `sent`, ошибка — в `failed` с текстом, `DeviceNotRegistered` попадает и в `failed`, и в `invalidTokenIds`; длина результата не зависит от порядка.
- [ ] **Step 2: Run** `node --test supabase/functions` — Expected: FAIL.
- [ ] **Step 3: Implement** `logic.js`, `logic.d.ts` и `index.ts`; описать развёртывание и расписание (`pg_cron` раз в минуту для `send-push`, раз в день для `notify_daily_tasks`) в `docs/zaya-setup.md`.
- [ ] **Step 4: Run** `node --test supabase/functions` — Expected: PASS.
- [ ] **Step 5: Commit** `feat(functions): send-push edge function`.

## Task 3: Push в приложении

**Files:** Create `mobile/src/notifications/registerPush.ts`, `mobile/src/notifications/usePushRegistration.ts`; Modify `mobile/app/_layout.tsx`, `mobile/app.json`, `mobile/package.json`; Test `mobile/__tests__/registerPush.test.ts`

**Interfaces:**
- Produces: `registerForPush(): Promise<string | null>` — на физическом устройстве запрашивает разрешение, получает Expo push token, сохраняет в `profiles.push_token` (`update ... where id = auth.uid()`), возвращает токен; при отказе, на эмуляторе или любой ошибке возвращает `null` без исключения; `usePushRegistration(state: SessionState): void` — вызывает `registerForPush` один раз, когда состояние становится `ready`.

- [ ] **Step 1: Write failing tests:** физическое устройство + разрешение выдано → токен сохранён в `profiles` для текущего пользователя и возвращён; разрешение отклонено → `null`, запись не выполняется; не физическое устройство → `null`; исключение при получении токена → `null`; запись в базу не удалась → `null`, без исключения.
- [ ] **Step 2: Run** `npm test --prefix mobile -- registerPush` — Expected: FAIL.
- [ ] **Step 3: Implement**; установить `expo-notifications` и `expo-device`, добавить плагин `expo-notifications` в `app.json`, подключить `usePushRegistration` в корневой layout.
- [ ] **Step 4: Run** `npm test --prefix mobile`, `npx tsc --noEmit` — Expected: PASS.
- [ ] **Step 5: Commit** `feat(app): push token registration`.

## Task 4: Переводы и локализация брифа

**Files:** Modify `mobile/app/(model)/orders/[id].tsx`, `mobile/src/i18n/{ru,uz,en}.json`, `supabase/seed/dev_content.sql`, `supabase/seed/ideas_content.sql`; Test `mobile/__tests__/ordersScreen.test.tsx`, `supabase/tests/0007_seed.test.sql`, `supabase/tests/0010_content.test.sql`

**Interfaces:**
- Produces: в экране заказа модели подписи полей берутся из ключей `brief.f.<section>.<key>`, булевы значения показываются как `orders.yes`/`orders.no`, неизвестные ключи показываются как есть; seed-файлы содержат непустые `uz` и `en` тексты для всех 30 заданий и 17 идей.

- [ ] **Step 1: Write failing tests:** экран заказа показывает «Название проекта: Summer shoot» (подпись из перевода) и «Питание: Да» для `meals: true`; неизвестный ключ выводится как `key: value`; сид: для каждой активной записи `title->>'uz'`, `title->>'en'`, `description/body->>'uz'`, `->>'en'` непусты.
- [ ] **Step 2: Run** `npm test --prefix mobile -- ordersScreen` и `bash supabase/tests/run.sh` — Expected: FAIL.
- [ ] **Step 3: Implement**: локализация экрана; добавить `orders.yes`/`orders.no`; перевести тексты 30 заданий и 17 идей на узбекский и английский (черновик на утверждение заказчика); seed-файлы остаются идемпотентными (`on conflict do update` для текстов).
- [ ] **Step 4: Run** `npm test --prefix mobile`, `bash supabase/tests/run.sh` — Expected: PASS.
- [ ] **Step 5: Commit** `feat: localize order brief and translate starter content`.

## Task 5: Подготовка релиза: EAS, иконки, CI, инструкции

**Files:** Create `mobile/eas.json`, `mobile/assets/icon.png`, `mobile/assets/adaptive-icon.png`, `mobile/assets/splash-icon.png`, `.github/workflows/zaya-ci.yml`, `docs/zaya-release.md`; Modify `mobile/app.json`; Test `mobile/__tests__/appConfig.test.ts`

**Interfaces:**
- Produces: `app.json` с `name` ZAYA, `version` 1.0.0, `ios.bundleIdentifier`/`android.package` `uz.zaya.app`, `ios.buildNumber` `1`, `android.versionCode` `1`, иконкой и сплэшем на чёрном фоне `#050505`, строками разрешений (фото, уведомления), `ios.usesAppleSignIn: true`, плагинами из этапов 1–3; `eas.json` с профилями `development`, `preview` (Android APK, internal distribution) и `production` (iOS для TestFlight, Android AAB), переменные окружения берутся из EAS secrets; CI-воркфлоу запускает тесты и проверку типов `mobile` и `admin`; `docs/zaya-release.md` — пошаговая выдача APK и TestFlight, настройка Google/Apple входа, Supabase, push и расписаний.

- [ ] **Step 1: Write failing test** (`appConfig.test.ts`, читает `app.json` и `eas.json`): bundle id и package равны `uz.zaya.app`; версия `1.0.0`; `usesAppleSignIn` включён; плагины содержат `expo-router`, `expo-apple-authentication`, `@react-native-google-signin/google-signin`, `expo-image-picker`, `expo-notifications`; иконка, adaptive icon и splash существуют на диске; `eas.json` имеет профили `development`, `preview`, `production`; профиль `preview` для Android собирает `apk`; в `eas.json` нет строк, похожих на секреты (`sk_`, `SECRET`, длинные токены).
- [ ] **Step 2: Run** `npm test --prefix mobile -- appConfig` — Expected: FAIL.
- [ ] **Step 3: Implement** конфигурацию, иконки (из монограммы ZAYA на чёрном фоне 1024×1024), CI и документацию; проверить `npx expo config --type public` и пробную генерацию нативных проектов `npx expo prebuild --no-install --platform all` во временном каталоге (результат не коммитится).
- [ ] **Step 4: Run** `npm test --prefix mobile`, `npx tsc --noEmit`, `npx expo export --platform android` — Expected: PASS; prebuild завершается без ошибок конфигурации.
- [ ] **Step 5: Commit** `chore: release configuration, icons, CI and release guide`.

---

## Self-Review

- **Покрытие (этап 5):** push (Задачи 1–3), переводы (Задача 4), сборки APK/TestFlight (Задача 5). Сами сборки и публикацию выполняет владелец аккаунтов Expo/Apple/Google по `docs/zaya-release.md`.
- **Согласованность:** виды уведомлений (`order_new` и др.) одинаковы в Задачах 1 и 2; поле `profiles.push_token` — Задачи 1–3.
- **Review Focus:** 1–2 — Задача 1; 3–4 — Задача 2; 5 — Задача 3; 6 — Задача 4.
