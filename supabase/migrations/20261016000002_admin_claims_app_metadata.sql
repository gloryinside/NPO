-- [보안] 관리자 권한 판정을 user_metadata → app_metadata로 이전
--
-- 문제: is_org_admin()과 앱 가드가 auth.users.raw_user_meta_data의 role/org_id를 믿었다.
--   raw_user_meta_data(user_metadata)는 로그인한 사용자 본인이
--   supabase.auth.updateUser({ data: { role: 'admin', org_id } })로 바꿀 수 있다.
--   후원자도 Supabase 계정으로 가입하므로, 아무 후원자나 임의 기관의 관리자가 될 수 있었다.
-- 해결: raw_app_meta_data(app_metadata)만 신뢰 — 서비스 롤만 쓸 수 있다.
--
-- 적용 순서: 이 마이그레이션(백필 포함) → 새 앱 코드 배포.
--   코드를 먼저 배포하면 백필 전이라 모든 관리자가 로그인할 수 없다.

-- 1) 기존 관리자 백필 — user_metadata의 role/org_id를 app_metadata로 복사.
--    단, 후원자 계정(members.supabase_uid로 연결된 계정)은 제외한다.
--    이미 스스로 권한을 올린 후원자 계정을 백필이 "진짜 관리자"로 만들지 않게 하기 위함.
update auth.users u
set raw_app_meta_data = coalesce(u.raw_app_meta_data, '{}'::jsonb)
  || jsonb_build_object('role', 'admin', 'org_id', u.raw_user_meta_data->>'org_id')
where (u.raw_user_meta_data->>'role') = 'admin'
  and (u.raw_user_meta_data->>'org_id') ~ '^[0-9a-fA-F-]{36}$'
  and exists (select 1 from public.orgs o where o.id = (u.raw_user_meta_data->>'org_id')::uuid)
  and not exists (select 1 from public.members m where m.supabase_uid = u.id);

-- 2) RLS 판정 함수 — app_metadata만 본다
create or replace function is_org_admin(target_org uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from auth.users
    where id = auth.uid()
      and (raw_app_meta_data->>'role') = 'admin'
      and (raw_app_meta_data->>'org_id')::uuid = target_org
  );
$$;

-- 3) 적용 후 수동 검토용 — user_metadata엔 admin인데 app_metadata로 옮겨지지 않은 계정.
--    후원자 계정이 스스로 권한을 올린 흔적일 수 있다. 결과가 있으면 하나씩 확인할 것.
--
--   select u.id, u.email, u.created_at, u.raw_user_meta_data->>'org_id' as claimed_org,
--          exists (select 1 from public.members m where m.supabase_uid = u.id) as is_donor
--   from auth.users u
--   where (u.raw_user_meta_data->>'role') = 'admin'
--     and coalesce(u.raw_app_meta_data->>'role', '') <> 'admin';
