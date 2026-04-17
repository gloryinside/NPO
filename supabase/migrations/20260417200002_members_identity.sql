-- 본인인증 정보 컬럼 추가
ALTER TABLE members ADD COLUMN IF NOT EXISTS ci_hash TEXT;
ALTER TABLE members ADD COLUMN IF NOT EXISTS identity_verified_at TIMESTAMPTZ;

COMMENT ON COLUMN members.ci_hash IS '토스 본인인증 CI 해시값';
COMMENT ON COLUMN members.identity_verified_at IS '본인인증 완료 시각';
