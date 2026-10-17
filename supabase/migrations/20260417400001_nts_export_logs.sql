-- nts_export_logs: 국세청 간소화파일 생성 이력 테이블

CREATE TABLE IF NOT EXISTS nts_export_logs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  year         int NOT NULL,
  created_by   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  file_url     text,
  member_count int,
  total_amount bigint
);

CREATE INDEX IF NOT EXISTS idx_nts_export_logs_org_year
  ON nts_export_logs(org_id, year);

ALTER TABLE nts_export_logs ENABLE ROW LEVEL SECURITY;

-- (2026-10-17) admin_users 테이블은 존재하지 않아 이 마이그레이션이 적용될 수 없었다 → is_org_admin()으로 교체
DROP POLICY IF EXISTS "org_isolation" ON nts_export_logs;
CREATE POLICY "org_isolation" ON nts_export_logs
  FOR ALL
  USING (is_org_admin(org_id))
  WITH CHECK (is_org_admin(org_id));
