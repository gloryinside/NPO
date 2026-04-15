/**
 * Toss Payments 설정 상수 및 헬퍼.
 * 시크릿은 서버에서만 참조한다 (NEXT_PUBLIC_* 만 클라이언트 번들 포함).
 */
export const TOSS_CLIENT_KEY = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY ?? "";
export const TOSS_SECRET_KEY = process.env.TOSS_SECRET_KEY ?? "";
export const TOSS_API_BASE = "https://api.tosspayments.com";
export const TOSS_WEBHOOK_SECRET = process.env.TOSS_WEBHOOK_SECRET ?? "";

/**
 * Toss REST API Basic Auth 헤더 — "base64({secret_key}:)" 포맷.
 * 서버 사이드에서만 호출한다.
 */
export function tossAuthHeader(): string {
  const token = Buffer.from(`${TOSS_SECRET_KEY}:`).toString("base64");
  return `Basic ${token}`;
}
