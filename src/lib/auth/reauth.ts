import { createHmac, timingSafeEqual } from "crypto";

/**
 * SP-5: 민감 작업 전 재인증 토큰.
 *
 * 약정 해지 · 금액 변경 · 계정 삭제 등 "의도 확인"이 필요한 작업에서
 * 사용자가 비밀번호를 다시 입력했음을 서버가 30분간 기억하기 위한
 * 짧은 HMAC 기반 토큰.
 *
 * 토큰 형식: base64url(memberId:timestamp:hmac)
 * 검증: 타이밍 안전 비교 + 만료 확인 + memberId 일치.
 */

const SECRET_RAW =
  process.env.REAUTH_SECRET ?? "dev-reauth-secret-change-in-prod";
const TTL_MS = 30 * 60 * 1000; // 30분

function sign(payload: string): string {
  return createHmac("sha256", SECRET_RAW).update(payload).digest("hex");
}

export function issueReauthToken(memberId: string): string {
  const ts = Date.now();
  const payload = `${memberId}:${ts}`;
  const sig = sign(payload);
  return Buffer.from(`${payload}:${sig}`).toString("base64url");
}

export function verifyReauthToken(
  token: string,
  memberId: string,
): boolean {
  let decoded: string;
  try {
    decoded = Buffer.from(token, "base64url").toString("utf8");
  } catch {
    return false;
  }

  const parts = decoded.split(":");
  if (parts.length !== 3) return false;
  const [id, tsStr, sig] = parts;
  if (id !== memberId) return false;

  const ts = parseInt(tsStr, 10);
  if (!Number.isFinite(ts)) return false;
  if (Date.now() - ts > TTL_MS) return false;

  const expected = sign(`${id}:${tsStr}`);
  const a = Buffer.from(sig, "hex");
  const b = Buffer.from(expected, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
