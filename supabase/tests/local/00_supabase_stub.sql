-- ローカル検証専用：Supabase が提供する auth スキーマ・ロール・publication の最小スタブ
-- （本番の Supabase では不要。supabase/tests/local/run.sh からのみ使用）
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create role authenticator login noinherit;
grant anon, authenticated, service_role to authenticator;

create schema auth;
create table auth.users (
  instance_id uuid,
  id uuid primary key,
  aud text, role text,
  email text unique,
  encrypted_password text,
  email_confirmed_at timestamptz,
  raw_app_meta_data jsonb,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  confirmation_token text, email_change text, email_change_token_new text, recovery_token text,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);
create table auth.identities (
  id uuid primary key, user_id uuid references auth.users (id), provider_id text, identity_data jsonb,
  provider text, last_sign_in_at timestamptz, created_at timestamptz, updated_at timestamptz
);
create schema extensions;
create extension pgcrypto with schema extensions;

-- Supabase と同じ実装
create function auth.uid() returns uuid language sql stable as $$
  select nullif(
    coalesce(
      current_setting('request.jwt.claim.sub', true),
      (current_setting('request.jwt.claims', true)::jsonb ->> 'sub')
    ), '')::uuid
$$;

grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;

-- Supabase の既定権限（新規テーブル・関数に anon/authenticated へ全権限）を再現し、
-- マイグレーション側の revoke が正しく効くかを検証できるようにする
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;

create publication supabase_realtime;
