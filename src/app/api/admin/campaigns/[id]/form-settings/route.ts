import { NextRequest, NextResponse } from 'next/server';
import { FormSettingsSchema } from '@/lib/campaign-builder/form-settings/schema';
import { logAudit } from '@/lib/audit';
import { createRequestClient } from '@/lib/supabase/request-client';
import { requireAdminOrgForBuilder } from '@/lib/auth/builder-guard';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

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

  // 후원 목적·결연 아동 범위에 연결한 회계 사업은 이 기관 것이어야 한다(다른 기관 사업으로 수입이 배분되지 않게)
  const programIds = [
    ...new Set(
      [...parsed.data.designations.map((d) => d.programId), parsed.data.sponsorshipProgramId].filter((v): v is string => !!v),
    ),
  ];
  if (programIds.length > 0) {
    const { data: owned } = await createSupabaseAdminClient()
      .from('programs')
      .select('id')
      .eq('org_id', guard.orgId)
      .in('id', programIds);
    if ((owned ?? []).length !== programIds.length) {
      return NextResponse.json({ error: '연결할 수 없는 회계 사업이 있습니다.' }, { status: 400 });
    }
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
