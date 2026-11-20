-- =====================================================================
-- WariNote セットアップ SQL（自動生成：scripts/build-setup-sql.sh）
-- Supabase ダッシュボード > SQL Editor に全文を貼り付けて「Run」してください。
-- 新しい（空の）プロジェクトで 1 回だけ実行します。サンプルデータは含みません。
-- =====================================================================

-- >>> 20261120000001_schema.sql
-- =====================================================================
-- WariNote: スキーマ定義
--   金額はすべて bigint（円・整数）。割合は bp（1% = 100）の整数。
--   users は Supabase Auth の auth.users を利用する。
-- =====================================================================

create schema if not exists private;

-- ---------- 列挙型 ----------
create type public.member_role as enum ('owner', 'admin', 'member');
create type public.split_method as enum ('equal', 'exact', 'percent');
create type public.settlement_status as enum ('pending', 'confirmed', 'rejected', 'cancelled');
create type public.join_request_status as enum ('pending', 'approved', 'rejected');
create type public.expense_category as enum (
  'food', 'drinks', 'transport', 'lodging', 'shopping', 'daily', 'entertainment', 'other'
);

-- ---------- 共通トリガー ----------
create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- 推測不能なトークン（UUIDv4 x2 = 244bit のランダム性）
create or replace function private.new_token()
returns text
language sql
volatile
set search_path = ''
as $$
  select replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
$$;

-- ---------- profiles ----------
create table public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  display_name  text not null check (char_length(btrim(display_name)) between 1 and 30),
  avatar_color  text not null default '#1F7A55' check (avatar_color ~ '^#[0-9A-Fa-f]{6}$'),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
comment on table public.profiles is '公開プロフィール。メールアドレスは保持しない（auth.users のみ）。';

-- ---------- groups ----------
create table public.groups (
  id                      uuid primary key default gen_random_uuid(),
  name                    text not null check (char_length(btrim(name)) between 1 and 40),
  description             text check (description is null or char_length(description) <= 200),
  icon                    text not null default 'users'
                          check (icon in ('users', 'plane', 'beer', 'heart', 'house', 'graduation', 'music', 'briefcase')),
  color                   text not null default 'green'
                          check (color in ('green', 'teal', 'blue', 'indigo', 'rose', 'amber', 'slate')),
  join_approval_required  boolean not null default false,
  settlement_due_date     date,
  created_by              uuid references public.profiles (id) on delete set null,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

-- ---------- group_members ----------
create table public.group_members (
  id          uuid primary key default gen_random_uuid(),
  group_id    uuid not null references public.groups (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  role        public.member_role not null default 'member',
  joined_at   timestamptz not null default now(),
  left_at     timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (group_id, user_id)
);
create index group_members_user_active_idx on public.group_members (user_id) where left_at is null;
create unique index group_members_one_owner_idx on public.group_members (group_id) where role = 'owner';

-- ---------- group_invitations ----------
create table public.group_invitations (
  id          uuid primary key default gen_random_uuid(),
  group_id    uuid not null references public.groups (id) on delete cascade,
  token       text not null unique default private.new_token(),
  created_by  uuid references public.profiles (id) on delete set null,
  expires_at  timestamptz not null default (now() + interval '7 days'),
  max_uses    integer check (max_uses is null or max_uses > 0),
  use_count   integer not null default 0 check (use_count >= 0),
  revoked_at  timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index group_invitations_group_idx on public.group_invitations (group_id);

-- ---------- group_join_requests（参加申請） ----------
create table public.group_join_requests (
  id             uuid primary key default gen_random_uuid(),
  group_id       uuid not null references public.groups (id) on delete cascade,
  user_id        uuid not null references public.profiles (id) on delete cascade,
  invitation_id  uuid references public.group_invitations (id) on delete set null,
  status         public.join_request_status not null default 'pending',
  decided_by     uuid references public.profiles (id) on delete set null,
  decided_at     timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create unique index group_join_requests_one_pending_idx
  on public.group_join_requests (group_id, user_id) where status = 'pending';

-- ---------- expenses ----------
create table public.expenses (
  id            uuid primary key default gen_random_uuid(),
  group_id      uuid not null references public.groups (id) on delete cascade,
  title         text not null check (char_length(btrim(title)) between 1 and 60),
  amount        bigint not null check (amount > 0 and amount <= 100000000),
  paid_by       uuid not null references public.profiles (id),
  category      public.expense_category not null default 'other',
  spent_on      date not null,
  memo          text check (memo is null or char_length(memo) <= 500),
  split_method  public.split_method not null default 'equal',
  created_by    uuid references public.profiles (id) on delete set null,
  updated_by    uuid references public.profiles (id) on delete set null,
  deleted_at    timestamptz,
  deleted_by    uuid references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index expenses_group_date_idx on public.expenses (group_id, spent_on desc, created_at desc) where deleted_at is null;
create index expenses_paid_by_idx on public.expenses (paid_by);

-- ---------- expense_splits ----------
create table public.expense_splits (
  id            uuid primary key default gen_random_uuid(),
  expense_id    uuid not null references public.expenses (id) on delete cascade,
  group_id      uuid not null references public.groups (id) on delete cascade,
  user_id       uuid not null references public.profiles (id),
  share_amount  bigint not null check (share_amount >= 0),
  input_value   bigint,   -- exact: 指定額(円) / percent: bp / equal: null
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (expense_id, user_id)
);
create index expense_splits_group_user_idx on public.expense_splits (group_id, user_id);

-- ---------- settlements ----------
create table public.settlements (
  id            uuid primary key default gen_random_uuid(),
  group_id      uuid not null references public.groups (id) on delete cascade,
  from_user     uuid not null references public.profiles (id),
  to_user       uuid not null references public.profiles (id),
  amount        bigint not null check (amount > 0 and amount <= 100000000),
  status        public.settlement_status not null default 'pending',
  note          text check (note is null or char_length(note) <= 200),
  request_id    uuid unique,   -- 冪等キー（二重送信防止）
  created_by    uuid references public.profiles (id) on delete set null,
  confirmed_by  uuid references public.profiles (id) on delete set null,
  confirmed_at  timestamptz,
  decided_at    timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  check (from_user <> to_user)
);
create index settlements_group_idx on public.settlements (group_id, created_at desc);
-- 同じ2人の間で「確認待ち」は1件まで
create unique index settlements_one_pending_pair_idx
  on public.settlements (group_id, from_user, to_user) where status = 'pending';

-- ---------- notifications ----------
create table public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  group_id    uuid references public.groups (id) on delete cascade,
  type        text not null,
  title       text not null,
  body        text,
  link        text,
  payload     jsonb not null default '{}'::jsonb,
  dedupe_key  text,
  read_at     timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);
create unique index notifications_dedupe_idx on public.notifications (user_id, dedupe_key) where dedupe_key is not null;

-- ---------- activity_logs ----------
create table public.activity_logs (
  id           uuid primary key default gen_random_uuid(),
  group_id     uuid not null references public.groups (id) on delete cascade,
  actor_id     uuid references public.profiles (id) on delete set null,
  action       text not null,
  entity_type  text not null,
  entity_id    uuid,
  summary      text not null,
  metadata     jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index activity_logs_group_idx on public.activity_logs (group_id, created_at desc);
create index activity_logs_entity_idx on public.activity_logs (entity_id);

-- ---------- updated_at トリガー ----------
do $$
declare t text;
begin
  foreach t in array array[
    'profiles', 'groups', 'group_members', 'group_invitations', 'group_join_requests',
    'expenses', 'expense_splits', 'settlements', 'notifications', 'activity_logs'
  ] loop
    execute format(
      'create trigger set_updated_at before update on public.%I for each row execute function private.set_updated_at()', t);
  end loop;
end;
$$;

-- ---------- 新規ユーザー → profiles 自動作成 ----------
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text;
  v_colors text[] := array['#1F7A55', '#2563EB', '#D97706', '#DB2777', '#7C3AED', '#0D9488', '#DC2626', '#475569'];
begin
  v_name := nullif(btrim(coalesce(new.raw_user_meta_data ->> 'display_name', '')), '');
  if v_name is null then
    v_name := split_part(coalesce(new.email, 'user'), '@', 1);
  end if;
  v_name := left(v_name, 30);
  if char_length(btrim(v_name)) = 0 then
    v_name := 'ユーザー';
  end if;
  insert into public.profiles (id, display_name, avatar_color)
  values (new.id, v_name, v_colors[1 + floor(random() * array_length(v_colors, 1))::int]);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- >>> 20261120000002_security.sql
-- =====================================================================
-- WariNote: 認可（RLS・権限）
--   方針：
--   * 読み取り … RLS で「所属グループのデータのみ」
--   * 書き込み … テーブルへの直接書き込み権限を剥奪し、検証付き RPC 経由のみ
--   * anon     … テーブル権限なし
-- =====================================================================

-- ---------- RLS 用ヘルパー（API 非公開の private スキーマ） ----------
create or replace function private.is_group_member(p_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.group_members m
    where m.group_id = p_group_id
      and m.user_id = (select auth.uid())
      and m.left_at is null
  );
$$;

create or replace function private.is_group_admin(p_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.group_members m
    where m.group_id = p_group_id
      and m.user_id = (select auth.uid())
      and m.left_at is null
      and m.role in ('owner', 'admin')
  );
$$;

-- 自分が現在所属しているグループに、対象ユーザーが所属している（いた）か
-- または、自分が管理するグループに対象ユーザーが参加申請中か（申請者名の表示用）
create or replace function private.shares_group_with(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.group_members me
    join public.group_members other on other.group_id = me.group_id
    where me.user_id = (select auth.uid())
      and me.left_at is null
      and other.user_id = p_user_id
  ) or exists (
    select 1
    from public.group_join_requests r
    join public.group_members me on me.group_id = r.group_id
    where r.user_id = p_user_id
      and r.status = 'pending'
      and me.user_id = (select auth.uid())
      and me.left_at is null
      and me.role in ('owner', 'admin')
  );
$$;

-- ---------- RLS 有効化 ----------
alter table public.profiles            enable row level security;
alter table public.groups              enable row level security;
alter table public.group_members       enable row level security;
alter table public.group_invitations   enable row level security;
alter table public.group_join_requests enable row level security;
alter table public.expenses            enable row level security;
alter table public.expense_splits      enable row level security;
alter table public.settlements         enable row level security;
alter table public.notifications       enable row level security;
alter table public.activity_logs       enable row level security;

-- ---------- ポリシー ----------
-- profiles
-- profiles: 本人と同じグループのメンバーのみ参照
create policy profiles_select_self_or_groupmate
  on public.profiles for select to authenticated
  using (id = (select auth.uid()) or private.shares_group_with(id));
-- profiles: 本人のみ更新
create policy profiles_update_self
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- groups
-- groups: メンバーのみ参照
create policy groups_select_member
  on public.groups for select to authenticated
  using (private.is_group_member(id));

-- group_members
-- group_members: 同じグループのメンバーのみ参照
create policy group_members_select_member
  on public.group_members for select to authenticated
  using (private.is_group_member(group_id));

-- group_invitations
-- group_invitations: メンバーのみ参照
create policy group_invitations_select_member
  on public.group_invitations for select to authenticated
  using (private.is_group_member(group_id));

-- group_join_requests
-- group_join_requests: 申請者本人と管理者のみ参照
create policy group_join_requests_select_self_or_admin
  on public.group_join_requests for select to authenticated
  using (user_id = (select auth.uid()) or private.is_group_admin(group_id));

-- expenses / expense_splits / settlements / activity_logs
-- expenses: メンバーのみ参照
create policy expenses_select_member
  on public.expenses for select to authenticated
  using (private.is_group_member(group_id));
-- expense_splits: メンバーのみ参照
create policy expense_splits_select_member
  on public.expense_splits for select to authenticated
  using (private.is_group_member(group_id));
-- settlements: メンバーのみ参照
create policy settlements_select_member
  on public.settlements for select to authenticated
  using (private.is_group_member(group_id));
-- activity_logs: メンバーのみ参照
create policy activity_logs_select_member
  on public.activity_logs for select to authenticated
  using (private.is_group_member(group_id));

-- notifications
-- notifications: 本人のみ参照
create policy notifications_select_own
  on public.notifications for select to authenticated
  using (user_id = (select auth.uid()));
-- notifications: 本人のみ既読化
create policy notifications_update_own_read_at
  on public.notifications for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
-- notifications: 本人のみ削除
create policy notifications_delete_own
  on public.notifications for delete to authenticated
  using (user_id = (select auth.uid()));

-- ---------- テーブル権限（列単位で最小化） ----------
-- 新規作成時の「Grant API access to new tables automatically」設定に依存しないよう明示する
grant usage on schema public to anon, authenticated;
revoke all on all tables in schema public from anon, authenticated;
grant select on all tables in schema public to authenticated;
grant update (display_name, avatar_color) on public.profiles to authenticated;
grant update (read_at) on public.notifications to authenticated;
grant delete on public.notifications to authenticated;

-- ---------- private スキーマ ----------
revoke all on schema private from public;
grant usage on schema private to authenticated;

-- >>> 20261120000003_functions.sql
-- =====================================================================
-- WariNote: ビジネスロジック（RPC）
--   すべての書き込みはここを通る。SECURITY DEFINER + search_path 固定。
--   エラーは英大文字コードで raise し、アプリ側で日本語メッセージに変換する。
-- =====================================================================

-- ---------------------------------------------------------------------
-- 内部ヘルパー
-- ---------------------------------------------------------------------
create or replace function private.yen(p bigint)
returns text
language sql
immutable
set search_path = ''
as $$
  select '¥' || to_char(p, 'FM999,999,999,990');
$$;

create or replace function private.display_name(p_user_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select p.display_name from public.profiles p where p.id = p_user_id), '不明なユーザー');
$$;

create or replace function private.log_activity(
  p_group_id uuid, p_action text, p_entity_type text, p_entity_id uuid,
  p_summary text, p_metadata jsonb default '{}'::jsonb
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.activity_logs (group_id, actor_id, action, entity_type, entity_id, summary, metadata)
  values (p_group_id, (select auth.uid()), p_action, p_entity_type, p_entity_id, p_summary, coalesce(p_metadata, '{}'::jsonb));
$$;

-- すべての通知はここを通る（将来のメール/Push 連携は notifications の INSERT を購読すればよい）
create or replace function private.notify(
  p_user_id uuid, p_group_id uuid, p_type text, p_title text, p_body text, p_link text,
  p_dedupe_key text default null, p_payload jsonb default '{}'::jsonb
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.notifications (user_id, group_id, type, title, body, link, dedupe_key, payload)
  values (p_user_id, p_group_id, p_type, p_title, p_body, p_link, p_dedupe_key, coalesce(p_payload, '{}'::jsonb))
  on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing;
$$;

create or replace function private.notify_group(
  p_group_id uuid, p_exclude uuid, p_type text, p_title text, p_body text, p_link text,
  p_dedupe_key text default null
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.notifications (user_id, group_id, type, title, body, link, dedupe_key)
  select m.user_id, p_group_id, p_type, p_title, p_body, p_link, p_dedupe_key
  from public.group_members m
  where m.group_id = p_group_id
    and m.left_at is null
    and (p_exclude is null or m.user_id <> p_exclude)
  on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing;
$$;

create or replace function private.add_member(p_group_id uuid, p_user_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.group_members (group_id, user_id, role)
  values (p_group_id, p_user_id, 'member')
  on conflict (group_id, user_id) do update set left_at = null, role = 'member';
$$;

-- ---------------------------------------------------------------------
-- 残高計算
--   balance           = 立替 − 負担 + 送った精算(確定) − 受け取った精算(確定)
--   effective_balance = balance + 送った精算(確認待ち) − 受け取った精算(確認待ち)
-- ---------------------------------------------------------------------
create or replace function private.balances(p_group_ids uuid[])
returns table (
  group_id uuid, user_id uuid,
  paid bigint, share bigint, sent bigint, received bigint,
  pending_out bigint, pending_in bigint,
  balance bigint, effective_balance bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  with people as (
    select m.group_id, m.user_id from public.group_members m
      where m.group_id = any (p_group_ids) and m.left_at is null
    union
    select e.group_id, e.paid_by from public.expenses e
      where e.group_id = any (p_group_ids) and e.deleted_at is null
    union
    select s.group_id, s.user_id from public.expense_splits s
      join public.expenses e on e.id = s.expense_id and e.deleted_at is null
      where s.group_id = any (p_group_ids)
    union
    select st.group_id, st.from_user from public.settlements st
      where st.group_id = any (p_group_ids) and st.status in ('pending', 'confirmed')
    union
    select st.group_id, st.to_user from public.settlements st
      where st.group_id = any (p_group_ids) and st.status in ('pending', 'confirmed')
  ),
  paid as (
    select e.group_id, e.paid_by as user_id, sum(e.amount)::bigint as v
    from public.expenses e
    where e.group_id = any (p_group_ids) and e.deleted_at is null
    group by 1, 2
  ),
  owed as (
    select s.group_id, s.user_id, sum(s.share_amount)::bigint as v
    from public.expense_splits s
    join public.expenses e on e.id = s.expense_id and e.deleted_at is null
    where s.group_id = any (p_group_ids)
    group by 1, 2
  ),
  sent as (
    select st.group_id, st.from_user as user_id,
      coalesce(sum(st.amount) filter (where st.status = 'confirmed'), 0)::bigint as c,
      coalesce(sum(st.amount) filter (where st.status = 'pending'), 0)::bigint as p
    from public.settlements st
    where st.group_id = any (p_group_ids)
    group by 1, 2
  ),
  recv as (
    select st.group_id, st.to_user as user_id,
      coalesce(sum(st.amount) filter (where st.status = 'confirmed'), 0)::bigint as c,
      coalesce(sum(st.amount) filter (where st.status = 'pending'), 0)::bigint as p
    from public.settlements st
    where st.group_id = any (p_group_ids)
    group by 1, 2
  )
  select
    pe.group_id, pe.user_id,
    coalesce(pa.v, 0), coalesce(ow.v, 0), coalesce(se.c, 0), coalesce(re.c, 0),
    coalesce(se.p, 0), coalesce(re.p, 0),
    coalesce(pa.v, 0) - coalesce(ow.v, 0) + coalesce(se.c, 0) - coalesce(re.c, 0),
    coalesce(pa.v, 0) - coalesce(ow.v, 0) + coalesce(se.c, 0) - coalesce(re.c, 0)
      + coalesce(se.p, 0) - coalesce(re.p, 0)
  from people pe
  left join paid pa on pa.group_id = pe.group_id and pa.user_id = pe.user_id
  left join owed ow on ow.group_id = pe.group_id and ow.user_id = pe.user_id
  left join sent se on se.group_id = pe.group_id and se.user_id = pe.user_id
  left join recv re on re.group_id = pe.group_id and re.user_id = pe.user_id;
$$;

-- ---------------------------------------------------------------------
-- 割り勘計算（src/lib/split.ts と同一アルゴリズム。テストで一致を検証）
--   参加者配列の順序 = 端数配分の優先順（呼び出し側で「支払者→参加順」に並べる）
-- ---------------------------------------------------------------------
create or replace function private.compute_split(
  p_amount bigint, p_method public.split_method, p_participants uuid[], p_values bigint[]
)
returns table (user_id uuid, share_amount bigint, input_value bigint)
language plpgsql
immutable
set search_path = ''
as $$
#variable_conflict use_column
declare
  n        int := coalesce(array_length(p_participants, 1), 0);
  i        int;
  v_base   bigint;
  v_left   bigint;
  v_sum    bigint := 0;
  v_total  bigint := 0;
  v_shares bigint[];
  v_rems   bigint[];
  r        record;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'INVALID_AMOUNT';
  end if;
  if n = 0 or array_position(p_participants, null) is not null then
    raise exception 'NO_PARTICIPANTS';
  end if;
  if (select count(distinct x) from unnest(p_participants) as x) <> n then
    raise exception 'DUPLICATE_PARTICIPANT';
  end if;

  v_shares := array_fill(0::bigint, array[n]);

  if p_method = 'equal' then
    v_base := p_amount / n;
    v_left := p_amount - v_base * n;
    for i in 1..n loop
      v_shares[i] := v_base + case when i <= v_left then 1 else 0 end;
    end loop;

  elsif p_method = 'exact' then
    if coalesce(array_length(p_values, 1), 0) <> n then
      raise exception 'INVALID_SPLIT';
    end if;
    for i in 1..n loop
      if p_values[i] is null or p_values[i] < 0 then
        raise exception 'INVALID_SPLIT';
      end if;
      v_shares[i] := p_values[i];
      v_sum := v_sum + p_values[i];
    end loop;
    if v_sum <> p_amount then
      raise exception 'SPLIT_SUM_MISMATCH';
    end if;

  elsif p_method = 'percent' then
    if coalesce(array_length(p_values, 1), 0) <> n then
      raise exception 'INVALID_SPLIT';
    end if;
    v_rems := array_fill(0::bigint, array[n]);
    for i in 1..n loop
      if p_values[i] is null or p_values[i] < 0 or p_values[i] > 10000 then
        raise exception 'INVALID_SPLIT';
      end if;
      v_sum := v_sum + p_values[i];
      v_shares[i] := (p_amount * p_values[i]) / 10000;
      v_rems[i] := (p_amount * p_values[i]) % 10000;
      v_total := v_total + v_shares[i];
    end loop;
    if v_sum <> 10000 then
      raise exception 'PERCENT_SUM_MISMATCH';
    end if;
    -- 最大剰余法：端数の大きい順（同値は配列順）に 1 円ずつ
    v_left := p_amount - v_total;
    for r in
      select t.idx::int as idx
      from unnest(v_rems) with ordinality as t(rem, idx)
      order by t.rem desc, t.idx asc
      limit v_left
    loop
      v_shares[r.idx] := v_shares[r.idx] + 1;
    end loop;

  else
    raise exception 'INVALID_SPLIT';
  end if;

  return query
    select p_participants[k], v_shares[k],
           case when p_method = 'equal' then null::bigint else p_values[k] end
    from generate_subscripts(p_participants, 1) as k
    order by k;
end;
$$;

-- 支払者・参加者になれるか（現メンバー、または編集中の支出に元々含まれていた人）
create or replace function private.can_be_party(p_group_id uuid, p_user_id uuid, p_expense_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
      select 1 from public.group_members m
      where m.group_id = p_group_id and m.user_id = p_user_id and m.left_at is null)
    or (p_expense_id is not null and (
      exists (select 1 from public.expenses e where e.id = p_expense_id and e.paid_by = p_user_id)
      or exists (select 1 from public.expense_splits s where s.expense_id = p_expense_id and s.user_id = p_user_id)));
$$;

-- 支出が「確定済みの精算」より前に登録されたものか
create or replace function private.expense_in_settled_period(p_group_id uuid, p_created_at timestamptz)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.settlements s
    where s.group_id = p_group_id and s.status = 'confirmed' and s.confirmed_at > p_created_at);
$$;

create or replace function private.expense_snapshot(p_expense_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'title', e.title, 'amount', e.amount, 'paid_by', e.paid_by, 'category', e.category,
    'spent_on', e.spent_on, 'memo', e.memo, 'split_method', e.split_method,
    'splits', coalesce((
      select jsonb_agg(jsonb_build_object('user_id', s.user_id, 'share', s.share_amount) order by s.share_amount desc, s.user_id)
      from public.expense_splits s where s.expense_id = e.id), '[]'::jsonb))
  from public.expenses e where e.id = p_expense_id;
$$;

-- ---------------------------------------------------------------------
-- グループ
-- ---------------------------------------------------------------------
create or replace function public.create_group(
  p_name text, p_description text default null, p_icon text default 'users', p_color text default 'green'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_id  uuid;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  p_name := btrim(coalesce(p_name, ''));
  if char_length(p_name) not between 1 and 40 then raise exception 'INVALID_NAME'; end if;
  if (select count(*) from public.group_members m where m.user_id = v_uid and m.left_at is null) >= 100 then
    raise exception 'TOO_MANY_GROUPS';
  end if;

  insert into public.groups (name, description, icon, color, created_by)
  values (p_name, nullif(btrim(coalesce(p_description, '')), ''), coalesce(p_icon, 'users'), coalesce(p_color, 'green'), v_uid)
  returning id into v_id;

  insert into public.group_members (group_id, user_id, role) values (v_id, v_uid, 'owner');
  perform private.log_activity(v_id, 'group.created', 'group', v_id, 'グループ「' || p_name || '」を作成しました');
  return v_id;
end;
$$;

create or replace function public.update_group(
  p_group_id uuid, p_name text, p_description text, p_icon text, p_color text,
  p_join_approval_required boolean, p_settlement_due_date date
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old public.groups%rowtype;
begin
  if not private.is_group_admin(p_group_id) then raise exception 'FORBIDDEN'; end if;
  p_name := btrim(coalesce(p_name, ''));
  if char_length(p_name) not between 1 and 40 then raise exception 'INVALID_NAME'; end if;

  select * into v_old from public.groups g where g.id = p_group_id for update;
  update public.groups set
    name = p_name,
    description = nullif(btrim(coalesce(p_description, '')), ''),
    icon = coalesce(p_icon, v_old.icon),
    color = coalesce(p_color, v_old.color),
    join_approval_required = coalesce(p_join_approval_required, false),
    settlement_due_date = p_settlement_due_date
  where id = p_group_id;

  perform private.log_activity(p_group_id, 'group.updated', 'group', p_group_id, 'グループ設定を更新しました',
    jsonb_build_object('before', jsonb_build_object('name', v_old.name, 'due', v_old.settlement_due_date),
                       'after', jsonb_build_object('name', p_name, 'due', p_settlement_due_date)));

  if p_settlement_due_date is distinct from v_old.settlement_due_date and p_settlement_due_date is not null then
    perform private.notify_group(p_group_id, auth.uid(), 'due_date_set', '精算期限が設定されました',
      '「' || p_name || '」の精算期限は ' || to_char(p_settlement_due_date, 'YYYY/MM/DD') || ' です',
      '/groups/' || p_group_id || '/settle');
  end if;
end;
$$;

create or replace function public.delete_group(p_group_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.group_members m
    where m.group_id = p_group_id and m.user_id = auth.uid() and m.role = 'owner' and m.left_at is null
  ) then
    raise exception 'FORBIDDEN';
  end if;
  delete from public.groups where id = p_group_id;
end;
$$;

-- ---------------------------------------------------------------------
-- 招待
-- ---------------------------------------------------------------------
create or replace function public.create_invitation(
  p_group_id uuid, p_expires_in_days int default 7, p_max_uses int default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token text;
begin
  if not private.is_group_member(p_group_id) then raise exception 'NOT_MEMBER'; end if;
  if p_expires_in_days is null or p_expires_in_days not between 1 and 30 then raise exception 'INVALID_INPUT'; end if;
  if p_max_uses is not null and p_max_uses not between 1 and 50 then raise exception 'INVALID_INPUT'; end if;
  if (select count(*) from public.group_invitations i
      where i.group_id = p_group_id and i.revoked_at is null and i.expires_at > now()) >= 20 then
    raise exception 'TOO_MANY_INVITATIONS';
  end if;

  insert into public.group_invitations (group_id, created_by, expires_at, max_uses)
  values (p_group_id, auth.uid(), now() + make_interval(days => p_expires_in_days), p_max_uses)
  returning token into v_token;

  perform private.log_activity(p_group_id, 'invitation.created', 'invitation', null, '招待リンクを発行しました');
  return v_token;
end;
$$;

create or replace function public.revoke_invitation(p_invitation_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inv public.group_invitations%rowtype;
begin
  select * into v_inv from public.group_invitations i where i.id = p_invitation_id for update;
  if not found or not private.is_group_member(v_inv.group_id) then raise exception 'NOT_FOUND'; end if;
  if not (private.is_group_admin(v_inv.group_id) or v_inv.created_by = auth.uid()) then raise exception 'FORBIDDEN'; end if;
  update public.group_invitations set revoked_at = now() where id = p_invitation_id and revoked_at is null;
  perform private.log_activity(v_inv.group_id, 'invitation.revoked', 'invitation', p_invitation_id, '招待リンクを無効化しました');
end;
$$;

-- 招待URLを開いた人向けのプレビュー（未ログインでも可。有効なトークンを知っている場合のみ最小限の情報を返す）
create or replace function public.get_invitation_preview(p_token text)
returns table (
  status text, group_id uuid, group_name text, group_icon text, group_color text,
  member_count int, inviter_name text, requires_approval boolean, expires_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_uid    uuid := auth.uid();
  v_inv    public.group_invitations%rowtype;
  v_g      public.groups%rowtype;
  v_status text;
begin
  if p_token is null or p_token !~ '^[0-9a-f]{64}$' then
    return query select 'invalid'::text, null::uuid, null::text, null::text, null::text, null::int, null::text, null::boolean, null::timestamptz;
    return;
  end if;

  select * into v_inv from public.group_invitations i where i.token = p_token;
  if not found then
    return query select 'invalid'::text, null::uuid, null::text, null::text, null::text, null::int, null::text, null::boolean, null::timestamptz;
    return;
  end if;
  select * into v_g from public.groups g where g.id = v_inv.group_id;

  if v_uid is not null and exists (
      select 1 from public.group_members m where m.group_id = v_g.id and m.user_id = v_uid and m.left_at is null) then
    v_status := 'already_member';
  elsif v_uid is not null and exists (
      select 1 from public.group_join_requests r where r.group_id = v_g.id and r.user_id = v_uid and r.status = 'pending') then
    v_status := 'pending_request';
  elsif v_inv.revoked_at is not null then
    v_status := 'revoked';
  elsif v_inv.expires_at <= now() then
    v_status := 'expired';
  elsif v_inv.max_uses is not null and v_inv.use_count >= v_inv.max_uses then
    v_status := 'exhausted';
  else
    v_status := 'valid';
  end if;

  if v_status in ('revoked', 'expired', 'exhausted') then
    return query select v_status, null::uuid, null::text, null::text, null::text, null::int, null::text, null::boolean, null::timestamptz;
    return;
  end if;

  return query
    select v_status, v_g.id, v_g.name, v_g.icon, v_g.color,
      (select count(*)::int from public.group_members m where m.group_id = v_g.id and m.left_at is null),
      (select p.display_name from public.profiles p where p.id = v_inv.created_by),
      v_g.join_approval_required, v_inv.expires_at;
end;
$$;

create or replace function public.accept_invitation(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid    uuid := auth.uid();
  v_inv    public.group_invitations%rowtype;
  v_g      public.groups%rowtype;
  v_member public.group_members%rowtype;
  v_name   text;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED'; end if;

  select * into v_inv from public.group_invitations i where i.token = p_token for update;
  if not found then raise exception 'INVITATION_INVALID'; end if;
  select * into v_g from public.groups g where g.id = v_inv.group_id;

  select * into v_member from public.group_members m where m.group_id = v_g.id and m.user_id = v_uid;
  if found and v_member.left_at is null then
    return jsonb_build_object('result', 'already_member', 'group_id', v_g.id);
  end if;

  if v_inv.revoked_at is not null or v_inv.expires_at <= now()
     or (v_inv.max_uses is not null and v_inv.use_count >= v_inv.max_uses) then
    raise exception 'INVITATION_EXPIRED';
  end if;
  if (select count(*) from public.group_members m where m.group_id = v_g.id and m.left_at is null) >= 50 then
    raise exception 'GROUP_FULL';
  end if;

  v_name := private.display_name(v_uid);

  if v_g.join_approval_required then
    if exists (select 1 from public.group_join_requests r
               where r.group_id = v_g.id and r.user_id = v_uid and r.status = 'pending') then
      return jsonb_build_object('result', 'already_requested', 'group_id', v_g.id);
    end if;
    insert into public.group_join_requests (group_id, user_id, invitation_id) values (v_g.id, v_uid, v_inv.id);
    update public.group_invitations set use_count = use_count + 1 where id = v_inv.id;

    insert into public.notifications (user_id, group_id, type, title, body, link)
    select m.user_id, v_g.id, 'join_requested', '参加申請が届きました',
           v_name || 'さんが「' || v_g.name || '」への参加を申請しています',
           '/groups/' || v_g.id || '/members'
    from public.group_members m
    where m.group_id = v_g.id and m.left_at is null and m.role in ('owner', 'admin');

    perform private.log_activity(v_g.id, 'member.requested', 'member', v_uid, v_name || 'さんが参加を申請しました');
    return jsonb_build_object('result', 'requested', 'group_id', v_g.id);
  end if;

  perform private.add_member(v_g.id, v_uid);
  update public.group_invitations set use_count = use_count + 1 where id = v_inv.id;
  perform private.log_activity(v_g.id, 'member.joined', 'member', v_uid, v_name || 'さんが参加しました');
  perform private.notify_group(v_g.id, v_uid, 'member_joined', '新しいメンバーが参加しました',
    v_name || 'さんが「' || v_g.name || '」に参加しました', '/groups/' || v_g.id || '/members');
  return jsonb_build_object('result', 'joined', 'group_id', v_g.id);
end;
$$;

create or replace function public.decide_join_request(p_request_id uuid, p_approve boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_req  public.group_join_requests%rowtype;
  v_g    public.groups%rowtype;
  v_name text;
begin
  select * into v_req from public.group_join_requests r where r.id = p_request_id for update;
  if not found or not private.is_group_admin(v_req.group_id) then raise exception 'NOT_FOUND'; end if;
  if v_req.status <> 'pending' then raise exception 'INVALID_STATE'; end if;
  select * into v_g from public.groups g where g.id = v_req.group_id;
  v_name := private.display_name(v_req.user_id);

  update public.group_join_requests
     set status = case when p_approve then 'approved'::public.join_request_status else 'rejected'::public.join_request_status end,
         decided_by = auth.uid(), decided_at = now()
   where id = p_request_id;

  if p_approve then
    perform private.add_member(v_req.group_id, v_req.user_id);
    perform private.log_activity(v_req.group_id, 'member.joined', 'member', v_req.user_id, v_name || 'さんの参加を承認しました');
    perform private.notify(v_req.user_id, v_req.group_id, 'join_approved', '参加が承認されました',
      '「' || v_g.name || '」に参加しました', '/groups/' || v_req.group_id);
    perform private.notify_group(v_req.group_id, v_req.user_id, 'member_joined', '新しいメンバーが参加しました',
      v_name || 'さんが「' || v_g.name || '」に参加しました', '/groups/' || v_req.group_id || '/members');
  else
    perform private.log_activity(v_req.group_id, 'member.rejected', 'member', v_req.user_id, v_name || 'さんの参加申請を見送りました');
    perform private.notify(v_req.user_id, null, 'join_rejected', '参加申請が承認されませんでした',
      '「' || v_g.name || '」への参加申請は見送られました', '/dashboard');
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- メンバー管理
-- ---------------------------------------------------------------------
create or replace function public.set_member_role(p_group_id uuid, p_user_id uuid, p_role public.member_role)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.group_members m
                 where m.group_id = p_group_id and m.user_id = auth.uid() and m.role = 'owner' and m.left_at is null) then
    raise exception 'FORBIDDEN';
  end if;
  if p_role not in ('admin', 'member') then raise exception 'INVALID_INPUT'; end if;
  update public.group_members set role = p_role
   where group_id = p_group_id and user_id = p_user_id and left_at is null and role <> 'owner';
  if not found then raise exception 'NOT_FOUND'; end if;
  perform private.log_activity(p_group_id, 'member.role_changed', 'member', p_user_id,
    private.display_name(p_user_id) || 'さんを' || case when p_role = 'admin' then '管理者' else 'メンバー' end || 'に変更しました');
end;
$$;

create or replace function public.remove_member(p_group_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid     uuid := auth.uid();
  v_target  public.group_members%rowtype;
  v_me      public.group_members%rowtype;
  v_bal     record;
  v_name    text;
begin
  select * into v_me from public.group_members m
   where m.group_id = p_group_id and m.user_id = v_uid and m.left_at is null;
  if not found then raise exception 'NOT_MEMBER'; end if;

  select * into v_target from public.group_members m
   where m.group_id = p_group_id and m.user_id = p_user_id and m.left_at is null
   for update;
  if not found then raise exception 'NOT_FOUND'; end if;

  if p_user_id = v_uid then
    if v_target.role = 'owner' then raise exception 'OWNER_CANNOT_LEAVE'; end if;
  else
    if v_me.role not in ('owner', 'admin') then raise exception 'FORBIDDEN'; end if;
    if v_target.role = 'owner' then raise exception 'FORBIDDEN'; end if;
    if v_target.role = 'admin' and v_me.role <> 'owner' then raise exception 'FORBIDDEN'; end if;
  end if;

  select * into v_bal from private.balances(array[p_group_id]) b where b.user_id = p_user_id;
  if found and (v_bal.balance <> 0 or v_bal.effective_balance <> 0 or v_bal.pending_in <> 0 or v_bal.pending_out <> 0) then
    raise exception 'MEMBER_HAS_BALANCE';
  end if;

  update public.group_members set left_at = now(), role = 'member' where id = v_target.id;
  v_name := private.display_name(p_user_id);
  if p_user_id = v_uid then
    perform private.log_activity(p_group_id, 'member.left', 'member', p_user_id, v_name || 'さんがグループを退出しました');
  else
    perform private.log_activity(p_group_id, 'member.removed', 'member', p_user_id, v_name || 'さんをグループから外しました');
    perform private.notify(p_user_id, null, 'member_removed', 'グループから外されました',
      '「' || (select g.name from public.groups g where g.id = p_group_id) || '」から外されました', '/dashboard');
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- 支出
-- ---------------------------------------------------------------------
create or replace function public.save_expense(
  p_group_id            uuid,
  p_title               text,
  p_amount              bigint,
  p_paid_by             uuid,
  p_category            public.expense_category,
  p_spent_on            date,
  p_memo                text,
  p_split_method        public.split_method,
  p_participants        uuid[],
  p_values              bigint[] default null,
  p_expense_id          uuid default null,
  p_expected_updated_at timestamptz default null,
  p_confirm_settled     boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid    uuid := auth.uid();
  v_old    public.expenses%rowtype;
  v_id     uuid;
  v_parts  uuid[];
  v_vals   bigint[];
  v_before jsonb;
  v_actor  text;
  v_n      int := coalesce(array_length(p_participants, 1), 0);
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if not private.is_group_member(p_group_id) then raise exception 'NOT_MEMBER'; end if;

  p_title := btrim(coalesce(p_title, ''));
  if char_length(p_title) not between 1 and 60 then raise exception 'INVALID_TITLE'; end if;
  if p_amount is null or p_amount <= 0 or p_amount > 100000000 then raise exception 'INVALID_AMOUNT'; end if;
  if p_spent_on is null or p_spent_on < date '2000-01-01' or p_spent_on > current_date + 366 then
    raise exception 'INVALID_DATE';
  end if;
  p_memo := nullif(btrim(coalesce(p_memo, '')), '');
  if p_memo is not null and char_length(p_memo) > 500 then raise exception 'INVALID_MEMO'; end if;
  if p_category is null or p_split_method is null then raise exception 'INVALID_INPUT'; end if;
  if v_n = 0 then raise exception 'NO_PARTICIPANTS'; end if;
  if p_split_method <> 'equal' and coalesce(array_length(p_values, 1), 0) <> v_n then
    raise exception 'INVALID_SPLIT';
  end if;

  if p_expense_id is not null then
    select * into v_old from public.expenses e where e.id = p_expense_id and e.group_id = p_group_id for update;
    if not found or v_old.deleted_at is not null then raise exception 'EXPENSE_NOT_FOUND'; end if;
    if not (v_old.created_by = v_uid or v_old.paid_by = v_uid or private.is_group_admin(p_group_id)) then
      raise exception 'FORBIDDEN';
    end if;
    if p_expected_updated_at is not null and v_old.updated_at <> p_expected_updated_at then
      raise exception 'CONFLICT';
    end if;
    if not coalesce(p_confirm_settled, false)
       and private.expense_in_settled_period(p_group_id, v_old.created_at) then
      raise exception 'SETTLED_CONFIRM_REQUIRED';
    end if;
  end if;

  if not private.can_be_party(p_group_id, p_paid_by, p_expense_id) then raise exception 'PAYER_NOT_MEMBER'; end if;
  if exists (select 1 from unnest(p_participants) as u
             where u is null or not private.can_be_party(p_group_id, u, p_expense_id)) then
    raise exception 'PARTICIPANT_NOT_MEMBER';
  end if;

  -- 端数配分の優先順：支払者 → 参加日時順 → ID
  select array_agg(t.uid order by (t.uid = p_paid_by) desc, m.joined_at nulls last, t.uid),
         array_agg(t.val order by (t.uid = p_paid_by) desc, m.joined_at nulls last, t.uid)
    into v_parts, v_vals
  from unnest(p_participants, coalesce(p_values, array_fill(null::bigint, array[v_n]))) as t(uid, val)
  left join public.group_members m on m.group_id = p_group_id and m.user_id = t.uid;

  v_actor := private.display_name(v_uid);

  if p_expense_id is null then
    insert into public.expenses (group_id, title, amount, paid_by, category, spent_on, memo, split_method, created_by, updated_by)
    values (p_group_id, p_title, p_amount, p_paid_by, p_category, p_spent_on, p_memo, p_split_method, v_uid, v_uid)
    returning id into v_id;
  else
    v_id := p_expense_id;
    v_before := private.expense_snapshot(v_id);
    update public.expenses set
      title = p_title, amount = p_amount, paid_by = p_paid_by, category = p_category,
      spent_on = p_spent_on, memo = p_memo, split_method = p_split_method, updated_by = v_uid
    where id = v_id;
    delete from public.expense_splits where expense_id = v_id;
  end if;

  insert into public.expense_splits (expense_id, group_id, user_id, share_amount, input_value)
  select v_id, p_group_id, c.user_id, c.share_amount, c.input_value
  from private.compute_split(p_amount, p_split_method, v_parts, v_vals) as c;

  if p_expense_id is null then
    perform private.log_activity(p_group_id, 'expense.created', 'expense', v_id,
      '「' || p_title || '」' || private.yen(p_amount) || ' を登録しました',
      jsonb_build_object('after', private.expense_snapshot(v_id)));
    perform private.notify_group(p_group_id, v_uid, 'expense_created', '支出が追加されました',
      v_actor || 'さんが「' || p_title || '」' || private.yen(p_amount) || ' を登録しました',
      '/groups/' || p_group_id || '/expenses/' || v_id);
  else
    perform private.log_activity(p_group_id, 'expense.updated', 'expense', v_id,
      '「' || p_title || '」を編集しました',
      jsonb_build_object('before', v_before, 'after', private.expense_snapshot(v_id)));
    perform private.notify_group(p_group_id, v_uid, 'expense_updated', '支出が編集されました',
      v_actor || 'さんが「' || p_title || '」を編集しました（' || private.yen(p_amount) || '）',
      '/groups/' || p_group_id || '/expenses/' || v_id);
  end if;

  return v_id;
end;
$$;

create or replace function public.delete_expense(p_expense_id uuid, p_confirm_settled boolean default false)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_old public.expenses%rowtype;
begin
  select * into v_old from public.expenses e where e.id = p_expense_id for update;
  if not found or v_old.deleted_at is not null or not private.is_group_member(v_old.group_id) then
    raise exception 'EXPENSE_NOT_FOUND';
  end if;
  if not (v_old.created_by = v_uid or v_old.paid_by = v_uid or private.is_group_admin(v_old.group_id)) then
    raise exception 'FORBIDDEN';
  end if;
  if not coalesce(p_confirm_settled, false)
     and private.expense_in_settled_period(v_old.group_id, v_old.created_at) then
    raise exception 'SETTLED_CONFIRM_REQUIRED';
  end if;

  update public.expenses set deleted_at = now(), deleted_by = v_uid, updated_by = v_uid where id = p_expense_id;

  perform private.log_activity(v_old.group_id, 'expense.deleted', 'expense', p_expense_id,
    '「' || v_old.title || '」' || private.yen(v_old.amount) || ' を削除しました',
    jsonb_build_object('before', private.expense_snapshot(p_expense_id)));
  perform private.notify_group(v_old.group_id, v_uid, 'expense_deleted', '支出が削除されました',
    private.display_name(v_uid) || 'さんが「' || v_old.title || '」' || private.yen(v_old.amount) || ' を削除しました',
    '/groups/' || v_old.group_id || '/expenses');
end;
$$;

-- ---------------------------------------------------------------------
-- 残高（公開 RPC）
-- ---------------------------------------------------------------------
create or replace function public.group_balances(p_group_id uuid)
returns table (
  group_id uuid, user_id uuid,
  paid bigint, share bigint, sent bigint, received bigint,
  pending_out bigint, pending_in bigint,
  balance bigint, effective_balance bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_group_member(p_group_id) then raise exception 'NOT_MEMBER'; end if;
  return query select * from private.balances(array[p_group_id]);
end;
$$;

create or replace function public.my_balances()
returns table (
  group_id uuid, user_id uuid,
  paid bigint, share bigint, sent bigint, received bigint,
  pending_out bigint, pending_in bigint,
  balance bigint, effective_balance bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select * from private.balances(array(
    select m.group_id from public.group_members m
    where m.user_id = (select auth.uid()) and m.left_at is null));
$$;

create or replace function public.my_group_overview()
returns table (
  group_id uuid, name text, icon text, color text, role public.member_role,
  member_count int, total_spent bigint, settlement_due_date date,
  pending_to_confirm int, my_pending_out int, last_activity_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select g.id, g.name, g.icon, g.color, me.role,
    (select count(*)::int from public.group_members m where m.group_id = g.id and m.left_at is null),
    coalesce((select sum(e.amount) from public.expenses e where e.group_id = g.id and e.deleted_at is null), 0)::bigint,
    g.settlement_due_date,
    (select count(*)::int from public.settlements s where s.group_id = g.id and s.to_user = me.user_id and s.status = 'pending'),
    (select count(*)::int from public.settlements s where s.group_id = g.id and s.from_user = me.user_id and s.status = 'pending'),
    greatest(g.updated_at, (select max(a.created_at) from public.activity_logs a where a.group_id = g.id))
  from public.groups g
  join public.group_members me on me.group_id = g.id and me.user_id = (select auth.uid()) and me.left_at is null
  order by 11 desc nulls last;
$$;

-- 分析用の集計（行数制限に影響されないよう DB 側で集計。RLS が適用される invoker 関数）
create or replace function public.my_analytics(p_since date, p_group_id uuid default null)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with ex as (
    select e.id, e.group_id, e.amount, e.paid_by, e.category, e.spent_on
    from public.expenses e
    where e.deleted_at is null
      and e.spent_on >= p_since
      and (p_group_id is null or e.group_id = p_group_id)
      and private.is_group_member(e.group_id)
  ),
  sp as (
    select s.user_id, s.share_amount, ex.group_id, ex.category, ex.spent_on
    from public.expense_splits s
    join ex on ex.id = s.expense_id
  )
  select jsonb_build_object(
    'monthly_total',  coalesce((select jsonb_object_agg(k, v) from (select to_char(spent_on, 'YYYY-MM') k, sum(amount)::bigint v from ex group by 1) t), '{}'::jsonb),
    'monthly_mine',   coalesce((select jsonb_object_agg(k, v) from (select to_char(spent_on, 'YYYY-MM') k, sum(share_amount)::bigint v from sp where user_id = (select auth.uid()) group by 1) t), '{}'::jsonb),
    'category_total', coalesce((select jsonb_object_agg(k, v) from (select category::text k, sum(amount)::bigint v from ex group by 1) t), '{}'::jsonb),
    'category_mine',  coalesce((select jsonb_object_agg(k, v) from (select category::text k, sum(share_amount)::bigint v from sp where user_id = (select auth.uid()) group by 1) t), '{}'::jsonb),
    'group_total',    coalesce((select jsonb_object_agg(k, v) from (select group_id::text k, sum(amount)::bigint v from ex group by 1) t), '{}'::jsonb),
    'member_paid',    coalesce((select jsonb_object_agg(k, v) from (select paid_by::text k, sum(amount)::bigint v from ex group by 1) t), '{}'::jsonb),
    'member_share',   coalesce((select jsonb_object_agg(k, v) from (select user_id::text k, sum(share_amount)::bigint v from sp group by 1) t), '{}'::jsonb)
  );
$$;

-- ---------------------------------------------------------------------
-- 精算
-- ---------------------------------------------------------------------
create or replace function public.record_settlement(
  p_group_id uuid, p_from uuid, p_to uuid, p_amount bigint,
  p_note text default null, p_request_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid       uuid := auth.uid();
  v_existing  uuid;
  v_from_eff  bigint;
  v_to_eff    bigint;
  v_status    public.settlement_status;
  v_id        uuid;
  v_gname     text;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if not private.is_group_member(p_group_id) then raise exception 'NOT_MEMBER'; end if;
  if v_uid <> p_from and v_uid <> p_to then raise exception 'FORBIDDEN'; end if;
  if p_from = p_to then raise exception 'INVALID_INPUT'; end if;
  if p_amount is null or p_amount <= 0 or p_amount > 100000000 then raise exception 'INVALID_AMOUNT'; end if;
  p_note := nullif(btrim(coalesce(p_note, '')), '');
  if p_note is not null and char_length(p_note) > 200 then raise exception 'INVALID_INPUT'; end if;

  -- 同一グループの精算登録を直列化（同時押し・二重送信対策）
  perform pg_advisory_xact_lock(hashtextextended('warinote:settle:' || p_group_id::text, 0));

  if p_request_id is not null then
    select s.id into v_existing from public.settlements s where s.request_id = p_request_id;
    if found then return v_existing; end if;
  end if;

  if not exists (select 1 from public.group_members m where m.group_id = p_group_id and m.user_id = p_from and m.left_at is null)
     or not exists (select 1 from public.group_members m where m.group_id = p_group_id and m.user_id = p_to and m.left_at is null) then
    raise exception 'NOT_MEMBER';
  end if;

  if exists (select 1 from public.settlements s
             where s.group_id = p_group_id and s.from_user = p_from and s.to_user = p_to and s.status = 'pending') then
    raise exception 'PENDING_EXISTS';
  end if;

  select b.effective_balance into v_from_eff from private.balances(array[p_group_id]) b where b.user_id = p_from;
  select b.effective_balance into v_to_eff   from private.balances(array[p_group_id]) b where b.user_id = p_to;
  if coalesce(v_from_eff, 0) >= 0 or coalesce(v_to_eff, 0) <= 0 then
    raise exception 'NOTHING_TO_SETTLE';
  end if;
  if p_amount > least(-v_from_eff, v_to_eff) then
    raise exception 'SETTLEMENT_EXCEEDS';
  end if;

  v_status := case when v_uid = p_to then 'confirmed'::public.settlement_status else 'pending'::public.settlement_status end;

  insert into public.settlements (group_id, from_user, to_user, amount, status, note, request_id, created_by,
                                  confirmed_by, confirmed_at, decided_at)
  values (p_group_id, p_from, p_to, p_amount, v_status, p_note, p_request_id, v_uid,
          case when v_status = 'confirmed' then v_uid end,
          case when v_status = 'confirmed' then now() end,
          case when v_status = 'confirmed' then now() end)
  returning id into v_id;

  select g.name into v_gname from public.groups g where g.id = p_group_id;

  if v_status = 'pending' then
    perform private.log_activity(p_group_id, 'settlement.reported', 'settlement', v_id,
      private.display_name(p_from) || 'さんが ' || private.display_name(p_to) || 'さんへの支払い ' || private.yen(p_amount) || ' を申告しました');
    perform private.notify(p_to, p_group_id, 'settlement_reported', '支払いの申告がありました',
      private.display_name(p_from) || 'さんから ' || private.yen(p_amount) || ' の支払い申告（' || v_gname || '）。受け取ったら確認してください',
      '/groups/' || p_group_id || '/settle');
  else
    perform private.log_activity(p_group_id, 'settlement.confirmed', 'settlement', v_id,
      private.display_name(p_to) || 'さんが ' || private.display_name(p_from) || 'さんから ' || private.yen(p_amount) || ' を受け取りました');
    perform private.notify(p_from, p_group_id, 'settlement_confirmed', '精算が記録されました',
      private.display_name(p_to) || 'さんが ' || private.yen(p_amount) || ' の受け取りを記録しました（' || v_gname || '）',
      '/groups/' || p_group_id || '/settle');
    perform private.notify_if_all_settled(p_group_id, v_id);
  end if;

  return v_id;
end;
$$;

create or replace function private.notify_if_all_settled(p_group_id uuid, p_settlement_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.expenses e where e.group_id = p_group_id and e.deleted_at is null)
     and not exists (select 1 from private.balances(array[p_group_id]) b
                     where b.balance <> 0 or b.effective_balance <> 0) then
    perform private.notify_group(p_group_id, null, 'all_settled', '精算がすべて完了しました',
      '「' || (select g.name from public.groups g where g.id = p_group_id) || '」の全員の精算が完了しました',
      '/groups/' || p_group_id || '/settle', 'all_settled:' || p_settlement_id::text);
  end if;
end;
$$;

create or replace function public.confirm_settlement(p_settlement_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_s public.settlements%rowtype;
begin
  select * into v_s from public.settlements s where s.id = p_settlement_id for update;
  if not found or not private.is_group_member(v_s.group_id) then raise exception 'NOT_FOUND'; end if;
  if v_s.to_user <> auth.uid() then raise exception 'FORBIDDEN'; end if;
  if v_s.status <> 'pending' then raise exception 'INVALID_STATE'; end if;

  update public.settlements
     set status = 'confirmed', confirmed_by = auth.uid(), confirmed_at = now(), decided_at = now()
   where id = p_settlement_id;

  perform private.log_activity(v_s.group_id, 'settlement.confirmed', 'settlement', v_s.id,
    private.display_name(v_s.to_user) || 'さんが ' || private.display_name(v_s.from_user) || 'さんからの ' || private.yen(v_s.amount) || ' を受け取りました');
  perform private.notify(v_s.from_user, v_s.group_id, 'settlement_confirmed', '受け取りが確認されました',
    private.display_name(v_s.to_user) || 'さんが ' || private.yen(v_s.amount) || ' の受け取りを確認しました',
    '/groups/' || v_s.group_id || '/settle');
  perform private.notify_if_all_settled(v_s.group_id, v_s.id);
end;
$$;

create or replace function public.reject_settlement(p_settlement_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_s public.settlements%rowtype;
begin
  select * into v_s from public.settlements s where s.id = p_settlement_id for update;
  if not found or not private.is_group_member(v_s.group_id) then raise exception 'NOT_FOUND'; end if;
  if v_s.to_user <> auth.uid() then raise exception 'FORBIDDEN'; end if;
  if v_s.status <> 'pending' then raise exception 'INVALID_STATE'; end if;

  update public.settlements set status = 'rejected', decided_at = now() where id = p_settlement_id;

  perform private.log_activity(v_s.group_id, 'settlement.rejected', 'settlement', v_s.id,
    private.display_name(v_s.to_user) || 'さんが ' || private.yen(v_s.amount) || ' の支払い申告を「未受領」としました');
  perform private.notify(v_s.from_user, v_s.group_id, 'settlement_rejected', '支払い申告が確認できませんでした',
    private.display_name(v_s.to_user) || 'さんが ' || private.yen(v_s.amount) || ' を「受け取っていない」としました。状況を確認してください',
    '/groups/' || v_s.group_id || '/settle');
end;
$$;

-- 確認待ち → 申告者が取り消し / 確定済み → 受取人（または管理者）が記録を取り消し
create or replace function public.cancel_settlement(p_settlement_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_s   public.settlements%rowtype;
begin
  select * into v_s from public.settlements s where s.id = p_settlement_id for update;
  if not found or not private.is_group_member(v_s.group_id) then raise exception 'NOT_FOUND'; end if;

  if v_s.status = 'pending' then
    if v_s.from_user <> v_uid then raise exception 'FORBIDDEN'; end if;
    update public.settlements set status = 'cancelled', decided_at = now() where id = p_settlement_id;
    perform private.log_activity(v_s.group_id, 'settlement.cancelled', 'settlement', v_s.id,
      private.display_name(v_uid) || 'さんが ' || private.yen(v_s.amount) || ' の支払い申告を取り消しました');
    perform private.notify(v_s.to_user, v_s.group_id, 'settlement_cancelled', '支払い申告が取り消されました',
      private.display_name(v_uid) || 'さんが ' || private.yen(v_s.amount) || ' の支払い申告を取り消しました',
      '/groups/' || v_s.group_id || '/settle');
  elsif v_s.status = 'confirmed' then
    if not (v_s.to_user = v_uid or private.is_group_admin(v_s.group_id)) then raise exception 'FORBIDDEN'; end if;
    update public.settlements set status = 'cancelled', decided_at = now() where id = p_settlement_id;
    perform private.log_activity(v_s.group_id, 'settlement.voided', 'settlement', v_s.id,
      private.display_name(v_s.from_user) || 'さん → ' || private.display_name(v_s.to_user) || 'さん ' || private.yen(v_s.amount) || ' の精算記録を取り消しました');
    perform private.notify(v_s.from_user, v_s.group_id, 'settlement_voided', '精算記録が取り消されました',
      private.display_name(v_uid) || 'さんが ' || private.yen(v_s.amount) || ' の精算記録を取り消しました',
      '/groups/' || v_s.group_id || '/settle');
  else
    raise exception 'INVALID_STATE';
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- 支払い忘れ防止
-- ---------------------------------------------------------------------
-- 受け取る側から支払う側へのリマインド（同じ相手には1日1回まで）
create or replace function public.send_payment_reminder(p_group_id uuid, p_debtor uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid     uuid := auth.uid();
  v_me      bigint;
  v_debtor  bigint;
  v_count   int;
  v_gname   text;
begin
  if not private.is_group_member(p_group_id) then raise exception 'NOT_MEMBER'; end if;
  select b.effective_balance into v_me     from private.balances(array[p_group_id]) b where b.user_id = v_uid;
  select b.effective_balance into v_debtor from private.balances(array[p_group_id]) b where b.user_id = p_debtor;
  if coalesce(v_me, 0) <= 0 or coalesce(v_debtor, 0) >= 0 then raise exception 'NOTHING_TO_SETTLE'; end if;
  select g.name into v_gname from public.groups g where g.id = p_group_id;

  insert into public.notifications (user_id, group_id, type, title, body, link, dedupe_key)
  values (p_debtor, p_group_id, 'payment_reminder', '支払いのリマインド',
    private.display_name(v_uid) || 'さんから：「' || v_gname || '」で ' || private.yen(-v_debtor) || ' の精算が残っています',
    '/groups/' || p_group_id || '/settle',
    'reminder:' || p_group_id || ':' || v_uid || ':' || p_debtor || ':' || to_char(now() at time zone 'Asia/Tokyo', 'YYYY-MM-DD'))
  on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing;
  get diagnostics v_count = row_count;

  if v_count > 0 then
    perform private.log_activity(p_group_id, 'settlement.reminded', 'member', p_debtor,
      private.display_name(p_debtor) || 'さんに支払いリマインドを送りました');
  end if;
  return v_count > 0;
end;
$$;

-- 精算期限の 3 日前〜期限後 14 日まで、未払いのメンバーに 1 日 1 回通知（pg_cron から実行）
create or replace function private.send_due_reminders()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'Asia/Tokyo')::date;
  v_count int := 0;
  r       record;
begin
  for r in
    select g.id as group_id, g.name, g.settlement_due_date as due, b.user_id, b.effective_balance
    from public.groups g
    cross join lateral private.balances(array[g.id]) b
    join public.group_members m on m.group_id = g.id and m.user_id = b.user_id and m.left_at is null
    where g.settlement_due_date is not null
      and g.settlement_due_date between v_today - 14 and v_today + 3
      and b.effective_balance < 0
  loop
    perform private.notify(r.user_id, r.group_id, 'due_reminder',
      case when r.due < v_today then '精算期限を過ぎています'
           when r.due = v_today then '今日が精算期限です'
           else '精算期限が近づいています' end,
      '「' || r.name || '」の精算期限は ' || to_char(r.due, 'MM/DD') || '。' || private.yen(-r.effective_balance) || ' の支払いが残っています',
      '/groups/' || r.group_id || '/settle',
      'due:' || r.group_id || ':' || v_today);
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

-- ---------------------------------------------------------------------
-- 関数の実行権限
-- ---------------------------------------------------------------------
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated;
grant execute on function public.get_invitation_preview(text) to anon;

revoke execute on all functions in schema private from public;
do $$
begin
  execute 'revoke execute on all functions in schema private from anon, authenticated';
end;
$$;
grant execute on function private.is_group_member(uuid) to authenticated;
grant execute on function private.is_group_admin(uuid) to authenticated;
grant execute on function private.shares_group_with(uuid) to authenticated;

-- >>> 20261120000004_realtime_and_jobs.sql
-- =====================================================================
-- WariNote: Realtime 配信・定期ジョブ
-- =====================================================================

-- Realtime（postgres_changes）は RLS を適用して配信されるため、所属グループの変更だけが届く
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table
      public.groups,
      public.group_members,
      public.group_join_requests,
      public.expenses,
      public.expense_splits,
      public.settlements,
      public.notifications,
      public.activity_logs;
  end if;
end;
$$;

-- Supabase Auth がユーザー作成時のトリガーを実行できるように
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'supabase_auth_admin') then
    execute 'grant usage on schema private to supabase_auth_admin';
  end if;
end;
$$;

-- 精算期限リマインド：毎日 9:00 JST（= 0:00 UTC）
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('warinote-due-reminders', '0 0 * * *', 'select private.send_due_reminders()');
  end if;
exception when others then
  raise notice 'pg_cron の設定をスキップしました（ダッシュボードの Integrations > Cron から有効化できます）: %', sqlerrm;
end;
$$;
