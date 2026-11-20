-- =====================================================================
-- ローカル開発専用のサンプルデータ
--   ・`supabase db reset`（ローカル）のときだけ実行されます。
--   ・本番への `supabase db push` / SQL Editor での setup.sql 実行では投入されません。
--   ・テストユーザーは実在しないドメイン @example.com のみを使用します。
--     yuki@example.com / haruka@example.com / sota@example.com / mio@example.com
--     パスワードはすべて password123
-- =====================================================================

do $$
declare
  u record;
begin
  for u in
    select * from (values
      ('10000000-0000-4000-8000-000000000001'::uuid, 'yuki@example.com',   'ゆうき'),
      ('10000000-0000-4000-8000-000000000002'::uuid, 'haruka@example.com', 'はるか'),
      ('10000000-0000-4000-8000-000000000003'::uuid, 'sota@example.com',   'そうた'),
      ('10000000-0000-4000-8000-000000000004'::uuid, 'mio@example.com',    'みお')
    ) as t(id, email, name)
  loop
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, email_change, email_change_token_new, recovery_token
    ) values (
      '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
      extensions.crypt('password123', extensions.gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}'::jsonb, jsonb_build_object('display_name', u.name), now(), now(),
      '', '', '', ''
    );
    insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), u.id, u.id::text, jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
            'email', now(), now(), now());
  end loop;
end;
$$;

-- 以降は実際の RPC を「各ユーザーとして」呼び出して作成する（アプリと同じ検証・計算を通る）
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}', false);
select set_config('seed.g', public.create_group('沖縄旅行（サンプル）', 'ローカル開発用のサンプルデータです', 'plane', 'teal')::text, false);
select set_config('seed.token', public.create_invitation(current_setting('seed.g')::uuid, 30, null), false);

select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}', false);
select public.accept_invitation(current_setting('seed.token'));
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000003","role":"authenticated"}', false);
select public.accept_invitation(current_setting('seed.token'));
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000004","role":"authenticated"}', false);
select public.accept_invitation(current_setting('seed.token'));

select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}', false);
select public.save_expense(current_setting('seed.g')::uuid, 'ホテル代（2泊）', 20000, '10000000-0000-4000-8000-000000000001',
  'lodging', current_date - 2, null, 'equal',
  array['10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002',
        '10000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000004']::uuid[]);
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}', false);
select public.save_expense(current_setting('seed.g')::uuid, 'レンタカー', 12000, '10000000-0000-4000-8000-000000000002',
  'transport', current_date - 2, null, 'equal',
  array['10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002',
        '10000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000004']::uuid[]);
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000003","role":"authenticated"}', false);
select public.save_expense(current_setting('seed.g')::uuid, '夕食（ソーキそば）', 8000, '10000000-0000-4000-8000-000000000003',
  'food', current_date - 1, null, 'equal',
  array['10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002',
        '10000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000004']::uuid[]);

select set_config('request.jwt.claims', '', false);
