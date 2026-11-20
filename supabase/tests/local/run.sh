#!/usr/bin/env bash
# ローカル PostgreSQL に一時クラスタを作り、マイグレーション＋テストを実行する検証スクリプト。
#   使い方: bash supabase/tests/local/run.sh
#   （Supabase CLI を使う場合は `supabase db reset` → `psql -f supabase/tests/*.sql` でも可）
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
PGBIN="${PGBIN:-$(ls -d /usr/lib/postgresql/*/bin | tail -1)}"
DATA="$(mktemp -d /tmp/warinote-pg.XXXXXX)"
PORT="${PGPORT:-54329}"
RUNAS=""
if [ "$(id -u)" = "0" ]; then RUNAS="runuser -u postgres --"; chown postgres "$DATA"; fi

cleanup() { $RUNAS "$PGBIN/pg_ctl" -D "$DATA" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$DATA"; }
trap cleanup EXIT

$RUNAS "$PGBIN/initdb" -D "$DATA" -U postgres --auth=trust -E UTF8 --locale=C.UTF-8 >/dev/null
$RUNAS "$PGBIN/pg_ctl" -D "$DATA" -o "-p $PORT -k /tmp -c listen_addresses='' -c wal_level=logical" -l "$DATA/log" -w start >/dev/null

PSQL=(psql -h /tmp -p "$PORT" -U postgres -d postgres -v ON_ERROR_STOP=1 -q -X)
"${PSQL[@]}" -f "$ROOT/supabase/tests/local/00_supabase_stub.sql"
for f in "$ROOT"/supabase/migrations/*.sql; do
  echo "▶ migrate $(basename "$f")"
  "${PSQL[@]}" -f "$f"
done
for f in "$ROOT"/supabase/tests/*.sql; do
  echo "▶ test    $(basename "$f")"
  "${PSQL[@]}" -f "$f"
done
echo "▶ seed    seed.sql（ローカル開発用データの投入確認）"
"${PSQL[@]}" -o /dev/null -f "$ROOT/supabase/seed.sql"
"${PSQL[@]}" -At -c "select '  seed: users=' || (select count(*) from auth.users where email like '%@example.com' and id::text like '10000000%') || ' expenses=' || (select count(*) from public.expenses e join public.groups g on g.id = e.group_id where g.name like '%サンプル%') || ' A残高=' || (select balance from private.balances(array[(select id from public.groups where name like '%サンプル%')]) where user_id = '10000000-0000-4000-8000-000000000001')"
if [ "${1:-}" = "--keep" ]; then
  echo "DB is running on port $PORT (Ctrl+C to stop)"; trap - EXIT; exit 0
fi
echo "✅ all database tests passed"
