import { runCron } from "@/lib/cron/runner";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * G-D138: scheduled_publish_at 이 도래한 draft 캠페인을 active 로 전환.
 * 매일 06:00 KST (= 21:00 UTC) 권장 — classify-lifecycle 과 같은 cadence.
 * 중복 실행돼도 안전 (이미 active 인 행은 제외).
 */
export async function GET(req: Request) {
  return runCron(req, "cron:auto-publish-campaigns", async () => {
    const supabase = createSupabaseAdminClient();
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("campaigns")
      .update({ status: "active" })
      .eq("status", "draft")
      .lte("scheduled_publish_at", now)
      .select("id");
    if (error) throw new Error(error.message);
    return { published: (data ?? []).length };
  });
}
