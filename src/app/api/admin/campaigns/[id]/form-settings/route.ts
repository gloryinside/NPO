import { NextRequest, NextResponse } from 'next/server';
import { FormSettingsSchema } from '@/lib/campaign-builder/form-settings/schema';
import { logAudit } from '@/lib/audit';
import { createRequestClient } from '@/lib/supabase/request-client';

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  const sb = createRequestClient(req);

  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { data: member } = await sb
    .from('members')
    .select('org_id, id')
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
    orgId: member.org_id,
    actorId: user.id,
    actorEmail: user.email ?? null,
    action: 'campaign.update',
    resourceType: 'campaign',
    resourceId: id,
    summary: 'form_settings updated',
  });

  return NextResponse.json({ ok: true });
}
