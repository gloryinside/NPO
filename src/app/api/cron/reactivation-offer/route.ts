import { runCron } from "@/lib/cron/runner";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/send-email";

/**
 * G-D156: 약정 해지 후 재활성화 권유 cron (일 1회).
 *   대상: promises.status='cancelled' 이고 ended_at 이 오늘로부터 정확히 30/60/90일 전
 *   notification_log 로 중복 방지 (template='reactivation_offer:{days}')
 */
export async function GET(req: Request) {
  return runCron(req, "cron:reactivation-offer", async () => {
    const supabase = createSupabaseAdminClient();
    const targets = [30, 60, 90];
    let sent = 0;
    for (const days of targets) {
      const d = new Date();
      d.setUTCDate(d.getUTCDate() - days);
      const dayStr = d.toISOString().slice(0, 10);

      const { data } = await supabase
        .from("promises")
        .select(
          "id, org_id, member_id, members!inner(name, email, email_disabled)"
        )
        .eq("status", "cancelled")
        .eq("ended_at", dayStr);

      type Row = {
        id: string;
        org_id: string;
        member_id: string;
        members: {
          name: string | null;
          email: string | null;
          email_disabled: boolean | null;
        };
      };
      const rows = (data as unknown as Row[]) ?? [];
      for (const r of rows) {
        const m = r.members;
        if (!m?.email || m.email_disabled) continue;

        const template = `reactivation_offer:${days}`;
        const { data: already } = await supabase
          .from("notification_log")
          .select("id")
          .eq("recipient", m.email)
          .eq("template", template)
          .eq("ref_key", r.member_id)
          .limit(1);
        if ((already ?? []).length > 0) continue;

        const res = await sendEmail({
          to: m.email,
          subject: `${m.name ?? "후원자"}님, 다시 시작해보시겠어요?`,
          html: `
            <div style="font-family:-apple-system,'Noto Sans KR',sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1f2937">
              <h2 style="font-size:20px">💙 다시 함께 하시겠어요?</h2>
              <p>${m.name ?? "후원자"}님, 후원을 중단하신 지 ${days}일이 되었습니다.</p>
              <p>이전 약정 정보를 가볍게 복원할 수 있도록 준비해두었어요.</p>
              <p style="margin-top:24px">
                <a href="/donor" style="background:#7c3aed;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:600">마이페이지로 이동 →</a>
              </p>
            </div>
          `,
        });
        if (res.success) {
          await supabase.from("notification_log").insert({
            org_id: r.org_id,
            recipient: m.email,
            template,
            ref_key: r.member_id,
          });
          sent++;
        }
      }
    }
    return { sent };
  });
}
