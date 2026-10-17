import { cronAuthError } from "@/lib/cron/runner";
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
  const authError = cronAuthError(req);
  if (authError) return authError;

  const supabase = createSupabaseAdminClient();
  const cutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('payments')
    // 컬럼은 pay_status(예전 코드는 없는 status·order_id를 써서 매번 실패했다).
    // 토스에 넘어간 건(toss_payment_key 있음)과 입금 대기 중인 가상계좌는 건드리지 않는다.
    .update({ pay_status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('pay_status', 'pending')
    .is('toss_payment_key', null)
    .is('promise_id', null)
    .not('pay_method', 'in', '(virtual_account,vbank,transfer)')
    .lt('created_at', cutoff)
    .select('id, payment_code');

  if (error) {
    console.error('[cron/cancel-stale-payments] DB error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const cancelled = data?.length ?? 0;
  if (cancelled > 0) {
    console.log('[cron/cancel-stale-payments] cancelled:', cancelled, 'payments', data?.map((p) => p.payment_code));
  }

  return NextResponse.json({ cancelled });
}
