-- Task: members.id_number (주민등록번호) encryption
--
-- 기존 members.id_number text 컬럼은 평문 저장 상태였다. 실 사용 전 pgcrypto 기반
-- encrypted storage로 전환한다.
--
-- 전환 전략:
--   1. id_number_encrypted bytea 컬럼 추가
--   2. 기존 평문 id_number 값이 있는 경우: 운영자가 수동 마이그레이션 스크립트로 이전
--      (본 프로젝트에서는 아직 입력 UI가 없어 실사용 데이터가 없다고 가정)
--   3. application layer는 항상 encrypted 컬럼 사용
--   4. RECEIPTS_ENCRYPTION_KEY passphrase로 암복호화 (RRN과 동일 키 재사용)
--
-- pgcrypto는 20260417000004에서 이미 활성화됨.

ALTER TABLE members
  ADD COLUMN IF NOT EXISTS id_number_encrypted bytea NULL;

COMMENT ON COLUMN members.id_number_encrypted IS
  '주민등록번호 pgp_sym_encrypt 암호화 저장. 평문 id_number 대체. 기부금영수증/NTS 간소화에 사용.';

-- Helper: encrypt a text id_number value with pgp_sym_encrypt.
-- Called by the application server (service role) when inserting/updating members.
CREATE OR REPLACE FUNCTION encrypt_id_number(plaintext text, passphrase text)
  RETURNS bytea
  LANGUAGE sql
  SECURITY DEFINER
  STABLE
AS $$
  SELECT pgp_sym_encrypt(plaintext, passphrase)
$$;

-- Helper: decrypt the id_number. Used by admin NTS export and admin RRN detail view.
CREATE OR REPLACE FUNCTION decrypt_id_number(ciphertext bytea, passphrase text)
  RETURNS text
  LANGUAGE sql
  SECURITY DEFINER
  STABLE
AS $$
  SELECT pgp_sym_decrypt(ciphertext, passphrase)
$$;

-- 평문 id_number 컬럼은 당장 삭제하지 않음 — 실 데이터 마이그레이션이 완료된 후
-- 후속 마이그레이션에서 DROP COLUMN 처리. 현재는 코드에서 사용 중단 처리로 충분.
