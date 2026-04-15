-- Task B6: RLS 정책 — 테넌트 격리 + 관리자/후원자 역할별 권한
--
-- 권한 모델:
-- - 관리자(admin): user_metadata.role = 'admin' AND user_metadata.org_id = <대상 org>
--   → 자신의 기관 데이터에 대해 전체 CRUD
-- - 후원자(donor): members.supabase_uid = auth.uid()
--   → 자신의 후원 정보만 조회 가능
-- - 익명(anon): campaigns 중 status='active'만 조회 가능 (공개 랜딩/캠페인 페이지용)
-- - service_role: 모든 정책을 우회 (서버사이드 admin 클라이언트)
--
-- RLS는 이미 활성화된 상태. 정책만 추가한다.

-- ============================================================================
-- 헬퍼 함수: is_org_admin(target_org)
-- ============================================================================
-- auth.users의 raw_user_meta_data에서 role과 org_id를 확인한다.
-- JWT 토큰에 이미 포함된 메타데이터를 기반으로 하므로 추가 쿼리가 없는 O(1) 체크.
-- STABLE로 선언해 쿼리 플래너가 캐시 가능하게 한다.
CREATE OR REPLACE FUNCTION is_org_admin(target_org uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM auth.users
    WHERE id = auth.uid()
      AND (raw_user_meta_data->>'role') = 'admin'
      AND (raw_user_meta_data->>'org_id')::uuid = target_org
  );
$$;

-- ============================================================================
-- campaigns
-- ============================================================================
DROP POLICY IF EXISTS "campaigns_public_read" ON campaigns;
CREATE POLICY "campaigns_public_read" ON campaigns
  FOR SELECT
  USING (status = 'active');

DROP POLICY IF EXISTS "campaigns_admin_all" ON campaigns;
CREATE POLICY "campaigns_admin_all" ON campaigns
  FOR ALL
  USING (is_org_admin(org_id))
  WITH CHECK (is_org_admin(org_id));

-- ============================================================================
-- members
-- ============================================================================
DROP POLICY IF EXISTS "members_self_read" ON members;
CREATE POLICY "members_self_read" ON members
  FOR SELECT
  USING (supabase_uid = auth.uid());

DROP POLICY IF EXISTS "members_admin_all" ON members;
CREATE POLICY "members_admin_all" ON members
  FOR ALL
  USING (is_org_admin(org_id))
  WITH CHECK (is_org_admin(org_id));

-- ============================================================================
-- promises
-- ============================================================================
DROP POLICY IF EXISTS "promises_self_read" ON promises;
CREATE POLICY "promises_self_read" ON promises
  FOR SELECT
  USING (member_id IN (SELECT id FROM members WHERE supabase_uid = auth.uid()));

DROP POLICY IF EXISTS "promises_admin_all" ON promises;
CREATE POLICY "promises_admin_all" ON promises
  FOR ALL
  USING (is_org_admin(org_id))
  WITH CHECK (is_org_admin(org_id));

-- ============================================================================
-- payments
-- ============================================================================
DROP POLICY IF EXISTS "payments_self_read" ON payments;
CREATE POLICY "payments_self_read" ON payments
  FOR SELECT
  USING (member_id IN (SELECT id FROM members WHERE supabase_uid = auth.uid()));

DROP POLICY IF EXISTS "payments_admin_all" ON payments;
CREATE POLICY "payments_admin_all" ON payments
  FOR ALL
  USING (is_org_admin(org_id))
  WITH CHECK (is_org_admin(org_id));

-- ============================================================================
-- receipts
-- ============================================================================
DROP POLICY IF EXISTS "receipts_self_read" ON receipts;
CREATE POLICY "receipts_self_read" ON receipts
  FOR SELECT
  USING (member_id IN (SELECT id FROM members WHERE supabase_uid = auth.uid()));

DROP POLICY IF EXISTS "receipts_admin_all" ON receipts;
CREATE POLICY "receipts_admin_all" ON receipts
  FOR ALL
  USING (is_org_admin(org_id))
  WITH CHECK (is_org_admin(org_id));
