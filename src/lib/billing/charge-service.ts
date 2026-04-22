import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { getOrgTossKeys } from '@/lib/toss/keys';
import { chargeBillingKey } from './toss-billing';
import { createBillingFailedNotification } from './notifications';
import { notifyCmsChargeSuccess } from './notify-success';

export async function processMonthlyCharges(orgId: string): Promise<{ charged: number; failed: number }> {
  const keys = await getOrgTossKeys(orgId);
  if (!keys.tossSecretKey) {
    console.error(`[charge] org ${orgId}: tossSecretKey 없음`);
    return { charged: 0, failed: 0 };
  }

  const supabase = createSupabaseAdminClient();
  const today = new Date().toISOString().slice(0, 10);

  const { data: payments, error } = await supabase
    .from('payments')
    .select(
      '*, promises!inner(toss_billing_key, customer_key, amount, pay_method, member_id)',
    )
    .eq('org_id', orgId)
    .eq('pay_status', 'pending')
    .lte('pay_date', today)
    .is('toss_payment_key', null);

  if (error) {
    console.error(`[charge] org ${orgId}: 조회 실패`, error.message);
    return { charged: 0, failed: 0 };
  }
  if (!payments?.length) return { charged: 0, failed: 0 };

  let charged = 0;
  let failed = 0;

  for (const payment of payments) {
    const promise = payment.promises as {
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
        orderName: '정기후원',
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

      // 후원자 감사 알림 (fire-and-forget)
      void notifyCmsChargeSuccess({
        orgId,
        paymentId: payment.id,
        memberId: promise.member_id,
        amount: payment.amount,
        paymentCode: payment.payment_code ?? payment.code ?? payment.id,
        approvedAt,
      });

      charged++;
    } else {
      await supabase
        .from('payments')
        .update({
          pay_status: 'failed',
          retry_count: 0,
          next_retry_at: new Date(
            Date.now() + 1 * 86400000,
          ).toISOString(),
        })
        .eq('id', payment.id);

      await createBillingFailedNotification(
        orgId,
        payment.id,
        promise.member_id,
        payment.amount,
        result.failureMessage,
      );
      failed++;
    }
  }

  return { charged, failed };
}
