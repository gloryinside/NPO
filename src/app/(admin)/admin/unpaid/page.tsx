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
  let totalUnpaidCount = 0;
  let totalUnpaidAmount = 0;
  let risk2 = 0;
  let risk3 = 0;

  try {
    const tenant = await requireTenant();
    const supabase = createSupabaseAdminClient();

    // 요약 집계 (전체 미납)
    const { data: summaryRaw, count: summaryCount } = await supabase
      .from("payments")
      .select("amount, member_id", { count: "exact" })
      .eq("org_id", tenant.id)
      .in("pay_status", ["unpaid", "failed"]);

    totalUnpaidCount = summaryCount ?? 0;
    totalUnpaidAmount = (summaryRaw ?? []).reduce(
      (s, r) => s + Number((r as { amount: number }).amount ?? 0),
      0
    );

    // 연속 미납 횟수 집계 (member_id별 카운트)
    const memberUnpaidCount = new Map<string, number>();
    for (const r of summaryRaw ?? []) {
      const mid = (r as { member_id: string }).member_id;
      memberUnpaidCount.set(mid, (memberUnpaidCount.get(mid) ?? 0) + 1);
    }
    risk2 = [...memberUnpaidCount.values()].filter((c) => c >= 2).length;
    risk3 = [...memberUnpaidCount.values()].filter((c) => c >= 3).length;

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
      const escaped = q.trim().replace(/[%()]/g, "");
      const { data: memberRows } = await supabase
        .from("members")
        .select("id")
        .eq("org_id", tenant.id)
        .ilike("name", `%${escaped}%`);
      const memberIds = (memberRows ?? []).map((r: { id: string }) => r.id);
      if (memberIds.length === 0) {
        return (
          <div>
            <SummaryCards total={totalUnpaidCount} amount={totalUnpaidAmount} risk2={risk2} risk3={risk3} />
            <UnpaidList payments={[]} total={0} initialQ={q} />
          </div>
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

  return (
    <div>
      <SummaryCards total={totalUnpaidCount} amount={totalUnpaidAmount} risk2={risk2} risk3={risk3} />
      <UnpaidList payments={payments} total={total} initialQ={q} />
    </div>
  );
}

function SummaryCards({
  total,
  amount,
  risk2,
  risk3,
}: {
  total: number;
  amount: number;
  risk2: number;
  risk3: number;
}) {
  const cards = [
    { label: "총 미납 건수", value: `${total.toLocaleString("ko-KR")}건`, negative: total > 0 },
    { label: "총 미납 금액", value: `${amount.toLocaleString("ko-KR")}원`, negative: amount > 0 },
    { label: "2회+ 연속 미납", value: `${risk2}명`, negative: risk2 > 0 },
    { label: "3회+ 연속 미납", value: `${risk3}명`, negative: risk3 > 0 },
  ];
  return (
    <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
      {cards.map(({ label, value, negative }) => (
        <div key={label} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
          <div className="mb-1 text-xs text-[var(--muted-foreground)]">{label}</div>
          <div
            className={`text-xl font-bold ${negative ? "text-[var(--negative)]" : "text-[var(--text)]"}`}
          >
            {value}
          </div>
        </div>
      ))}
    </div>
  );
}
