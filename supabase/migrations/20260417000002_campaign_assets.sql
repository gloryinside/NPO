-- Donation site builder — Task 2: campaign_assets table
--
-- Stores metadata for images uploaded via the Supabase Storage
-- `campaign-assets` bucket (bucket itself is provisioned in Task 5).
-- Every row is org-scoped and accessible only to members of that org
-- via RLS. `created_by` references members(id) (not auth.users) because
-- uploads are attributed to a member record, not raw auth users.

CREATE TABLE IF NOT EXISTS campaign_assets (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  campaign_id  uuid NULL REFERENCES campaigns(id) ON DELETE SET NULL,
  storage_path text NOT NULL,
  public_url   text NOT NULL,
  mime_type    text NOT NULL,
  size_bytes   integer NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 5242880),
  width        integer NULL,
  height       integer NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  created_by   uuid NULL REFERENCES members(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_campaign_assets_org ON campaign_assets(org_id);
CREATE INDEX IF NOT EXISTS idx_campaign_assets_campaign ON campaign_assets(campaign_id);

ALTER TABLE campaign_assets ENABLE ROW LEVEL SECURITY;

-- Members of an org can read their org's assets. `supabase_uid` is the
-- bridge between auth.users and members (see 20260415000003_members.sql).
DROP POLICY IF EXISTS "campaign_assets_member_select" ON campaign_assets;
CREATE POLICY "campaign_assets_member_select" ON campaign_assets
  FOR SELECT
  USING (
    org_id IN (
      SELECT org_id FROM members WHERE supabase_uid = auth.uid()
    )
  );

DROP POLICY IF EXISTS "campaign_assets_member_insert" ON campaign_assets;
CREATE POLICY "campaign_assets_member_insert" ON campaign_assets
  FOR INSERT
  WITH CHECK (
    org_id IN (
      SELECT org_id FROM members WHERE supabase_uid = auth.uid()
    )
  );

DROP POLICY IF EXISTS "campaign_assets_member_delete" ON campaign_assets;
CREATE POLICY "campaign_assets_member_delete" ON campaign_assets
  FOR DELETE
  USING (
    org_id IN (
      SELECT org_id FROM members WHERE supabase_uid = auth.uid()
    )
  );

-- Admins get full CRUD via the existing is_org_admin() helper, mirroring
-- the convention used by campaigns/members/payments RLS.
DROP POLICY IF EXISTS "campaign_assets_admin_all" ON campaign_assets;
CREATE POLICY "campaign_assets_admin_all" ON campaign_assets
  FOR ALL
  USING (is_org_admin(org_id))
  WITH CHECK (is_org_admin(org_id));
