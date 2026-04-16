-- Phase 2 GAP 처리 마이그레이션
--
-- 1. payments 테이블에 누락된 컬럼 추가 (pay_method, note)
-- 2. org_secrets에 erp_api_key 추가 (ERP 연동 인증용)
-- 3. consultation_logs 테이블 (상담이력)
-- 4. income_status 값 확장 (pending → processing → confirmed | excluded)

-- ============================================================================
-- 1. payments 누락 컬럼
-- ============================================================================
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS pay_method text,
  ADD COLUMN IF NOT EXISTS note text;

-- income_status 체크 제약 교체: processing 상태 추가
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_income_status_check;
ALTER TABLE payments ADD CONSTRAINT payments_income_status_check
  CHECK (income_status IN ('pending','processing','confirmed','excluded'));

-- ============================================================================
-- 2. org_secrets ERP API key
-- ============================================================================
ALTER TABLE org_secrets
  ADD COLUMN IF NOT EXISTS erp_api_key text;

-- ============================================================================
-- 3. consultation_logs (상담이력)
-- ============================================================================
CREATE TABLE IF NOT EXISTS consultation_logs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  member_id     uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  logged_by     uuid REFERENCES auth.users(id),
  log_type      text NOT NULL DEFAULT 'phone' CHECK (log_type IN ('phone','email','visit','other')),
  subject       text NOT NULL,
  content       text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_consultation_logs_member ON consultation_logs(member_id);
CREATE INDEX IF NOT EXISTS idx_consultation_logs_org ON consultation_logs(org_id);

ALTER TABLE consultation_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "consultation_logs_admin_all" ON consultation_logs;
CREATE POLICY "consultation_logs_admin_all" ON consultation_logs
  FOR ALL
  USING (is_org_admin(org_id))
  WITH CHECK (is_org_admin(org_id));
