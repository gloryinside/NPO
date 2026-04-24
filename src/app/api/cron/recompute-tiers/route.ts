import { runCron } from "@/lib/cron/runner";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { recomputeOrgTiers } from "@/lib/members/tier";

/**
 * 매주 일요일 02:00 UTC — 모든 org의 회원 tier 재계산.
 */
export async function GET(req: Request) {
  return runCron(req, "cron:recompute-tiers", async () => {
    const supabase = createSupabaseAdminClient();
    const { data: orgs } = await supabase.from("orgs").select("id");
    let totalUpdated = 0;
    let totalSkipped = 0;
    for (const o of (orgs ?? []) as Array<{ id: string }>) {
      const r = await recomputeOrgTiers(supabase, o.id);
      totalUpdated += r.updated;
      totalSkipped += r.skipped;
    }
    return { updated: totalUpdated, skipped: totalSkipped };
  });
}
