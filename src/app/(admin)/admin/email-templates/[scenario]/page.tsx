import { notFound } from 'next/navigation';
import { requireAdminUser } from '@/lib/auth';
import { requireTenant } from '@/lib/tenant/context';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { SCENARIOS, type ScenarioKey } from '@/lib/email/default-templates';
import { EmailTemplateEditor } from '@/components/admin/email-template-editor';

export default async function EmailTemplateEditPage({
  params,
}: {
  params: Promise<{ scenario: string }>;
}) {
  await requireAdminUser();
  const tenant = await requireTenant();
  const { scenario } = await params;

  const meta = SCENARIOS.find((s) => s.key === scenario);
  if (!meta) notFound();

  const supabase = createSupabaseAdminClient();
  const { data: custom } = await supabase
    .from('email_templates')
    .select('subject, body_json')
    .eq('org_id', tenant.id)
    .eq('scenario', scenario)
    .maybeSingle();

  const initialSubject = (custom?.subject as string) ?? meta.defaultSubject;
  const initialBodyJson = (custom?.body_json as Record<string, unknown>) ?? meta.defaultBodyJson;

  return (
    <EmailTemplateEditor
      scenario={scenario as ScenarioKey}
      label={meta.label}
      variables={meta.variables}
      initialSubject={initialSubject}
      initialBodyJson={initialBodyJson}
    />
  );
}
