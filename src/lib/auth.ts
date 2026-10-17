import { redirect } from "next/navigation";
import { cache } from "react";
import { cookies } from "next/headers";
import type { User } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getTenant } from "@/lib/tenant/context";
import { getOtpSessionFromCookies } from "@/lib/auth/otp-session";
import { adminClaims, isAdminOfTenant } from "@/lib/auth/tenant-binding";
import { adminMfaState } from "@/lib/auth/admin-mfa";
import {
  MFA_BYPASS_COOKIE,
  verifyMfaBypassToken,
} from "@/lib/auth/mfa-bypass";
import type { Member } from "@/types/member";

/**
 * Returns the current authenticated user from Supabase session.
 * Returns null if not authenticated.
 */
export async function getAdminUser(): Promise<User | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/**
 * 2단계 인증 화면용 — 로그인·기관 소속까지만 확인한다(2단계 인증 확인 전 단계라 그것은 보지 않는다).
 */
export async function requireAdminUserBeforeMfa(): Promise<{ user: User; orgId: string }> {
  const user = await getAdminUser();
  if (!adminClaims(user)) {
    redirect("/admin/login");
  }
  // [보안] 이 도메인 기관의 관리자여야 한다(다른 기관 관리자 계정 차단)
  const tenant = await getTenant();
  if (!isAdminOfTenant(user, tenant?.id)) {
    redirect("/admin/login?reason=wrong_org");
  }
  return { user: user!, orgId: tenant!.id };
}

/**
 * 관리자 화면 가드 — 로그인·기관 소속·2단계 인증(lib/auth/admin-mfa)까지 확인한다.
 */
export async function requireAdminUser(): Promise<User> {
  const { user, orgId } = await requireAdminUserBeforeMfa();
  const state = await adminMfaState(await createSupabaseServerClient(), orgId);
  if (state === "challenge") redirect("/admin/mfa");
  if (state === "enroll") redirect("/admin/mfa/setup");
  return user;
}

export type DonorSession = {
  user: User | null;
  member: Member;
  authMethod: "supabase" | "otp";
};

/**
 * 현재 로그인된 donor 세션을 반환한다. 로그인이 안 되어있거나
 * 현재 tenant에 연결된 member 가 없으면 null.
 *
 * members 테이블은 admin-only RLS이므로 service-role 클라이언트로
 * supabase_uid + org_id 두 조건을 모두 만족하는 행만 조회한다.
 */
export const getDonorSession = cache(async (): Promise<DonorSession | null> => {
  const tenant = await getTenant();
  if (!tenant) return null;

  // 1. Supabase Auth 세션 시도
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const admin = createSupabaseAdminClient();
    const { data: member } = await admin
      .from("members")
      .select("*")
      .eq("supabase_uid", user.id)
      .eq("org_id", tenant.id)
      .maybeSingle();

    if (member) {
      // MFA 가드: 활성 사용자는 aal2 세션이거나 유효한 백업 코드 bypass 쿠키가 있어야 함
      const typedMember = member as Member & { mfa_enabled?: boolean };
      if (typedMember.mfa_enabled) {
        const { data: aalData } =
          await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
        const isAal2 = aalData?.currentLevel === "aal2";
        if (!isAal2) {
          const cookieStore = await cookies();
          const bypass = cookieStore.get(MFA_BYPASS_COOKIE)?.value;
          const bypassValid =
            typeof bypass === "string" && verifyMfaBypassToken(bypass, user.id);
          if (!bypassValid) return null;
        }
      }
      return { user, member: member as Member, authMethod: "supabase" };
    }
  }

  // 2. OTP JWT 세션 폴백
  const otpPayload = await getOtpSessionFromCookies();
  if (otpPayload && otpPayload.orgId === tenant.id) {
    const admin = createSupabaseAdminClient();
    const { data: member } = await admin
      .from("members")
      .select("*")
      .eq("id", otpPayload.memberId)
      .eq("org_id", tenant.id)
      .maybeSingle();

    if (member) {
      return { user: null, member: member as Member, authMethod: "otp" };
    }
  }

  return null;
});

/**
 * 인증 필수 — 미로그인/미연결 시 /donor/login 으로 redirect.
 */
export async function requireDonorSession(): Promise<DonorSession> {
  const session = await getDonorSession();
  if (!session) {
    redirect("/donor/login");
  }
  return session;
}
