import { runCron } from "@/lib/cron/runner";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/send-email";

/**
 * G-D165: 월 1회, 매달 3일 08:00 KST 에 실행되어 이전 달 재무 요약을 관리자에게 이메일.
 *
 * 대상: admin_roles 에 finance 또는 super 역할을 가진 user. (없으면 orgs 별 contact_email 대체)
 * 이메일 본문: paid 건수·금액, 환불 건수·금액, 순 수입, 정기/일시 비율.
 */
export async function GET(req: Request) {
  return runCron(req, "cron:monthly-financial-report", async () => {
    const now = new Date();
    const prev = new Date(now.getUTCFullYear(), now.getUTCMonth() - 1, 1);
    const year = prev.getUTCFullYear();
    const month = prev.getUTCMonth() + 1;
    const first = `${year}-${String(month).padStart(2, "0")}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const last = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

    const supabase = createSupabaseAdminClient();
    const { data: orgs } = await supabase
      .from("orgs")
      .select("id, name, contact_email")
      .eq("status", "active");

    let sent = 0;
    for (const org of (orgs ?? []) as Array<{
      id: string;
      name: string;
      contact_email: string | null;
    }>) {
      const { data: payments } = await supabase
        .from("payments")
        .select("amount, pay_status, refund_amount")
        .eq("org_id", org.id)
        .gte("pay_date", first)
        .lte("pay_date", last);
      const rows = (payments ?? []) as Array<{
        amount: number | null;
        pay_status: string;
        refund_amount: number | null;
      }>;
      let paidCount = 0;
      let paidAmount = 0;
      let refundCount = 0;
      let refundAmount = 0;
      for (const r of rows) {
        const amt = Number(r.amount ?? 0);
        if (r.pay_status === "paid") {
          paidCount++;
          paidAmount += amt;
        } else if (r.pay_status === "refunded") {
          refundCount++;
          refundAmount += Number(r.refund_amount ?? 0);
        }
      }
      const net = paidAmount - refundAmount;

      // 수신자 조회 — finance/super admin
      const { data: roleRows } = await supabase
        .from("admin_roles")
        .select("user_id")
        .eq("org_id", org.id)
        .in("role", ["finance", "super"]);
      const userIds = [...new Set((roleRows ?? []).map((r) => r.user_id as string))];
      const recipients: string[] = [];
      if (userIds.length > 0) {
        const { data: listPage } = await supabase.auth.admin.listUsers({
          page: 1,
          perPage: 200,
        });
        for (const u of listPage?.users ?? []) {
          if (userIds.includes(u.id) && u.email) recipients.push(u.email);
        }
      }
      if (recipients.length === 0 && org.contact_email) {
        recipients.push(org.contact_email);
      }
      if (recipients.length === 0) continue;

      const html = `
        <div style="font-family:-apple-system,'Noto Sans KR',sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1f2937">
          <h2 style="font-size:20px">📊 ${year}년 ${month}월 재무 요약</h2>
          <p><b>${org.name}</b></p>
          <table style="width:100%;border-collapse:collapse;margin-top:16px">
            <tr><td style="padding:8px 0">결제 건수</td><td style="text-align:right;font-weight:600">${paidCount.toLocaleString()}건</td></tr>
            <tr><td style="padding:8px 0">결제 금액</td><td style="text-align:right;font-weight:600">${paidAmount.toLocaleString()}원</td></tr>
            <tr><td style="padding:8px 0">환불 건수</td><td style="text-align:right;color:#b91c1c">${refundCount.toLocaleString()}건</td></tr>
            <tr><td style="padding:8px 0">환불 금액</td><td style="text-align:right;color:#b91c1c">${refundAmount.toLocaleString()}원</td></tr>
            <tr style="border-top:1px solid #e5e7eb"><td style="padding:8px 0;font-weight:700">순 수입</td><td style="text-align:right;font-weight:700;color:#7c3aed">${net.toLocaleString()}원</td></tr>
          </table>
          <p style="font-size:13px;color:#6b7280;margin-top:16px">
            자세한 리포트는 /admin/reports/monthly 에서 CSV 다운로드하실 수 있습니다.
          </p>
        </div>
      `;

      for (const to of recipients) {
        const res = await sendEmail({
          to,
          subject: `${year}년 ${month}월 재무 요약 — ${org.name}`,
          html,
        });
        if (res.success) sent++;
      }
    }

    return { year, month, sent };
  });
}
