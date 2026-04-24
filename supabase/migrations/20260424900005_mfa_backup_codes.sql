-- SP-5 / 후속: MFA 백업 코드
-- TOTP 인증 디바이스 분실 시 사용할 1회용 비상 코드.
-- 평문은 발급 시 1회만 사용자에게 표시. DB에는 scrypt 해시(64-byte hex)와
-- 솔트(16-byte hex)만 저장. used_at 으로 1회 사용 보장.

CREATE TABLE IF NOT EXISTS member_mfa_backup_codes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id   uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  code_hash   text NOT NULL,        -- scrypt(plaintext, salt, 64) hex
  code_salt   text NOT NULL,        -- 16-byte hex
  used_at     timestamptz,
  created_at  timestamptz NOT NULL DEFAULT NOW()
);

-- 검증 시 member_id 로 미사용 코드를 조회
CREATE INDEX IF NOT EXISTS idx_mfa_backup_codes_member_unused
  ON member_mfa_backup_codes (member_id)
  WHERE used_at IS NULL;

COMMENT ON TABLE member_mfa_backup_codes IS
  'SP-5 후속: TOTP 분실 시 사용할 1회용 백업 코드. scrypt 해시 저장.';
COMMENT ON COLUMN member_mfa_backup_codes.code_hash IS
  'scrypt(plaintext, salt, N=16384, r=8, p=1, dkLen=64) → hex';
COMMENT ON COLUMN member_mfa_backup_codes.used_at IS
  '사용한 코드는 NOT NULL 처리 후 재사용 차단';
