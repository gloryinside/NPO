import { cronAuthError } from "@/lib/cron/runner";
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

/**
 * GET /api/cron/purge-expired-rrn
 *
 * Nightly cron: nulls out resident_no_encrypted / business_no_encrypted on
 * receipts whose rrn_retention_expires_at has passed, and pending RRNs on
 * payments that never got paid (개인정보 보호법 제21조 — 목적을 다하면 지체 없이 파기).
 *
 * Secured by CRON_SECRET env var (Authorization: Bearer 또는 x-cron-secret, via cronAuthError — 없으면 거부) so only Vercel's
 * cron infrastructure can call it. Consistent with /api/cron/process-payments.
 */
export async function GET(req: NextRequest) {
  const authError = cronAuthError(req);
  if (authError) return authError;

  const sb = createSupabaseAdminClient();
  const { error } = await sb
    .from('receipts')
    .update({
      resident_no_encrypted: null,
      business_no_encrypted: null,
      rrn_retention_expires_at: null,
    })
    .lt('rrn_retention_expires_at', new Date().toISOString());

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // 신청 때 결제 행에 잠시 보관한 주민번호(사업자번호) — 돈이 들어오면 후원자에게 옮기고 지운다(lib/receipt/pending-id).
  // 결제가 끝내 안 된 신청은 더 쓸 데가 없으니 지운다: 취소·실패·환불은 바로, 대기·미납은 90일 지나면.
  const staleBefore = new Date(Date.now() - 90 * 86_400_000).toISOString();
  const pendingClear = { rrn_pending_encrypted: null };
  const [closed, stale] = await Promise.all([
    sb.from('payments').update(pendingClear)
      .not('rrn_pending_encrypted', 'is', null)
      .in('pay_status', ['cancelled', 'failed', 'refunded']),
    sb.from('payments').update(pendingClear)
      .not('rrn_pending_encrypted', 'is', null)
      .in('pay_status', ['pending', 'unpaid'])
      .lt('created_at', staleBefore),
  ]);
  const pendingError = closed.error ?? stale.error;
  if (pendingError) {
    return NextResponse.json({ error: pendingError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
