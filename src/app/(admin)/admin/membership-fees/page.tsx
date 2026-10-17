import { requireAdminUser } from "@/lib/auth";
import { requireTenant } from "@/lib/tenant/context";
import { hasAnyRole } from "@/lib/auth/admin-rbac";
import { kstToday } from "@/lib/billing/kst";
import { MembershipFeeBoard } from "@/components/admin/membership-fee-board";

export const metadata = { title: "회비" };

export default async function MembershipFeesPage() {
  const user = await requireAdminUser();
  const tenant = await requireTenant();
  const canRecord = await hasAnyRole(user.id, tenant.id, ["finance"]);
  return <MembershipFeeBoard today={kstToday()} canRecord={canRecord} />;
}
