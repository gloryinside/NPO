import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * 홈 대시보드 상단 "Action Required" 배너용 3종 카운트.
 *
 * - failedPayments: 자동결제 실패 + 재시도 가능한 건 (pay_status='failed' AND retry_count<3)
 * - missingRrnReceipts: 올해 paid 중 영수증 동의 + 주민번호/영수증 미입력
 * - recentAdminChanges: 최근 30일 admin이 약정 금액 변경한 건
 */
export interface DashboardActions {
  failedPayments: number;
  missingRrnReceipts: number;
  recentAdminChanges: number;
}

export async function getDashboardActions(
  supabase: SupabaseClient,
  orgId: string,
  memberId: string,
): Promise<DashboardActions> {
  const now = new Date();
  const currentYear = now.getUTCFullYear();
  const yearStart = `${currentYear}-01-01`;
  const yearEnd = `${currentYear + 1}-01-01`;
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000).toISOString();

  const failedQ = supabase
    .from('payments')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .eq('member_id', memberId)
    .eq('pay_status', 'failed')
    .lt('retry_count', 3);

  const rrnQ = supabase
    .from('payments')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .eq('member_id', memberId)
    .eq('pay_status', 'paid')
    .eq('receipt_opt_in', true)
    .is('rrn_pending_encrypted', null)
    .is('receipt_id', null)
    .gte('pay_date', yearStart)
    .lt('pay_date', yearEnd);

  const changesQ = supabase
    .from('promise_amount_changes')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .eq('member_id', memberId)
    .eq('actor', 'admin')
    .gte('created_at', thirtyDaysAgo);

  const [failed, rrn, changes] = await Promise.all([failedQ, rrnQ, changesQ]);

  return {
    failedPayments: failed.error ? 0 : failed.count ?? 0,
    missingRrnReceipts: rrn.error ? 0 : rrn.count ?? 0,
    recentAdminChanges: changes.error ? 0 : changes.count ?? 0,
  };
}
