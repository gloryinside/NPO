import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { notifyDonationThanks } from '@/lib/notifications/send';

/**
 * CMS 정기결제 성공 시 후원자에게 감사 알림을 보낸다.
 * charge-service / retry-service 양쪽에서 재사용.
 *
 * - fire-and-forget: 알림 실패해도 결제 성공 흐름 막지 않음.
 * - 이메일/전화 둘 다 없으면 skip.
 */
export async function notifyCmsChargeSuccess(params: {
  orgId: string;
  paymentId: string;
  memberId: string;
  amount: number;
  paymentCode: string;
  approvedAt: string;
}): Promise<void> {
  const { orgId, memberId, amount, paymentCode, approvedAt } = params;
  const supabase = createSupabaseAdminClient();

  const [memberRes, orgRes] = await Promise.all([
    supabase
      .from('members')
      .select('name, email, phone')
      .eq('org_id', orgId)
      .eq('id', memberId)
      .maybeSingle(),
    supabase.from('orgs').select('name').eq('id', orgId).maybeSingle(),
  ]);

  const phone = memberRes.data?.phone ?? null;
  const email = memberRes.data?.email ?? null;
  if (!phone && !email) return;

  notifyDonationThanks({
    orgId,
    phone,
    email,
    name: memberRes.data?.name ?? '후원자',
    amount,
    type: 'regular',
    orgName: orgRes.data?.name ?? '',
    campaignTitle: null,
    paymentCode,
    approvedAt,
  });
}
