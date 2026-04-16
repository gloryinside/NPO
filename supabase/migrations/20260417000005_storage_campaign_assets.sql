-- Donation site builder — Task 5: campaign-assets storage bucket
--
-- Public bucket for campaign hero images, gallery photos, and other
-- user-facing campaign assets. Reads are public (so images can be
-- embedded in public donation pages without signed URLs), but writes
-- are restricted to authenticated org members uploading under their
-- own org_id folder prefix (e.g. `<org_id>/<campaign_id>/<file>`).
--
-- Companion metadata table is `campaign_assets` (see 20260417000002).

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'campaign-assets',
  'campaign-assets',
  true,
  5242880,  -- 5 MB per file
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- Public read: anyone can GET objects in this bucket (images are served
-- directly from the public Supabase Storage URL on donation pages).
DROP POLICY IF EXISTS "campaign_assets_public_read" ON storage.objects;
CREATE POLICY "campaign_assets_public_read" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'campaign-assets');

-- Authed upload: object path must begin with the org_id of a member
-- record whose supabase_uid matches the caller (auth.uid()). This
-- enforces org-scoped isolation at the storage layer — members of org
-- A cannot write into org B's folder even if they guess the path.
DROP POLICY IF EXISTS "campaign_assets_member_insert" ON storage.objects;
CREATE POLICY "campaign_assets_member_insert" ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'campaign-assets'
    AND (storage.foldername(name))[1] IN (
      SELECT org_id::text FROM members WHERE supabase_uid = auth.uid()
    )
  );

-- Authed delete: mirror insert check so members can remove assets only
-- within their own org's folder.
DROP POLICY IF EXISTS "campaign_assets_member_delete" ON storage.objects;
CREATE POLICY "campaign_assets_member_delete" ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'campaign-assets'
    AND (storage.foldername(name))[1] IN (
      SELECT org_id::text FROM members WHERE supabase_uid = auth.uid()
    )
  );
