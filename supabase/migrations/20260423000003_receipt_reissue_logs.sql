-- Tier S #4: 기부금 영수증 재발행 이력
--
-- receipt_reissue_logs: 특정 영수증을 재발행할 때마다 로그 한 건 append.
-- 이력 추적용 append-only 테이블. 원본 receipt는 유지되고 pdf만 교체.

CREATE TABLE IF NOT EXISTS receipt_reissue_logs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  receipt_id      uuid NOT NULL REFERENCES receipts(id) ON DELETE CASCADE,
  reissued_by     uuid REFERENCES auth.users(id),
  reissued_at     timestamptz NOT NULL DEFAULT now(),
  reason          text,
  prev_pdf_url    text,
  new_pdf_url     text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_receipt_reissue_logs_receipt
  ON receipt_reissue_logs(receipt_id, reissued_at DESC);

CREATE INDEX IF NOT EXISTS idx_receipt_reissue_logs_org
  ON receipt_reissue_logs(org_id, reissued_at DESC);

COMMENT ON TABLE receipt_reissue_logs IS
  'Tier S #4: 기부금 영수증 재발행 이력 (append-only)';

-- RLS 활성화: admin 전용 조회
ALTER TABLE receipt_reissue_logs ENABLE ROW LEVEL SECURITY;
