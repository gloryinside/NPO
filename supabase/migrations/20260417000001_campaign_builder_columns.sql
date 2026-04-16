-- Donation site builder — Task 1: campaigns table JSONB extensions
--
-- Adds block-tree page content, published snapshot, preview token,
-- and form settings. Backfills existing rows so that:
--   1) Rows with non-empty `description` get a single `richText` block.
--   2) Rows currently `status='active'` have their `page_content` copied
--      into `published_content` with `published_at` set.
--
-- NOTE: The existing `preset_amounts`, `donation_type`, and `pg_config`
-- JSONB columns remain untouched. `form_settings` is additive; future
-- migrations may move legacy values into it.

ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS page_content      JSONB NOT NULL DEFAULT '{"meta":{"schemaVersion":1},"blocks":[]}'::jsonb,
  ADD COLUMN IF NOT EXISTS published_content JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS published_at      TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS preview_token     TEXT NULL,
  ADD COLUMN IF NOT EXISTS form_settings     JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS campaigns_preview_token_idx
  ON campaigns (preview_token)
  WHERE preview_token IS NOT NULL;

-- Backfill: wrap non-empty description into a richText block for rows
-- whose page_content is still the default empty-blocks structure.
UPDATE campaigns
SET page_content = jsonb_build_object(
  'meta', jsonb_build_object('schemaVersion', 1),
  'blocks', jsonb_build_array(
    jsonb_build_object(
      'id', gen_random_uuid()::text,
      'type', 'richText',
      'props', jsonb_build_object('html', COALESCE(description, ''))
    )
  )
)
WHERE page_content = '{"meta":{"schemaVersion":1},"blocks":[]}'::jsonb
  AND description IS NOT NULL
  AND description <> '';

-- Backfill: for live (active) campaigns without a published snapshot,
-- snapshot the current page_content into published_content.
UPDATE campaigns
SET published_content = page_content,
    published_at      = COALESCE(updated_at, now())
WHERE status = 'active'
  AND published_content = '{}'::jsonb;
