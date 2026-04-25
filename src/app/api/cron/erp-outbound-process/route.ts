import { runCron } from "@/lib/cron/runner";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { processOutboundQueue } from "@/lib/erp/outbound-queue";

/**
 * 매분 실행 — ERP 아웃바운드 웹훅 큐 처리.
 */
export async function GET(req: Request) {
  return runCron(req, "cron:erp-outbound-process", async () => {
    const supabase = createSupabaseAdminClient();
    return processOutboundQueue(supabase, 50);
  });
}
