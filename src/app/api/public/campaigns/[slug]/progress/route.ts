import { NextResponse } from 'next/server';
import { getCampaignProgress } from '@/lib/campaign-builder/progress';
import { getClientIp, rateLimit } from '@/lib/rate-limit';

export const revalidate = 60;

export async function GET(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const ip = getClientIp(req.headers);
  const limit = rateLimit(`public:progress:${ip}`, 60, 60_000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Too many requests' },
      {
        status: 429,
        headers: { 'Retry-After': String(Math.ceil(limit.retryAfterMs / 1000)) },
      }
    );
  }

  const { slug } = await ctx.params;
  const p = await getCampaignProgress(slug);
  return NextResponse.json(p, { headers: { 'Cache-Tag': `campaign:${slug}` } });
}
