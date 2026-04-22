import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { getOrgTossKeys } from '@/lib/toss/keys';
import { chargeBillingKey } from './toss-billing';
import {
  createBillingFailedNotification,
  createPledgeSuspendedNotification,
} from './notifications';
import { notifyCmsChargeSuccess } from './notify-success';

const RETRY_INTERVALS_MS = [
  1 * 86400000, // retry_count 0 → +1일
  3 * 86400000, // retry_count 1 → +3일
  7 * 86400000, // retry_count 2 → +7일
];

export async function processRetries(orgId: string): Promise<{ retried: number; suspended: number }> {
  const keys = await getOrgTossKeys(orgId);
  if (!keys.tossSecretKey) {
    console.error(`[retry] org ${orgId}: tossSecretKey 없음`);
    return { retried: 0, suspended: 0 };
  }

  const supabase = createSupabaseAdminClient();
  const now = new Date().toISOString();

  const { data: payments, error } = await supabase
    .from('payments')
    .select(
      '*, promises!inner(id, toss_billing_key, customer_key, amount, pay_method, member_id)',
    )
    .eq('org_id', orgId)
    .eq('pay_status', 'failed')
    .lt('retry_count', 3)
    .lte('next_retry_at', now);

  if (error) {
    console.error(`[retry] org ${orgId}: 조회 실패`, error.message);
    return { retried: 0, suspended: 0 };
  }
  if (!payments?.length) return { retried: 0, suspended: 0 };

  let retried = 0;
  let suspended = 0;

  for (const payment of payments) {
    const promise = payment.promises as {
      id: string;
      toss_billing_key: string | null;
      customer_key: string | null;
      amount: number;
      pay_method: string;
      member_id: string;
    };

    if (!promise.toss_billing_key || !promise.customer_key) continue;

    const result = await chargeBillingKey(
      keys.tossSecretKey,
      promise.toss_billing_key,
      {
        customerKey: promise.customer_key,
        amount: payment.amount,
        orderId: payment.code,
        orderName: '정기후원 재시도',
      },
    );

    if (result.success) {
      const approvedAt = new Date().toISOString();
      await supabase
        .from('payments')
        .update({
          pay_status: 'paid',
          toss_payment_key: result.paymentKey,
          approved_at: approvedAt,
        })
        .eq('id', payment.id);

      void notifyCmsChargeSuccess({
        orgId,
        paymentId: payment.id,
        memberId: promise.member_id,
        amount: payment.amount,
        paymentCode: payment.payment_code ?? payment.code ?? payment.id,
        approvedAt,
      });

      retried++;
    } else {
      const newRetryCount = (payment.retry_count ?? 0) + 1;

      if (newRetryCount >= 3) {
        // 3회 실패 → 약정 정지
        await supabase
          .from('payments')
          .update({ pay_status: 'failed', retry_count: newRetryCount })
          .eq('id', payment.id);

        await supabase
          .from('promises')
          .update({ status: 'suspended' })
          .eq('id', promise.id);

        await createPledgeSuspendedNotification(
          orgId,
          promise.id,
          promise.member_id,
          payment.amount,
        );
        suspended++;
      } else {
        const nextRetryAt = new Date(
          Date.now() + RETRY_INTERVALS_MS[newRetryCount],
        ).toISOString();

        await supabase
          .from('payments')
          .update({
            retry_count: newRetryCount,
            next_retry_at: nextRetryAt,
          })
          .eq('id', payment.id);

        await createBillingFailedNotification(
          orgId,
          payment.id,
          promise.member_id,
          payment.amount,
          result.failureMessage,
        );
      }
    }
  }

  return { retried, suspended };
}
