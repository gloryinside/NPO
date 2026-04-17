import { NextRequest, NextResponse } from 'next/server';
import { requireAdminUser } from '@/lib/auth';
import { requireTenant } from '@/lib/tenant/context';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { getSampleVariables } from '@/lib/email/default-templates';
import { renderTemplate, renderSubject } from '@/lib/email/template-renderer';
import type { ScenarioKey } from '@/lib/email/default-templates';

export async function POST(req: NextRequest) {
  await requireAdminUser();
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

  return NextResponse.json({ subject: renderedSubject, html });
}
