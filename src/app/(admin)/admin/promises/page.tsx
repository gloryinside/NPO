import { requireAdminUser } from "@/lib/auth";
import { requireTenant } from "@/lib/tenant/context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { PromiseList } from "@/components/admin/promise-list";
import type { PromiseWithRelations } from "@/types/promise";

type SearchParams = Promise<{
  status?: string;
}>;

export default async function PromisesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireAdminUser();

  const { status = "active" } = await searchParams;

  let promises: PromiseWithRelations[] = [];
  let total = 0;
  try {
    const tenant = await requireTenant();
    const supabase = createSupabaseAdminClient();

    let query = supabase
      .from("promises")
      .select(
        "*, members(id, name, member_code), campaigns(id, title)",
        { count: "exact" }
      )
      .eq("org_id", tenant.id);

    if (status !== "all") {
      query = query.eq("status", status);
    }

    const { data, count } = await query
      .order("created_at", { ascending: false })
      .range(0, 99);

    promises = (data as unknown as PromiseWithRelations[]) ?? [];
    total = count ?? 0;
  } catch {
    // tenant not found — render empty list
  }

  return (
    <PromiseList promises={promises} total={total} initialStatus={status} />
  );
}
