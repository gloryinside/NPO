import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireTenant } from "@/lib/tenant/context";
import { formatKRW, formatDateKR } from "@/lib/format";

type RecentPaymentRow = {
  id: string;
  amount: number | null;
  pay_date: string | null;
  members: { id: string; name: string } | null;
  campaigns: { id: string; title: string } | null;
};

type FailedPaymentRow = {
  id: string;
  fail_reason: string | null;
  pay_status: string;
};

type MonthlyRow = { month: string; total: number };

function getCurrentMonthRange(): { firstDay: string; nextFirstDay: string } {
  const nowKst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const year = nowKst.getUTCFullYear();
  const month = nowKst.getUTCMonth();
  const pad = (n: number) => String(n).padStart(2, "0");
  const firstDay = `${year}-${pad(month + 1)}-01`;
  const nextYear = month === 11 ? year + 1 : year;
  const nextMonth = month === 11 ? 0 : month + 1;
  const nextFirstDay = `${nextYear}-${pad(nextMonth + 1)}-01`;
  return { firstDay, nextFirstDay };
}

export default async function AdminDashboardPage() {
  let tenantId: string | null = null;
  try {
    const tenant = await requireTenant();
    tenantId = tenant.id;
  } catch {
    return (
      <div>
        <h1 className="text-2xl font-bold text-[var(--text)]">대시보드</h1>
        <p className="text-sm text-[var(--muted-foreground)] mt-1 mb-8">
          테넌트 정보를 확인할 수 없습니다.
        </p>
      </div>
    );
  }

  const supabase = createSupabaseAdminClient();
  const { firstDay, nextFirstDay } = getCurrentMonthRange();

  // 병렬 쿼리
  const [
    membersRes,
    monthAmountRes,
    campaignsRes,
    unpaidRes,
    recentRes,
    failedRes,
    monthlyRes,
    pendingIncomeRes,
  ] = await Promise.all([
    supabase
      .from("members")
      .select("*", { count: "exact", head: true })
      .eq("org_id", tenantId)
      .eq("status", "active"),
    supabase
      .from("payments")
      .select("amount")
      .eq("org_id", tenantId)
      .eq("pay_status", "paid")
      .gte("pay_date", firstDay)
      .lt("pay_date", nextFirstDay),
    supabase
      .from("campaigns")
      .select("*", { count: "exact", head: true })
      .eq("org_id", tenantId)
      .eq("status", "active"),
    // 미납 약정 계산
    supabase
      .from("payments")
      .select("*", { count: "exact", head: true })
      .eq("org_id", tenantId)
      .in("pay_status", ["unpaid", "failed"])
      .gte("pay_date", firstDay)
      .lt("pay_date", nextFirstDay),
    // 최근 납입 5건
    supabase
      .from("payments")
      .select("id, amount, pay_date, members(id, name), campaigns(id, title)")
      .eq("org_id", tenantId)
      .eq("pay_status", "paid")
      .order("pay_date", { ascending: false, nullsFirst: false })
      .range(0, 4),
    // 결제 오류 현황
    supabase
      .from("payments")
      .select("id, fail_reason, pay_status")
      .eq("org_id", tenantId)
      .in("pay_status", ["failed"])
      .gte("pay_date", firstDay)
      .lt("pay_date", nextFirstDay),
    // 월별 추이 (6개월)
    (() => {
      const d = new Date();
      d.setMonth(d.getMonth() - 5);
      const startStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
      return supabase
        .from("payments")
        .select("pay_date, amount")
        .eq("org_id", tenantId)
        .eq("pay_status", "paid")
        .gte("pay_date", startStr)
        .order("pay_date", { ascending: true });
    })(),
    // 수입대기 건수
    supabase
      .from("payments")
      .select("*", { count: "exact", head: true })
      .eq("org_id", tenantId)
      .eq("income_status", "pending")
      .eq("pay_status", "paid"),
  ]);

  const totalMembers = membersRes.count ?? 0;
  const monthAmount = (monthAmountRes.data ?? []).reduce(
    (acc: number, r: { amount: number | null }) => acc + Number(r.amount ?? 0),
    0
  );
  const activeCampaigns = campaignsRes.count ?? 0;
  const unpaidCount = unpaidRes.count ?? 0;
  const recentPayments = (recentRes.data as unknown as RecentPaymentRow[]) ?? [];
  const failedPayments = (failedRes.data as unknown as FailedPaymentRow[]) ?? [];
  const pendingIncomeCount = pendingIncomeRes.count ?? 0;

  // 월별 추이 집계
  const monthlyMap = new Map<string, number>();
  for (const row of (monthlyRes.data ?? []) as { pay_date: string; amount: number | null }[]) {
    const m = row.pay_date?.slice(0, 7);
    if (!m) continue;
    monthlyMap.set(m, (monthlyMap.get(m) ?? 0) + Number(row.amount ?? 0));
  }
  const monthlyData: MonthlyRow[] = Array.from(monthlyMap.entries())
    .map(([month, total]) => ({ month, total }))
    .sort((a, b) => a.month.localeCompare(b.month));
  const maxMonthly = Math.max(...monthlyData.map((r) => r.total), 1);

  // 결제 오류 분류
  const failReasonMap = new Map<string, number>();
  for (const f of failedPayments) {
    const reason = f.fail_reason ?? "알 수 없음";
    failReasonMap.set(reason, (failReasonMap.get(reason) ?? 0) + 1);
  }

  const kpiCards = [
    { title: "총 후원자 수", value: `${totalMembers.toLocaleString("ko-KR")}명` },
    { title: "이번 달 납입금액", value: formatKRW(monthAmount) },
    { title: "활성 캠���인", value: `${activeCampaigns}건` },
    { title: "미납/실패", value: `${unpaidCount}건`, negative: unpaidCount > 0 },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-[var(--text)]">대시보드</h1>
      <p className="text-sm text-[var(--muted-foreground)] mt-1 mb-8">
        안녕하세요. NPO 후원관리 대시보드입니다.
      </p>

      {/* KPI 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {kpiCards.map((card) => (
          <Card key={card.title} className="bg-[var(--surface)] border-[var(--border)]">
            <CardHeader className="pb-1">
              <CardTitle className="text-sm text-[var(--muted-foreground)]">
                {card.title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p
                className="text-2xl font-bold"
                style={{ color: card.negative ? "var(--negative)" : "var(--text)" }}
              >
                {card.value}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 월별 추이 차트 + 할 일 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        {/* 월별 추이 */}
        <Card className="bg-[var(--surface)] border-[var(--border)]">
          <CardHeader>
            <CardTitle className="text-sm text-[var(--muted-foreground)]">
              월별 납입 추이 (최근 6개월)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {monthlyData.length === 0 ? (
              <p className="text-sm text-[var(--muted-foreground)] text-center py-6">
                데이터가 없습니다.
              </p>
            ) : (
              <div className="flex items-end gap-3 h-32">
                {monthlyData.map((row) => {
                  const pct = Math.max((row.total / maxMonthly) * 100, 4);
                  return (
                    <div key={row.month} className="flex-1 flex flex-col items-center gap-1">
                      <span className="text-[10px] text-[var(--text)] font-medium">
                        {formatKRW(row.total)}
                      </span>
                      <div
                        className="w-full rounded-t"
                        style={{ height: `${pct}%`, background: "var(--accent)", minHeight: 4 }}
                      />
                      <span className="text-[10px] text-[var(--muted-foreground)]">
                        {row.month.slice(5)}월
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 오늘의 할 일 + 결제 오류 */}
        <Card className="bg-[var(--surface)] border-[var(--border)]">
          <CardHeader>
            <CardTitle className="text-sm text-[var(--muted-foreground)]">
              오늘의 할 일
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <TodoItem
              label="수입대기 처리"
              count={pendingIncomeCount}
              href="/admin/payments"
            />
            <TodoItem
              label="미납/���패 확인"
              count={unpaidCount}
              href="/admin/payments?status=failed"
            />
            {failReasonMap.size > 0 && (
              <div className="mt-2">
                <p className="text-xs text-[var(--muted-foreground)] mb-2">결제 오류 유형:</p>
                <div className="flex flex-wrap gap-2">
                  {Array.from(failReasonMap.entries()).map(([reason, cnt]) => (
                    <Badge
                      key={reason}
                      className="border-0 bg-[rgba(239,68,68,0.1)] text-[var(--negative)]"
                    >
                      {reason}: {cnt}건
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 최근 납입 */}
      {recentPayments.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold text-[var(--text)]">최근 납입 5건</h2>
          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)]">
            <ul>
              {recentPayments.map((p, idx) => (
                <li
                  key={p.id}
                  className={`flex items-center justify-between p-4 ${
                    idx === 0 ? "" : "border-t border-[var(--border)]"
                  }`}
                >
                  <div>
                    <div className="text-sm font-medium text-[var(--text)]">
                      {p.members?.name ?? "익명"}
                      {p.campaigns?.title ? (
                        <span className="ml-2 text-xs text-[var(--muted-foreground)]">
                          · {p.campaigns.title}
                        </span>
                      ) : null}
                    </div>
                    <div className="text-xs text-[var(--muted-foreground)]">
                      {formatDateKR(p.pay_date)}
                    </div>
                  </div>
                  <div className="text-sm font-semibold text-[var(--text)]">
                    {formatKRW(Number(p.amount ?? 0))}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}
    </div>
  );
}

function TodoItem({
  label,
  count,
  href,
}: {
  label: string;
  count: number;
  href: string;
}) {
  return (
    <a
      href={href}
      className="flex items-center justify-between rounded-lg border px-4 py-3 text-sm transition-colors hover:bg-[var(--surface-2)] border-[var(--border)] text-[var(--text)]"
      style={{ textDecoration: "none" }}
    >
      <span>{label}</span>
      <Badge
        className={`border-0 font-medium ${
          count > 0
            ? "bg-[var(--negative-soft)] text-[var(--negative)]"
            : "bg-[var(--positive-soft)] text-[var(--positive)]"
        }`}
      >
        {count}건
      </Badge>
    </a>
  );
}
