import { requireAdminUserBeforeMfa } from "@/lib/auth";
import { getAdminRoles } from "@/lib/auth/admin-rbac";
import { orgRequiresAdminMfa } from "@/lib/auth/admin-mfa";
import { AdminMfaSetup } from "@/components/admin/admin-mfa";

export const metadata = { title: "2단계 인증 설정" };

/** OTP 앱 등록·해제, 기관 전체 필수 설정(최고 관리자) */
export default async function AdminMfaSetupPage() {
  const { user, orgId } = await requireAdminUserBeforeMfa();
  const [required, roles] = await Promise.all([orgRequiresAdminMfa(orgId), getAdminRoles(user.id, orgId)]);
  return <AdminMfaSetup orgRequires={required} isSuper={roles.roles.includes("super")} />;
}
