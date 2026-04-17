-- Task: receipt opt-in + RRN temporary encrypted storage on payments
--
-- When a donor opts into a donation receipt (기부금 영수증) and provides
-- their resident registration number (주민번호), we:
--   1. Store receipt_opt_in = TRUE on the payment row
--   2. Encrypt the raw RRN with pgp_sym_encrypt and store it temporarily in
--      rrn_pending_encrypted on the payment row
--   3. On payment confirmation (pay_status → 'paid'), the application layer
--      creates a receipts row and nulls out rrn_pending_encrypted
--
-- pgcrypto must already exist (added in 20260417000004).

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS receipt_opt_in       boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS rrn_pending_encrypted bytea NULL;

-- Helper: encrypt a text value with pgp_sym_encrypt.
-- Called by the application server (service role) to store a pending RRN
-- on the payment row before the payment is confirmed.
-- The passphrase comes from the RECEIPTS_ENCRYPTION_KEY env var, passed in
-- by the caller — never stored in the DB.
CREATE OR REPLACE FUNCTION encrypt_rrn_pending(plaintext text, passphrase text)
  RETURNS bytea
  LANGUAGE sql
  SECURITY DEFINER
  STABLE
  SET search_path = public, extensions
AS $$
  SELECT pgp_sym_encrypt(plaintext, passphrase)
$$;

-- Helper: decrypt the pending RRN. Used at confirm time and in the admin
-- receipt detail view.
CREATE OR REPLACE FUNCTION decrypt_rrn_pending(ciphertext bytea, passphrase text)
  RETURNS text
  LANGUAGE sql
  SECURITY DEFINER
  STABLE
  SET search_path = public, extensions
AS $$
  SELECT pgp_sym_decrypt(ciphertext, passphrase)
$$;
