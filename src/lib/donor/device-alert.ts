import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/email/send-email";

/**
 * 새 IP에서 로그인 감지 시 이메일 알림 발송.
 * member_audit_log의 과거 ip 목록과 비교하여 처음 보는 IP면 알림.
 * Best-effort — 실패해도 로그인 차단하지 않음.
 */
export async function checkAndAlertNewDevice(
  supabase: SupabaseClient,
  params: {
    memberId: string;
    orgId: string;
    email: string;
    name: string;
    currentIp: string | null;
    userAgent: string | null;
  }
): Promise<void> {
  if (!params.currentIp) return;

  try {
    const { data: recentRows } = await supabase
      .from("member_audit_log")
      .select("ip")
      .eq("member_id", params.memberId)
      .not("ip", "is", null)
      .order("created_at", { ascending: false })
      .limit(50);

    const knownIps = new Set((recentRows ?? []).map((r: { ip: string | null }) => r.ip));

    if (knownIps.has(params.currentIp)) return;

    // New IP — send alert and log
    const now = new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });

    await sendEmail({
      to: params.email,
      subject: "[보안 알림] 새로운 기기에서 로그인이 감지되었습니다",
      html: `
        <p>${params.name}님, 안녕하세요.</p>
        <p>처음 사용하는 기기나 위치에서 로그인이 감지되었습니다.</p>
        <table style="border-collapse:collapse;font-size:14px;margin:12px 0">
          <tr><td style="padding:4px 12px 4px 0;color:#666">IP</td><td>${params.currentIp}</td></tr>
          <tr><td style="padding:4px 12px 4px 0;color:#666">시각</td><td>${now}</td></tr>
          ${params.userAgent ? `<tr><td style="padding:4px 12px 4px 0;color:#666">기기</td><td>${params.userAgent.slice(0, 120)}</td></tr>` : ""}
        </table>
        <p>본인이 아닌 경우 즉시 비밀번호를 변경하고 고객센터에 문의해 주세요.</p>
      `,
    });

    // Record the new IP in audit log
    await supabase.from("member_audit_log").insert({
      org_id: params.orgId,
      member_id: params.memberId,
      action: "new_device_login",
      diff: null,
      ip: params.currentIp,
      user_agent: params.userAgent,
    });
  } catch {
    // swallow — never block login
  }
}
