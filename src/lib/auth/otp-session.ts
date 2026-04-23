import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';

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

export async function verifyOtpToken(token: string): Promise<OtpPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    const p = payload as unknown as OtpPayload;
    // 비활성 타임아웃 검증 (G-D30)
    if (typeof p.lastSeen === 'number') {
      const idle = Date.now() - p.lastSeen;
      if (idle > INACTIVITY_MS) return null;
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
