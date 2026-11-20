# WariNote 設計書（STEP 1）

複数人で使う割り勘・共有家計管理 Web アプリ。各ユーザーが自分のアカウントでログインし、
所属グループのデータだけをリアルタイムに共有する。

## 1. 全体アーキテクチャ

```
[スマホ / PC ブラウザ]  ── HTTPS ──>  [Next.js (Cloudflare Workers / OpenNext)]
     │  ▲                                  │  Server Components / Server Actions
     │  │ Realtime (WebSocket, RLS適用)      │  （ユーザー本人のJWTでSupabaseを呼ぶ）
     ▼  │                                  ▼
[Supabase]  Auth（メール+パスワード） / PostgreSQL（RLS） / Realtime / pg_cron
```

- **認可の本体はデータベース**。全テーブルに RLS を設定し、書き込みはすべて
  `SECURITY DEFINER` の RPC 経由（入力検証・権限チェック・計算をDB内で実施）。
  クライアントからのテーブル直接 INSERT/UPDATE/DELETE は権限ごと剥奪している。
- **金額はすべて整数（円）**。割合は「ベーシスポイント（1% = 100）」の整数で保持。浮動小数点は使わない。
- **割り勘の負担額はDB側で計算**（`compute_split`）。画面のプレビューは同一アルゴリズムのTS実装
  （`src/lib/split.ts`）で、両者が一致することを自動テストで検証済み。
- 残高・精算プランは「支出」と「精算記録」から毎回導出するため、支出の編集・削除後も自動的に正しい値になる。

## 2. 画面構成

| パス | 画面 | 主な内容 |
|---|---|---|
| `/` | ランディング | 未ログイン時の紹介。ログイン済みは `/dashboard` へ |
| `/login` `/signup` `/forgot-password` `/reset-password` | 認証 | メール登録・ログイン・パスワード再設定 |
| `/dashboard` | ホーム | 受取予定/支払予定/立替総額、未精算件数、グループ一覧、自分の精算、最近の支出・活動 |
| `/groups` `/groups/new` | グループ | 参加グループ一覧・作成 |
| `/groups/[id]` | グループ概要 | 総支出、未精算額、メンバー別 立替/負担、最近の支出、精算状況 |
| `/groups/[id]/expenses` | 支出履歴 | 一覧・検索（カテゴリ） |
| `/groups/[id]/expenses/new` `/[eid]` `/[eid]/edit` | 支出 | 登録・詳細（負担内訳・編集履歴）・編集・削除 |
| `/groups/[id]/settle` | 精算 | 最適化された送金プラン、申告→受取確認、履歴、リマインド、期限 |
| `/groups/[id]/members` | メンバー | 招待URL発行/LINE共有/失効、参加申請の承認、権限、退出 |
| `/invite/[token]` | 招待 | グループ情報の確認→参加（または参加申請） |
| `/analytics` | 分析 | 月別推移、カテゴリ別、グループ別、メンバー別 立替/負担 |
| `/notifications` | 通知 | アプリ内通知（Realtimeで即時反映） |
| `/settings` | 設定 | プロフィール、パスワード変更、ログアウト |

スマホは下部タブ（ホーム／グループ／＋支出／分析／設定）、PC は左サイドバー。

## 3. データベース

`users` は Supabase Auth の `auth.users` を使用（パスワードはSupabaseが管理）。

| テーブル | 役割 | 主なカラム |
|---|---|---|
| profiles | 公開プロフィール | id(=auth.users.id), display_name, avatar_color |
| groups | グループ | name, icon, color, join_approval_required, settlement_due_date |
| group_members | 所属 | group_id, user_id, role(owner/admin/member), left_at |
| group_invitations | 招待URL | token(推測不能な長いランダム値), expires_at, max_uses, use_count, revoked_at |
| group_join_requests | 参加申請 | status(pending/approved/rejected) |
| expenses | 支出 | amount(bigint 円), paid_by, category, spent_on, split_method, created_by, updated_by, deleted_at |
| expense_splits | 負担額 | expense_id, user_id, share_amount(円), input_value(指定額 or bp) |
| settlements | 精算記録 | from_user, to_user, amount, status(pending/confirmed/rejected/cancelled), request_id(冪等キー) |
| notifications | 通知 | user_id, type, title, body, link, read_at, dedupe_key |
| activity_logs | 操作履歴 | actor_id, action, entity_type, entity_id, summary, metadata(変更前後) |

全テーブルに `id`（または複合PK）、外部キー、`created_at`、`updated_at`（トリガーで自動更新）。

### 残高の定義

```
残高 = 立替額(支払った支出の合計) − 負担額(割り勘で自分に割り当てられた額)
       + 送った精算(確定) − 受け取った精算(確定)
正 = 受け取る側 / 負 = 支払う側。グループ内の残高合計は常に 0。
```
「確認待ち」の精算は *実効残高* に含め、同じ支払いを二重に提案しない。

## 4. 端数処理（合計と各人負担が必ず一致）

- **均等割り**：`floor(金額 / 人数)` を全員に割り当て、余り（1円単位）を「支払った人 → 参加順」で1円ずつ配分。
  例：10,000円を3人 → 支払者 3,334 / 3,333 / 3,333
- **割合**：各人 `floor(金額 × bp / 10000)`、余りは端数の大きい順（同値は支払者→参加順）に1円ずつ（最大剰余法）。
- **金額指定**：入力額の合計が支出額と一致しない場合はエラー。

## 5. 精算の最適化

残高が 0 でない人を対象に、
1. **15人以下**：ビットマスクDPで「合計0になる部分集合」への最大分割を求め、各部分集合内を貪欲法で精算
   → 送金回数 = 人数 − 部分集合数 となり、**理論上の最小回数**を保証。
2. 16人以上：大きい債務者と大きい債権者を順に組み合わせる貪欲法（最大 n−1 回）。

## 6. 精算フロー・二重精算の防止

```
支払う人「支払いました」→ pending（受け取る人に通知）
受け取る人「受け取りを確認」→ confirmed（支払った人に通知・残高に反映）
          「受け取っていない」→ rejected
受け取る人が直接「受け取りを記録」→ confirmed
```
- 同じ2人の間で確認待ちは1件まで（部分ユニークインデックス）
- `request_id` による冪等化（ボタン連打でも1件）
- 実効残高を超える金額は登録不可（グループ単位のアドバイザリロックで同時実行も直列化）
- 確定済みは `FOR UPDATE` で行ロックし状態遷移を一度だけ許可

## 7. 編集・削除の整合性

- 支出は論理削除（履歴に残る）。残高は常に再導出されるため、編集・削除後も精算額は正しい。
- 楽観的排他：編集画面を開いた時点の `updated_at` と一致しない場合は「他のメンバーが先に編集しました」。
- 確定済みの精算より前に登録された支出を編集/削除する場合、確認（`confirm_settled`）が必須。
- 編集/削除の権限：登録者・支払者・管理者。すべて activity_logs に変更前後を記録。

## 8. セキュリティ

- RLS：グループ系テーブルは `private.is_group_member(group_id)` のときのみ SELECT 可。
- profiles は「本人」または「同じグループに所属（していた）人」のみ参照可。**メールアドレスは他人に一切公開しない**（auth.users にのみ存在）。
- 通知は本人のみ。更新できるのは `read_at` 列だけ（列単位 GRANT）。
- `anon` ロールはテーブルを一切読めない。招待プレビューのみ、トークンを知っている場合に限り
  グループ名・人数・招待者名だけを返す。
- RPC は `search_path = ''` 固定の SECURITY DEFINER。補助関数は API 非公開の `private` スキーマ。

## 9. 通知

アプリ内通知（Realtime で即時表示）。種類：支出の追加/編集/削除、精算の申告/確認/却下、
メンバー参加、参加申請、支払いリマインド、期限前通知（pg_cron で毎朝9時 JST）。
通知はすべて `private.notify()` を通って `notifications` に入るため、将来は Database Webhook /
Edge Function で同テーブルの INSERT を購読すれば、メール・Web Push に拡張できる。

## 10. テストデータの分離

- `supabase/seed.sql` は **ローカル開発（`supabase db reset`）専用**。本番への `supabase db push` では実行されない。
- テストユーザーは全員 `@example.com`（実在しないドメイン）。
- 本番と開発は Supabase プロジェクトを分けることを推奨（README参照）。
