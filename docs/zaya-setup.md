# ZAYA: запуск проекта (этап 1)

## Приложение (`mobile/`)
    cd mobile && npm install && npm test
    npx tsc --noEmit

Переменные окружения (шаблон `mobile/.env.example`, реальные значения только в `.env`, в git не коммитятся):
`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`, `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`.

## База данных (`supabase/`)
С Docker и Supabase CLI: `supabase start`, затем `supabase test db`.
Без Docker: `bash supabase/tests/run.sh` (временный PostgreSQL 16 + pgTAP, заглушка схемы `auth`).

## Настройка Supabase-проекта
1. Создать проект на supabase.com, применить миграции `supabase/migrations/*.sql` (`supabase db push`).
2. Authentication → Providers: включить Email, Google (Web client ID/secret) и Apple (Services ID, ключ).
3. Передать URL и anon key в `.env` приложения.
4. Зарегистрировать будущего суперадмина через приложение и выполнить `scripts/promote-admin.sql` с его e-mail (SQL editor, service role).
5. Для Sign in with Apple нужен аккаунт Apple Developer (bundle id `uz.zaya.app`).
