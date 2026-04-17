-- Task: org_secrets encryption + erp_api_key hash
--
-- Phase 2 보안 강화: Toss/ERP 시크릿을 pgcrypto 로 암호화 저장하고,
-- ERP API 키 인증은 평문 비교가 아닌 해시 비교로 전환한다.
--
-- 저장 형식 변경:
--   - toss_client_key_enc       bytea  (pgp_sym_encrypt, passphrase = env ORG_SECRETS_KEY)
--   - toss_secret_key_enc       bytea
--   - toss_webhook_secret_enc   bytea
--   - erp_api_key_hash          text   (SHA-256 hex digest — 타이밍 공격 방지)
--   - erp_webhook_url           그대로 유지 (공개 URL 이므로 평문 OK)
--
-- pgcrypto는 20260417000004에서 이미 활성화됨.

ALTER TABLE org_secrets
  ADD COLUMN IF NOT EXISTS toss_client_key_enc     bytea NULL,
  ADD COLUMN IF NOT EXISTS toss_secret_key_enc     bytea NULL,
  ADD COLUMN IF NOT EXISTS toss_webhook_secret_enc bytea NULL,
  ADD COLUMN IF NOT EXISTS erp_api_key_enc         bytea NULL,
  ADD COLUMN IF NOT EXISTS erp_api_key_hash        text  NULL;

COMMENT ON COLUMN org_secrets.erp_api_key_enc         IS 'ERP API key, pgp_sym_encrypt (복원용)';

COMMENT ON COLUMN org_secrets.toss_client_key_enc     IS 'Toss client key, pgp_sym_encrypt';
COMMENT ON COLUMN org_secrets.toss_secret_key_enc     IS 'Toss secret key, pgp_sym_encrypt';
COMMENT ON COLUMN org_secrets.toss_webhook_secret_enc IS 'Toss webhook secret, pgp_sym_encrypt';
COMMENT ON COLUMN org_secrets.erp_api_key_hash        IS 'ERP API key SHA-256 hex digest (lowercase, 64 chars)';

-- 해시 조회용 인덱스 (v1 payments API에서 token hash로 org 찾음)
CREATE INDEX IF NOT EXISTS idx_org_secrets_erp_api_key_hash
  ON org_secrets (erp_api_key_hash)
  WHERE erp_api_key_hash IS NOT NULL;

-- ── RPC Helpers ────────────────────────────────────────────────────────────

-- Encrypt a generic secret. Service role 전용.
CREATE OR REPLACE FUNCTION encrypt_secret(plaintext text, passphrase text)
  RETURNS bytea
  LANGUAGE sql
  SECURITY DEFINER
  STABLE
  SET search_path = public, extensions
AS $$
  SELECT pgp_sym_encrypt(plaintext, passphrase)
$$;

-- Decrypt a generic secret. Service role 전용.
CREATE OR REPLACE FUNCTION decrypt_secret(ciphertext bytea, passphrase text)
  RETURNS text
  LANGUAGE sql
  SECURITY DEFINER
  STABLE
  SET search_path = public, extensions
AS $$
  SELECT pgp_sym_decrypt(ciphertext, passphrase)
$$;

-- SHA-256 해시 (소문자 hex 64자)
-- ERP API 키 해싱용. 이미 pgcrypto의 digest() 사용 가능하지만 일관성을 위해 래퍼 제공.
CREATE OR REPLACE FUNCTION hash_api_key(plaintext text)
  RETURNS text
  LANGUAGE sql
  IMMUTABLE
  SET search_path = public, extensions
AS $$
  SELECT encode(digest(plaintext, 'sha256'), 'hex')
$$;

-- 기존 평문 컬럼(toss_client_key, toss_secret_key, toss_webhook_secret, erp_api_key)은
-- 마이그레이션 backfill이 완료된 후 후속 DROP COLUMN 에서 정리. 현재는 애플리케이션
-- 코드에서 사용 중단 처리로 충분.
