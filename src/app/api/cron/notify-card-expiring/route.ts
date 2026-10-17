import { runCron } from "@/lib/cron/runner";
import { kstParts } from "@/lib/billing/kst";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/send-email";
import { logNotification } from "@/lib/email/notification-log";

/**
 * 매일 — 카드 만료 30일/7일 임박 후원자에게 안내 이메일.
 *   promises.card_expiry_year/month + status='active' + 빌링키 있는 건만.
 *   D-30, D-7 두 시점에 발송 (notification log로 중복 방지).
 */
export async function GET(req: Request) {
  return runCron(req, "cron:notify-card-expiring", async () => {
    const supabase = createSupabaseAdminClient();
    let sent = 0; let skipped = 0;

    // 만료 직전 1~31일 내 카드 검색 (월말 기준)
    const targets: Array<{ days: number; kind: "D-30" | "D-7" }> = [
      { days: 30, kind: "D-30" },
      { days: 7, kind: "D-7" },
    ];

    for (const { days, kind } of targets) {
      // KST 기준(서버 UTC와 무관) — 카드는 만료 "월"의 말일까지 쓸 수 있다
      const { year: targetYear, month: targetMonth } = kstParts(new Date(Date.now() + days * 86400_000));

      const { data: promises } = await supabase
        .from("promises")
        .select("id, org_id, member_id, card_expiry_year, card_expiry_month, members(name, email, email_disabled), orgs(name)")
        .eq("status", "active")
        .not("toss_billing_key", "is", null)
        .eq("card_expiry_year", targetYear)
        .eq("card_expiry_month", targetMonth);

      for (const p of (promises ?? []) as unknown as Array<{
        id: string; org_id: string; member_id: string;
        members: { name: string | null; email: string | null; email_disabled: boolean | null } | null;
        orgs: { name: string | null } | null;
      }>) {
        const member = Array.isArray(p.members) ? p.members[0] : p.members;
        const org = Array.isArray(p.orgs) ? p.orgs[0] : p.orgs;
        if (!member?.email || member.email_disabled) { skipped++; continue; }

        // 중복 방지 — 같은 promise + 같은 D-day 14일 내에 보냈으면 skip
        const cutoff = new Date(Date.now() - 14 * 86400_000).toISOString();
        const { count } = await supabase
          .from("email_notifications_log").select("id", { count: "exact", head: true })
          .eq("ref_id", p.id)
          .eq("kind", `card_expiring_${kind}`)
          .gte("sent_at", cutoff);
        if ((count ?? 0) > 0) { skipped++; continue; }

        const subject = `[${org?.name ?? "기관"}] 정기후원 카드 만료 ${days}일 전 안내`;
        const html = `
          <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1a1a2e">
            <h2 style="color:#b45309;margin:0 0 12px">결제 카드 만료가 ${days}일 남았습니다</h2>
            <p style="margin:0 0 12px">
              ${member.name ?? "후원자"}님, 정기후원에 사용 중인 카드의 유효기간이
              <b>${targetYear}년 ${targetMonth}월</b>에 만료됩니다.
            </p>
            <p style="margin:0 0 12px">
              만료 전 마이페이지 → 약정 → 카드 변경에서 새 카드를 등록해 주시면
              결제가 중단되지 않고 계속 진행됩니다.
            </p>
            <a href="https://${process.env.NEXT_PUBLIC_BASE_DOMAIN ?? ""}/donor/promises"
              style="display:inline-block;padding:12px 24px;background:#b45309;color:white;border-radius:8px;text-decoration:none">
              카드 변경하기 →
            </a>
          </div>
        `.trim();

        const result = await sendEmail({ to: member.email, subject, html });
        await logNotification(supabase, {
          orgId: p.org_id,
          // 중복 방지 조회와 같은 kind로 기록(예전엔 member_invite로 남겨 매일 재발송됐다)
          kind: `card_expiring_${kind}`,
          recipientEmail: member.email,
          refId: p.id,
          status: result.success ? "sent" : "failed",
          error: result.error ?? null,
        });
        if (result.success) sent++;
      }
    }
    return { sent, skipped };
  });
}
