import { NextRequest, NextResponse } from 'next/server';
import { createRequestClient } from '@/lib/supabase/request-client';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

type RouteContext = { params: Promise<{ id: string; assetId: string }> };

export async function DELETE(req: NextRequest, { params }: RouteContext) {
  const { id, assetId } = await params;
  const sb = createRequestClient(req);

  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { data: member } = await sb
    .from('members')
    .select('org_id')
    .eq('supabase_uid', user.id)
    .single();
  if (!member) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const admin = createSupabaseAdminClient();

  const { data: campaign } = await admin
    .from('campaigns')
    .select('org_id, page_content, published_content')
    .eq('id', id)
    .single();
  if (!campaign || campaign.org_id !== member.org_id) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
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
