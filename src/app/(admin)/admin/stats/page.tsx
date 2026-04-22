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
import { computeInsights } from "@/lib/stats/insights";
import { InsightCard } from "@/components/admin/insight-card";
import { MonthlyPaymentChart } from "@/components/admin/charts/monthly-payment-chart";
import { MemberGrowthChart } from "@/components/admin/charts/member-growth-chart";
import { PayMethodPieChart } from "@/components/admin/charts/pay-method-pie-chart";
import { ChurnRateChart } from "@/components/admin/charts/churn-rate-chart";
import { CampaignPerformanceChart } from "@/components/admin/charts/campaign-performance-chart";

type MonthRow = { month: string; total: number; count: number };
type MemberGrowth = { month: string; joined: number; churned: number };
type ChurnRateRow = { month: string; total: number; failed: number; rate: number };
type CampaignSettlement = {
  campaignId: string | null;
  campaignTitle: string;
  paidCount: number;
  paidAmount: number;
  unpaidCount: number;
  unpaidAmount: number;
  rate: number;
};
import type { ChurnRiskMember } from "@/lib/stats/churn-risk";
import { fetchChurnRiskMembers as fetchChurnRiskMembersLib } from "@/lib/stats/churn-risk";
type MemberPayRow = {
  memberId: string;
  memberName: string;
  totalPaid: number;
  paidCount: number;
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

  const [joinedData, churnedData] = await Promise.all([
    supabase
      .from("members")
      .select("created_at")
      .eq("org_id", orgId)
      .gte("created_at", startStr)
      .order("created_at", { ascending: true }),
    supabase
      .from("members")
      .select("updated_at")
      .eq("org_id", orgId)
      .eq("status", "inactive")
      .gte("updated_at", startStr),
  ]);

  const joinMap = new Map<string, number>();
  for (const row of joinedData.data ?? []) {
    const month = (row.created_at as string)?.slice(0, 7);
    if (!month) continue;
    joinMap.set(month, (joinMap.get(month) ?? 0) + 1);
  }

  const churnMap = new Map<string, number>();
  for (const row of churnedData.data ?? []) {
    const month = (row.updated_at as string)?.slice(0, 7);
    if (!month) continue;
    churnMap.set(month, (churnMap.get(month) ?? 0) + 1);
  }

  const months = Array.from(new Set([...joinMap.keys(), ...churnMap.keys()])).sort();
  return months.map((month) => ({
    month,
    joined: joinMap.get(month) ?? 0,
    churned: churnMap.get(month) ?? 0,
  }));
}

async function fetchUnpaidStats(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  orgId: string
): Promise<{ count: number; total: number }> {
  const { data } = await supabase
    .from("payments")
    .select("amount")
    .eq("org_id", orgId)
    .in("pay_status", ["unpaid", "failed"]);

  const rows = data ?? [];
  return {
    count: rows.length,
    total: rows.reduce((s, r) => s + Number(r.amount ?? 0), 0),
  };
}

async function fetchIncomeStatusCounts(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  orgId: string
): Promise<{ pending: number; processing: number; confirmed: number; excluded: number }> {
  const { data } = await supabase
    .from("payments")
    .select("income_status")
    .eq("org_id", orgId);

  const counts = { pending: 0, processing: 0, confirmed: 0, excluded: 0 };
  for (const row of data ?? []) {
    const s = row.income_status as string;
    if (s === "pending") counts.pending++;
    else if (s === "processing") counts.processing++;
    else if (s === "confirmed") counts.confirmed++;
    else if (s === "excluded") counts.excluded++;
  }
  return counts;
}

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
    .gte("pay_date", startStr);

  const map = new Map<string, { total: number; failed: number }>();
  for (const row of data ?? []) {
    const month = (row.pay_date as string)?.slice(0, 7);
    if (!month) continue;
    const cur = map.get(month) ?? { total: 0, failed: 0 };
    cur.total += 1;
    if (row.pay_status === "failed" || row.pay_status === "unpaid") cur.failed += 1;
    map.set(month, cur);
  }

  return Array.from(map.entries())
    .map(([month, v]) => ({
      month,
      total: v.total,
      failed: v.failed,
      rate: v.total > 0 ? Math.round((v.failed / v.total) * 100) : 0,
    }))
    .sort((a, b) => a.month.localeCompare(b.month));
}

async function fetchCampaignSettlement(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  orgId: string
): Promise<CampaignSettlement[]> {
  const { data } = await supabase
    .from("payments")
    .select("campaign_id, campaigns(title), pay_status, amount")
    .eq("org_id", orgId);

  const map = new Map<
    string,
    { campaignId: string | null; campaignTitle: string; paidCount: number; paidAmount: number; unpaidCount: number; unpaidAmount: number }
  >();
  for (const row of data ?? []) {
    const cid = (row.campaign_id as string | null) ?? "__none__";
    const title = (row as Record<string, unknown>).campaigns
      ? ((row as Record<string, unknown>).campaigns as { title: string })?.title
      : "캠페인 없음";
    const cur = map.get(cid) ?? {
      campaignId: cid === "__none__" ? null : cid,
      campaignTitle: title ?? "캠페인 없음",
      paidCount: 0,
      paidAmount: 0,
      unpaidCount: 0,
      unpaidAmount: 0,
    };
    const amt = Number(row.amount ?? 0);
    if (row.pay_status === "paid") {
      cur.paidCount += 1;
      cur.paidAmount += amt;
    } else {
      cur.unpaidCount += 1;
      cur.unpaidAmount += amt;
    }
    map.set(cid, cur);
  }

  return Array.from(map.values())
    .map((c) => {
      const total = c.paidCount + c.unpaidCount;
      return { ...c, rate: total > 0 ? Math.round((c.paidCount / total) * 100) : 0 };
    })
    .sort((a, b) => b.paidAmount - a.paidAmount);
}

// fetchChurnRisk는 src/lib/stats/churn-risk.ts로 이전되어 cron과 공용.
// 기존 호출부는 fetchChurnRiskMembersLib(supabase, orgId) 사용.

async function fetchMemberPayRanking(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  orgId: string,
  from: string,
  to: string,
  method?: string
): Promise<MemberPayRow[]> {
  let query = supabase
    .from("payments")
    .select("member_id, amount, members(name)")
    .eq("org_id", orgId)
    .eq("pay_status", "paid")
    .gte("pay_date", from)
    .lte("pay_date", to);

  if (method) query = query.eq("pay_method", method);

  const { data } = await query;
  const map = new Map<string, MemberPayRow>();
  for (const row of data ?? []) {
    const mid = row.member_id as string;
    if (!mid) continue;
    const member = (row as Record<string, unknown>).members as { name: string } | null;
    const cur = map.get(mid) ?? {
      memberId: mid,
      memberName: member?.name ?? "알 수 없음",
      totalPaid: 0,
      paidCount: 0,
    };
    cur.totalPaid += Number(row.amount ?? 0);
    cur.paidCount += 1;
    map.set(mid, cur);
  }
  return Array.from(map.values()).sort((a, b) => b.totalPaid - a.totalPaid).slice(0, 50);
}

export default async function StatsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; from?: string; to?: string; method?: string }>;
}) {
  await requireAdminUser();
  const tenant = await requireTenant();
  const supabase = createSupabaseAdminClient();
  const { tab = "dashboard", from, to, method } = await searchParams;

  const tabs = [
    { key: "dashboard", label: "대시보드" },
    { key: "report", label: "리포트" },
    { key: "members", label: "회원별납부" },
  ];

  const tabLinks = (
    <div className="flex gap-1 border-b border-[var(--border)] mb-6">
      {tabs.map((t) => (
        <a
          key={t.key}
          href={`/admin/stats?tab=${t.key}`}
          className={[
            "px-4 py-2 text-sm font-medium transition-colors",
            tab === t.key
              ? "border-b-2 border-[var(--accent)] text-[var(--accent)]"
              : "text-[var(--muted-foreground)] hover:text-[var(--text)]",
          ].join(" ")}
        >
          {t.label}
        </a>
      ))}
    </div>
  );

  // ─── 대시보드 탭 ───────────────────────────────────────────────
  if (tab === "dashboard") {
    const [monthlyPayments, memberGrowth, unpaid, incomeStatus, churnRisk, churnRate, campaignSettlement] =
      await Promise.all([
        fetchMonthlyPayments(supabase, tenant.id),
        fetchMemberGrowth(supabase, tenant.id),
        fetchUnpaidStats(supabase, tenant.id),
        fetchIncomeStatusCounts(supabase, tenant.id),
        fetchChurnRiskMembersLib(supabase, tenant.id),
        fetchChurnRate(supabase, tenant.id),
        fetchCampaignSettlement(supabase, tenant.id),
      ]);

    // KPI 집계
    const totalPaidYear = monthlyPayments.reduce((s, r) => s + r.total, 0);
    const totalCountYear = monthlyPayments.reduce((s, r) => s + r.count, 0);
    const totalNewMembers = memberGrowth.reduce((s, r) => s + r.joined, 0);

    // 결제수단 파이 차트 데이터 조회
    const { data: methodRaw } = await supabase
      .from("payments")
      .select("pay_method")
      .eq("org_id", tenant.id)
      .eq("pay_status", "paid");
    const methodMap = new Map<string, number>();
    for (const row of methodRaw ?? []) {
      const m = (row.pay_method as string) ?? "기타";
      methodMap.set(m, (methodMap.get(m) ?? 0) + 1);
    }
    const methodPieData = Array.from(methodMap.entries()).map(([name, value]) => ({ name, value }));

    // 활성 회원 수 조회 (Insight 계산용)
    const { count: activeMemberCount } = await supabase
      .from("members")
      .select("*", { count: "exact", head: true })
      .eq("org_id", tenant.id)
      .eq("status", "active");

    // 미발급 영수증 수 조회 (Insight 계산용)
    const { count: pendingReceiptCount } = await supabase
      .from("donation_receipts")
      .select("*", { count: "exact", head: true })
      .eq("org_id", tenant.id)
      .eq("status", "pending");

    // CMS 처리 중 건수 조회 (Insight 계산용)
    const { count: cmsProcessingCount } = await supabase
      .from("payments")
      .select("*", { count: "exact", head: true })
      .eq("org_id", tenant.id)
      .eq("pay_method", "cms")
      .eq("pay_status", "processing");

    // Insight 계산
    const curMonth = churnRate[churnRate.length - 1];
    const prevMonth = churnRate[churnRate.length - 2];
    const curNew = memberGrowth[memberGrowth.length - 1]?.joined ?? 0;
    const prevNew = memberGrowth[memberGrowth.length - 2]?.joined ?? 0;
    const bestCamp = campaignSettlement.length > 0 ? campaignSettlement[0] : null;

    const insights = computeInsights({
      currentUnpaidRate: curMonth?.rate ?? 0,
      prevUnpaidRate: prevMonth?.rate ?? 0,
      churnRiskCount: churnRisk.length,
      activeMemberCount: activeMemberCount ?? 0,
      currentNewMembers: curNew,
      prevNewMembers: prevNew,
      pendingReceiptCount: pendingReceiptCount ?? 0,
      currentMonth: new Date().getMonth() + 1,
      cmsProcessingCount: cmsProcessingCount ?? 0,
      bestCampaign: bestCamp ? { title: bestCamp.campaignTitle, rate: bestCamp.rate } : null,
    });

    return (
      <div>
        <h1 className="text-2xl font-bold text-[var(--text)] mb-1">통계 / 보고서</h1>
        <p className="text-sm text-[var(--muted-foreground)] mb-6">최근 12개월 후원 현황</p>
        {tabLinks}

        {/* Insight 카드 */}
        {insights.length > 0 && (
          <div className="flex flex-col gap-3 mb-6">
            {insights.map((insight) => (
              <InsightCard key={insight.id} insight={insight} />
            ))}
          </div>
        )}

        {/* KPI 카드 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <SummaryCard title="연간 납입액" value={formatKRW(totalPaidYear)} />
          <SummaryCard title="납입 건수" value={`${totalCountYear.toLocaleString("ko-KR")}건`} />
          <SummaryCard title="신규 후원자" value={`${totalNewMembers}명`} />
          <SummaryCard
            title="미납/실패"
            value={`${unpaid.count}건 (${formatKRW(unpaid.total)})`}
            negative
          />
        </div>

        {/* 차트 2×2 그리드 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <Card className="bg-[var(--surface)] border-[var(--border)]">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-[var(--muted-foreground)]">월별 납입 추이</CardTitle>
            </CardHeader>
            <CardContent>
              {monthlyPayments.length === 0 ? (
                <p className="text-sm text-[var(--muted-foreground)] text-center py-8">데이터가 없습니다.</p>
              ) : (
                <MonthlyPaymentChart data={monthlyPayments} />
              )}
            </CardContent>
          </Card>

          <Card className="bg-[var(--surface)] border-[var(--border)]">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-[var(--muted-foreground)]">회원 증감 추이</CardTitle>
            </CardHeader>
            <CardContent>
              {memberGrowth.length === 0 ? (
                <p className="text-sm text-[var(--muted-foreground)] text-center py-8">데이터가 없습니다.</p>
              ) : (
                <MemberGrowthChart data={memberGrowth} />
              )}
            </CardContent>
          </Card>

          <Card className="bg-[var(--surface)] border-[var(--border)]">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-[var(--muted-foreground)]">결제수단 분포</CardTitle>
            </CardHeader>
            <CardContent>
              {methodPieData.length === 0 ? (
                <p className="text-sm text-[var(--muted-foreground)] text-center py-8">데이터가 없습니다.</p>
              ) : (
                <PayMethodPieChart data={methodPieData} />
              )}
            </CardContent>
          </Card>

          <Card className="bg-[var(--surface)] border-[var(--border)]">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-[var(--muted-foreground)]">
                월별 이탈율
                <span className="ml-1 font-normal text-xs">(미납+실패 / 전체)</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {churnRate.length === 0 ? (
                <p className="text-sm text-[var(--muted-foreground)] text-center py-8">데이터가 없습니다.</p>
              ) : (
                <ChurnRateChart data={churnRate} />
              )}
            </CardContent>
          </Card>
        </div>

        {/* 캠페인별 납입 성과 (horizontal bar) */}
        <Card className="bg-[var(--surface)] border-[var(--border)] mb-6">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-[var(--muted-foreground)]">캠페인별 납입 성과</CardTitle>
          </CardHeader>
          <CardContent>
            {campaignSettlement.length === 0 ? (
              <p className="text-sm text-[var(--muted-foreground)] text-center py-8">데이터가 없습니다.</p>
            ) : (
              <CampaignPerformanceChart data={campaignSettlement} />
            )}
          </CardContent>
        </Card>

        {/* 기금별 정산 테이블 */}
        <Card className="bg-[var(--surface)] border-[var(--border)] mb-6">
          <CardHeader>
            <CardTitle className="text-sm text-[var(--muted-foreground)]">
              기금별 정산 ({campaignSettlement.length}개 캠페인)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {campaignSettlement.length === 0 ? (
              <p className="text-sm text-[var(--muted-foreground)] text-center py-8">데이터가 없습니다.</p>
            ) : (
              <div className="rounded-lg border border-[var(--border)] overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border)] bg-[var(--surface-2)]">
                      <th className="text-left px-4 py-2 text-xs font-medium text-[var(--muted-foreground)]">캠페인</th>
                      <th className="text-right px-4 py-2 text-xs font-medium text-[var(--muted-foreground)]">완납액</th>
                      <th className="text-center px-4 py-2 text-xs font-medium text-[var(--muted-foreground)]">완납 건수</th>
                      <th className="text-right px-4 py-2 text-xs font-medium text-[var(--muted-foreground)]">미납액</th>
                      <th className="text-center px-4 py-2 text-xs font-medium text-[var(--muted-foreground)]">미납 건수</th>
                      <th className="text-right px-4 py-2 text-xs font-medium text-[var(--muted-foreground)]">수납율</th>
                    </tr>
                  </thead>
                  <tbody>
                    {campaignSettlement.map((c, idx) => (
                      <tr key={c.campaignId ?? "__none__"} className={idx > 0 ? "border-t border-[var(--border)]" : ""}>
                        <td className="px-4 py-3 font-medium text-[var(--text)]">
                          {c.campaignId ? (
                            <a href="/admin/campaigns" className="hover:underline text-[var(--accent)]">
                              {c.campaignTitle}
                            </a>
                          ) : (
                            <span className="text-[var(--muted-foreground)]">{c.campaignTitle}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-[var(--positive)]">
                          {formatKRW(c.paidAmount)}
                        </td>
                        <td className="px-4 py-3 text-center text-xs text-[var(--muted-foreground)]">
                          {c.paidCount.toLocaleString("ko-KR")}건
                        </td>
                        <td className={`px-4 py-3 text-right font-medium ${c.unpaidAmount > 0 ? "text-[var(--negative)]" : "text-[var(--muted-foreground)]"}`}>
                          {c.unpaidAmount > 0 ? formatKRW(c.unpaidAmount) : "-"}
                        </td>
                        <td className="px-4 py-3 text-center text-xs text-[var(--muted-foreground)]">
                          {c.unpaidCount > 0 ? `${c.unpaidCount.toLocaleString("ko-KR")}건` : "-"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={[
                            "text-xs font-semibold px-2 py-0.5 rounded",
                            c.rate >= 90
                              ? "bg-[var(--positive)]/10 text-[var(--positive)]"
                              : c.rate >= 70
                                ? "bg-[var(--warning)]/10 text-[var(--warning)]"
                                : "bg-[var(--negative)]/10 text-[var(--negative)]",
                          ].join(" ")}>
                            {c.rate}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 이탈 위험 후원자 */}
        <Card className="bg-[var(--surface)] border-[var(--border)]">
          <CardHeader>
            <CardTitle className="text-sm text-[var(--muted-foreground)]">
              이탈 위험 후원자 ({churnRisk.length}명)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {churnRisk.length === 0 ? (
              <p className="text-sm text-center py-6 text-[var(--positive)]">✓ 이탈 위험 후원자가 없습니다.</p>
            ) : (
              <>
                <p className="text-xs mb-4 text-[var(--muted-foreground)]">
                  최근 6개월 내 2회 이상 미납/실패한 후원자입니다. 조기 상담을 권장합니다.
                </p>
                <div className="rounded-lg border border-[var(--border)] overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[var(--border)] bg-[var(--surface-2)]">
                        <th className="text-left px-4 py-2 text-xs font-medium text-[var(--muted-foreground)]">후원자</th>
                        <th className="text-center px-4 py-2 text-xs font-medium text-[var(--muted-foreground)]">미납 횟수</th>
                        <th className="text-right px-4 py-2 text-xs font-medium text-[var(--muted-foreground)]">미납 금액</th>
                        <th className="text-center px-4 py-2 text-xs font-medium text-[var(--muted-foreground)]">최근 미납일</th>
                        <th className="px-4 py-2 text-xs font-medium text-[var(--muted-foreground)]">상세</th>
                      </tr>
                    </thead>
                    <tbody>
                      {churnRisk.map((m, idx) => (
                        <tr key={m.memberId} className={idx > 0 ? "border-t border-[var(--border)]" : ""}>
                          <td className="px-4 py-3">
                            <div className="font-medium text-[var(--text)]">{m.memberName}</div>
                            {m.memberPhone && (
                              <div className="text-xs text-[var(--muted-foreground)]">{m.memberPhone}</div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={[
                              "text-xs font-semibold px-2 py-0.5 rounded",
                              m.unpaidCount >= 3 ? "bg-[var(--negative)]/10 text-[var(--negative)]" : "bg-[var(--warning)]/10 text-[var(--warning)]",
                            ].join(" ")}>
                              {m.unpaidCount}회
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-[var(--negative)]">
                            {formatKRW(m.totalUnpaid)}
                          </td>
                          <td className="px-4 py-3 text-center text-xs text-[var(--muted-foreground)]">
                            {m.lastPayDate ?? "-"}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <a
                              href={`/admin/members/${m.memberId}`}
                              className="text-xs px-2 py-1 rounded border border-[var(--border)] text-[var(--text)] no-underline"
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

  // ─── 리포트 탭 ─────────────────────────────────────────────────
  if (tab === "report") {
    const defaultFrom = (() => {
      const d = new Date();
      d.setMonth(d.getMonth() - 11);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
    })();
    const defaultTo = new Date().toISOString().slice(0, 10);
    const fromStr = from ?? defaultFrom;
    const toStr = to ?? defaultTo;

    const { data: reportData } = await supabase
      .from("payments")
      .select("pay_date, amount, pay_status, pay_method")
      .eq("org_id", tenant.id)
      .gte("pay_date", fromStr)
      .lte("pay_date", toStr)
      .order("pay_date", { ascending: true });

    type MonthReport = { month: string; paid: number; paidAmt: number; unpaid: number; unpaidAmt: number; rate: number };
    const reportMap = new Map<string, MonthReport>();
    for (const row of reportData ?? []) {
      const month = (row.pay_date as string)?.slice(0, 7);
      if (!month) continue;
      const cur = reportMap.get(month) ?? { month, paid: 0, paidAmt: 0, unpaid: 0, unpaidAmt: 0, rate: 0 };
      const amt = Number(row.amount ?? 0);
      if (row.pay_status === "paid") { cur.paid += 1; cur.paidAmt += amt; }
      else { cur.unpaid += 1; cur.unpaidAmt += amt; }
      reportMap.set(month, cur);
    }
    const reportRows = Array.from(reportMap.values()).map((r) => {
      const total = r.paid + r.unpaid;
      return { ...r, rate: total > 0 ? Math.round((r.paid / total) * 100) : 0 };
    }).sort((a, b) => a.month.localeCompare(b.month));

    return (
      <div>
        <h1 className="text-2xl font-bold text-[var(--text)] mb-1">통계 / 보고서</h1>
        <p className="text-sm text-[var(--muted-foreground)] mb-6">기간별 납입 내역</p>
        {tabLinks}

        <form method="get" className="flex flex-wrap gap-3 items-center mb-6">
          <input type="hidden" name="tab" value="report" />
          <div className="flex items-center gap-2">
            <label className="text-xs text-[var(--muted-foreground)]">시작일</label>
            <input
              type="date"
              name="from"
              defaultValue={fromStr}
              title="조회 시작일"
              className="text-sm border border-[var(--border)] rounded px-2 py-1 bg-[var(--surface)] text-[var(--text)]"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-[var(--muted-foreground)]">종료일</label>
            <input
              type="date"
              name="to"
              defaultValue={toStr}
              title="조회 종료일"
              className="text-sm border border-[var(--border)] rounded px-2 py-1 bg-[var(--surface)] text-[var(--text)]"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-[var(--muted-foreground)]">결제수단</label>
            <select
              name="method"
              defaultValue={method ?? ""}
              title="결제수단 필터"
              className="text-sm border border-[var(--border)] rounded px-2 py-1 bg-[var(--surface)] text-[var(--text)]"
            >
              <option value="">전체</option>
              <option value="cms">CMS</option>
              <option value="card">카드</option>
              <option value="transfer">계좌이체</option>
            </select>
          </div>
          <button
            type="submit"
            className="text-sm px-3 py-1 rounded bg-[var(--accent)] text-white font-medium"
          >
            조회
          </button>
        </form>

        {reportRows.length === 0 ? (
          <p className="text-sm text-[var(--muted-foreground)] text-center py-12">
            해당 기간에 데이터가 없습니다.
          </p>
        ) : (
          <Card className="bg-[var(--surface)] border-[var(--border)]">
            <CardContent className="p-0">
              <div className="rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border)] bg-[var(--surface-2)]">
                      <th className="text-left px-4 py-2 text-xs font-medium text-[var(--muted-foreground)]">월</th>
                      <th className="text-right px-4 py-2 text-xs font-medium text-[var(--muted-foreground)]">완납액</th>
                      <th className="text-center px-4 py-2 text-xs font-medium text-[var(--muted-foreground)]">완납 건수</th>
                      <th className="text-right px-4 py-2 text-xs font-medium text-[var(--muted-foreground)]">미납액</th>
                      <th className="text-center px-4 py-2 text-xs font-medium text-[var(--muted-foreground)]">미납 건수</th>
                      <th className="text-right px-4 py-2 text-xs font-medium text-[var(--muted-foreground)]">수납율</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportRows.map((r, idx) => (
                      <tr key={r.month} className={idx > 0 ? "border-t border-[var(--border)]" : ""}>
                        <td className="px-4 py-3 font-medium text-[var(--text)]">{r.month}</td>
                        <td className="px-4 py-3 text-right font-semibold text-[var(--positive)]">{formatKRW(r.paidAmt)}</td>
                        <td className="px-4 py-3 text-center text-xs text-[var(--muted-foreground)]">{r.paid.toLocaleString("ko-KR")}건</td>
                        <td className={`px-4 py-3 text-right ${r.unpaidAmt > 0 ? "text-[var(--negative)]" : "text-[var(--muted-foreground)]"}`}>
                          {r.unpaidAmt > 0 ? formatKRW(r.unpaidAmt) : "-"}
                        </td>
                        <td className="px-4 py-3 text-center text-xs text-[var(--muted-foreground)]">
                          {r.unpaid > 0 ? `${r.unpaid}건` : "-"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={[
                            "text-xs font-semibold px-2 py-0.5 rounded",
                            r.rate >= 90 ? "bg-[var(--positive)]/10 text-[var(--positive)]"
                              : r.rate >= 70 ? "bg-[var(--warning)]/10 text-[var(--warning)]"
                              : "bg-[var(--negative)]/10 text-[var(--negative)]",
                          ].join(" ")}>
                            {r.rate}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-[var(--border)] bg-[var(--surface-2)]">
                      <td className="px-4 py-3 text-xs font-semibold text-[var(--muted-foreground)]">합계</td>
                      <td className="px-4 py-3 text-right font-bold text-[var(--positive)]">
                        {formatKRW(reportRows.reduce((s, r) => s + r.paidAmt, 0))}
                      </td>
                      <td className="px-4 py-3 text-center text-xs text-[var(--muted-foreground)]">
                        {reportRows.reduce((s, r) => s + r.paid, 0).toLocaleString("ko-KR")}건
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-[var(--negative)]">
                        {formatKRW(reportRows.reduce((s, r) => s + r.unpaidAmt, 0))}
                      </td>
                      <td className="px-4 py-3 text-center text-xs text-[var(--muted-foreground)]">
                        {reportRows.reduce((s, r) => s + r.unpaid, 0)}건
                      </td>
                      <td className="px-4 py-3"></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  // ─── 회원별납부 탭 (기본) ─────────────────────────────────────
  const defaultFrom = (() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 11);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  })();
  const defaultTo = new Date().toISOString().slice(0, 10);
  const fromStr = from ?? defaultFrom;
  const toStr = to ?? defaultTo;

  const memberRows = await fetchMemberPayRanking(supabase, tenant.id, fromStr, toStr, method);

  return (
    <div>
      <h1 className="text-2xl font-bold text-[var(--text)] mb-1">통계 / 보고서</h1>
      <p className="text-sm text-[var(--muted-foreground)] mb-6">회원별 납부 현황 (상위 50명)</p>
      {tabLinks}

      <form method="get" className="flex flex-wrap gap-3 items-center mb-6">
        <input type="hidden" name="tab" value="members" />
        <div className="flex items-center gap-2">
          <label className="text-xs text-[var(--muted-foreground)]">시작일</label>
          <input
            type="date"
            name="from"
            defaultValue={fromStr}
            title="조회 시작일"
            className="text-sm border border-[var(--border)] rounded px-2 py-1 bg-[var(--surface)] text-[var(--text)]"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-[var(--muted-foreground)]">종료일</label>
          <input
            type="date"
            name="to"
            defaultValue={toStr}
            title="조회 종료일"
            className="text-sm border border-[var(--border)] rounded px-2 py-1 bg-[var(--surface)] text-[var(--text)]"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-[var(--muted-foreground)]">결제수단</label>
          <select
            name="method"
            defaultValue={method ?? ""}
            title="결제수단 필터"
            className="text-sm border border-[var(--border)] rounded px-2 py-1 bg-[var(--surface)] text-[var(--text)]"
          >
            <option value="">전체</option>
            <option value="cms">CMS</option>
            <option value="card">카드</option>
            <option value="transfer">계좌이체</option>
          </select>
        </div>
        <button
          type="submit"
          className="text-sm px-3 py-1 rounded bg-[var(--accent)] text-white font-medium"
        >
          조회
        </button>
      </form>

      {memberRows.length === 0 ? (
        <p className="text-sm text-[var(--muted-foreground)] text-center py-12">
          해당 기간에 데이터가 없습니다.
        </p>
      ) : (
        <Card className="bg-[var(--surface)] border-[var(--border)]">
          <CardContent className="p-0">
            <div className="rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] bg-[var(--surface-2)]">
                    <th className="text-center px-4 py-2 text-xs font-medium text-[var(--muted-foreground)] w-10">순위</th>
                    <th className="text-left px-4 py-2 text-xs font-medium text-[var(--muted-foreground)]">회원명</th>
                    <th className="text-right px-4 py-2 text-xs font-medium text-[var(--muted-foreground)]">납부액</th>
                    <th className="text-center px-4 py-2 text-xs font-medium text-[var(--muted-foreground)]">납부 건수</th>
                    <th className="px-4 py-2 w-10 text-xs font-medium text-[var(--muted-foreground)]">상세</th>
                  </tr>
                </thead>
                <tbody>
                  {memberRows.map((m, idx) => (
                    <tr key={m.memberId} className={idx > 0 ? "border-t border-[var(--border)]" : ""}>
                      <td className="px-4 py-3 text-center text-xs text-[var(--muted-foreground)]">{idx + 1}</td>
                      <td className="px-4 py-3 font-medium text-[var(--text)]">{m.memberName}</td>
                      <td className="px-4 py-3 text-right font-semibold text-[var(--positive)]">
                        {formatKRW(m.totalPaid)}
                      </td>
                      <td className="px-4 py-3 text-center text-xs text-[var(--muted-foreground)]">
                        {m.paidCount.toLocaleString("ko-KR")}건
                      </td>
                      <td className="px-4 py-3 text-right">
                        <a
                          href={`/admin/members/${m.memberId}`}
                          className="text-xs px-2 py-1 rounded border border-[var(--border)] text-[var(--text)] no-underline"
                        >
                          →
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
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
        <p className={`text-xl font-bold ${negative ? "text-[var(--negative)]" : "text-[var(--text)]"}`}>
          {value}
        </p>
      </CardContent>
    </Card>
  );
}
