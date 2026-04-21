import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { getTenant } from '@/lib/tenant/context';
import { sendSms } from '@/lib/sms/nhn-client';
import { rateLimit, getClientIp } from '@/lib/rate-limit';

const BodySchema = z.object({
  phone: z.string().regex(/^01[016789]\d{7,8}$/, '올바른 휴대폰 번호를 입력하세요.'),
});

export async function POST(req: NextRequest) {
  const ip = getClientIp(req.headers);
  const ipLimit = rateLimit(`otp:send:ip:${ip}`, 10, 60_000);
  if (!ipLimit.allowed) {
    return NextResponse.json(
      { error: '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(ipLimit.retryAfterMs / 1000)) } },
    );
  }

  const tenant = await getTenant();
  if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 400 });

  const body = await req.json();
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? '잘못된 요청' }, { status: 400 });
  }

  const { phone } = parsed.data;
  const supabase = createSupabaseAdminClient();

  // Rate limit: 1분 내 기존 코드 확인
  const oneMinAgo = new Date(Date.now() - 60_000).toISOString();
  const { data: recent } = await supabase
    .from('otp_codes')
    .select('id')
    .eq('phone', phone)
    .eq('org_id', tenant.id)
    .gte('created_at', oneMinAgo)
    .limit(1);

  if (recent && recent.length > 0) {
    return NextResponse.json({ error: '잠시 후 다시 시도해 주세요.' }, { status: 429 });
  }

  const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 900000 + 100000);
  const expiresAt = new Date(Date.now() + 5 * 60_000).toISOString();

  await supabase.from('otp_codes').insert({
    org_id: tenant.id,
    phone,
    code,
    expires_at: expiresAt,
  });

  const orgName = tenant.name ?? '후원';
  const result = await sendSms(phone, `[${orgName}] 인증번호: ${code} (5분 이내 입력)`);

  if (!result.success) {
    return NextResponse.json({ error: 'SMS 발송에 실패했습니다. 잠시 후 다시 시도해 주세요.' }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
