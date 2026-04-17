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
  tab?: string;
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
    tab = "list",
  } = await searchParams;

  // 탭 링크 (공통)
  const tabLinks = (
    <div className="mb-6 flex gap-1 border-b border-[var(--border)]">
      {[
        { key: "list", label: "회원목록" },
        { key: "source", label: "유입경로" },
      ].map(({ key, label }) => (
        <a
          key={key}
          href={`/admin/members?tab=${key}`}
          className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
            tab === key
              ? "border-[var(--accent)] text-[var(--accent)]"
              : "border-transparent text-[var(--muted-foreground)]"
          }`}
        >
          {label}
        </a>
      ))}
    </div>
  );

  // ── 유입경로 탭 ──
  if (tab === "source") {
    let sourceList: { path: string; count: number }[] = [];
    let grandTotal = 0;
    try {
      const tenant = await requireTenant();
      const supabase = createSupabaseAdminClient();
      const { data: sourceRaw } = await supabase
        .from("members")
        .select("join_path")
        .eq("org_id", tenant.id);

      const sourceMap = new Map<string, number>();
      for (const r of sourceRaw ?? []) {
        const src = (r as { join_path: string | null }).join_path ?? "미입력";
        sourceMap.set(src, (sourceMap.get(src) ?? 0) + 1);
      }
      sourceList = Array.from(sourceMap.entries())
        .map(([path, count]) => ({ path, count }))
        .sort((a, b) => b.count - a.count);
      grandTotal = sourceList.reduce((s, r) => s + r.count, 0);
    } catch {
      // tenant not found
    }

    return (
      <div>
        {tabLinks}
        <h2 className="mb-4 text-lg font-semibold text-[var(--text)]">유입경로 현황</h2>
        <div className="overflow-hidden rounded-lg border border-[var(--border)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[var(--surface-2)]">
                <th className="px-4 py-2 text-left text-xs font-medium text-[var(--muted-foreground)]">유입경로</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-[var(--muted-foreground)]">회원 수</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-[var(--muted-foreground)]">비율</th>
              </tr>
            </thead>
            <tbody>
              {sourceList.map(({ path, count }, idx) => (
                <tr
                  key={path}
                  className={idx > 0 ? "border-t border-[var(--border)]" : ""}
                >
                  <td className="px-4 py-3 text-[var(--text)]">{path}</td>
                  <td className="px-4 py-3 text-right font-medium text-[var(--text)]">
                    {count.toLocaleString("ko-KR")}명
                  </td>
                  <td className="px-4 py-3 text-right text-[var(--muted-foreground)]">
                    {grandTotal > 0 ? Math.round((count / grandTotal) * 100) : 0}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // ── 회원목록 탭 (기본) ──
  let members: Member[] = [];
  let total = 0;
  try {
    const tenant = await requireTenant();
    const supabase = createSupabaseAdminClient();

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
        return (
          <div>
            {tabLinks}
            <MemberList
              members={[]}
              total={0}
              initialQuery={q}
              initialStatus={status}
              initialPayMethod={payMethod}
              initialPromiseType={promiseType}
            />
          </div>
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
    <div>
      {tabLinks}
      <MemberList
        members={members}
        total={total}
        initialQuery={q}
        initialStatus={status}
        initialPayMethod={payMethod}
        initialPromiseType={promiseType}
      />
    </div>
  );
}
