import { NextResponse } from 'next/server';
import { getCampaignProgress } from '@/lib/campaign-builder/progress';

export const revalidate = 60;

export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const p = await getCampaignProgress(slug);
  return NextResponse.json(p, { headers: { 'Cache-Tag': `campaign:${slug}` } });
}
