import { runCron } from "@/lib/cron/runner";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { detectDiscrepancies } from "@/lib/payments/discrepancy-detector";

/**
 * 매일 새벽 — 정산 차이 감지 (중복결제/누락/정체불명).
 */
export async function GET(req: Request) {
  return runCron(req, "cron:detect-discrepancies", async () => {
    const supabase = createSupabaseAdminClient();
    const { data: orgs } = await supabase.from("orgs").select("id");
    let totalDup = 0; let totalMiss = 0; let totalOrphan = 0;
    for (const o of (orgs ?? []) as Array<{ id: string }>) {
      const r = await detectDiscrepancies(supabase, o.id);
      totalDup += r.duplicates; totalMiss += r.missing; totalOrphan += r.orphans;
    }
    return { duplicates: totalDup, missing: totalMiss, orphans: totalOrphan };
  });
}
