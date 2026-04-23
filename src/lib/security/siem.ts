import { reportEvent } from "@/lib/observability/report";

/**
 * G-D167: 보안 이벤트 전용 리포팅.
 *
 * observability.reportEvent 위에 얇은 래퍼 — 보안 이벤트 유형을 고정해 대시보드에서
 * 필터하기 쉽게 한다. 별도의 SIEM(SigNoz/Elastic/Splunk) 연동 시 이 함수만 교체.
 */
export type SecurityEvent =
  | "auth.admin_login_failed"
  | "auth.admin_login_success"
  | "auth.otp_lockout"
  | "auth.password_reset_requested"
  | "auth.session_expired"
  | "security.csrf_forbidden"
  | "security.rate_limited"
  | "webhook.toss.ip_rejected"
  | "webhook.toss.signature_invalid"
  | "webhook.resend.signature_invalid"
  | "admin.privilege_escalation_attempt";

export async function reportSecurityEvent(
  event: SecurityEvent,
  ctx: {
    ip?: string | null;
    userId?: string | null;
    email?: string | null;
    memo?: string;
    extra?: Record<string, unknown>;
  } = {}
): Promise<void> {
  await reportEvent(event, {
    domain: "security",
    tags: {
      ip: ctx.ip ?? null,
      userId: ctx.userId ?? null,
      email: ctx.email ? maskEmail(ctx.email) : null,
    },
    extra: {
      memo: ctx.memo,
      ...ctx.extra,
    },
  });
}

function maskEmail(email: string): string {
  const at = email.indexOf("@");
  if (at < 2) return "***";
  return `${email.slice(0, 2)}***${email.slice(at)}`;
}
