/**
 * G-D166: 공용 Security header 세트.
 * Next.js config 또는 middleware 에서 응답에 부착.
 *
 * 현재 단계:
 *   - CSP: strict 설정을 단계적으로 전환 예정. 일단 report-only 기본값 제공
 *   - HSTS, X-Content-Type-Options, Referrer-Policy, Permissions-Policy
 *
 * CSP nonce 주입은 middleware + next.config 에서 추가 작업 필요 (후속).
 */
export function defaultSecurityHeaders(): Record<string, string> {
  return {
    "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy":
      "geolocation=(), camera=(), microphone=(), payment=(self)",
    "X-Frame-Options": "SAMEORIGIN",
  };
}

/**
 * CSP 정책 (report-only 초기 단계).
 * Toss Widget / Supabase / Resend / sendBeacon 허용이 필요.
 * nonce 전환 후 'unsafe-inline' 제거.
 */
export function defaultCsp(): string {
  return [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://js.tosspayments.com https://payments.toss.im",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    "img-src 'self' data: blob: https:",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.tosspayments.com",
    "frame-src 'self' https://js.tosspayments.com https://payments.toss.im",
    "frame-ancestors 'self'",
    "base-uri 'self'",
    "form-action 'self' https://*.tosspayments.com",
  ].join("; ");
}
