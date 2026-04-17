import { NextRequest, NextResponse } from 'next/server';
import { requireAdminUser } from '@/lib/auth';
import { requireTenant } from '@/lib/tenant/context';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { getSampleVariables } from '@/lib/email/default-templates';
import { renderTemplate, renderSubject } from '@/lib/email/template-renderer';
import type { ScenarioKey } from '@/lib/email/default-templates';

export async function POST(req: NextRequest) {
  const adminUser = await requireAdminUser();
  const tenant = await requireTenant();
  const supabase = createSupabaseAdminClient();

  const { scenario, subject, bodyJson } = (await req.json()) as {
    scenario: ScenarioKey;
    subject: string;
    bodyJson: Record<string, unknown>;
  };

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

  const sampleVars = getSampleVariables(scenario);
  const html = renderTemplate(bodyJson, sampleVars, theme);
  const renderedSubject = renderSubject(subject, sampleVars);

  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_API_KEY) {
    return NextResponse.json({ error: 'RESEND_API_KEY 미설정' }, { status: 500 });
  }

  const BASE_DOMAIN = process.env.NEXT_PUBLIC_BASE_DOMAIN ?? '';
  const fromAddr = BASE_DOMAIN
    ? `${org?.name ?? '후원'} 알림 <noreply@${BASE_DOMAIN}>`
    : 'Test <onboarding@resend.dev>';

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: fromAddr,
      to: adminUser.email,
      subject: `[테스트] ${renderedSubject}`,
      html,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json({ error: `발송 실패: ${text}` }, { status: 500 });
  }

  return NextResponse.json({ ok: true, sentTo: adminUser.email });
}
