-- Task E2: payments 테이블 — Toss Payments 연동 컬럼 추가
--
-- toss_payment_key: Toss가 발급한 결제 고유키 (confirm/refund 시 사용)
-- idempotency_key: 중복 confirm 방지를 위한 멱등키 (클라이언트 생성 orderId 재사용)
-- receipt_url: Toss가 발급한 영수증 URL (카드전표 등)
--
-- 기존 컬럼 pg_tx_id는 거래 추적용으로 유지 (toss transactionKey 저장).
-- pg_method는 "카드" / "계좌이체" / "가상계좌" 등 결제수단 이름 저장.

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS toss_payment_key text,
  ADD COLUMN IF NOT EXISTS idempotency_key  text,
  ADD COLUMN IF NOT EXISTS receipt_url      text,
  ADD COLUMN IF NOT EXISTS requested_at     timestamptz,
  ADD COLUMN IF NOT EXISTS approved_at      timestamptz;

-- idempotency_key는 org별 유일 — 같은 주문이 두 번 confirm되는 것을 DB 레벨에서 차단
CREATE UNIQUE INDEX IF NOT EXISTS uq_payments_idempotency_key
  ON payments(org_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payments_toss_key
  ON payments(toss_payment_key)
  WHERE toss_payment_key IS NOT NULL;
