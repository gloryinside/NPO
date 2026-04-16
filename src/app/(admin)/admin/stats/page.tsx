import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireAdminUser } from "@/lib/auth";
import { requireTenant } from "@/lib/tenant/context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { formatKRW } from "@/lib/format";

type MonthRow = { month: string; total: number; count: number };
type MemberGrowth = { month: string; joined: number };
type ChurnRateRow = { month: string; total: number; failed: number; rate: number };
type CampaignSettlement = {
  campaignId: string | null;
  campaignTitle: string;
  paidCount: number;
  paidAmount: number;
  unpaidCount: number;
  unpaidAmount: number;
};
type ChurnRiskMember = {
  memberId: string;
  memberName: string;
  memberPhone: string | null;
  unpaidCount: number;
  lastPayDate: string | null;
  totalUnpaid: number;
};

async function fetchMonthlyPayments(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  orgId: string
): Promise<MonthRow[]> {
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - 11);
  const startStr = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, "0")}-01`;

  const { data } = await supabase
    .from("payments")
    .select("pay_date, amount")
    .eq("org_id", orgId)
    .eq("pay_status", "paid")
    .gte("pay_date", startStr)
    .order("pay_date", { ascending: true });

  const map = new Map<string, { total: number; count: number }>();
  for (const row of data ?? []) {
    const month = (row.pay_date as string)?.slice(0, 7);
    if (!month) continue;
    const cur = map.get(month) ?? { total: 0, count: 0 };
    cur.total += Number(row.amount ?? 0);
    cur.count += 1;
    map.set(month, cur);
  }

  return Array.from(map.entries())
    .map(([month, v]) => ({ month, ...v }))
    .sort((a, b) => a.month.localeCompare(b.month));
}

async function fetchMemberGrowth(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  orgId: string
): Promise<MemberGrowth[]> {
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - 11);
  const startStr = startDate.toISOString();

  const { data } = await supabase
    .from("members")
    .select("created_at")
    .eq("org_id", orgId)
    .gte("created_at", startStr)
    .order("created_at", { ascending: true });

  const map = new Map<string, number>();
  for (const row of data ?? []) {
    const month = (row.created_at as string)?.slice(0, 7);
    if (!month) continue;
    map.set(month, (map.get(month) ?? 0) + 1);
  }

  return Array.from(map.entries())
    .map(([month, joined]) => ({ month, joined }))
    .sort((a, b) => a.month.localeCompare(b.month));
}

async function fetchUnpaidStats(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  orgId: string
) {
  const { data, count } = await supabase
    .from("payments")
    .select("amount", { count: "exact" })
    .eq("org_id", orgId)
    .in("pay_status", ["unpaid", "failed"]);

  const total = (data ?? []).reduce(
    (s, r) => s + Number((r as { amount: number }).amount ?? 0),
    0
  );
  return { count: count ?? 0, total };
}

async function fetchIncomeStatusCounts(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  orgId: string
) {
  const statuses = ["pending", "processing", "confirmed", "excluded"] as const;
  const result: Record<string, number> = {};
  for (const s of statuses) {
    const { count } = await supabase
      .from("payments")
      .select("*", { count: "exact", head: true })
      .eq("org_id", orgId)
      .eq("income_status", s);
    result[s] = count ?? 0;
  }
  return result;
}

/**
 * 월별 이탈율: (미납+실패 건수 / 전체 청구 건수) × 100
 * pending/processing 등 아직 결제 대기 건은 제외하고 확정 건만 집계.
 */
async function fetchChurnRate(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  orgId: string
): Promise<ChurnRateRow[]> {
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - 11);
  const startStr = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, "0")}-01`;

  const { data } = await supabase
    .from("payments")
    .select("pay_date, pay_status")
    .eq("org_id", orgId)
    .in("pay_status", ["paid", "unpaid", "failed", "cancelled", "refunded"])
    .gte("pay_date", startStr)
    .order("pay_date", { ascending: true });

  const map = new Map<string, { total: number; failed: number }>();
  for (const row of data ?? []) {
    const month = (row.pay_date as string)?.slice(0, 7);
    if (!month) continue;
    const cur = map.get(month) ?? { total: 0, failed: 0 };
    cur.total += 1;
    if (row.pay_status === "unpaid" || row.pay_status === "failed") {
      cur.failed += 1;
    }
    map.set(month, cur);
  }

  return Array.from(map.entries())
    .map(([month, v]) => ({
      month,
      total: v.total,
      failed: v.failed,
      rate: v.total > 0 ? Math.round((v.failed / v.total) * 1000) / 10 : 0,
    }))
    .sort((a, b) => a.month.localeCompare(b.month));
}

/**
 * 기금별 정산: 캠페인별로 paid/unpaid 금액과 건수를 집계.
 * campaign_id가 null인 건은 '일반 후원'으로 묶음.
 */
async function fetchCampaignSettlement(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  orgId: string
): Promise<CampaignSettlement[]> {
  const { data } = await supabase
    .from("payments")
    .select("campaign_id, pay_status, amount, campaigns(id, title)")
    .eq("org_id", orgId)
    .in("pay_status", ["paid", "unpaid", "failed"]);

  type Row = {
    campaign_id: string | null;
    pay_status: string;
    amount: number | null;
    campaigns: { id: string; title: string } | null;
  };

  const rows = (data as unknown as Row[]) ?? [];

  const map = new Map<
    string,
    {
      campaignId: string | null;
      campaignTitle: string;
      paidCount: number;
      paidAmount: number;
      unpaidCount: number;
      unpaidAmount: number;
    }
  >();

  for (const r of rows) {
    const key = r.campaign_id ?? "__none__";
    const title = r.campaigns?.title ?? "일반 후원";
    const cur = map.get(key) ?? {
      campaignId: r.campaign_id,
      campaignTitle: title,
      paidCount: 0,
      paidAmount: 0,
      unpaidCount: 0,
      unpaidAmount: 0,
    };
    const amt = Number(r.amount ?? 0);
    if (r.pay_status === "paid") {
      cur.paidCount += 1;
      cur.paidAmount += amt;
    } else {
      cur.unpaidCount += 1;
      cur.unpaidAmount += amt;
    }
    map.set(key, cur);
  }

  return Array.from(map.values()).sort((a, b) => b.paidAmount - a.paidAmount);
}

/**
 * 이탈 위험 후원자: 최근 2개월 이상 연속으로 미납/실패한 약정 보유 후원자.
 * payments 테이블에서 pay_status in ('unpaid','failed') 인 건 중
 * 동일 member_id 에 2건 이상인 회원을 집계.
 */
async function fetchChurnRisk(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  orgId: string
): Promise<ChurnRiskMember[]> {
  // 최근 6개월 미납/실패 건 조회
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const since = sixMonthsAgo.toISOString().slice(0, 10);

  const { data } = await supabase
    .from("payments")
    .select("member_id, amount, pay_date, members!inner(id, name, phone)")
    .eq("org_id", orgId)
    .in("pay_status", ["unpaid", "failed"])
    .gte("pay_date", since)
    .order("pay_date", { ascending: false });

  type Row = {
    member_id: string;
    amount: number | null;
    pay_date: string | null;
    members: { id: string; name: string; phone: string | null } | null;
  };

  const rows = (data as unknown as Row[]) ?? [];

  const map = new Map<
    string,
    {
      name: string;
      phone: string | null;
      count: number;
      total: number;
      lastDate: string | null;
    }
  >();

  for (const r of rows) {
    if (!r.member_id || !r.members) continue;
    const cur = map.get(r.member_id) ?? {
      name: r.members.name,
      phone: r.members.phone,
      count: 0,
      total: 0,
      lastDate: null,
    };
    cur.count += 1;
    cur.total += Number(r.amount ?? 0);
    if (!cur.lastDate || (r.pay_date && r.pay_date > cur.lastDate)) {
      cur.lastDate = r.pay_date;
    }
    map.set(r.member_id, cur);
  }

  // 2건 이상 미납인 회원만, 최근 미납일 내림차순
  return Array.from(map.entries())
    .filter(([, v]) => v.count >= 2)
    .map(([memberId, v]) => ({
      memberId,
      memberName: v.name,
      memberPhone: v.phone,
      unpaidCount: v.count,
      lastPayDate: v.lastDate,
      totalUnpaid: v.total,
    }))
    .sort((a, b) => (b.lastPayDate ?? "").localeCompare(a.lastPayDate ?? ""));
}

export default async function StatsPage() {
  await requireAdminUser();
  const tenant = await requireTenant();
  const supabase = createSupabaseAdminClient();

  const [monthlyPayments, memberGrowth, unpaid, incomeStatus, churnRisk, churnRate, campaignSettlement] =
    await Promise.all([
      fetchMonthlyPayments(supabase, tenant.id),
      fetchMemberGrowth(supabase, tenant.id),
      fetchUnpaidStats(supabase, tenant.id),
      fetchIncomeStatusCounts(supabase, tenant.id),
      fetchChurnRisk(supabase, tenant.id),
      fetchChurnRate(supabase, tenant.id),
      fetchCampaignSettlement(supabase, tenant.id),
    ]);

  const totalPaidYear = monthlyPayments.reduce((s, r) => s + r.total, 0);
  const totalCountYear = monthlyPayments.reduce((s, r) => s + r.count, 0);
  const totalNewMembers = memberGrowth.reduce((s, r) => s + r.joined, 0);
  const maxMonthly = Math.max(...monthlyPayments.map((r) => r.total), 1);

  return (
    <div>
      <h1 className="text-2xl font-bold text-[var(--text)] mb-1">통계 / 보고서</h1>
      <p className="text-sm text-[var(--muted-foreground)] mb-8">
        최근 12개월 후원 현황
      </p>

      {/* 요약 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <SummaryCard title="연간 납입액" value={formatKRW(totalPaidYear)} />
        <SummaryCard title="납입 건수" value={`${totalCountYear.toLocaleString("ko-KR")}건`} />
        <SummaryCard title="신규 후원자" value={`${totalNewMembers}명`} />
        <SummaryCard
          title="미납/실패"
          value={`${unpaid.count}건 (${formatKRW(unpaid.total)})`}
          negative
        />
      </div>

      {/* 월별 납입 추이 (CSS bar chart) */}
      <Card className="bg-[var(--surface)] border-[var(--border)] mb-8">
        <CardHeader>
          <CardTitle className="text-sm text-[var(--muted-foreground)]">월별 납입 추이</CardTitle>
        </CardHeader>
        <CardContent>
          {monthlyPayments.length === 0 ? (
            <p className="text-sm text-[var(--muted-foreground)] text-center py-8">
              데이터가 없습니다.
            </p>
          ) : (
            <div className="flex items-end gap-2 h-40">
              {monthlyPayments.map((row) => {
                const pct = Math.max((row.total / maxMonthly) * 100, 4);
                return (
                  <div
                    key={row.month}
                    className="flex-1 flex flex-col items-center gap-1"
                  >
                    <span className="text-xs text-[var(--text)] font-medium">
                      {formatKRW(row.total)}
                    </span>
                    <div
                      className="w-full rounded-t"
                      style={{
                        height: `${pct}%`,
                        background: "var(--accent)",
                        minHeight: 4,
                      }}
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

      {/* 후원자 증감 */}
      <Card className="bg-[var(--surface)] border-[var(--border)] mb-8">
        <CardHeader>
          <CardTitle className="text-sm text-[var(--muted-foreground)]">월별 신규 후원자</CardTitle>
        </CardHeader>
        <CardContent>
          {memberGrowth.length === 0 ? (
            <p className="text-sm text-[var(--muted-foreground)] text-center py-8">
              데이터가 없습니다.
            </p>
          ) : (
            <div className="flex items-end gap-2 h-32">
              {memberGrowth.map((row) => {
                const maxG = Math.max(...memberGrowth.map((r) => r.joined), 1);
                const pct = Math.max((row.joined / maxG) * 100, 4);
                return (
                  <div key={row.month} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-xs text-[var(--text)] font-medium">
                      {row.joined}
                    </span>
                    <div
                      className="w-full rounded-t"
                      style={{
                        height: `${pct}%`,
                        background: "var(--positive)",
                        minHeight: 4,
                      }}
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

      {/* 수입상태 분포 */}
      <Card className="bg-[var(--surface)] border-[var(--border)] mb-8">
        <CardHeader>
          <CardTitle className="text-sm text-[var(--muted-foreground)]">수입상태 분포</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatusCard label="수입대기" count={incomeStatus.pending} />
            <StatusCard label="수입진행" count={incomeStatus.processing} color="var(--accent)" />
            <StatusCard label="수입완료" count={incomeStatus.confirmed} color="var(--positive)" />
            <StatusCard label="수입제외" count={incomeStatus.excluded} color="var(--warning)" />
          </div>
        </CardContent>
      </Card>

      {/* 월별 이탈율 추이 */}
      <Card className="bg-[var(--surface)] border-[var(--border)] mb-8">
        <CardHeader>
          <CardTitle className="text-sm text-[var(--muted-foreground)]">
            월별 이탈율 추이 (미납+실패 / 전체 청구)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {churnRate.length === 0 ? (
            <p className="text-sm text-[var(--muted-foreground)] text-center py-8">
              데이터가 없습니다.
            </p>
          ) : (
            <>
              <div className="flex items-end gap-2 h-36">
                {churnRate.map((row) => {
                  const maxRate = Math.max(...churnRate.map((r) => r.rate), 1);
                  const pct = Math.max((row.rate / maxRate) * 100, 4);
                  const isHigh = row.rate >= 20;
                  return (
                    <div key={row.month} className="flex-1 flex flex-col items-center gap-1">
                      <span
                        className="text-xs font-medium"
                        style={{ color: isHigh ? "var(--negative)" : "var(--text)" }}
                      >
                        {row.rate}%
                      </span>
                      <div
                        className="w-full rounded-t"
                        style={{
                          height: `${pct}%`,
                          background: isHigh ? "var(--negative)" : "rgba(245,158,11,0.7)",
                          minHeight: 4,
                        }}
                      />
                      <span className="text-[10px] text-[var(--muted-foreground)]">
                        {row.month.slice(5)}월
                      </span>
                    </div>
                  );
                })}
              </div>
              <p className="mt-3 text-xs text-[var(--muted-foreground)]">
                * 20% 이상인 달은 빨간색으로 표시됩니다.
              </p>
            </>
          )}
        </CardContent>
      </Card>

      {/* 기금별 정산 */}
      <Card className="bg-[var(--surface)] border-[var(--border)] mb-8">
        <CardHeader>
          <CardTitle className="text-sm text-[var(--muted-foreground)]">
            기금별 정산 ({campaignSettlement.length}개 캠페인)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {campaignSettlement.length === 0 ? (
            <p className="text-sm text-[var(--muted-foreground)] text-center py-8">
              데이터가 없습니다.
            </p>
          ) : (
            <div className="rounded-lg border overflow-hidden" style={{ borderColor: "var(--border)" }}>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border)", background: "var(--surface-2)" }}>
                    <th className="text-left px-4 py-2 text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>
                      캠페인
                    </th>
                    <th className="text-right px-4 py-2 text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>
                      완납액
                    </th>
                    <th className="text-center px-4 py-2 text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>
                      완납 건수
                    </th>
                    <th className="text-right px-4 py-2 text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>
                      미납액
                    </th>
                    <th className="text-center px-4 py-2 text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>
                      미납 건수
                    </th>
                    <th className="text-right px-4 py-2 text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>
                      수납율
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {campaignSettlement.map((c, idx) => {
                    const totalCount = c.paidCount + c.unpaidCount;
                    const collectionRate = totalCount > 0
                      ? Math.round((c.paidCount / totalCount) * 100)
                      : 0;
                    return (
                      <tr
                        key={c.campaignId ?? "__none__"}
                        style={{ borderTop: idx > 0 ? "1px solid var(--border)" : undefined }}
                      >
                        <td className="px-4 py-3 font-medium" style={{ color: "var(--text)" }}>
                          {c.campaignId ? (
                            <a
                              href={`/admin/campaigns`}
                              className="hover:underline"
                              style={{ color: "var(--accent)" }}
                            >
                              {c.campaignTitle}
                            </a>
                          ) : (
                            <span style={{ color: "var(--muted-foreground)" }}>{c.campaignTitle}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold" style={{ color: "var(--positive)" }}>
                          {formatKRW(c.paidAmount)}
                        </td>
                        <td className="px-4 py-3 text-center text-xs" style={{ color: "var(--muted-foreground)" }}>
                          {c.paidCount.toLocaleString("ko-KR")}건
                        </td>
                        <td className="px-4 py-3 text-right font-medium" style={{ color: c.unpaidAmount > 0 ? "var(--negative)" : "var(--muted-foreground)" }}>
                          {c.unpaidAmount > 0 ? formatKRW(c.unpaidAmount) : "-"}
                        </td>
                        <td className="px-4 py-3 text-center text-xs" style={{ color: "var(--muted-foreground)" }}>
                          {c.unpaidCount > 0 ? `${c.unpaidCount.toLocaleString("ko-KR")}건` : "-"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span
                            className="text-xs font-semibold px-2 py-0.5 rounded"
                            style={{
                              background: collectionRate >= 90
                                ? "rgba(34,197,94,0.12)"
                                : collectionRate >= 70
                                  ? "rgba(245,158,11,0.12)"
                                  : "rgba(239,68,68,0.12)",
                              color: collectionRate >= 90
                                ? "var(--positive)"
                                : collectionRate >= 70
                                  ? "var(--warning)"
                                  : "var(--negative)",
                            }}
                          >
                            {collectionRate}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 이탈 위험 경보 (Churn Risk) */}
      <Card className="bg-[var(--surface)] border-[var(--border)]">
        <CardHeader>
          <CardTitle className="text-sm text-[var(--muted-foreground)]">
            이탈 위험 후원자 ({churnRisk.length}명)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {churnRisk.length === 0 ? (
            <p className="text-sm text-center py-6" style={{ color: "var(--positive)" }}>
              ✓ 이탈 위험 후원자가 없습니다.
            </p>
          ) : (
            <>
              <p className="text-xs mb-4" style={{ color: "var(--muted-foreground)" }}>
                최근 6개월 내 2회 이상 미납/실패한 후원자입니다. 조기 상담을 권장합니다.
              </p>
              <div className="rounded-lg border overflow-hidden" style={{ borderColor: "var(--border)" }}>
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--border)", background: "var(--surface-2)" }}>
                      <th className="text-left px-4 py-2 text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>후원자</th>
                      <th className="text-center px-4 py-2 text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>미납 횟수</th>
                      <th className="text-right px-4 py-2 text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>미납 금액</th>
                      <th className="text-center px-4 py-2 text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>최근 미납일</th>
                      <th className="px-4 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {churnRisk.map((m, idx) => (
                      <tr
                        key={m.memberId}
                        style={{
                          borderTop: idx > 0 ? "1px solid var(--border)" : undefined,
                        }}
                      >
                        <td className="px-4 py-3">
                          <div className="font-medium" style={{ color: "var(--text)" }}>{m.memberName}</div>
                          {m.memberPhone && (
                            <div className="text-xs" style={{ color: "var(--muted-foreground)" }}>{m.memberPhone}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className="text-xs font-semibold px-2 py-0.5 rounded"
                            style={{
                              background: m.unpaidCount >= 3 ? "rgba(239,68,68,0.12)" : "rgba(234,179,8,0.12)",
                              color: m.unpaidCount >= 3 ? "var(--negative)" : "var(--warning)",
                            }}
                          >
                            {m.unpaidCount}회
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-semibold" style={{ color: "var(--negative)" }}>
                          {formatKRW(m.totalUnpaid)}
                        </td>
                        <td className="px-4 py-3 text-center text-xs" style={{ color: "var(--muted-foreground)" }}>
                          {m.lastPayDate ?? "-"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <a
                            href={`/admin/members/${m.memberId}`}
                            className="text-xs px-2 py-1 rounded border"
                            style={{
                              borderColor: "var(--border)",
                              color: "var(--text)",
                              textDecoration: "none",
                            }}
                          >
                            상세 →
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryCard({
  title,
  value,
  negative,
}: {
  title: string;
  value: string;
  negative?: boolean;
}) {
  return (
    <Card className="bg-[var(--surface)] border-[var(--border)]">
      <CardHeader className="pb-1">
        <CardTitle className="text-sm text-[var(--muted-foreground)]">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p
          className="text-xl font-bold"
          style={{ color: negative ? "var(--negative)" : "var(--text)" }}
        >
          {value}
        </p>
      </CardContent>
    </Card>
  );
}

function StatusCard({
  label,
  count,
  color,
}: {
  label: string;
  count: number;
  color?: string;
}) {
  return (
    <div className="rounded-lg border border-[var(--border)] p-4 text-center">
      <div className="text-sm text-[var(--muted-foreground)] mb-1">{label}</div>
      <div
        className="text-2xl font-bold"
        style={{ color: color ?? "var(--muted-foreground)" }}
      >
        {count.toLocaleString("ko-KR")}
      </div>
    </div>
  );
}
