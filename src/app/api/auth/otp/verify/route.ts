import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { getTenant } from '@/lib/tenant/context';
import { signOtpToken, otpSessionCookieConfig } from '@/lib/auth/otp-session';
import { rateLimit } from '@/lib/rate-limit';

const BodySchema = z.object({
  phone: z.string().min(1),
  code: z.string().length(6),
});

export async function POST(req: NextRequest) {
  const tenant = await getTenant();
  if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 400 });

  const body = await req.json();
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: '잘못된 요청' }, { status: 400 });
  }

  const { phone, code } = parsed.data;

  // G-D54: IP 기반 + phone 기반 이중 rate limit
  //   - IP: 10분에 20회 (같은 IP에서 여러 계정 대입 방지)
  //   - phone: 30분 누적 5회 실패 (기존 로직, DB attempts 합산)
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown';
  const ipRl = rateLimit(`otp:verify:ip:${ip}`, 20, 10 * 60_000);
  if (!ipRl.allowed) {
    return NextResponse.json(
      { error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' },
      { status: 429 }
    );
  }

  const supabase = createSupabaseAdminClient();

  // 30분 잠금 확인
  const thirtyMinAgo = new Date(Date.now() - 30 * 60_000).toISOString();
  const { data: recentAttempts } = await supabase
    .from('otp_codes')
    .select('attempts')
    .eq('phone', phone)
    .eq('org_id', tenant.id)
    .gte('created_at', thirtyMinAgo)
    .order('created_at', { ascending: false })
    .limit(5);

  const totalAttempts = (recentAttempts ?? []).reduce(
    (sum: number, r: { attempts: number }) => sum + r.attempts, 0
  );
  if (totalAttempts >= 5) {
    return NextResponse.json(
      {
        error:
          '인증 시도 횟수를 초과했습니다 (30분 5회). 시간을 두고 다시 시도하거나 고객센터로 문의해주세요.',
        code: 'OTP_LOCKED',
      },
      { status: 429 }
    );
  }

  // 최신 미인증 코드 조회
  const now = new Date().toISOString();
  const { data: otpRow } = await supabase
    .from('otp_codes')
    .select('*')
    .eq('phone', phone)
    .eq('org_id', tenant.id)
    .eq('verified', false)
    .gte('expires_at', now)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!otpRow) {
    return NextResponse.json({ error: '인증번호가 만료되었습니다. 다시 발송해 주세요.' }, { status: 400 });
  }

  if (otpRow.code !== code) {
    await supabase
      .from('otp_codes')
      .update({ attempts: (otpRow.attempts ?? 0) + 1 })
      .eq('id', otpRow.id);
    return NextResponse.json({ error: '인증번호가 일치하지 않습니다.' }, { status: 400 });
  }

  await supabase.from('otp_codes').update({ verified: true }).eq('id', otpRow.id);

  const { data: member } = await supabase
    .from('members')
    .select('id')
    .eq('phone', phone)
    .eq('org_id', tenant.id)
    .eq('status', 'active')
    .maybeSingle();

  if (!member) {
    return NextResponse.json({ ok: false, reason: 'no_member' });
  }

  const token = await signOtpToken({ memberId: member.id, orgId: tenant.id, phone });
  const cookie = otpSessionCookieConfig(token);

  const res = NextResponse.json({ ok: true });
  res.cookies.set(cookie);
  return res;
}
