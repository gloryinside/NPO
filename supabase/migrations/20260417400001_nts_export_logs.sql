-- nts_export_logs: 국세청 간소화파일 생성 이력 테이블

CREATE TABLE IF NOT EXISTS nts_export_logs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  year         int NOT NULL,
  created_by   uuid REFERENCES admin_users(id),
  created_at   timestamptz NOT NULL DEFAULT now(),
  file_url     text,
  member_count int,
  total_amount bigint
);

CREATE INDEX IF NOT EXISTS idx_nts_export_logs_org_year
  ON nts_export_logs(org_id, year);

ALTER TABLE nts_export_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_isolation" ON nts_export_logs
  FOR ALL
  USING (org_id = (
    SELECT org_id FROM admin_users
    WHERE supabase_uid = auth.uid()
    LIMIT 1
  ));
