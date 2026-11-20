#!/usr/bin/env bash
# supabase/migrations/*.sql を 1 ファイルにまとめ、Supabase ダッシュボードの SQL Editor に貼り付けて実行できるようにする
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/supabase/setup.sql"
{
  echo "-- ====================================================================="
  echo "-- WariNote セットアップ SQL（自動生成：scripts/build-setup-sql.sh）"
  echo "-- Supabase ダッシュボード > SQL Editor に全文を貼り付けて「Run」してください。"
  echo "-- 新しい（空の）プロジェクトで 1 回だけ実行します。サンプルデータは含みません。"
  echo "-- ====================================================================="
  for f in "$ROOT"/supabase/migrations/*.sql; do
    echo
    echo "-- >>> $(basename "$f")"
    cat "$f"
  done
} > "$OUT"
echo "wrote $OUT ($(wc -l < "$OUT") lines)"
