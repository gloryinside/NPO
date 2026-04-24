import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { createHash } from 'crypto';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

const COOKIE_NAME = 'donor-otp-session';

// 절대 만료(하드 리밋) — 토큰 발급 후 24시간
const MAX_AGE_SECONDS = 86400;
// 비활성 타임아웃 (G-D30) — 마지막 활동 후 30분 경과 시 로그아웃
const INACTIVITY_MS = 30 * 60 * 1000;

export type OtpPayload = {
  memberId: string;
  orgId: string;
  phone: string;
  lastSeen?: number; // ms timestamp — 비활성 타임아웃용
};

function getSecret() {
  const secret = process.env.OTP_JWT_SECRET;
  if (!secret) throw new Error('OTP_JWT_SECRET 환경변수 미설정');
  return new TextEncoder().encode(secret);
}

export async function signOtpToken(payload: OtpPayload): Promise<string> {
  const withTimestamp: OtpPayload = {
    ...payload,
    lastSeen: payload.lastSeen ?? Date.now(),
  };
  return new SignJWT(withTimestamp as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .setIssuedAt()
    .sign(getSecret());
}

/**
 * SP-5: OTP JWT의 jti (= SHA256(iat || memberId)의 앞 16자리).
 * blocklist 조회/삽입 모두 이 함수 결과와 일치해야 한다.
 */
export function makeOtpJti(iat: number, memberId: string): string {
  return createHash('sha256')
    .update(`${iat}:${memberId}`)
    .digest('hex')
    .slice(0, 16);
}

/**
 * SP-5: OTP 세션을 서버 측에서 무효화. 로그아웃 시 호출.
 * 저장된 jti는 getDonorSession(verifyOtpToken) 경로에서 차단된다.
 */
export async function revokeOtpSession(
  iat: number,
  memberId: string,
  reason: string = 'logout',
): Promise<void> {
  const jti = makeOtpJti(iat, memberId);
  const supabase = createSupabaseAdminClient();
  await supabase
    .from('otp_session_blocklist')
    .upsert({ jti, reason }, { onConflict: 'jti' });
}

async function isOtpJtiRevoked(jti: string): Promise<boolean> {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from('otp_session_blocklist')
    .select('jti')
    .eq('jti', jti)
    .maybeSingle();
  return data !== null;
}

export async function verifyOtpToken(token: string): Promise<OtpPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    const p = payload as unknown as OtpPayload;
    // 비활성 타임아웃 검증 (G-D30)
    if (typeof p.lastSeen === 'number') {
      const idle = Date.now() - p.lastSeen;
      if (idle > INACTIVITY_MS) return null;
    }
    // SP-5: blocklist 조회 — revoked 세션은 차단
    const iat = payload.iat as number | undefined;
    if (typeof iat === 'number' && p.memberId) {
      const jti = makeOtpJti(iat, p.memberId);
      if (await isOtpJtiRevoked(jti)) return null;
    }
    return p;
  } catch {
    return null;
  }
}

export async function getOtpSessionFromCookies(): Promise<OtpPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyOtpToken(token);
}

export function otpSessionCookieConfig(token: string) {
  return {
    name: COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: MAX_AGE_SECONDS,
    path: '/',
  };
}

export const OTP_SESSION_COOKIE_NAME = COOKIE_NAME;
export const OTP_INACTIVITY_MS = INACTIVITY_MS;
