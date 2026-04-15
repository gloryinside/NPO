-- Task B5: payments 테이블 — 납입 내역
--
-- 약정에 따라 실제 이뤄진 개별 결제 건. 일시 후원의 경우 promise_id가 NULL일 수 있다.
-- pay_status: 납부완료/미납/실패/취소/환불/처리중
-- income_status: 소득공제 처리 상태 (연말정산 기부금 영수증 발급 기준)
-- receipt_id FK는 영수증 테이블 생성 후 다음 마이그레이션에서 추가.

CREATE TABLE IF NOT EXISTS payments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  payment_code    text NOT NULL,
  member_id       uuid NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
  promise_id      uuid REFERENCES promises(id) ON DELETE SET NULL,
  campaign_id     uuid NOT NULL REFERENCES campaigns(id) ON DELETE RESTRICT,
  amount          bigint NOT NULL,
  pay_date        date NOT NULL,
  deposit_date    timestamptz,
  pay_status      text NOT NULL DEFAULT 'unpaid' CHECK (pay_status IN ('paid','unpaid','failed','cancelled','refunded','pending')),
  income_status   text NOT NULL DEFAULT 'pending' CHECK (income_status IN ('pending','confirmed','excluded')),
  pg_tx_id        text,
  pg_method       text,
  fail_reason     text,
  receipt_id      uuid,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(org_id, payment_code)
);

CREATE INDEX IF NOT EXISTS idx_payments_org ON payments(org_id);
CREATE INDEX IF NOT EXISTS idx_payments_member ON payments(member_id);
CREATE INDEX IF NOT EXISTS idx_payments_promise ON payments(promise_id);
CREATE INDEX IF NOT EXISTS idx_payments_pay_date ON payments(org_id, pay_date);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(org_id, pay_status);
