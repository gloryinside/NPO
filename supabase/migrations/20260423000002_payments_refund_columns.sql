-- Phase 7-D-2-b: 관리자 환불 처리 컬럼
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS cancelled_at  timestamptz,
  ADD COLUMN IF NOT EXISTS refund_amount bigint,
  ADD COLUMN IF NOT EXISTS cancel_reason text;
