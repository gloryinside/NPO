import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const secretKey = process.env.TOSS_IDENTITY_SECRET_KEY;
  if (!secretKey) {
    return NextResponse.json({ error: '본인인증 설정이 누락되었습니다.' }, { status: 500 });
  }

  const { successUrl, failUrl } = await req.json();

  const res = await fetch('https://api.tosspayments.com/v1/identity-verification/requests', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${Buffer.from(secretKey + ':').toString('base64')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      requestedAt: new Date().toISOString(),
      successUrl,
      failUrl,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    return NextResponse.json({ error: '본인인증 요청 실패', details: err }, { status: res.status });
  }

  const data = await res.json();
  return NextResponse.json({ txId: data.txId });
}
