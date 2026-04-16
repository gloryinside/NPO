import { NextRequest, NextResponse } from 'next/server';
import { FormSettingsSchema } from '@/lib/campaign-builder/form-settings/schema';
import { logAudit } from '@/lib/audit';
import { createRequestClient } from '@/lib/supabase/request-client';
import { requireAdminOrgForBuilder } from '@/lib/auth/builder-guard';

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  const guard = await requireAdminOrgForBuilder(req, { campaignId: id });
  if (!guard.ok) return guard.response;
  const sb = createRequestClient(req);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  const parsed = FormSettingsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid', issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { error } = await sb
    .from('campaigns')
    .update({ form_settings: parsed.data })
    .eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAudit({
    orgId: guard.orgId,
    actorId: guard.userId,
    actorEmail: guard.userEmail,
    action: 'campaign.update',
    resourceType: 'campaign',
    resourceId: id,
    summary: 'form_settings updated',
  });

  return NextResponse.json({ ok: true });
}
