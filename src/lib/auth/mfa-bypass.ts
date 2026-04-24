import { createHmac, timingSafeEqual } from "crypto";

/**
 * SP-5 후속: MFA 백업 코드로 로그인 시 발급하는 단기 bypass 토큰.
 *
 * Supabase Auth MFA는 백업 코드를 네이티브로 지원하지 않으므로,
 * 우리가 백업 코드를 검증한 뒤 이 쿠키를 발급해 getDonorSession의
 * MFA 가드를 일회 우회시킨다. TTL 15분.
 */

const SECRET_RAW =
  process.env.REAUTH_SECRET ?? "dev-reauth-secret-change-in-prod";
const TTL_MS = 15 * 60 * 1000;

export const MFA_BYPASS_COOKIE = "donor-mfa-bypass";

function sign(payload: string): string {
  return createHmac("sha256", SECRET_RAW).update(payload).digest("hex");
}

export function issueMfaBypassToken(supabaseUid: string): string {
  const ts = Date.now();
  const payload = `${supabaseUid}:${ts}`;
  const sig = sign(payload);
  return Buffer.from(`${payload}:${sig}`).toString("base64url");
}

export function verifyMfaBypassToken(
  token: string,
  supabaseUid: string,
): boolean {
  let decoded: string;
  try {
    decoded = Buffer.from(token, "base64url").toString("utf8");
  } catch {
    return false;
  }

  const parts = decoded.split(":");
  if (parts.length !== 3) return false;
  const [uid, tsStr, sig] = parts;
  if (uid !== supabaseUid) return false;

  const ts = parseInt(tsStr, 10);
  if (!Number.isFinite(ts)) return false;
  if (Date.now() - ts > TTL_MS) return false;

  const expected = sign(`${uid}:${tsStr}`);
  const a = Buffer.from(sig, "hex");
  const b = Buffer.from(expected, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export const MFA_BYPASS_TTL_SECONDS = TTL_MS / 1000;
