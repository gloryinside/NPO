import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export async function POST(req: NextRequest) {
  const secretKey = process.env.TOSS_IDENTITY_SECRET_KEY;
  if (!secretKey) {
    return NextResponse.json({ error: '본인인증 설정이 누락되었습니다.' }, { status: 500 });
  }

  const { txId, memberId } = await req.json();
  if (!txId) {
    return NextResponse.json({ error: 'txId가 필요합니다.' }, { status: 400 });
  }

  const res = await fetch(`https://api.tosspayments.com/v1/identity-verification/requests/${txId}`, {
    headers: {
      'Authorization': `Basic ${Buffer.from(secretKey + ':').toString('base64')}`,
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    return NextResponse.json({ error: '본인인증 확인 실패', details: err }, { status: res.status });
  }

  const data = await res.json();
  const { name, birthday, ci } = data.personalInfo ?? {};

  if (!ci) {
    return NextResponse.json({ error: '본인인증 정보를 가져올 수 없습니다.' }, { status: 400 });
  }

  if (memberId) {
    const supabase = createSupabaseAdminClient();
    await supabase
      .from('members')
      .update({
        ci_hash: ci,
        identity_verified_at: new Date().toISOString(),
        name: name ?? undefined,
        birth_date: birthday ?? undefined,
      })
      .eq('id', memberId);
  }

  return NextResponse.json({ ok: true, name, birthday });
}
