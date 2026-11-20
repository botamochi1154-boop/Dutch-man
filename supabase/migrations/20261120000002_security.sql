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
revoke all on all tables in schema public from anon, authenticated;
grant select on all tables in schema public to authenticated;
grant update (display_name, avatar_color) on public.profiles to authenticated;
grant update (read_at) on public.notifications to authenticated;
grant delete on public.notifications to authenticated;

-- ---------- private スキーマ ----------
revoke all on schema private from public;
grant usage on schema private to authenticated;
