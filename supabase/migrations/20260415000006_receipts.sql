-- Task B5: receipts 테이블 — 기부금 영수증
--
-- 연말정산 소득공제를 위한 공식 증빙. 기관(org)별 연도(year) 단위로 발행.
-- total_amount는 해당 기간의 확정 납입액 합계.
-- pdf_url은 Supabase Storage의 signed URL 경로.
-- 생성 후 payments.receipt_id FK 제약을 추가해 payment ↔ receipt 연결.

CREATE TABLE IF NOT EXISTS receipts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  receipt_code    text NOT NULL,
  member_id       uuid NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
  year            integer NOT NULL,
  total_amount    bigint NOT NULL,
  pdf_url         text,
  issued_at       timestamptz,
  issued_by       uuid REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(org_id, receipt_code)
);

CREATE INDEX IF NOT EXISTS idx_receipts_org ON receipts(org_id);
CREATE INDEX IF NOT EXISTS idx_receipts_member ON receipts(member_id, year);

-- payments ↔ receipts 연결 (이전 마이그레이션에서 receipt_id 컬럼을 만들었으므로 FK만 추가)
ALTER TABLE payments
  DROP CONSTRAINT IF EXISTS fk_payments_receipt;

ALTER TABLE payments
  ADD CONSTRAINT fk_payments_receipt
  FOREIGN KEY (receipt_id) REFERENCES receipts(id) ON DELETE SET NULL;
