-- =====================================================================
-- 複数ユーザー動作確認・セキュリティテスト（STEP 8）
--   シナリオ：A・B・C・D の4人で沖縄旅行。E は無関係の部外者、F は承認制で参加申請する人。
--   各ステップで「ログイン中のユーザー」を切り替え、Supabase と同じ authenticated ロール + RLS で検証する。
--   実行: bash supabase/tests/local/run.sh
-- =====================================================================
\set ON_ERROR_STOP 1
\o /dev/null

-- ---------- テスト用ヘルパー ----------
create schema tests;
grant usage on schema tests to anon, authenticated;

create function tests.eq(actual anyelement, expected anyelement, msg text) returns void
language plpgsql as $$
begin
  if actual is distinct from expected then
    raise exception 'FAIL: % (expected %, got %)', msg, expected, actual;
  end if;
  raise notice 'ok - %', msg;
end $$;

create function tests.throws(q text, pattern text, msg text) returns void
language plpgsql as $$
begin
  begin
    execute q;
  exception when others then
    if sqlerrm ~* pattern then
      raise notice 'ok - % (%)', msg, sqlerrm;
      return;
    end if;
    raise exception 'FAIL: % (expected error ~ "%", got "%")', msg, pattern, sqlerrm;
  end;
  raise exception 'FAIL: % (expected error ~ "%", but it succeeded)', msg, pattern;
end $$;

create function tests.id(name text) returns uuid language sql stable as $$
  select current_setting('test.' || name)::uuid
$$;
create function tests.balance(p_user text) returns bigint language sql stable as $$
  select b.balance from public.group_balances(tests.id('g')) b where b.user_id = tests.id(p_user)
$$;
create function tests.eff(p_user text) returns bigint language sql stable as $$
  select b.effective_balance from public.group_balances(tests.id('g')) b where b.user_id = tests.id(p_user)
$$;
grant execute on all functions in schema tests to anon, authenticated;

-- ---------- ユーザー ----------
set test.a = '00000000-0000-4000-8000-00000000000a';
set test.b = '00000000-0000-4000-8000-00000000000b';
set test.c = '00000000-0000-4000-8000-00000000000c';
set test.d = '00000000-0000-4000-8000-00000000000d';
set test.e = '00000000-0000-4000-8000-00000000000e';
set test.f = '00000000-0000-4000-8000-00000000000f';

insert into auth.users (id, email, raw_user_meta_data) values
  (tests.id('a'), 'a@example.com', '{"display_name":"Aさん"}'),
  (tests.id('b'), 'b@example.com', '{"display_name":"Bさん"}'),
  (tests.id('c'), 'c@example.com', '{"display_name":"Cさん"}'),
  (tests.id('d'), 'd@example.com', '{"display_name":"Dさん"}'),
  (tests.id('e'), 'e@example.com', '{"display_name":"部外者E"}'),
  (tests.id('f'), 'f@example.com', '{}');

select tests.eq((select count(*) from public.profiles), 6::bigint, '新規登録でプロフィールが自動作成される');
select tests.eq((select display_name from public.profiles where id = tests.id('f')), 'f', '表示名が未指定ならメールの@前を使う');

\set as_a 'reset role; set request.jwt.claims = ''{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated"}''; set role authenticated;'
\set as_b 'reset role; set request.jwt.claims = ''{"sub":"00000000-0000-4000-8000-00000000000b","role":"authenticated"}''; set role authenticated;'
\set as_c 'reset role; set request.jwt.claims = ''{"sub":"00000000-0000-4000-8000-00000000000c","role":"authenticated"}''; set role authenticated;'
\set as_d 'reset role; set request.jwt.claims = ''{"sub":"00000000-0000-4000-8000-00000000000d","role":"authenticated"}''; set role authenticated;'
\set as_e 'reset role; set request.jwt.claims = ''{"sub":"00000000-0000-4000-8000-00000000000e","role":"authenticated"}''; set role authenticated;'
\set as_f 'reset role; set request.jwt.claims = ''{"sub":"00000000-0000-4000-8000-00000000000f","role":"authenticated"}''; set role authenticated;'
\set as_anon 'reset role; set request.jwt.claims = ''{"role":"anon"}''; set role anon;'

-- =====================================================================
-- 1〜4. A がグループを作り、招待URLで B・C・D が参加
-- =====================================================================
:as_a
select set_config('test.g', public.create_group('沖縄旅行', '4人旅', 'plane', 'teal')::text, false);
select tests.eq((select role::text from public.group_members where user_id = tests.id('a')), 'owner', '作成者はオーナー');
select set_config('test.token', public.create_invitation(tests.id('g'), 7, null), false);
select tests.eq(char_length(current_setting('test.token')), 64, '招待トークンは64桁のランダム値');

-- 部外者 E：招待URLのプレビューは見えるが、グループの中身は見えない
:as_e
select tests.eq((select status from public.get_invitation_preview(current_setting('test.token'))), 'valid', 'E: 招待プレビューは有効');
select tests.eq((select group_name from public.get_invitation_preview(current_setting('test.token'))), '沖縄旅行', 'E: プレビューでグループ名は分かる');
select tests.eq((select count(*) from public.groups), 0::bigint, 'E: 未参加グループは見えない');
select tests.eq((select count(*) from public.group_invitations), 0::bigint, 'E: 招待一覧は見えない');

:as_anon
select tests.eq((select status from public.get_invitation_preview(current_setting('test.token'))), 'valid', '未ログインでも招待プレビューは見られる');
select tests.throws('select * from public.groups', 'permission denied', '未ログイン: groups を読めない');
select tests.throws('select * from public.profiles', 'permission denied', '未ログイン: profiles を読めない');
select tests.throws('select * from public.expenses', 'permission denied', '未ログイン: expenses を読めない');
select tests.throws(format('select public.accept_invitation(%L)', current_setting('test.token')), 'permission denied', '未ログイン: 参加RPCは実行不可');

:as_b
select tests.eq(public.accept_invitation(current_setting('test.token')) ->> 'result', 'joined', 'B が招待URLから参加');
:as_c
select tests.eq(public.accept_invitation(current_setting('test.token')) ->> 'result', 'joined', 'C が招待URLから参加');
:as_d
select tests.eq(public.accept_invitation(current_setting('test.token')) ->> 'result', 'joined', 'D が招待URLから参加');
select tests.eq(public.accept_invitation(current_setting('test.token')) ->> 'result', 'already_member', '二重参加はしない');
select tests.eq((select count(*) from public.group_members where group_id = tests.id('g')), 4::bigint, 'D から見てメンバーは4人');
select tests.eq((select count(*) from public.profiles), 4::bigint, 'D は同じグループの4人のプロフィールだけ見える（部外者E・Fは見えない）');

-- =====================================================================
-- 5〜8. 支出登録（A ホテル20,000 / B レンタカー12,000 / C 食事8,000）→ 全員に共有
-- =====================================================================
:as_a
select set_config('test.hotel', public.save_expense(tests.id('g'), 'ホテル代', 20000, tests.id('a'), 'lodging', '2026-11-20', null, 'equal',
  array[tests.id('d'), tests.id('c'), tests.id('b'), tests.id('a')])::text, false);
:as_b
select set_config('test.car', public.save_expense(tests.id('g'), 'レンタカー代', 12000, tests.id('b'), 'transport', '2026-11-20', null, 'equal',
  array[tests.id('a'), tests.id('b'), tests.id('c'), tests.id('d')])::text, false);
:as_c
select set_config('test.food', public.save_expense(tests.id('g'), '食事代', 8000, tests.id('c'), 'food', '2026-11-21', 'ソーキそば', 'equal',
  array[tests.id('a'), tests.id('b'), tests.id('c'), tests.id('d')])::text, false);

:as_d
select tests.eq((select count(*) from public.expenses where group_id = tests.id('g') and deleted_at is null), 3::bigint, 'D のスマホにも3件の支出が共有されている');
select tests.eq((select sum(share_amount) from public.expense_splits where expense_id = tests.id('hotel'))::bigint, 20000::bigint, 'ホテル代：負担額の合計 = 支出額');
select tests.eq((select share_amount from public.expense_splits where expense_id = tests.id('hotel') and user_id = tests.id('d')), 5000::bigint, 'ホテル代：D の負担 5,000円');
select tests.eq(tests.balance('a'),  10000::bigint, '残高 A: +10,000（受け取る）');
select tests.eq(tests.balance('b'),   2000::bigint, '残高 B: +2,000（受け取る）');
select tests.eq(tests.balance('c'),  -2000::bigint, '残高 C: -2,000（支払う）');
select tests.eq(tests.balance('d'), -10000::bigint, '残高 D: -10,000（支払う）');
select tests.eq((select sum(balance) from public.group_balances(tests.id('g')))::bigint, 0::bigint, '残高の合計は常に0');
select tests.eq((select count(*) from public.notifications where type = 'expense_created'), 3::bigint, 'D に「支出が追加されました」通知が3件');

-- 端数処理：10,000円を3人で（B 支払い）→ 支払者 B が 3,334
:as_a
select set_config('test.odd', public.save_expense(tests.id('g'), '端数テスト', 10000, tests.id('b'), 'other', '2026-11-21', null, 'equal',
  array[tests.id('a'), tests.id('b'), tests.id('c')])::text, false);
select tests.eq((select share_amount from public.expense_splits where expense_id = tests.id('odd') and user_id = tests.id('b')), 3334::bigint, '均等割り：余り1円は支払者が負担');
select tests.eq((select share_amount from public.expense_splits where expense_id = tests.id('odd') and user_id = tests.id('a')), 3333::bigint, '均等割り：他は3,333円');
select tests.eq((select sum(share_amount) from public.expense_splits where expense_id = tests.id('odd'))::bigint, 10000::bigint, '均等割り：合計一致');
select public.delete_expense(tests.id('odd'));

-- 割合：1,001円を 33.33% / 33.33% / 33.34% → 最大剰余法
select set_config('test.pct', public.save_expense(tests.id('g'), '割合テスト', 1001, tests.id('a'), 'other', '2026-11-21', null, 'percent',
  array[tests.id('a'), tests.id('b'), tests.id('c')], array[3333, 3333, 3334]::bigint[])::text, false);
select tests.eq((select array_agg(share_amount order by user_id) from public.expense_splits where expense_id = tests.id('pct')), array[334, 333, 334]::bigint[], '割合：端数は剰余の大きい順に1円ずつ');
select public.delete_expense(tests.id('pct'));

-- 金額指定
select set_config('test.exact', public.save_expense(tests.id('g'), '金額指定テスト', 5000, tests.id('a'), 'other', '2026-11-21', null, 'exact',
  array[tests.id('a'), tests.id('b')], array[1200, 3800]::bigint[])::text, false);
select tests.eq((select share_amount from public.expense_splits where expense_id = tests.id('exact') and user_id = tests.id('b')), 3800::bigint, '金額指定：指定どおり');
select public.delete_expense(tests.id('exact'));
select tests.eq(tests.balance('a'), 10000::bigint, '削除した支出は残高に影響しない');

select tests.throws(format('select public.save_expense(%L, %L, 5000, %L, %L, %L, null, %L, array[%L,%L]::uuid[], array[1000,3000]::bigint[])',
  tests.id('g'), 'x', tests.id('a'), 'other', '2026-11-21', 'exact', tests.id('a'), tests.id('b')), 'SPLIT_SUM_MISMATCH', '金額指定の合計不一致は拒否');
select tests.throws(format('select public.save_expense(%L, %L, 5000, %L, %L, %L, null, %L, array[%L,%L]::uuid[], array[5000,4000]::bigint[])',
  tests.id('g'), 'x', tests.id('a'), 'other', '2026-11-21', 'percent', tests.id('a'), tests.id('b')), 'PERCENT_SUM_MISMATCH', '割合の合計が100%でなければ拒否');
select tests.throws(format('select public.save_expense(%L, %L, 5000, %L, %L, %L, null, %L, array[%L,%L]::uuid[])',
  tests.id('g'), 'x', tests.id('a'), 'other', '2026-11-21', 'equal', tests.id('a'), tests.id('e')), 'PARTICIPANT_NOT_MEMBER', 'メンバー以外を割り勘対象にできない');
select tests.throws(format('select public.save_expense(%L, %L, 0, %L, %L, %L, null, %L, array[%L]::uuid[])',
  tests.id('g'), 'x', tests.id('a'), 'other', '2026-11-21', 'equal', tests.id('a')), 'INVALID_AMOUNT', '0円は拒否');

-- =====================================================================
-- セキュリティ：部外者 E は何も見えず、何も書けない
-- =====================================================================
:as_e
select tests.eq((select count(*) from public.expenses), 0::bigint, 'E: 他グループの支出は0件');
select tests.eq((select count(*) from public.expense_splits), 0::bigint, 'E: 他グループの負担額は0件');
select tests.eq((select count(*) from public.settlements), 0::bigint, 'E: 他グループの精算は0件');
select tests.eq((select count(*) from public.activity_logs), 0::bigint, 'E: 他グループの履歴は0件');
select tests.eq((select count(*) from public.group_members), 0::bigint, 'E: 他グループのメンバーは0件');
select tests.eq((select count(*) from public.profiles), 1::bigint, 'E: 自分のプロフィールしか見えない');
select tests.eq((select count(*) from public.notifications), 0::bigint, 'E: 他人の通知は見えない');
select tests.throws(format('select * from public.group_balances(%L)', tests.id('g')), 'NOT_MEMBER', 'E: 他グループの残高RPCは拒否');
select tests.throws(format('select public.save_expense(%L, %L, 100, %L, %L, %L, null, %L, array[%L]::uuid[])',
  tests.id('g'), '不正', tests.id('e'), 'other', '2026-11-21', 'equal', tests.id('e')), 'NOT_MEMBER', 'E: 他グループに支出を登録できない');
select tests.throws(format('insert into public.expenses (group_id, title, amount, paid_by, spent_on) values (%L, %L, 1, %L, %L)',
  tests.id('g'), '直接INSERT', tests.id('e'), '2026-11-21'), 'permission denied', 'E: テーブルへの直接INSERTは権限なし');
select tests.throws(format('update public.expenses set amount = 1 where id = %L', tests.id('hotel')), 'permission denied', 'E: テーブルへの直接UPDATEは権限なし');
select tests.throws(format('delete from public.expenses where id = %L', tests.id('hotel')), 'permission denied', 'E: テーブルへの直接DELETEは権限なし');
select tests.throws(format('insert into public.group_members (group_id, user_id, role) values (%L, %L, %L)', tests.id('g'), tests.id('e'), 'owner'),
  'permission denied', 'E: 自分をメンバーに直接追加できない');
select tests.throws(format('select private.notify(%L, null, %L, %L, %L, %L)', tests.id('a'), 'x', '偽通知', 'x', '/'),
  'permission denied', 'E: 内部関数（通知送信）は呼べない');
select tests.throws(format('select * from private.balances(array[%L]::uuid[])', tests.id('g')), 'permission denied', 'E: 内部関数（残高計算）は呼べない');
select tests.throws(format('select public.delete_expense(%L)', tests.id('hotel')), 'EXPENSE_NOT_FOUND', 'E: 他グループの支出を削除できない');

-- メンバー同士でも：他人のプロフィールや通知は改ざん不可
:as_b
do $$
declare n int;
begin
  update public.profiles set display_name = '乗っ取り' where id = tests.id('a');
  get diagnostics n = row_count;
  perform tests.eq(n, 0, 'B: 他人のプロフィールは更新できない');
  update public.notifications set read_at = now() where user_id = tests.id('a');
  get diagnostics n = row_count;
  perform tests.eq(n, 0, 'B: 他人の通知は既読にできない');
  update public.notifications set read_at = now() where user_id = tests.id('b');
  get diagnostics n = row_count;
  perform tests.eq(n > 0, true, 'B: 自分の通知は既読にできる');
end $$;
select tests.throws(format('update public.notifications set title = %L where user_id = %L', '改ざん', tests.id('b')),
  'permission denied', 'B: 通知の本文は書き換えられない（read_at 列のみ許可）');
select tests.throws(format('update public.profiles set id = %L where id = %L', tests.id('e'), tests.id('b')),
  'permission denied', 'B: プロフィールのIDは書き換えられない');
select tests.throws(format('select public.delete_expense(%L)', tests.id('hotel')), 'FORBIDDEN', 'B: 他人が登録・支払いした支出は削除できない（管理者以外）');

-- =====================================================================
-- 9〜12. 精算：D→A 10,000 / C→B 2,000（二重精算の防止を含む）
-- =====================================================================
:as_d
select set_config('test.s1', public.record_settlement(tests.id('g'), tests.id('d'), tests.id('a'), 10000, null, '11111111-1111-4111-8111-111111111111')::text, false);
select tests.eq((select status::text from public.settlements where id = tests.id('s1')), 'pending', 'D の支払い申告は「確認待ち」');
select tests.eq(public.record_settlement(tests.id('g'), tests.id('d'), tests.id('a'), 10000, null, '11111111-1111-4111-8111-111111111111'),
  tests.id('s1'), '同じ request_id の再送信は同じ記録を返す（ボタン連打対策）');
select tests.eq((select count(*) from public.settlements), 1::bigint, '連打しても精算記録は1件');
select tests.throws(format('select public.record_settlement(%L, %L, %L, 10000)', tests.id('g'), tests.id('d'), tests.id('a')),
  'PENDING_EXISTS', '確認待ちがある相手への二重申告は拒否');
select tests.throws(format('select public.record_settlement(%L, %L, %L, 1)', tests.id('g'), tests.id('d'), tests.id('b')),
  'NOTHING_TO_SETTLE', '申告済みの D はもう支払う残額がない（二重精算防止）');
select tests.eq(tests.eff('d'), 0::bigint, 'D の実効残高は0（確認待ち込み）');
select tests.eq(tests.balance('d'), -10000::bigint, 'D の確定残高は確認されるまで -10,000');

:as_c
select tests.throws(format('select public.record_settlement(%L, %L, %L, 3000)', tests.id('g'), tests.id('c'), tests.id('b')),
  'SETTLEMENT_EXCEEDS', 'C は 2,000円を超えて支払えない');
select tests.throws(format('select public.record_settlement(%L, %L, %L, 100)', tests.id('g'), tests.id('c'), tests.id('a')),
  'NOTHING_TO_SETTLE', 'A は申告分で受取予定がなくなっている');
select tests.throws(format('select public.record_settlement(%L, %L, %L, 100)', tests.id('g'), tests.id('b'), tests.id('a')),
  'FORBIDDEN', '当事者以外は精算を登録できない');

:as_b
select tests.throws(format('select public.confirm_settlement(%L)', tests.id('s1')), 'FORBIDDEN', '受取人以外は受け取り確認できない');
:as_e
select tests.throws(format('select public.confirm_settlement(%L)', tests.id('s1')), 'NOT_FOUND', '部外者は確認できない');
:as_a
select tests.eq((select count(*) from public.notifications where type = 'settlement_reported'), 1::bigint, 'A に支払い申告の通知が届く');
select public.confirm_settlement(tests.id('s1'));
select tests.throws(format('select public.confirm_settlement(%L)', tests.id('s1')), 'INVALID_STATE', '確認済みを再確認できない（二重計上防止）');
select tests.eq(tests.balance('a'), 0::bigint, '確認後：A の残高 0');
select tests.eq(tests.balance('d'), 0::bigint, '確認後：D の残高 0');

-- 受取人 B が直接「受け取りを記録」
:as_b
select public.record_settlement(tests.id('g'), tests.id('c'), tests.id('b'), 2000);
select tests.eq((select count(*) from public.group_balances(tests.id('g')) where balance <> 0), 0::bigint, '全員の残高が0（精算完了）');
:as_c
select tests.eq((select count(*) from public.notifications where type = 'all_settled'), 1::bigint, 'C に「精算がすべて完了しました」通知');
select tests.eq((select count(*) from public.settlements where status = 'confirmed'), 2::bigint, 'C から見ても精算状況が反映（確定2件）');

-- =====================================================================
-- 編集・削除後の再計算と整合性
-- =====================================================================
:as_a
select tests.throws(format('select public.save_expense(%L, %L, 24000, %L, %L, %L, null, %L, array[%L,%L,%L,%L]::uuid[], null, %L)',
  tests.id('g'), 'ホテル代', tests.id('a'), 'lodging', '2026-11-20', 'equal', tests.id('a'), tests.id('b'), tests.id('c'), tests.id('d'), tests.id('hotel')),
  'SETTLED_CONFIRM_REQUIRED', '精算済みの支出の編集には確認が必要');
select tests.throws(format('select public.save_expense(%L, %L, 24000, %L, %L, %L, null, %L, array[%L,%L,%L,%L]::uuid[], null, %L, %L, true)',
  tests.id('g'), 'ホテル代', tests.id('a'), 'lodging', '2026-11-20', 'equal', tests.id('a'), tests.id('b'), tests.id('c'), tests.id('d'), tests.id('hotel'), '2000-01-01'),
  'CONFLICT', '他の人が先に編集していたら上書きしない（楽観的排他）');
select public.save_expense(tests.id('g'), 'ホテル代', 24000, tests.id('a'), 'lodging', '2026-11-20', null, 'equal',
  array[tests.id('a'), tests.id('b'), tests.id('c'), tests.id('d')], null, tests.id('hotel'),
  (select updated_at from public.expenses where id = tests.id('hotel')), true);
select tests.eq(tests.balance('a'),  3000::bigint, '編集後の再計算：A +3,000');
select tests.eq(tests.balance('b'), -1000::bigint, '編集後の再計算：B -1,000');
select tests.eq(tests.balance('c'), -1000::bigint, '編集後の再計算：C -1,000');
select tests.eq(tests.balance('d'), -1000::bigint, '編集後の再計算：D -1,000');
select tests.eq((select (metadata -> 'before' ->> 'amount')::int from public.activity_logs where action = 'expense.updated' and entity_id = tests.id('hotel')),
  20000, '編集履歴に変更前の金額が残る');
select tests.eq((select actor_id from public.activity_logs where action = 'expense.updated' and entity_id = tests.id('hotel')),
  tests.id('a'), '編集履歴に「誰が」編集したかが残る');
select tests.eq((select updated_by from public.expenses where id = tests.id('hotel')), tests.id('a'), 'expenses.updated_by が記録される');

-- メンバー管理
select tests.throws(format('select public.remove_member(%L, %L)', tests.id('g'), tests.id('d')), 'MEMBER_HAS_BALANCE', '未精算のメンバーは外せない');
:as_b
select tests.throws(format('select public.remove_member(%L, %L)', tests.id('g'), tests.id('c')), 'FORBIDDEN', '一般メンバーは他人を外せない');
select tests.throws(format('select public.update_group(%L, %L, null, null, null, false, null)', tests.id('g'), '乗っ取り'), 'FORBIDDEN', '一般メンバーはグループ設定を変更できない');

-- リマインド（1日1回まで）
:as_a
select tests.eq(public.send_payment_reminder(tests.id('g'), tests.id('d')), true, 'A → D に支払いリマインド');
select tests.eq(public.send_payment_reminder(tests.id('g'), tests.id('d')), false, '同日2回目のリマインドは送られない');
:as_d
select tests.eq((select count(*) from public.notifications where type = 'payment_reminder'), 1::bigint, 'D にリマインドが1件届く');
select tests.throws(format('select public.send_payment_reminder(%L, %L)', tests.id('g'), tests.id('a')), 'NOTHING_TO_SETTLE', '支払う側は催促できない');

-- 精算期限の通知（pg_cron から実行される関数）
:as_a
select public.update_group(tests.id('g'), '沖縄旅行', '4人旅', 'plane', 'teal', false, ((now() at time zone 'Asia/Tokyo')::date + 2));
reset role;
select tests.eq(private.send_due_reminders(), 3, '期限前通知：未払いの3人（B・C・D）に送信');
select private.send_due_reminders();
select tests.eq((select count(*) from public.notifications where type = 'due_reminder'), 3::bigint, '期限前通知は1日1回（重複しない）');

-- =====================================================================
-- 承認制の参加申請・招待の失効
-- =====================================================================
:as_a
select public.update_group(tests.id('g'), '沖縄旅行', '4人旅', 'plane', 'teal', true, null);
:as_f
select tests.eq(public.accept_invitation(current_setting('test.token')) ->> 'result', 'requested', 'F: 承認制なので参加申請になる');
select tests.eq((select count(*) from public.groups), 0::bigint, 'F: 承認前はグループが見えない');
:as_b
select tests.throws(format('select public.decide_join_request(%L, true)', (select id from public.group_join_requests limit 1)),
  'NOT_FOUND', '一般メンバーは申請を承認できない');
select tests.eq((select count(*) from public.profiles where id = tests.id('f')), 0::bigint, '一般メンバーには申請者のプロフィールは見えない');
:as_a
select tests.eq((select count(*) from public.notifications where type = 'join_requested'), 1::bigint, 'オーナーに参加申請の通知');
select tests.eq((select display_name from public.profiles where id = tests.id('f')), 'f', '管理者は申請者の表示名を確認できる');
select public.decide_join_request((select id from public.group_join_requests where status = 'pending'), true);
:as_f
select tests.eq((select count(*) from public.groups), 1::bigint, 'F: 承認後はグループが見える');

:as_a
select public.revoke_invitation((select id from public.group_invitations where token = current_setting('test.token')));
:as_e
select tests.eq((select status from public.get_invitation_preview(current_setting('test.token'))), 'revoked', '無効化された招待');
select tests.eq((select group_name from public.get_invitation_preview(current_setting('test.token'))), null::text, '無効な招待ではグループ名も返さない');
select tests.throws(format('select public.accept_invitation(%L)', current_setting('test.token')), 'INVITATION_EXPIRED', '無効化された招待では参加できない');
select tests.eq((select status from public.get_invitation_preview(repeat('0', 64))), 'invalid', '存在しないトークン');

-- =====================================================================
-- グループ間の分離：E が自分のグループを作っても A からは見えない
-- =====================================================================
:as_e
select set_config('test.g2', public.create_group('Eの飲み会', null, 'beer', 'amber')::text, false);
select public.save_expense(tests.id('g2'), '居酒屋', 9000, tests.id('e'), 'drinks', '2026-11-21', null, 'equal', array[tests.id('e')]);
select tests.eq((select count(*) from public.groups), 1::bigint, 'E: 自分のグループだけ見える');
:as_a
select tests.eq((select count(*) from public.groups), 1::bigint, 'A: E のグループは見えない');
select tests.eq((select count(*) from public.expenses where group_id = tests.id('g2')), 0::bigint, 'A: E のグループの支出は見えない');
select tests.eq((select count(distinct group_id) from public.my_balances()), 1::bigint, 'A: 自分の残高RPCも所属グループ分だけ');
select tests.eq((select count(*) from public.my_group_overview()), 1::bigint, 'A: ダッシュボード集計も所属グループ分だけ');
select tests.eq((public.my_analytics('2026-01-01') -> 'group_total' ->> current_setting('test.g'))::bigint, 44000::bigint, 'A: 分析の集計（総支出 44,000円）');
select tests.eq((public.my_analytics('2026-01-01') -> 'monthly_mine' ->> '2026-11')::bigint, 11000::bigint, 'A: 分析の自分の負担（11,000円）');
select tests.eq(public.my_analytics('2026-01-01') -> 'group_total' ? current_setting('test.g2'), false, 'A: 分析に E のグループは含まれない');

-- Realtime 配信対象
reset role;
select tests.eq((select count(*) from pg_publication_tables where pubname = 'supabase_realtime'), 8::bigint, 'Realtime 配信対象テーブル 8つ');
-- すべてのテーブルで RLS が有効
select tests.eq((select count(*) from pg_tables where schemaname = 'public' and not rowsecurity), 0::bigint, 'public の全テーブルで RLS 有効');

\o
\echo '  ✔ 複数ユーザー・セキュリティテスト：すべて成功'
