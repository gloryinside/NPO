import { runCron } from "@/lib/cron/runner";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/send-email";

/**
 * G-D192: 캠페인 목표 달성률 감지 + 마일스톤 알림.
 *
 * 트리거 수준: 50% / 75% / 100%.
 * orgs.contact_email 로 관리자 알림 + admin_notifications insert.
 * 동일 milestone 중복 알림 방지: admin_notifications.kind='campaign_milestone:<pct>:<campaign_id>'.
 */
const MILESTONES = [50, 75, 100] as const;

export async function GET(req: Request) {
  return runCron(req, "cron:campaign-milestones", async () => {
    const supabase = createSupabaseAdminClient();

    const { data: campaigns } = await supabase
      .from("campaigns")
      .select("id, org_id, title, slug, goal_amount, status")
      .in("status", ["active", "published"])
      .not("goal_amount", "is", null);

    type Camp = {
      id: string;
      org_id: string;
      title: string | null;
      slug: string | null;
      goal_amount: number;
    };
    const list = (campaigns ?? []) as unknown as Camp[];

    let triggered = 0;
    for (const c of list) {
      if (!c.goal_amount || c.goal_amount <= 0) continue;
      const { data: sums } = await supabase
        .from("payments")
        .select("amount")
        .eq("campaign_id", c.id)
        .eq("pay_status", "paid");
      const raised = (sums ?? []).reduce(
        (s, r) => s + Number((r as { amount: number | null }).amount ?? 0),
        0
      );
      const pct = Math.floor((raised / c.goal_amount) * 100);

      for (const m of MILESTONES) {
        if (pct < m) continue;
        const kind = `campaign_milestone:${m}:${c.id}`;
        const { count } = await supabase
          .from("admin_notifications")
          .select("id", { count: "exact", head: true })
          .eq("org_id", c.org_id)
          .eq("kind", kind);
        if ((count ?? 0) > 0) continue;

        await supabase.from("admin_notifications").insert({
          org_id: c.org_id,
          kind,
          title: `🎯 ${c.title ?? "캠페인"} — 목표 ${m}% 달성`,
          body: `누적 ${raised.toLocaleString()}원 / 목표 ${c.goal_amount.toLocaleString()}원 (${pct}%)`,
          link: c.slug ? `/campaigns/${c.slug}` : null,
        });

        // 관리자 이메일 (orgs.contact_email)
        const { data: org } = await supabase
          .from("orgs")
          .select("contact_email, name")
          .eq("id", c.org_id)
          .maybeSingle();
        if (org?.contact_email) {
          await sendEmail({
            to: org.contact_email,
            subject: `[${org.name ?? ""}] 캠페인 ${m}% 달성`,
            html: `
              <div style="font-family:-apple-system,'Noto Sans KR',sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1f2937">
                <h2>🎯 ${c.title ?? "캠페인"} — ${m}% 달성</h2>
                <p>누적 <b>${raised.toLocaleString()}원</b> / 목표 ${c.goal_amount.toLocaleString()}원</p>
                <p>공개 페이지: <a href="/campaigns/${c.slug ?? ""}">열기</a></p>
              </div>
            `,
          });
        }
        triggered++;
      }
    }
    return { scanned: list.length, triggered };
  });
}
