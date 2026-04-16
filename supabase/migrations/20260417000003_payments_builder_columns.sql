-- Task 3 (donation-site-builder): payments builder columns
--
-- Adds columns needed by the campaign builder's donation flow:
--   - designation:     optional fund/designation label chosen by the donor
--   - custom_fields:   arbitrary JSON captured from builder form fields
--   - idempotency_key: request-level dedupe key (PG/retry safety)
--
-- Indexes:
--   - idx_payments_designation: partial btree on (campaign_id, designation)
--     for designation breakdown queries; skips NULLs.
--   - idx_payments_idempotency_key: partial UNIQUE to enforce
--     at-most-one successful insert per idempotency key while still
--     allowing pre-existing NULL rows (backward compatibility).

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS designation     text,
  ADD COLUMN IF NOT EXISTS custom_fields   jsonb,
  ADD COLUMN IF NOT EXISTS idempotency_key text;

CREATE INDEX IF NOT EXISTS idx_payments_designation
  ON payments (campaign_id, designation)
  WHERE designation IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_idempotency_key
  ON payments (idempotency_key)
  WHERE idempotency_key IS NOT NULL;
