import { Hero } from '@/components/campaign-blocks/Hero';
import { RichText } from '@/components/campaign-blocks/RichText';
import { ImageSingle } from '@/components/campaign-blocks/ImageSingle';
import { ImpactStats } from '@/components/campaign-blocks/ImpactStats';
import { FundraisingProgress } from '@/components/campaign-blocks/FundraisingProgress';
import { Faq } from '@/components/campaign-blocks/Faq';
import { DonationQuickForm } from '@/components/campaign-blocks/DonationQuickForm';
import { SnsShare } from '@/components/campaign-blocks/SnsShare';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { defaultFormSettings } from '@/lib/campaign-builder/form-settings/schema';

/** Server component wrapper that injects form_settings into DonationQuickForm. */
async function DonationQuickFormWithSettings({ block, slug }: { block: any; slug: string }) {
  const sb = createSupabaseAdminClient();
  const { data } = await sb.from('campaigns').select('form_settings').eq('slug', slug).single();
  const formSettings = { ...defaultFormSettings(), ...(data?.form_settings ?? {}) };
  return <DonationQuickForm block={block} slug={slug} formSettings={formSettings} />;
}

export const blockRegistry: Record<string, React.ComponentType<{ block: any; slug: string }>> = {
  hero: Hero,
  richText: RichText,
  imageSingle: ImageSingle,
  impactStats: ImpactStats,
  fundraisingProgress: FundraisingProgress,
  faq: Faq,
  donationQuickForm: DonationQuickFormWithSettings as any,
  snsShare: SnsShare,
};
