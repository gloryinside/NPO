import { redirect } from "next/navigation";
import { getAdminUser } from "@/lib/auth";
import { getTenant } from "@/lib/tenant/context";
import { isAdminOfTenant } from "@/lib/auth/tenant-binding";
import { LoginForm } from "@/components/admin/login-form";

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const user = await getAdminUser();
  const { reason } = await searchParams;
  // 이 기관 관리자일 때만 콘솔로 — 다른 기관 계정이면 로그인 화면에 머문다(리다이렉트 루프 방지)
  if (isAdminOfTenant(user, (await getTenant())?.id)) {
    redirect("/admin");
  }

  // 로그인은 됐지만 이 기관 소속이 아닌 계정
  const notice =
    reason === "wrong_org" && user
      ? "이 계정은 이 기관의 관리자가 아닙니다. 소속 기관의 주소로 접속하거나 다른 계정으로 로그인하세요."
      : null;
  return <LoginForm notice={notice} />;
}
