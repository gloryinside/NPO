import { requireAdminUser } from "@/lib/auth";
import { requireTenant } from "@/lib/tenant/context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { CmsErrorList } from "@/components/admin/cms-error-list";
import type { PaymentWithRelations } from "@/types/payment";

export default async function CmsErrorsPage() {
  await requireAdminUser();

  const tenant = await requireTenant();
  const supabase = createSupabaseAdminClient();

  const { data, count } = await supabase
    .from("payments")
    .select(
      "*, members(id, name, member_code, phone), campaigns(id, title)",
      { count: "exact" }
    )
    .eq("org_id", tenant.id)
    .eq("pay_method", "cms")
    .in("pay_status", ["failed", "unpaid"])
    .order("pay_date", { ascending: false, nullsFirst: false })
    .range(0, 199);

  const payments = (data as unknown as PaymentWithRelations[]) ?? [];
  const total = count ?? 0;

  return <CmsErrorList payments={payments} total={total} />;
}
