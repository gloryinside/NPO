import { NextRequest } from "next/server";
import { requireAdminApi } from "@/lib/auth/api-guard";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * G-D200: 관리자용 Server-Sent Events 실시간 audit_logs 피드.
 *   - 10초마다 최근 20건 delta 를 보낸다 (real-time Supabase subscription 대신 poll-push)
 *   - Vercel Functions 의 장기 연결 제약(최대 60s) 고려: 5분 후 종료 + 클라이언트가 재접속
 *
 * 쿼리: ?since=<ISO>  (선택 — 초기 pull 대신)
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_DURATION_MS = 5 * 60_000;
const POLL_MS = 10_000;

export async function GET(req: NextRequest) {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const { tenant } = guard.ctx;

  const sp = req.nextUrl.searchParams;
  let since = sp.get("since") ?? new Date().toISOString();

  const encoder = new TextEncoder();
  const supabase = createSupabaseAdminClient();

  const stream = new ReadableStream({
    async start(controller) {
      const started = Date.now();
      const send = (data: unknown) =>
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
        );

      // 초기 ping
      controller.enqueue(encoder.encode(`: connected\n\n`));

      let timer: ReturnType<typeof setInterval> | null = null;

      async function poll() {
        if (Date.now() - started > MAX_DURATION_MS) {
          controller.enqueue(encoder.encode(`event: close\ndata: timeout\n\n`));
          controller.close();
          if (timer) clearInterval(timer);
          return;
        }
        const { data, error } = await supabase
          .from("audit_logs")
          .select(
            "id, action, actor_email, resource_type, resource_id, summary, created_at"
          )
          .eq("org_id", tenant.id)
          .gt("created_at", since)
          .order("created_at", { ascending: true })
          .limit(50);
        if (error) {
          send({ error: error.message });
          return;
        }
        const rows = data ?? [];
        if (rows.length > 0) {
          for (const r of rows as Array<{ created_at: string }>) {
            send(r);
          }
          since = (rows[rows.length - 1]! as { created_at: string }).created_at;
        }
      }

      await poll();
      timer = setInterval(poll, POLL_MS);

      // 클라이언트 연결 종료 시 정리
      req.signal.addEventListener("abort", () => {
        if (timer) clearInterval(timer);
        try {
          controller.close();
        } catch {
          // no-op
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
