#!/usr/bin/env bash
# Local DB test runner without Docker: temporary PostgreSQL 16 + pgTAP.
# Usage: bash supabase/tests/run.sh  (run as root or as the postgres user)
set -euo pipefail
shopt -s nullglob
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PGBIN=/usr/lib/postgresql/16/bin
DATA=/tmp/zaya-pg-data
PORT=54329
run_pg() { if [ "$(id -u)" = 0 ]; then su postgres -c "$*"; else bash -c "$*"; fi; }
run_pg "rm -rf $DATA && $PGBIN/initdb -D $DATA -A trust >/dev/null"
run_pg "$PGBIN/pg_ctl -D $DATA -o '-p $PORT -k /tmp' -l /tmp/zaya-pg.log -w start >/dev/null"
trap 'run_pg "$PGBIN/pg_ctl -D $DATA -m immediate stop >/dev/null" || true' EXIT
PSQL="psql -X -q -h /tmp -p $PORT -U postgres -d postgres -v ON_ERROR_STOP=1"
$PSQL -c 'create extension pgtap' >/dev/null
$PSQL -f "$ROOT/supabase/tests/_bootstrap.sql" >/dev/null
for f in "$ROOT"/supabase/migrations/*.sql; do $PSQL -f "$f" >/dev/null; done
fail=0
for t in "$ROOT"/supabase/tests/[0-9]*.test.sql; do
  echo "== $(basename "$t")"
  out="$(psql -X -At -h /tmp -p $PORT -U postgres -d postgres -f "$t" 2>&1 || true)"
  echo "$out" | grep -E '^(ok|not ok|#|ERROR|psql:)' || true
  if echo "$out" | grep -qE '^(not ok|ERROR|psql:.*ERROR)|Looks like you failed'; then fail=1; fi
done
exit $fail
