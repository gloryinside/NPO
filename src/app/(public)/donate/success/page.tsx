import { redirect } from 'next/navigation';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { getDonorSession } from '@/lib/auth';
import { confirmDonation } from '@/lib/donations/confirm';
import { Step3 } from '@/app/donate/wizard/steps/Step3';
import type { WizardState } from '@/app/donate/wizard/WizardClient';
import StepProgressBar from '@/components/public/donation/StepProgressBar';

type SP = Promise<{ paymentKey?: string; orderId?: string; amount?: string }>;

export default async function DonateSuccessPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const paymentKey = sp.paymentKey;
  const orderId = sp.orderId;
  const amount = sp.amount ? Number(sp.amount) : NaN;

  if (!paymentKey || !orderId || !Number.isFinite(amount) || amount <= 0) {
    const qs = new URLSearchParams();
    if (orderId) qs.set('orderId', orderId);
    qs.set('message', '결제 파라미터가 올바르지 않습니다.');
    redirect(`/donate/fail?${qs.toString()}`);
  }

  // confirmDonation은 멱등 — 같은 URL 새로고침해도 재승인 호출 없이 기존 결과 반환
  let confirmed;
  try {
    confirmed = await confirmDonation({ paymentKey, orderId, amount });
  } catch (err) {
    const msg = err instanceof Error ? err.message : '결제 승인 실패';
    const qs = new URLSearchParams({ orderId, message: msg });
    redirect(`/donate/fail?${qs.toString()}`);
  }

  const supabase = createSupabaseAdminClient();

  // Step3가 필요한 데이터 재구성 — campaign slug, member email, donation type, pay_method
  const [paymentRes, campaignRes, memberRes] = await Promise.all([
    supabase
      .from('payments')
      .select('pay_method, receipt_opt_in, promise_id, campaign_id, member_id')
      .eq('id', confirmed.id)
      .maybeSingle(),
    confirmed.campaign_id
      ? supabase
          .from('campaigns')
          .select('slug, title, form_settings')
          .eq('id', confirmed.campaign_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    confirmed.member_id
      ? supabase
          .from('members')
          .select('name, email')
          .eq('id', confirmed.member_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const payment = paymentRes.data as {
    pay_method: string | null;
    receipt_opt_in: boolean | null;
    promise_id: string | null;
  } | null;

  const campaign = campaignRes.data as {
    slug: string;
    title: string;
    form_settings: { completeRedirectUrl?: string | null } | null;
  } | null;

  const member = memberRes.data as { name: string; email: string | null } | null;

  // 정기/일시 판별 — promise_id가 있으면 regular
  const donationType: 'regular' | 'onetime' = payment?.promise_id ? 'regular' : 'onetime';

  const state: WizardState = {
    type: donationType,
    amount: Number(confirmed.amount),
    donorInfo: member ? { name: member.name, email: member.email ?? '' } : undefined,
    paymentMethod: payment?.pay_method ?? undefined,
    receiptOptIn: payment?.receipt_opt_in ?? false,
    paymentCode: confirmed.payment_code,
    idempotencyKey: orderId,
  };

  const session = await getDonorSession();
  const campaignSlug = campaign?.slug ?? confirmed.campaign_slug ?? '';
  const settings = { completeRedirectUrl: campaign?.form_settings?.completeRedirectUrl ?? null };

  return (
    <main className="mx-auto max-w-xl px-4 py-8">
      <h1 className="mb-6 text-xl font-bold text-[var(--text)]">{campaign?.title ?? '후원 완료'}</h1>
      <StepProgressBar steps={['후원 선택', '정보 입력', '결제 완료']} currentStep={2} />
      <Step3
        campaign={{ slug: campaignSlug }}
        settings={settings}
        state={state}
        isLoggedIn={!!session}
      />
    </main>
  );
}
