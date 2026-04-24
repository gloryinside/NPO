import type { SupabaseClient } from "@supabase/supabase-js";
import { headers } from "next/headers";

export type MemberAuditAction =
  | "profile_update"
  | "password_change"
  | "account_delete"
  | "email_change_attempt"
  | "2fa_enroll"
  | "2fa_unenroll"
  | "new_device_login";

/**
 * G-D25: 후원자 본인 계정 변경 이벤트 기록.
 * 실패해도 주 흐름(본 요청)을 막지 않는다 — best-effort 로깅.
 *
 * diff 에 민감 정보(비밀번호, 토큰 등)를 절대 포함하지 말 것. 호출 측에서 마스킹.
 */
export async function writeMemberAudit(
  supabase: SupabaseClient,
  params: {
    orgId: string;
    memberId: string;
    action: MemberAuditAction;
    diff?: Record<string, unknown> | null;
  }
): Promise<void> {
  try {
    const h = await headers();
    const ip =
      h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      h.get("x-real-ip") ||
      null;
    const userAgent = h.get("user-agent") || null;

    await supabase.from("member_audit_log").insert({
      org_id: params.orgId,
      member_id: params.memberId,
      action: params.action,
      diff: params.diff ?? null,
      ip,
      user_agent: userAgent,
    });
  } catch {
    // swallow — 감사 로그 실패는 주 로직에 영향 없음
  }
}
