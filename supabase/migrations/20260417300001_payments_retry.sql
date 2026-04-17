-- 결제 실패 재시도 지원
ALTER TABLE payments ADD COLUMN IF NOT EXISTS retry_count INT NOT NULL DEFAULT 0;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMPTZ;

CREATE INDEX idx_payments_retry ON payments(next_retry_at) WHERE pay_status = 'failed' AND retry_count < 3;

COMMENT ON COLUMN payments.retry_count IS '자동결제 재시도 횟수 (최대 3)';
COMMENT ON COLUMN payments.next_retry_at IS '다음 재시도 예정 시각';
