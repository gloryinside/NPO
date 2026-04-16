import { requireAdminUser } from "@/lib/auth";
import { requireTenant } from "@/lib/tenant/context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { MemberList } from "@/components/admin/member-list";
import type { Member } from "@/types/member";

type SearchParams = Promise<{
  q?: string;
  status?: string;
  payMethod?: string;
  promiseType?: string;
}>;

export default async function MembersPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireAdminUser();

  const {
    q = "",
    status = "active",
    payMethod = "",
    promiseType = "",
  } = await searchParams;

  let members: Member[] = [];
  let total = 0;
  try {
    const tenant = await requireTenant();
    const supabase = createSupabaseAdminClient();

    // payMethod / promiseType 필터: promises 테이블에서 member_id 목록 추출
    let filteredMemberIds: string[] | null = null;
    if (payMethod || promiseType) {
      let pq = supabase
        .from("promises")
        .select("member_id")
        .eq("org_id", tenant.id);
      if (payMethod) pq = pq.eq("pay_method", payMethod);
      if (promiseType) pq = pq.eq("type", promiseType);
      const { data: pRows } = await pq;
      filteredMemberIds = [...new Set((pRows ?? []).map((r: { member_id: string }) => r.member_id))];
      if (filteredMemberIds.length === 0) {
        // 필터 결과가 없으면 빈 목록 반환
        return (
          <MemberList
            members={[]}
            total={0}
            initialQuery={q}
            initialStatus={status}
            initialPayMethod={payMethod}
            initialPromiseType={promiseType}
          />
        );
      }
    }

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
    if (filteredMemberIds) {
      query = query.in("id", filteredMemberIds);
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
      initialPayMethod={payMethod}
      initialPromiseType={promiseType}
    />
  );
}
