import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { BlockRenderer } from '@/components/campaign-blocks/BlockRenderer';
import { PageContentSchema } from '@/lib/campaign-builder/blocks/schema';
import { verifyPreviewToken } from '@/lib/campaign-builder/preview-token';

export const metadata: Metadata = { robots: 'noindex,nofollow' };
export const revalidate = 0;

export default async function PreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { slug } = await params;
  const { token } = await searchParams;

  const sb = createSupabaseAdminClient();
  const { data: c } = await sb
    .from('campaigns')
    .select('slug, preview_token, page_content')
    .eq('slug', slug)
    .single();

  if (!c || !verifyPreviewToken(c.preview_token, token ?? null)) notFound();

  const parsed = PageContentSchema.safeParse(c.page_content);
  if (!parsed.success) notFound();

  return (
    <main>
      <div className="sticky top-0 z-50 border-b border-yellow-300 bg-yellow-100 py-2 text-center text-sm font-medium text-yellow-800">
        미리보기 — 아직 공개되지 않은 상태입니다
      </div>
      <BlockRenderer content={parsed.data} slug={slug} />
    </main>
  );
}
