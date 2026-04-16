import { NextRequest, NextResponse } from 'next/server';
import { publishCampaign } from '@/lib/campaign-builder/publish';
import { createRequestClient } from '@/lib/supabase/request-client';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  const sb = createRequestClient(req);

  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { data: member } = await sb
    .from('members')
    .select('org_id')
    .eq('supabase_uid', user.id)
    .single();
  if (!member) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const { data: campaign } = await sb
    .from('campaigns')
    .select('org_id')
    .eq('id', id)
    .single();
  if (!campaign || campaign.org_id !== member.org_id) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const result = await publishCampaign(id);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 422 });
  }

  return NextResponse.json({ ok: true });
}
