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

## Веб-админка (`admin/`)
    cd admin && npm install && npm test && npm run build
Переменные окружения (шаблон `admin/.env.example`): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`. Service-role ключ в админку не кладётся.
Вход только для аккаунта с ролью `admin` (назначается `scripts/promote-admin.sql`). Для запуска локально: `npm run dev`.
Сборку из `admin/dist` можно выложить на любой статический хостинг (Netlify, Vercel, GitHub Pages и т.п.).

## 3D-каталог
Страница сгенерирована из `catalog.html` сайта ZAYA без зашитых данных моделей: `node mobile/scripts/build-catalog-html.js <путь к catalog.html>`.
Проверка в headless-браузере: `THREE_JS=<путь к three.min.js r128> CHROMIUM=<путь к chrome> node mobile/scripts/catalog-smoke.js`
(`THREE_JS` нужен только если CDN недоступен).
