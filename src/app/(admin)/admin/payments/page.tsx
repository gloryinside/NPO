import { requireAdminUser } from "@/lib/auth";
import { requireTenant } from "@/lib/tenant/context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { PaymentList } from "@/components/admin/payment-list";
import { MonthlyProcessingPanel } from "@/components/admin/monthly-processing-panel";
import type { PaymentWithRelations } from "@/types/payment";

type SearchParams = Promise<{ status?: string; tab?: string }>;

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireAdminUser();
  const { status = "all", tab = "list" } = await searchParams;

  const tenant = await requireTenant();
  const supabase = createSupabaseAdminClient();

  // 탭 링크
  const tabLinks = (
    <div className="mb-6 flex gap-1 border-b border-[var(--border)]">
      {[
        { key: "list", label: "전체결제내역" },
        { key: "monthly", label: "당월처리현황" },
      ].map(({ key, label }) => (
        <a
          key={key}
          href={`/admin/payments?tab=${key}`}
          className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
            tab === key
              ? "text-[var(--accent)] border-[var(--accent)]"
              : "text-[var(--muted-foreground)] border-transparent"
          }`}
        >
          {label}
        </a>
      ))}
    </div>
  );

  // ── 전체결제내역 탭 ──
  if (tab !== "monthly") {
    let payments: PaymentWithRelations[] = [];
    let total = 0;
    let monthPaidTotal = 0;
    let unpaidCount = 0;
    let cmsSuccessRate = 100;
    let pendingIncomeCount = 0;
    try {
      const now = new Date();
      const firstDay = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
      const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      const nextFirstDay = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, "0")}-01`;

      const [paymentsRes, monthPaidRes, monthFailedRes, monthTotalRes, pendingIncomeRes] = await Promise.all([
        (() => {
          let q = supabase
            .from("payments")
            .select("*, members(id, name, member_code), campaigns(id, title)", { count: "exact" })
            .eq("org_id", tenant.id);
          if (status !== "all") q = q.eq("pay_status", status);
          return q.order("pay_date", { ascending: false }).range(0, 99);
        })(),
        supabase
          .from("payments")
          .select("amount")
          .eq("org_id", tenant.id)
          .eq("pay_status", "paid")
          .gte("pay_date", firstDay)
          .lt("pay_date", nextFirstDay),
        supabase
          .from("payments")
          .select("*", { count: "exact", head: true })
          .eq("org_id", tenant.id)
          .eq("pay_status", "failed")
          .gte("pay_date", firstDay)
          .lt("pay_date", nextFirstDay),
        supabase
          .from("payments")
          .select("*", { count: "exact", head: true })
          .eq("org_id", tenant.id)
          .in("pay_status", ["paid", "failed"])
          .gte("pay_date", firstDay)
          .lt("pay_date", nextFirstDay),
        supabase
          .from("payments")
          .select("*", { count: "exact", head: true })
          .eq("org_id", tenant.id)
          .eq("income_status", "pending")
          .eq("pay_status", "paid"),
      ]);

      payments = (paymentsRes.data as unknown as PaymentWithRelations[]) ?? [];
      total = paymentsRes.count ?? 0;

      monthPaidTotal = (monthPaidRes.data ?? []).reduce(
        (s: number, r: { amount: number | null }) => s + Number(r.amount ?? 0),
        0,
      );
      const monthFailed = monthFailedRes.count ?? 0;
      const monthAttempts = monthTotalRes.count ?? 0;
      unpaidCount = monthFailed;
      cmsSuccessRate =
        monthAttempts > 0 ? Math.round(((monthAttempts - monthFailed) / monthAttempts) * 100) : 100;
      pendingIncomeCount = pendingIncomeRes.count ?? 0;
    } catch { /* tenant not found */ }
    return (
      <div>
        {tabLinks}
        <PaymentList
          payments={payments}
          total={total}
          initialStatus={status}
          stats={{
            monthPaidTotal,
            unpaidCount,
            cmsSuccessRate,
            pendingIncomeCount,
          }}
        />
      </div>
    );
  }

  // ── 당월처리현황 탭 ──
  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const monthEnd = nextMonth.toISOString().slice(0, 10);
  const monthStr = monthStart.slice(0, 7);

  const { data: monthlyRaw } = await supabase
    .from("payments")
    .select("pay_method, pay_status, amount, pay_day")
    .eq("org_id", tenant.id)
    .gte("pay_date", monthStart)
    .lt("pay_date", monthEnd)
    .in("pay_method", ["cms", "card"]);

  type MonthlyRow = {
    pay_method: string | null;
    pay_status: string | null;
    amount: number | null;
    pay_day: number | null;
  };

  const rows = (monthlyRaw as unknown as MonthlyRow[]) ?? [];

  function calcStats(method: string) {
    const methodRows = rows.filter((r) => r.pay_method === method);
    return {
      done: methodRows.filter((r) => r.pay_status === "paid").length,
      pending: methodRows.filter((r) => ["pending", "processing"].includes(r.pay_status ?? "")).length,
      failed: methodRows.filter((r) => ["failed", "unpaid"].includes(r.pay_status ?? "")).length,
      total: methodRows
        .filter((r) => r.pay_status === "paid")
        .reduce((s, r) => s + Number(r.amount ?? 0), 0),
    };
  }

  const dayMap = new Map<number, number>();
  for (const r of rows) {
    if (r.pay_day) dayMap.set(r.pay_day, (dayMap.get(r.pay_day) ?? 0) + 1);
  }
  const byDay = Array.from(dayMap.entries())
    .map(([day, count]) => ({ day, count }))
    .sort((a, b) => a.day - b.day);

  return (
    <div>
      {tabLinks}
      <MonthlyProcessingPanel
        month={monthStr}
        cms={calcStats("cms")}
        card={calcStats("card")}
        byDay={byDay}
      />
    </div>
  );
}
