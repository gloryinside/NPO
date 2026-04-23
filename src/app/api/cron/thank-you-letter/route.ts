import { runCron } from "@/lib/cron/runner";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/send-email";

/**
 * G-D190: 기부 30일 경과 시 감사 편지 1회 발송.
 *   - 대상: 30일 전 pay_date 에 첫 paid 결제가 있는 후원자
 *   - notification_log template='thank_you_letter_30d' 로 중복 방지
 */
export async function GET(req: Request) {
  return runCron(req, "cron:thank-you-letter", async () => {
    const supabase = createSupabaseAdminClient();
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - 30);
    const dayStr = d.toISOString().slice(0, 10);

    const { data } = await supabase
      .from("payments")
      .select(
        "org_id, member_id, amount, members!inner(name, email, email_disabled)"
      )
      .eq("pay_status", "paid")
      .eq("pay_date", dayStr);

    type Row = {
      org_id: string;
      member_id: string | null;
      amount: number | null;
      members: {
        name: string | null;
        email: string | null;
        email_disabled: boolean | null;
      };
    };
    const rows = (data as unknown as Row[]) ?? [];
    let sent = 0;

    for (const r of rows) {
      if (!r.member_id || !r.members.email || r.members.email_disabled) continue;

      const template = "thank_you_letter_30d";
      const { data: already } = await supabase
        .from("notification_log")
        .select("id")
        .eq("recipient", r.members.email)
        .eq("template", template)
        .eq("ref_key", r.member_id)
        .limit(1);
      if ((already ?? []).length > 0) continue;

      const html = `
        <div style="font-family:-apple-system,'Noto Sans KR',sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1f2937">
          <h2 style="font-size:20px">🙏 ${r.members.name ?? "후원자"}님께 감사드립니다</h2>
          <p>한 달 전 보내주신 <b>${Number(r.amount ?? 0).toLocaleString()}원</b>이 지금도 소중하게 사용되고 있습니다.</p>
          <p>후원자님의 온기가 만든 변화를 임팩트 페이지에서 확인해보세요.</p>
          <p style="margin-top:24px">
            <a href="/donor/impact" style="background:#7c3aed;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:600">나의 임팩트 →</a>
          </p>
          <p style="font-size:13px;color:#6b7280;margin-top:16px">감사합니다.</p>
        </div>
      `;
      const res = await sendEmail({
        to: r.members.email,
        subject: "한 달 전, 보내주신 마음에 감사드립니다",
        html,
      });
      if (res.success) {
        await supabase.from("notification_log").insert({
          org_id: r.org_id,
          recipient: r.members.email,
          template,
          ref_key: r.member_id,
        });
        sent++;
      }
    }

    return { scanned: rows.length, sent };
  });
}
