import { runCron } from "@/lib/cron/runner";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { buildGiftQueue } from "@/lib/gifts/queue-builder";

/**
 * 매일 새벽 — 모든 org에 대해 기념품 발송 트리거 점검 + 큐 채우기.
 */
export async function GET(req: Request) {
  return runCron(req, "cron:build-gift-queue", async () => {
    const supabase = createSupabaseAdminClient();
    const { data: orgs } = await supabase.from("orgs").select("id");
    let total = 0;
    for (const o of (orgs ?? []) as Array<{ id: string }>) {
      const r = await buildGiftQueue(supabase, o.id);
      total += r.queued;
    }
    return { queued: total };
  });
}
