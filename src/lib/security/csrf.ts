import type { NextRequest } from "next/server";

/**
 * G-D31: CSRF 방어 — Origin/Referer 헤더 검증
 *
 * 사용 패턴 (mutating endpoint 최상단):
 *   const csrfErr = checkCsrf(req);
 *   if (csrfErr) return csrfErr;
 *
 * 전략: Same-Origin 정책
 *   - Origin 헤더가 있으면 host와 일치해야 함
 *   - Origin 없고 Referer만 있으면 Referer의 host와 일치해야 함
 *   - 둘 다 없으면 차단 (브라우저 양식 submit은 항상 Referer 전송)
 *
 * 예외:
 *   - localhost / 127.0.0.1 개발환경은 관대하게 허용
 *   - 서비스 간 서버 호출(cron, webhook)은 이 헬퍼 대신 별도 서명 검증 사용
 */
export function isCsrfSafe(req: NextRequest | Request): boolean {
  const headers = req.headers;
  const method = req.method?.toUpperCase();
  if (!method || method === "GET" || method === "HEAD" || method === "OPTIONS") {
    return true;
  }

  const host =
    headers.get("x-forwarded-host") ?? headers.get("host") ?? "";
  if (!host) {
    // host 없는 요청은 정상 케이스가 없음
    return false;
  }
  const hostname = host.split(":")[0];

  // 개발환경 완화
  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return true;
  }

  const origin = headers.get("origin");
  if (origin) {
    try {
      const u = new URL(origin);
      return u.hostname === hostname || u.hostname.endsWith(`.${getApexDomain(hostname)}`);
    } catch {
      return false;
    }
  }

  const referer = headers.get("referer");
  if (referer) {
    try {
      const u = new URL(referer);
      return u.hostname === hostname || u.hostname.endsWith(`.${getApexDomain(hostname)}`);
    } catch {
      return false;
    }
  }

  return false;
}

/**
 * "sub.foo.example.com" → "example.com" 같은 apex 도메인 추출.
 * 국가 TLD(.co.kr 등)는 단순 규칙으로 마지막 2~3개 레이블 사용.
 */
function getApexDomain(hostname: string): string {
  const parts = hostname.split(".");
  if (parts.length <= 2) return hostname;
  // .co.kr, .or.kr 등 2차 TLD 보호
  const last = parts[parts.length - 1];
  const prev = parts[parts.length - 2];
  if (
    ["co", "or", "ac", "go", "ne", "re"].includes(prev) &&
    last.length === 2
  ) {
    return parts.slice(-3).join(".");
  }
  return parts.slice(-2).join(".");
}

import { NextResponse } from "next/server";

/**
 * 미통과 시 403 응답 반환, 통과 시 null.
 *   const blocked = checkCsrf(req); if (blocked) return blocked;
 */
export function checkCsrf(req: NextRequest | Request): Response | null {
  if (isCsrfSafe(req)) return null;
  return NextResponse.json({ error: "CSRF_FORBIDDEN" }, { status: 403 });
}
