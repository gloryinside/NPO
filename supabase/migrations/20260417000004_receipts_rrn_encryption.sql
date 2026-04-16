-- Task 4: receipts RRN encryption columns + 5y retention
--
-- Adds pgcrypto-backed encrypted storage for resident registration number
-- (RRN, 주민등록번호) and business registration number on receipts, along with
-- a retention timestamp so a nightly job can null them out after 5 years.
-- Encryption key is pulled from org_secrets at write time (see campaign
-- payment-intent route); this migration only provisions the columns and the
-- extension.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE receipts
  ADD COLUMN IF NOT EXISTS resident_no_encrypted BYTEA NULL,
  ADD COLUMN IF NOT EXISTS business_no_encrypted BYTEA NULL,
  ADD COLUMN IF NOT EXISTS rrn_retention_expires_at TIMESTAMPTZ NULL;

-- Partial index: the retention sweep job scans only rows that still hold
-- encrypted PII and whose retention window has elapsed.
CREATE INDEX IF NOT EXISTS idx_receipts_rrn_retention
  ON receipts (rrn_retention_expires_at)
  WHERE rrn_retention_expires_at IS NOT NULL;
