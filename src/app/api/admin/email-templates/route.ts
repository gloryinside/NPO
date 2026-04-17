import { NextRequest, NextResponse } from 'next/server';
import { requireAdminUser } from '@/lib/auth';
import { requireTenant } from '@/lib/tenant/context';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { SCENARIOS } from '@/lib/email/default-templates';
import { renderTemplate } from '@/lib/email/template-renderer';

export async function GET() {
  await requireAdminUser();
  const tenant = await requireTenant();
  const supabase = createSupabaseAdminClient();

  const { data: customs } = await supabase
    .from('email_templates')
    .select('scenario, subject, is_active, updated_at')
    .eq('org_id', tenant.id);

  const customMap = new Map(
    (customs ?? []).map((c) => [c.scenario, c])
  );

  const list = SCENARIOS.map((s) => {
    const custom = customMap.get(s.key);
    return {
      scenario: s.key,
      label: s.label,
      description: s.description,
      isCustom: !!custom,
      isActive: custom?.is_active ?? true,
      updatedAt: custom?.updated_at ?? null,
    };
  });

  return NextResponse.json(list);
}

export async function PUT(req: NextRequest) {
  await requireAdminUser();
  const tenant = await requireTenant();
  const supabase = createSupabaseAdminClient();

  const body = await req.json();
  const { scenario, subject, bodyJson } = body as {
    scenario: string;
    subject: string;
    bodyJson: Record<string, unknown>;
  };

  if (!scenario || !subject || !bodyJson) {
    return NextResponse.json({ error: '필수 필드 누락' }, { status: 400 });
  }

  const meta = SCENARIOS.find((s) => s.key === scenario);
  if (!meta) {
    return NextResponse.json({ error: '알 수 없는 시나리오' }, { status: 400 });
  }

  const doc = bodyJson as { type?: string; content?: unknown[] };
  if (doc.type !== 'doc' || !doc.content || doc.content.length === 0) {
    return NextResponse.json({ error: '템플릿 내용이 비어있습니다.' }, { status: 400 });
  }

  const { data: org } = await supabase
    .from('orgs')
    .select('name, logo_url, contact_email, contact_phone, theme_config')
    .eq('id', tenant.id)
    .maybeSingle();

  const theme = {
    accent: (org?.theme_config as { accent?: string } | null)?.accent,
    logoUrl: org?.logo_url ?? null,
    orgName: org?.name ?? '',
    contactEmail: org?.contact_email ?? null,
    contactPhone: org?.contact_phone ?? null,
  };

  const sampleVars: Record<string, string> = {};
  for (const v of meta.variables) sampleVars[v.key] = v.sample;
  const bodyHtml = renderTemplate(bodyJson, sampleVars, theme);

  const { error } = await supabase
    .from('email_templates')
    .upsert({
      org_id: tenant.id,
      scenario,
      subject,
      body_json: bodyJson,
      body_html: bodyHtml,
      is_active: true,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'org_id,scenario' });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
