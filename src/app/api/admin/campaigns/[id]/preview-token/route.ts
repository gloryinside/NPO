import { NextRequest, NextResponse } from 'next/server';
import { generatePreviewToken } from '@/lib/campaign-builder/preview-token';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { requireAdminOrgForBuilder } from '@/lib/auth/builder-guard';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  const guard = await requireAdminOrgForBuilder(req, { campaignId: id });
  if (!guard.ok) return guard.response;

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
