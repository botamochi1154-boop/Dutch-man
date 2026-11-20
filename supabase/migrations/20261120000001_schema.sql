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
