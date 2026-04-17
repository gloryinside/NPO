import { NextRequest, NextResponse } from 'next/server';
import { getDonorSession } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getDonorSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const supabase = createSupabaseAdminClient();

  const { data: payment } = await supabase
    .from('payments')
    .select('id, pay_status, pay_date, amount, toss_payment_key, org_id, member_id')
    .eq('id', id)
    .eq('member_id', session.member.id)
    .eq('org_id', session.member.org_id)
    .maybeSingle();

  if (!payment) return NextResponse.json({ error: '결제 정보를 찾을 수 없습니다.' }, { status: 404 });
  if (payment.pay_status !== 'paid') return NextResponse.json({ error: '취소 가능한 상태가 아닙니다.' }, { status: 400 });

  const payDate = new Date(payment.pay_date);
  const daysSince = (Date.now() - payDate.getTime()) / 86400000;
  if (daysSince > 7) {
    return NextResponse.json({ error: '취소 가능 기간(7일)이 지났습니다. 관리자에게 문의해 주세요.' }, { status: 400 });
  }

  if (payment.toss_payment_key) {
    const { data: secrets } = await supabase
      .from('org_secrets')
      .select('toss_secret_key_enc')
      .eq('org_id', payment.org_id)
      .maybeSingle();

    if (secrets?.toss_secret_key_enc) {
      const { decryptSecret } = await import('@/lib/secrets/crypto');
      const secretKey = await decryptSecret(secrets.toss_secret_key_enc);
      if (secretKey) {
        const tossRes = await fetch(`https://api.tosspayments.com/v1/payments/${payment.toss_payment_key}/cancel`, {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${Buffer.from(secretKey + ':').toString('base64')}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ cancelReason: '후원자 요청 취소' }),
        });
        if (!tossRes.ok) {
          const err = await tossRes.json().catch(() => ({}));
          return NextResponse.json({ error: '결제 취소 실패', details: err }, { status: 500 });
        }
      }
    }
  }

  await supabase
    .from('payments')
    .update({ pay_status: 'cancelled', cancelled_at: new Date().toISOString() })
    .eq('id', id);

  return NextResponse.json({ ok: true });
}
