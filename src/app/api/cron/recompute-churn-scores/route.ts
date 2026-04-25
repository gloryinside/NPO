import { runCron } from "@/lib/cron/runner";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { recomputeChurnScores } from "@/lib/members/churn-score";

/**
 * 매주 월요일 03:00 UTC — 모든 org의 churn 점수 재계산.
 */
export async function GET(req: Request) {
  return runCron(req, "cron:recompute-churn-scores", async () => {
    const supabase = createSupabaseAdminClient();
    const { data: orgs } = await supabase.from("orgs").select("id");
    let total = 0;
    for (const o of (orgs ?? []) as Array<{ id: string }>) {
      const r = await recomputeChurnScores(supabase, o.id);
      total += r.updated;
    }
    return { updated: total };
  });
}
