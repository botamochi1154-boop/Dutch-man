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
