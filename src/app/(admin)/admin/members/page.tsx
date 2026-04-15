import { requireAdminUser } from "@/lib/auth";
import { requireTenant } from "@/lib/tenant/context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { MemberList } from "@/components/admin/member-list";
import type { Member } from "@/types/member";

type SearchParams = Promise<{
  q?: string;
  status?: string;
}>;

export default async function MembersPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireAdminUser();

  const { q = "", status = "active" } = await searchParams;

  let members: Member[] = [];
  let total = 0;
  try {
    const tenant = await requireTenant();
    const supabase = createSupabaseAdminClient();
    let query = supabase
      .from("members")
      .select("*", { count: "exact" })
      .eq("org_id", tenant.id);

    if (status !== "all") {
      query = query.eq("status", status);
    }
    if (q) {
      const escaped = q.replace(/[%,()]/g, "");
      query = query.or(
        `name.ilike.%${escaped}%,phone.ilike.%${escaped}%,email.ilike.%${escaped}%`
      );
    }

    const { data, count } = await query
      .order("created_at", { ascending: false })
      .range(0, 49);

    members = (data as Member[]) ?? [];
    total = count ?? 0;
  } catch {
    // tenant not found — render empty list
  }

  return (
    <MemberList
      members={members}
      total={total}
      initialQuery={q}
      initialStatus={status}
    />
  );
}
