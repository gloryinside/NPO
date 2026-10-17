/**
 * 관리자 2단계 인증(OTP 앱) 판정 — 페이지·API·캠페인 편집 API 가드가 모두 이것을 쓴다.
 *
 *  - OTP 앱을 등록한 관리자: 로그인 뒤 코드를 입력해 세션이 aal2가 돼야 관리자 기능을 쓴다(challenge)
 *  - 등록하지 않은 관리자: 기관이 필수로 켰으면(orgs.admin_mfa_required) 먼저 등록해야 한다(enroll)
 *  - 그 밖에는 통과(ok)
 * 판정 근거(aal)는 세션 토큰에 들어 있어 네트워크 호출이 없다. 기관 설정만 DB에서 읽는다.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type AdminMfaState = "ok" | "challenge" | "enroll";

export function decideAdminMfa(args: {
  currentLevel: string | null | undefined;
  nextLevel: string | null | undefined;
  orgRequires: boolean;
}): AdminMfaState {
  if (args.currentLevel === "aal2") return "ok";
  // 등록된 인증 수단이 있으면 다음 단계가 aal2 — 코드를 입력해야 한다
  if (args.nextLevel === "aal2") return "challenge";
  return args.orgRequires ? "enroll" : "ok";
}

export async function orgRequiresAdminMfa(orgId: string): Promise<boolean> {
  const { data } = await createSupabaseAdminClient().from("orgs").select("admin_mfa_required").eq("id", orgId).maybeSingle();
  return (data as { admin_mfa_required?: boolean } | null)?.admin_mfa_required === true;
}

/** 로그인한 관리자 세션(sb)의 2단계 인증 상태 */
export async function adminMfaState(sb: SupabaseClient, orgId: string): Promise<AdminMfaState> {
  const { data, error } = await sb.auth.mfa.getAuthenticatorAssuranceLevel();
  // 판정을 못 하면 막는다 — 등록 여부를 모르는 채로 통과시키지 않는다
  if (error) return "challenge";
  const levels = { currentLevel: data?.currentLevel, nextLevel: data?.nextLevel };
  // 이미 aal2거나 코드 입력이 필요하면 기관 설정을 읽을 필요가 없다
  const early = decideAdminMfa({ ...levels, orgRequires: false });
  if (early === "challenge" || levels.currentLevel === "aal2") return early;
  return decideAdminMfa({ ...levels, orgRequires: await orgRequiresAdminMfa(orgId) });
}

/** 2단계 인증이 필요할 때 API가 돌려주는 응답 본문 */
export function mfaRequiredBody(state: Exclude<AdminMfaState, "ok">) {
  return {
    error: state === "enroll" ? "2단계 인증을 먼저 등록해 주세요." : "2단계 인증 코드를 입력해 주세요.",
    code: "MFA_REQUIRED",
    next: state === "enroll" ? "/admin/mfa/setup" : "/admin/mfa",
  };
}
