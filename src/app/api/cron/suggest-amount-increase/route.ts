import { runCron } from "@/lib/cron/runner";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/send-email";

/**
 * G-D158: 장기 동일 금액 정기후원자에게 인상 제안 (연 1회).
 *   대상: promises.status='active', type='regular', started_at <= 오늘-365일,
 *         그리고 최근 1년간 금액 변경 이력 없음 (promise_amount_changes 미존재)
 *   notification_log template='amount_increase_yearly'
 */
export async function GET(req: Request) {
  return runCron(req, "cron:suggest-amount-increase", async () => {
    const supabase = createSupabaseAdminClient();
    const cutoff = new Date();
    cutoff.setUTCDate(cutoff.getUTCDate() - 365);
    const cutoffStr = cutoff.toISOString().slice(0, 10);

    const { data } = await supabase
      .from("promises")
      .select(
        "id, org_id, member_id, amount, started_at, members!inner(name, email, email_disabled)"
      )
      .eq("status", "active")
      .eq("type", "regular")
      .lte("started_at", cutoffStr);

    type Row = {
      id: string;
      org_id: string;
      member_id: string;
      amount: number;
      started_at: string;
      members: {
        name: string | null;
        email: string | null;
        email_disabled: boolean | null;
      };
    };
    const rows = (data as unknown as Row[]) ?? [];
    let sent = 0;
    let skipped = 0;

    for (const r of rows) {
      const m = r.members;
      if (!m?.email || m.email_disabled) {
        skipped++;
        continue;
      }

      // 최근 1년 내 금액 변경 있는지 — 있으면 스킵
      const { count } = await supabase
        .from("promise_amount_changes")
        .select("id", { count: "exact", head: true })
        .eq("promise_id", r.id)
        .gte("created_at", cutoff.toISOString());
      if ((count ?? 0) > 0) {
        skipped++;
        continue;
      }

      // 중복 방지
      const template = "amount_increase_yearly";
      const { data: already } = await supabase
        .from("notification_log")
        .select("id")
        .eq("recipient", m.email)
        .eq("template", template)
        .eq("ref_key", r.id)
        .gte("sent_at", cutoffStr)
        .limit(1);
      if ((already ?? []).length > 0) {
        skipped++;
        continue;
      }

      const suggested = Math.round((r.amount * 1.05) / 1000) * 1000; // +5% 반올림(천원)
      const res = await sendEmail({
        to: m.email,
        subject: "1년간 함께해주신 ${m.name}님께 감사드립니다",
        html: `
          <div style="font-family:-apple-system,'Noto Sans KR',sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1f2937">
            <h2 style="font-size:20px">🌱 벌써 1년이 되었습니다</h2>
            <p>${m.name ?? "후원자"}님의 월 ${r.amount.toLocaleString()}원 후원이 1년 넘게 이어졌습니다.</p>
            <p>지속되는 변화를 위해, 월 ${suggested.toLocaleString()}원으로 인상해보시는 건 어떨까요?</p>
            <p style="margin-top:24px">
              <a href="/donor/promises" style="background:#7c3aed;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:600">약정 관리 →</a>
            </p>
            <p style="font-size:13px;color:#6b7280;margin-top:16px">인상은 선택이며, 현재 금액을 유지하셔도 전혀 문제 없습니다.</p>
          </div>
        `,
      });
      if (res.success) {
        await supabase.from("notification_log").insert({
          org_id: r.org_id,
          recipient: m.email,
          template,
          ref_key: r.id,
        });
        sent++;
      }
    }

    return { sent, skipped, scanned: rows.length };
  });
}
