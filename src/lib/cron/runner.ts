import { NextResponse } from "next/server";
import { reportError, reportEvent } from "@/lib/observability/report";

/**
 * G-D69: Cron job 공용 러너.
 *
 * - CRON_SECRET 인증 (Bearer 또는 ?token=)
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

  const auth = req.headers.get("authorization") ?? "";
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  const provided = auth.startsWith("Bearer ") ? auth.slice(7) : token ?? "";
  if (provided !== secret) {
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
