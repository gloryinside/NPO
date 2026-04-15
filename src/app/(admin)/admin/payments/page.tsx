import { requireAdminUser } from "@/lib/auth";
import { requireTenant } from "@/lib/tenant/context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { PaymentList } from "@/components/admin/payment-list";
import type { PaymentWithRelations } from "@/types/payment";

type SearchParams = Promise<{
  status?: string;
}>;

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireAdminUser();

  const { status = "all" } = await searchParams;

  let payments: PaymentWithRelations[] = [];
  let total = 0;
  try {
    const tenant = await requireTenant();
    const supabase = createSupabaseAdminClient();

    let query = supabase
      .from("payments")
      .select(
        "*, members(id, name, member_code), campaigns(id, title)",
        { count: "exact" }
      )
      .eq("org_id", tenant.id);

    if (status !== "all") {
      query = query.eq("pay_status", status);
    }

    const { data, count } = await query
      .order("pay_date", { ascending: false })
      .range(0, 99);

    payments = (data as unknown as PaymentWithRelations[]) ?? [];
    total = count ?? 0;
  } catch {
    // tenant not found — render empty list
  }

  return (
    <PaymentList payments={payments} total={total} initialStatus={status} />
  );
}
