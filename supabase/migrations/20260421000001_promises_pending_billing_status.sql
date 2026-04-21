-- promises.status에 'pending_billing' 상태 추가
--
-- 배경: 정기후원 약정 생성 시 카드 빌링키 발급이 실패하면 promise를
-- 'active' 상태로 생성하면 안 된다. active 상태면 processMonthlyCharges가
-- null billingKey로 청구를 시도하다 매월 실패해 3회 후 자동 suspended 처리됨.
-- 대신 'pending_billing' 상태로 생성해 관리자가 카드 재등록 후 active로
-- 전환하도록 한다.
--
-- 상태 전이:
--   pending_billing → active  (관리자가 빌링키 재등록 완료)
--   pending_billing → cancelled (후원자가 해지)

ALTER TABLE promises DROP CONSTRAINT IF EXISTS promises_status_check;

ALTER TABLE promises
  ADD CONSTRAINT promises_status_check
  CHECK (status IN ('active', 'suspended', 'cancelled', 'completed', 'pending_billing'));

COMMENT ON COLUMN promises.status IS '약정 상태: active(진행중), suspended(일시중지), cancelled(해지), completed(완료), pending_billing(빌링키 발급 대기)';
