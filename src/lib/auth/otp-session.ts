import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';

const COOKIE_NAME = 'donor-otp-session';
const MAX_AGE = 86400;

export type OtpPayload = {
  memberId: string;
  orgId: string;
  phone: string;
};

function getSecret() {
  const secret = process.env.OTP_JWT_SECRET;
  if (!secret) throw new Error('OTP_JWT_SECRET 환경변수 미설정');
  return new TextEncoder().encode(secret);
}

export async function signOtpToken(payload: OtpPayload): Promise<string> {
  return new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime(`${MAX_AGE}s`)
    .setIssuedAt()
    .sign(getSecret());
}

export async function verifyOtpToken(token: string): Promise<OtpPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return payload as unknown as OtpPayload;
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
    maxAge: MAX_AGE,
    path: '/',
  };
}
