import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getTenant } from "@/lib/tenant/context";
import { getOtpSessionFromCookies } from "@/lib/auth/otp-session";
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
 * Throws redirect to /admin/login if not authenticated or not admin role.
 */
export async function requireAdminUser(): Promise<User> {
  const user = await getAdminUser();
  if (!user || user.user_metadata?.role !== "admin") {
    redirect("/admin/login");
  }
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
export async function getDonorSession(): Promise<DonorSession | null> {
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
}

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
