import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { reportError, reportEvent } from "@/lib/observability/report";

/**
 * G-D69: Cron job 공용 러너.
 *
 * - CRON_SECRET 인증 (Authorization: Bearer 또는 x-cron-secret 헤더)
 * - 시작/종료 이벤트 reportEvent
 * - 예외 시 reportError + 5xx 반환
 *
 * 사용:
 *   export async function GET(req: Request) {
 *     return runCron(req, 'cron:process-payments', async () => {
 *       // 실제 작업
 *       return { processed: 10, failed: 0 }
 *     })
 *   }
 */
/**
 * 크론 요청 인증 — Vercel Cron은 CRON_SECRET이 설정되면 `Authorization: Bearer <secret>`을 보낸다.
 * 수동 실행 호환으로 `x-cron-secret` 헤더도 받는다. 길이 차이·타이밍 누출 없는 비교.
 * URL 쿼리(?token=)는 받지 않는다 — 접근 로그·브라우저 기록·프록시에 비밀이 남는다.
 */
export function cronSecretMatches(req: Request, secret: string): boolean {
  const auth = req.headers.get("authorization") ?? "";
  const candidates = [
    auth.startsWith("Bearer ") ? auth.slice(7) : "",
    req.headers.get("x-cron-secret") ?? "",
  ];
  const expected = Buffer.from(secret);
  return candidates.some((c) => {
    const got = Buffer.from(c);
    return got.length === expected.length && timingSafeEqual(got, expected);
  });
}

/**
 * 직접 인증하는 크론 라우트용 — 문제가 있으면 응답, 통과면 null.
 * CRON_SECRET이 없으면 환경과 무관하게 거부한다(예전: 개발 환경에선 인증 없이 실행돼
 * 로컬에서 실제 DB에 결제 행이 만들어졌다). 로컬 실행은 .env.local에 CRON_SECRET을 두고 헤더로 보낸다.
 */
export function cronAuthError(req: Request): NextResponse | null {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ ok: false, error: "CRON_SECRET not configured" }, { status: 500 });
  }
  if (!cronSecretMatches(req, secret)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  return null;
}

export type CronResult = Record<string, number | string | boolean>;

export async function runCron(
  req: Request,
  name: string,
  handler: () => Promise<CronResult | void>
): Promise<Response> {
  // Vercel Cron 은 `Authorization: Bearer $CRON_SECRET` 을 자동 설정
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { ok: false, error: "CRON_SECRET not configured" },
      { status: 500 }
    );
  }

  if (!cronSecretMatches(req, secret)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const started = Date.now();
  await reportEvent(`${name}.start`, { domain: "cron" });

  try {
    const result = (await handler()) ?? {};
    const durationMs = Date.now() - started;
    await reportEvent(`${name}.complete`, {
      domain: "cron",
      extra: { ...result, durationMs },
    });
    return NextResponse.json({ ok: true, durationMs, ...result });
  } catch (err) {
    const durationMs = Date.now() - started;
    await reportError(err, {
      domain: "cron",
      tags: { cron: name, durationMs },
    });
    return NextResponse.json(
      { ok: false, error: String(err), durationMs },
      { status: 500 }
    );
  }
}
