-- Phase 7-C / G-102: referral_codes에 donor 본인 SELECT 정책 추가.
--
-- 기존 마이그레이션(20260422000003)에서 RLS ENABLE + admin SELECT 정책은
-- 추가됐으나, donor 본인이 자신의 코드를 직접 조회하는 경로는 service-role을
-- 경유한 API로만 열려 있었다. 향후 donor 전용 Supabase 인증 클라이언트로 직접
-- SELECT 호출이 생길 경우를 대비해 명시적 정책을 추가한다.
--
-- 정책:
--   referral_codes_donor_own_read — members.supabase_uid = auth.uid() 로 소유자 검증.
--   org_id 필터는 members 조인이 자연 충족 (members.org_id ↔ referral_codes.org_id).
--
-- INSERT/UPDATE/DELETE는 여전히 service-role 전용 — donor 측 직접 변경 경로를
-- 두지 않는다 (ensureReferralCode는 서버 API를 경유).

CREATE POLICY referral_codes_donor_own_read
  ON referral_codes FOR SELECT
  USING (
    member_id IN (
      SELECT id FROM members WHERE supabase_uid = auth.uid()
    )
  );

COMMENT ON POLICY referral_codes_donor_own_read ON referral_codes IS
  'Phase 7-C / G-102: donor 본인이 자신의 초대 코드를 직접 SELECT할 수 있도록 허용.';
