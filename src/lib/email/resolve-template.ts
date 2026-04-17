import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { getScenario, type ScenarioKey } from './default-templates';
import { renderTemplate, renderSubject } from './template-renderer';

type ResolvedEmail = {
  subject: string;
  html: string;
};

type ThemeRow = {
  name: string;
  logo_url: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  theme_config: { accent?: string } | null;
};

export async function resolveTemplate(
  orgId: string,
  scenario: ScenarioKey,
  variables: Record<string, string>
): Promise<ResolvedEmail> {
  const supabase = createSupabaseAdminClient();

  const [templateRes, orgRes] = await Promise.all([
    supabase
      .from('email_templates')
      .select('subject, body_json, is_active')
      .eq('org_id', orgId)
      .eq('scenario', scenario)
      .maybeSingle(),
    supabase
      .from('orgs')
      .select('name, logo_url, contact_email, contact_phone, theme_config')
      .eq('id', orgId)
      .maybeSingle(),
  ]);

  const org = orgRes.data as ThemeRow | null;
  const theme = {
    accent: org?.theme_config?.accent,
    logoUrl: org?.logo_url,
    orgName: org?.name ?? variables.orgName ?? '',
    contactEmail: org?.contact_email,
    contactPhone: org?.contact_phone,
  };

  const custom = templateRes.data;
  if (custom && custom.is_active) {
    return {
      subject: renderSubject(custom.subject as string, variables),
      html: renderTemplate(custom.body_json as Record<string, unknown>, variables, theme),
    };
  }

  const defaults = getScenario(scenario);
  return {
    subject: renderSubject(defaults.defaultSubject, variables),
    html: renderTemplate(defaults.defaultBodyJson, variables, theme),
  };
}
