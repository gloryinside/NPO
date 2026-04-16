-- Donation site builder — Task 2 RLS hardening follow-up.
--
-- The initial campaign_assets migration (20260417000002) granted any
-- same-org member INSERT/DELETE rights. Campaign assets are admin-
-- authoring artifacts and must follow the same write-gating pattern as
-- campaigns/promises/payments: admin-only writes via is_org_admin().
--
-- After this migration, `campaign_assets_admin_all` (FOR ALL, USING +
-- WITH CHECK gated on is_org_admin(org_id)) is the SOLE write path
-- (covering INSERT, UPDATE, DELETE). Member SELECT remains intact so
-- same-org donors can still view images referenced by public campaign
-- pages.
--
-- Also tightens data-at-rest: mime_type is restricted to an image
-- allowlist via CHECK constraint.

DROP POLICY IF EXISTS campaign_assets_member_insert ON campaign_assets;
DROP POLICY IF EXISTS campaign_assets_member_delete ON campaign_assets;

ALTER TABLE campaign_assets
  DROP CONSTRAINT IF EXISTS campaign_assets_mime_type_check;

ALTER TABLE campaign_assets
  ADD CONSTRAINT campaign_assets_mime_type_check
  CHECK (mime_type IN (
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/gif',
    'image/svg+xml'
  ));

COMMENT ON POLICY campaign_assets_admin_all ON campaign_assets IS
  'Sole write path (INSERT/UPDATE/DELETE) for campaign_assets. Gated on is_org_admin(org_id). Member SELECT is granted separately by campaign_assets_member_select.';
