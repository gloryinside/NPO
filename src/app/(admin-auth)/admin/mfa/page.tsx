import { redirect } from "next/navigation";
import { requireAdminUserBeforeMfa } from "@/lib/auth";
import { adminMfaState } from "@/lib/auth/admin-mfa";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AdminMfaChallenge } from "@/components/admin/admin-mfa";

export const metadata = { title: "2단계 인증" };

/** 로그인 뒤 OTP 앱 코드 입력 */
export default async function AdminMfaPage() {
  const { orgId } = await requireAdminUserBeforeMfa();
  const state = await adminMfaState(await createSupabaseServerClient(), orgId);
  if (state === "ok") redirect("/admin");
  if (state === "enroll") redirect("/admin/mfa/setup");
  return <AdminMfaChallenge />;
}
