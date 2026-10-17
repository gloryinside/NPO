-- [보안] 관리자 권한 판정을 user_metadata → app_metadata로 이전
--
-- 문제: is_org_admin()과 앱 가드가 auth.users.raw_user_meta_data의 role/org_id를 믿었다.
--   raw_user_meta_data(user_metadata)는 로그인한 사용자 본인이
--   supabase.auth.updateUser({ data: { role: 'admin', org_id } })로 바꿀 수 있다.
--   후원자도 Supabase 계정으로 가입하므로, 아무 후원자나 임의 기관의 관리자가 될 수 있었다.
-- 해결: raw_app_meta_data(app_metadata)만 신뢰 — 서비스 롤만 쓸 수 있다.
--
-- 적용 순서: 이 마이그레이션 → 운영자가 관리자 목록 검토·부여(아래 1) → 새 앱 코드 배포.
--   부여 전에 코드를 배포하면 모든 관리자가 로그인할 수 없다.
--
-- (2026-10-17 개정) 처음엔 user_metadata.role='admin'인 계정을 자동으로 승격했으나,
--   user_metadata는 본인이 바꿀 수 있어 "후원자 레코드가 없는" 계정이 스스로 올린 권한도 진짜 관리자가 됐다.
--   DB에는 누가 진짜 관리자인지 증명할 기록이 없으므로 자동 승격하지 않는다.
--   (개발 DB는 개정 전 버전으로 이미 적용됨 — 승격된 계정은 통합 테스트 계정이었고 정리 완료)

-- 1) 관리자 후보 검토 → 명시적 부여
--    후보 = user_metadata엔 admin이지만 app_metadata엔 아직 아닌 계정. 운영자가 실제 관리자인지 확인한 뒤:
--      select * from admin_claim_candidates;                 -- 검토
--      select grant_admin_claims(array['<user uuid>', ...]::uuid[]);  -- 확인된 계정만 부여
--    (또는 scripts/create-admin.mjs <email> <org_slug> — app_metadata에 직접 기록)
--    검토 뷰·부여 함수는 20261017000003_admin_claims_review.sql에 있다.

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
