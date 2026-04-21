import { notFound } from 'next/navigation';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { getDonorSession } from '@/lib/auth';
import { WizardClient } from './WizardClient';
import { FormSettingsSchema, defaultFormSettings } from '@/lib/campaign-builder/form-settings/schema';

export default async function WizardPage({
  searchParams,
}: {
  searchParams: Promise<{ campaign?: string; type?: string; amount?: string; designation?: string; completed?: string }>;
}) {
  const sp = await searchParams;
  if (!sp.campaign) notFound();

  const sb = createSupabaseAdminClient();
  const { data: c } = await sb
    .from('campaigns')
    .select('id, slug, title, status, ended_at, form_settings, org_id')
    .eq('slug', sp.campaign)
    .single();

  if (!c || c.status !== 'active') notFound();

  if (c.ended_at && new Date(c.ended_at as string) < new Date()) {
    return (
      <main className="mx-auto max-w-xl p-10 text-center">
        캠페인이 종료되었습니다.
      </main>
    );
  }

  const settings = FormSettingsSchema.parse({
    ...defaultFormSettings(),
    ...(c.form_settings ?? {}),
  });

  const donorSession = await getDonorSession();

  return (
    <WizardClient
      campaign={{ id: c.id, slug: c.slug, title: c.title, orgId: c.org_id }}
      settings={settings}
      isLoggedIn={!!donorSession}
      prefill={{
        type: sp.type,
        amount: sp.amount ? Number(sp.amount) : undefined,
        designation: sp.designation,
        completed: sp.completed === '1',
      }}
    />
  );
}
