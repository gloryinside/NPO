import { redirect } from "next/navigation";
import { getDonorSession } from "@/lib/auth";
import { DonorLoginForm } from "@/components/donor/login-form";
import { isDonorAuthBypassEnabled } from "@/lib/auth/donor-bypass";

export default async function DonorLoginPage() {
  const session = await getDonorSession();
  if (session) {
    redirect("/donor");
  }

  // 개발용 로그인 우회 (NEXT_PUBLIC_DONOR_AUTH_BYPASS=1, prod 자동 차단)
  const bypass = isDonorAuthBypassEnabled();

  return <DonorLoginForm bypass={bypass} />;
}
