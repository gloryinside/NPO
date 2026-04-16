import { NextRequest, NextResponse } from 'next/server';
import { publishCampaign } from '@/lib/campaign-builder/publish';
import { requireAdminOrgForBuilder } from '@/lib/auth/builder-guard';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  const guard = await requireAdminOrgForBuilder(req, { campaignId: id });
  if (!guard.ok) return guard.response;

  const result = await publishCampaign(id);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 422 });
  }

  return NextResponse.json({ ok: true });
}
