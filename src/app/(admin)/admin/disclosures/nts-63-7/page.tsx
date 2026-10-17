import { requireAdminUser } from "@/lib/auth";
import { requireTenant } from "@/lib/tenant/context";
import { hasAnyRole } from "@/lib/auth/admin-rbac";
import { NtsDonationUsageEditor } from "@/components/admin/nts-donation-usage-editor";

export const metadata = { title: "기부금 모금액·활용실적 명세서" };

export default async function NtsDonationUsagePage() {
  const user = await requireAdminUser();
  const tenant = await requireTenant();
  const canSave = await hasAnyRole(user.id, tenant.id, ["finance"]);
  // 보통 지난해 실적을 공개한다
  const defaultYear = new Date().getFullYear() - 1;
  return <NtsDonationUsageEditor defaultYear={defaultYear} canSave={canSave} />;
}
