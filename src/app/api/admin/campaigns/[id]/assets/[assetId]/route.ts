import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { requireAdminOrgForBuilder } from '@/lib/auth/builder-guard';

type RouteContext = { params: Promise<{ id: string; assetId: string }> };

export async function DELETE(req: NextRequest, { params }: RouteContext) {
  const { id, assetId } = await params;
  const guard = await requireAdminOrgForBuilder(req, { campaignId: id });
  if (!guard.ok) return guard.response;

  const admin = createSupabaseAdminClient();

  const { data: campaign } = await admin
    .from('campaigns')
    .select('page_content, published_content')
    .eq('id', id)
    .single();
  if (!campaign) {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }

  // Guard: check if assetId is referenced in page_content or published_content
  const pageJson = JSON.stringify(campaign.page_content ?? {});
  const publishedJson = JSON.stringify(campaign.published_content ?? {});
  if (pageJson.includes(assetId) || publishedJson.includes(assetId)) {
    return NextResponse.json(
      { error: 'asset is referenced in page content' },
      { status: 409 },
    );
  }

  const { data: asset } = await admin
    .from('campaign_assets')
    .select('storage_path')
    .eq('id', assetId)
    .eq('campaign_id', id)
    .single();

  if (!asset) {
    return NextResponse.json({ error: 'asset not found' }, { status: 404 });
  }

  // Remove from storage
  await admin.storage.from('campaign-assets').remove([asset.storage_path]);

  // Delete DB row
  const { error } = await admin
    .from('campaign_assets')
    .delete()
    .eq('id', assetId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
