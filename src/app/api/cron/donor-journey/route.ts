import { runCron } from "@/lib/cron/runner";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { runJourneys } from "@/lib/journey/runner";

/**
 * 후원자 여정 메시지 — 매일 11:00(KST). lib/journey/runner 참고.
 * 예전 감사 편지 작업(thank-you-letter)을 대신한다: 그 내용은 '첫 후원 한 달 감사' 단계(기본 켜짐)가 됐다.
 */
export async function GET(req: Request) {
  return runCron(req, "cron:donor-journey", async () => {
    const results = await runJourneys(createSupabaseAdminClient());
    const total = { sent: 0, failed: 0, skipped: 0 };
    for (const r of results) for (const s of r.steps) {
      total.sent += s.sent;
      total.failed += s.failed;
      total.skipped += s.skipped;
    }
    const failedOrgs = results.filter((r) => r.error);
    for (const r of failedOrgs) console.error(`[donor-journey] org=${r.orgId}: ${r.error}`);
    return { orgs: results.length, ...total, orgErrors: failedOrgs.length };
  });
}
