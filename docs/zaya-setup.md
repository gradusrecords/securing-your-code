# ZAYA: запуск проекта

## Приложение
    cd mobile && npm install && npm test

## База данных (локально)
Нужен Docker и Supabase CLI: `supabase start`, затем `supabase test db`.
Без Docker: `bash supabase/tests/run.sh` (локальный PostgreSQL 16 + pgTAP).

Секреты хранятся только в `.env` (шаблон: `mobile/.env.example`), в репозиторий не коммитятся.
