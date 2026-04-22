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
  let methodCounts: Record<string, number> = {};
  let statusCounts: Record<string, number> = {};
  let monthlyTotal = 0;
  let activeCount = 0;
  let cancelScheduledCount = 0;
  let overdueCount = 0;

  try {
    const tenant = await requireTenant();
    const supabase = createSupabaseAdminClient();

    const sixtyDaysAgo = new Date(Date.now() - 60 * 86400000)
      .toISOString()
      .slice(0, 10);

    // 기존 집계 + 신규 스탯 쿼리를 병렬 실행
    const [
      methodAggRes,
      statusAggRes,
      amountAggRes,
      promisesRes,
      activeCountRes,
      overdueRes,
    ] = await Promise.all([
      // 결제수단별 집계 (active 약정만)
      supabase
        .from("promises")
        .select("pay_method")
        .eq("org_id", tenant.id)
        .eq("status", "active"),
      // 상태별 집계 (전체)
      supabase.from("promises").select("status").eq("org_id", tenant.id),
      // 월 약정총액 (active)
      supabase
        .from("promises")
        .select("amount")
        .eq("org_id", tenant.id)
        .eq("status", "active"),
      // 메인 목록 쿼리
      (() => {
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

        return query.order("created_at", { ascending: false }).range(0, 99);
      })(),
      // 활성 약정 건수
      supabase
        .from("promises")
        .select("*", { count: "exact", head: true })
        .eq("org_id", tenant.id)
        .eq("status", "active"),
      // 연체 근사: 최근 60일 failed payment 건수
      supabase
        .from("payments")
        .select("*", { count: "exact", head: true })
        .eq("org_id", tenant.id)
        .eq("pay_status", "failed")
        .gte("pay_date", sixtyDaysAgo),
    ]);

    const methodAgg = methodAggRes.data;
    const statusAgg = statusAggRes.data;
    const amountAgg = amountAggRes.data;

    for (const r of methodAgg ?? []) {
      const m = (r as { pay_method: string | null }).pay_method ?? "기타";
      methodCounts[m] = (methodCounts[m] ?? 0) + 1;
    }

    for (const r of statusAgg ?? []) {
      const s = (r as { status: string }).status;
      statusCounts[s] = (statusCounts[s] ?? 0) + 1;
    }

    monthlyTotal = (amountAgg ?? []).reduce(
      (sum, r) => sum + Number((r as { amount: number }).amount ?? 0),
      0
    );

    promises =
      (promisesRes.data as unknown as PromiseWithRelations[]) ?? [];
    total = promisesRes.count ?? 0;

    activeCount = activeCountRes.count ?? 0;
    // promises 스키마상 'cancel_scheduled' 개념이 없음 — 0으로 둠
    cancelScheduledCount = 0;
    overdueCount = overdueRes.count ?? 0;
  } catch {
    // tenant not found — render empty list
  }

  return (
    <div>
      {/* 집계 헤더 */}
      <div className="mb-6 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
        <div className="flex flex-wrap gap-6 text-sm">
          <div>
            <span className="text-[var(--muted-foreground)]">결제수단 · </span>
            {["cms", "card", "transfer", "manual"].map((m) => (
              <span key={m} className="mr-3">
                <span className="font-medium text-[var(--text)]">
                  {{ cms: "CMS", card: "카드", transfer: "계좌이체", manual: "수기" }[m]}
                </span>
                <span className="ml-1 text-[var(--muted-foreground)]">
                  {(methodCounts[m] ?? 0).toLocaleString("ko-KR")}건
                </span>
              </span>
            ))}
          </div>
          <div>
            <span className="text-[var(--muted-foreground)]">상태 · </span>
            {[
              { key: "active", label: "활성" },
              { key: "suspended", label: "정지" },
              { key: "cancelled", label: "해지" },
            ].map(({ key, label }) => (
              <span key={key} className="mr-3">
                <span className="font-medium text-[var(--text)]">{label}</span>
                <span className="ml-1 text-[var(--muted-foreground)]">
                  {(statusCounts[key] ?? 0).toLocaleString("ko-KR")}건
                </span>
              </span>
            ))}
          </div>
          <div>
            <span className="text-[var(--muted-foreground)]">월 약정총액 · </span>
            <span className="font-semibold text-[var(--text)]">
              {monthlyTotal.toLocaleString("ko-KR")}원
            </span>
          </div>
        </div>
      </div>
      <PromiseList
        promises={promises}
        total={total}
        initialStatus={status}
        stats={{ activeCount, cancelScheduledCount, overdueCount }}
      />
    </div>
  );
}
