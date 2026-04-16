import { requireAdminUser } from "@/lib/auth";
import { requireTenant } from "@/lib/tenant/context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { UnpaidList } from "@/components/admin/unpaid-list";
import type { PaymentWithRelations } from "@/types/payment";

type SearchParams = Promise<{ q?: string }>;

export default async function UnpaidPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireAdminUser();

  const { q = "" } = await searchParams;

  let payments: PaymentWithRelations[] = [];
  let total = 0;

  try {
    const tenant = await requireTenant();
    const supabase = createSupabaseAdminClient();

    let query = supabase
      .from("payments")
      .select(
        "*, members(id, name, member_code, phone), campaigns(id, title)",
        { count: "exact" }
      )
      .eq("org_id", tenant.id)
      .in("pay_status", ["unpaid", "failed"])
      .order("pay_date", { ascending: true, nullsFirst: false });

    if (q.trim()) {
      // 미납 관리에서 회원명 검색: sub-select member_ids
      const escaped = q.trim().replace(/[%()]/g, "");
      const { data: memberRows } = await supabase
        .from("members")
        .select("id")
        .eq("org_id", tenant.id)
        .ilike("name", `%${escaped}%`);
      const memberIds = (memberRows ?? []).map((r: { id: string }) => r.id);
      if (memberIds.length === 0) {
        return (
          <UnpaidList payments={[]} total={0} initialQ={q} />
        );
      }
      query = query.in("member_id", memberIds);
    }

    const { data, count } = await query.range(0, 199);
    payments = (data as unknown as PaymentWithRelations[]) ?? [];
    total = count ?? 0;
  } catch {
    // tenant not found
  }

  return <UnpaidList payments={payments} total={total} initialQ={q} />;
}
