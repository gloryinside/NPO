import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

/**
 * GET /api/cron/cancel-stale-payments
 *
 * Vercel Cron — every 30 minutes.
 * vercel.json crons schedule: "* /30 * * * *" (remove space between * and /30)
 *
 * pending 상태로 30분 이상 경과한 결제를 cancelled로 전환한다.
 * /donate/fail 에서 cancelDonation이 실패한 경우의 안전망.
 */
export async function GET(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret');
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const supabase = createSupabaseAdminClient();
  const cutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('payments')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('status', 'pending')
    .lt('created_at', cutoff)
    .select('id, order_id');

  if (error) {
    console.error('[cron/cancel-stale-payments] DB error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const cancelled = data?.length ?? 0;
  if (cancelled > 0) {
    console.log('[cron/cancel-stale-payments] cancelled:', cancelled, 'payments', data?.map((p) => p.order_id));
  }

  return NextResponse.json({ cancelled });
}
