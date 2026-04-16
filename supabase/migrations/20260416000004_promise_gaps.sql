-- Phase 3 GAP: promises 테이블 추가 필드
-- 일시정지 해제 예정일 (NULL이면 무기한 정지)
ALTER TABLE promises
  ADD COLUMN IF NOT EXISTS suspended_until date;

-- 해지 사유 (관리자 입력)
ALTER TABLE promises
  ADD COLUMN IF NOT EXISTS cancel_reason text;

COMMENT ON COLUMN promises.suspended_until IS '일시정지 해제 예정일. NULL이면 수동 재개 전까지 유지.';
COMMENT ON COLUMN promises.cancel_reason IS '해지 사유 (관리자 입력 자유 텍스트)';
