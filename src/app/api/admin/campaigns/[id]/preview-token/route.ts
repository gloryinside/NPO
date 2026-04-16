import { NextRequest, NextResponse } from 'next/server';
import { generatePreviewToken } from '@/lib/campaign-builder/preview-token';
import { createRequestClient } from '@/lib/supabase/request-client';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

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

  const token = generatePreviewToken();

  // Use admin client to bypass RLS for the update
  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from('campaigns')
    .update({ preview_token: token })
    .eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ token });
}
