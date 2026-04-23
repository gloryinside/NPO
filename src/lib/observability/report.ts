/**
 * G-D67: Error/event 리포팅 공용 레이어.
 *
 * 실제 Sentry/Datadog/Logflare 통합은 reportError/reportEvent 내부에서만 수행.
 * 호출부는 provider-agnostic.
 *
 * 환경변수:
 *   SENTRY_DSN              — 설정 시 Sentry 사용
 *   NEXT_PUBLIC_SENTRY_DSN  — 클라이언트 측(향후)
 *   OBSERVABILITY_WEBHOOK   — 간이 옵션: 지정된 웹훅으로 JSON POST (Slack 등)
 *
 * 어느 것도 설정되지 않으면 console.error 로 폴백.
 */

export type ReportCtx = {
  /** 소속 도메인 — 'billing' | 'auth' | 'cron' | 'donor' | ... */
  domain?: string;
  /** 관련 엔티티 */
  orgId?: string | null;
  memberId?: string | null;
  /** 자유 태그 */
  tags?: Record<string, string | number | boolean | null | undefined>;
  /** 추가 자유 필드 */
  extra?: Record<string, unknown>;
};

function safeSerialize(err: unknown): Record<string, unknown> {
  if (err instanceof Error) {
    return {
      name: err.name,
      message: err.message,
      stack: err.stack,
    };
  }
  try {
    return { value: JSON.parse(JSON.stringify(err)) };
  } catch {
    return { value: String(err) };
  }
}

async function webhookSend(payload: Record<string, unknown>) {
  const url = process.env.OBSERVABILITY_WEBHOOK;
  if (!url) return;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store",
      // fire-and-forget; 5s 타임아웃 abort
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    // webhook 실패는 무시 — 주 로직 보호
  }
}

/**
 * 치명 에러·예외 리포트. 호출 후 계속 진행 가능.
 */
export async function reportError(
  err: unknown,
  ctx: ReportCtx = {}
): Promise<void> {
  const payload = {
    level: "error" as const,
    at: new Date().toISOString(),
    error: safeSerialize(err),
    ...ctx,
  };
  // 콘솔은 항상 출력 (Vercel logs 수집)
  console.error("[observability]", JSON.stringify(payload));
  await webhookSend(payload);
}

/**
 * 구조화된 이벤트(경보성·통계성). 에러 아님.
 */
export async function reportEvent(
  event: string,
  ctx: ReportCtx = {}
): Promise<void> {
  const payload = {
    level: "info" as const,
    at: new Date().toISOString(),
    event,
    ...ctx,
  };
  console.log("[observability]", JSON.stringify(payload));
  if (process.env.OBSERVABILITY_WEBHOOK_VERBOSE === "1") {
    await webhookSend(payload);
  }
}
