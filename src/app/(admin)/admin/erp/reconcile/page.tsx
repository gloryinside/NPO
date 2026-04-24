import { requireAdminUser } from "@/lib/auth";
import { requireTenant } from "@/lib/tenant/context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getAdminRoles } from "@/lib/auth/admin-rbac";
import { PageHeader } from "@/components/common/page-header";
import { ReconcileClient, type ReconcileRow } from "./ReconcileClient";

export const metadata = { title: "ERP 수입결의" };

export default async function ErpReconcilePage() {
  const user = await requireAdminUser();
  const tenant = await requireTenant();
  const supabase = createSupabaseAdminClient();

  const [paymentsRes, rolesRes] = await Promise.all([
    supabase
      .from("payments")
      .select(
        `id, pay_date, amount, income_status, pay_method,
         members!inner(name, member_code),
         campaigns(title)`
      )
      .eq("org_id", tenant.id)
      .in("income_status", ["pending", "processing"])
      .order("pay_date", { ascending: false })
      .limit(500),
    getAdminRoles(user.id, tenant.id),
  ]);

  const rows: ReconcileRow[] = (paymentsRes.data ?? []).map((p) => {
    const member = Array.isArray(p.members) ? p.members[0] : p.members;
    const campaign = Array.isArray(p.campaigns) ? p.campaigns[0] : p.campaigns;
    return {
      id: p.id,
      pay_date: p.pay_date ?? null,
      amount: p.amount ?? 0,
      income_status: (p.income_status ?? "pending") as ReconcileRow["income_status"],
      pay_method: p.pay_method ?? null,
      member_name: (member as { name?: string } | null)?.name ?? null,
      member_code: (member as { member_code?: string } | null)?.member_code ?? null,
      campaign_title: (campaign as { title?: string } | null)?.title ?? null,
    };
  });

  const isSuper = rolesRes.ok && rolesRes.roles.includes("super");

  return (
    <div>
      <PageHeader
        title="ERP 수입결의"
        description="납입 건의 수입상태를 검토하고 일괄 확정합니다."
      />
      <ReconcileClient initialRows={rows} isSuper={isSuper} />
    </div>
  );
}
