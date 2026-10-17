import { kstToday } from "@/lib/billing/kst";
import { runCron } from "@/lib/cron/runner";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  renderPromiseStatusChangeEmail,
} from "@/lib/promises/status-change-email";
import { sendEmail } from "@/lib/email/send-email";
import { logNotification } from "@/lib/email/notification-log";

/**
 * 매일 새벽 실행 — suspended_until 이 오늘 이전인 약정을 active 로 자동 전환.
 *
 * 어드민이 "X월 Y일까지 일시정지"로 설정한 약정이 그 날짜 후에도 영원히
 * suspended 로 남는 갭을 막는다. 후원자에게는 재개 알림 이메일을 발송한다.
 */
export async function GET(req: Request) {
  return runCron(req, "cron:auto-resume-promises", async () => {
    const supabase = createSupabaseAdminClient();
    const today = kstToday(); // 23:00 UTC 실행 = 다음 날 08:00 KST — UTC 날짜를 쓰면 하루 늦게 재개됐다

    const { data: rows, error } = await supabase
      .from("promises")
      .select(
        "id, org_id, amount, members(name, email, email_disabled), campaigns(title), orgs(name)",
      )
      .eq("status", "suspended")
      .not("suspended_until", "is", null)
      .lte("suspended_until", today);

    if (error) {
      console.error("[cron:auto-resume-promises] fetch failed:", error.message);
      return { resumed: 0, errors: 1 };
    }

    const list = (rows ?? []) as Array<{
      id: string;
      org_id: string;
      amount: number | null;
      members: unknown;
      campaigns: unknown;
      orgs: unknown;
    }>;

    let resumed = 0;
    let errors = 0;

    for (const p of list) {
      const { error: upErr } = await supabase
        .from("promises")
        .update({
          status: "active",
          suspended_until: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", p.id)
        .eq("status", "suspended"); // 경합 가드

      if (upErr) {
        console.error(`[cron:auto-resume-promises] update ${p.id} failed:`, upErr.message);
        errors++;
        continue;
      }
      resumed++;

      // 후원자 알림 (fire-and-forget)
      try {
        const member = (Array.isArray(p.members) ? p.members[0] : p.members) as
          | { name: string | null; email: string | null; email_disabled: boolean | null }
          | null;
        if (!member?.email || member.email_disabled) continue;

        const org = (Array.isArray(p.orgs) ? p.orgs[0] : p.orgs) as
          | { name: string | null }
          | null;
        const campaign = (Array.isArray(p.campaigns) ? p.campaigns[0] : p.campaigns) as
          | { title: string | null }
          | null;

        const { subject, html } = renderPromiseStatusChangeEmail("resumed", {
          toEmail: member.email,
          memberName: member.name ?? "후원자",
          orgName: org?.name ?? "기관",
          campaignTitle: campaign?.title ?? null,
          amount: Number(p.amount ?? 0),
        });
        const sendResult = await sendEmail({ to: member.email, subject, html });
        await logNotification(supabase, {
          orgId: p.org_id,
          kind: "promise_resumed",
          recipientEmail: member.email,
          refId: p.id,
          status: sendResult.success ? "sent" : "failed",
          error: sendResult.error ?? null,
        });
      } catch (err) {
        console.error(`[cron:auto-resume-promises] notify ${p.id} failed:`, err);
      }
    }

    return { resumed, errors };
  });
}
