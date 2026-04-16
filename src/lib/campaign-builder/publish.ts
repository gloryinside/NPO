import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { PageContentSchema } from './blocks/schema';

export async function publishCampaign(
  campaignId: string,
): Promise<{ ok: boolean; error?: string }> {
  const sb = createSupabaseAdminClient();

  const { data: c, error } = await sb
    .from('campaigns')
    .select('id, slug, page_content')
    .eq('id', campaignId)
    .single();

  if (error || !c) return { ok: false, error: 'campaign not found' };

  const parsed = PageContentSchema.safeParse(c.page_content);
  if (!parsed.success) return { ok: false, error: 'invalid page_content' };

  const { error: updErr } = await sb
    .from('campaigns')
    .update({
      published_content: parsed.data,
      published_at: new Date().toISOString(),
      status: 'active',
    })
    .eq('id', campaignId);

  if (updErr) return { ok: false, error: updErr.message };

  // revalidateTag throws outside Next.js context — ignore failures
  try {
    const { revalidateTag } = await import('next/cache');
    revalidateTag(`campaign:${c.slug}`);
  } catch {
    // not in Next.js runtime
  }

  return { ok: true };
}
