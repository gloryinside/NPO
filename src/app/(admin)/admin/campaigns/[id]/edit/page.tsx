import { notFound } from 'next/navigation';
import { requireAdminUser } from '@/lib/auth';
import { requireTenant } from '@/lib/tenant/context';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { Editor } from '@/components/campaign-builder/Editor';
import { defaultFormSettings } from '@/lib/campaign-builder/form-settings/schema';

export default async function CampaignEditPage({ params }: { params: { id: string } }) {
  await requireAdminUser();
  const tenant = await requireTenant();
  const supabase = createSupabaseAdminClient();

  const { data: campaign } = await supabase
    .from('campaigns')
    .select('id, slug, page_content, form_settings')
    .eq('id', params.id)
    .eq('org_id', tenant.id)
    .single();

  if (!campaign) notFound();

  const initialContent = campaign.page_content ?? { blocks: [] };
  const initialFormSettings = campaign.form_settings ?? defaultFormSettings();

  return (
    <Editor
      campaignId={campaign.id}
      campaignSlug={campaign.slug}
      initialContent={initialContent}
      initialFormSettings={initialFormSettings}
    />
  );
}
