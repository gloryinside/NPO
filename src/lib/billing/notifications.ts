import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { sendEmail } from '@/lib/email/send-email';
import { notifyBillingFailed as notifyDonorBillingFailed } from '@/lib/notifications/send';

async function lookupMember(memberId: string) {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from('members')
    .select('name, phone')
    .eq('id', memberId)
    .maybeSingle();
  return { name: data?.name ?? '알 수 없음', phone: data?.phone ?? '' };
}

async function lookupOrg(orgId: string) {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from('orgs')
    .select('name, contact_email')
    .eq('id', orgId)
    .maybeSingle();
  return {
    orgName: data?.name ?? '',
    contactEmail: data?.contact_email ?? '',
  };
}

export async function createBillingFailedNotification(
  orgId: string,
  paymentId: string,
  memberId: string,
  amount: number,
  failureMessage: string,
) {
  const [{ name, phone: memberPhone }, { orgName, contactEmail }] = await Promise.all([
    lookupMember(memberId),
    lookupOrg(orgId),
  ]);

  const supabase = createSupabaseAdminClient();
  const title = `자동결제 실패: ${name}님 ${amount.toLocaleString()}원`;

  // 표의 칸은 kind/title/body/link — 예전엔 없는 칸(type·meta)에 넣어 알림이 조용히 저장되지 않았다
  const { error: notifyErr } = await supabase.from('admin_notifications').insert({
    org_id: orgId,
    kind: 'billing_failed',
    title,
    body: failureMessage,
    read: false,
    link: `/admin/members/${memberId}`,
  });
  if (notifyErr) console.error('[billing/notifications] billing_failed:', notifyErr.message, { paymentId });

  if (contactEmail) {
    await sendEmail({
      to: contactEmail,
      subject: `[${orgName}] 자동결제 실패 알림`,
      html: `<p>${title}</p><p>사유: ${failureMessage}</p><p>결제 ID: ${paymentId}</p>`,
    });
  }

  // 후원자에게 알림톡 (fire-and-forget)
  void notifyDonorBillingFailed({
    orgId,
    phone: memberPhone ?? null,
    name,
    amount,
    reason: failureMessage,
    orgName: orgName ?? '후원',
  });
}

export async function createPledgeSuspendedNotification(
  orgId: string,
  promiseId: string,
  memberId: string,
  amount: number,
) {
  const [{ name }, { orgName, contactEmail }] = await Promise.all([
    lookupMember(memberId),
    lookupOrg(orgId),
  ]);

  const supabase = createSupabaseAdminClient();
  const title = `약정 정지: ${name}님 ${amount.toLocaleString()}원 정기후원`;

  const { error: notifyErr } = await supabase.from('admin_notifications').insert({
    org_id: orgId,
    kind: 'pledge_suspended',
    title,
    body: `3회 결제 실패로 약정이 정지되었습니다.`,
    read: false,
    link: `/admin/members/${memberId}`,
  });
  if (notifyErr) console.error('[billing/notifications] pledge_suspended:', notifyErr.message, { promiseId });

  if (contactEmail) {
    await sendEmail({
      to: contactEmail,
      subject: `[${orgName}] 정기후원 약정 정지 알림`,
      html: `<p>${title}</p><p>3회 연속 결제 실패로 인해 약정이 자동 정지되었습니다.</p><p>약정 ID: ${promiseId}</p>`,
    });
  }
}
