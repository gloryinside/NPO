import { runCron } from "@/lib/cron/runner";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { classifyAllForOrg } from "@/lib/members/lifecycle-stage";

/**
 * G-D127: 전 기관의 회원 lifecycle_stage 재분류.
 * 일 1회 06:00 KST (= 21:00 UTC) 권장 — vercel.json 에서 스케줄.
 */
export async function GET(req: Request) {
  return runCron(req, "cron:classify-lifecycle", async () => {
    const supabase = createSupabaseAdminClient();
    const { data: orgs } = await supabase
      .from("orgs")
      .select("id")
      .eq("status", "active");

    let scanned = 0;
    let updated = 0;
    for (const o of (orgs ?? []) as Array<{ id: string }>) {
      const r = await classifyAllForOrg(supabase, o.id);
      scanned += r.scanned;
      updated += r.updated;
    }
    return { scanned, updated, orgs: (orgs ?? []).length };
  });
}
