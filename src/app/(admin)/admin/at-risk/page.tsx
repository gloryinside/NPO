import { requireAdminUser } from "@/lib/auth";
import { requireTenant } from "@/lib/tenant/context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { fetchChurnRiskMembers, type ChurnRiskMember } from "@/lib/stats/churn-risk";
import { PageHeader } from "@/components/common/page-header";
import { StatCard } from "@/components/common/stat-card";
import { AtRiskList } from "@/components/admin/at-risk-list";

export const dynamic = "force-dynamic";

export default async function AtRiskPage() {
  await requireAdminUser();
  const tenant = await requireTenant();
  const supabase = createSupabaseAdminClient();

  const riskMembers = await fetchChurnRiskMembers(supabase, tenant.id);

  // 심각도 집계
  const critical = riskMembers.filter((m) => m.unpaidCount >= 3);
  const warning = riskMembers.filter((m) => m.unpaidCount === 2);

  const totalUnpaid = riskMembers.reduce((s, m) => s + m.totalUnpaid, 0);

  return (
    <div>
      <PageHeader
        title="이탈 위험 후원자"
        description="최근 6개월 내 미납·실패가 2회 이상인 후원자입니다. 적극적인 접촉으로 이탈을 예방하세요."
        stats={
          <>
            <StatCard
              label="총 위험 후원자"
              value={`${riskMembers.length.toLocaleString("ko-KR")}명`}
              tone={riskMembers.length > 0 ? "warning" : "default"}
            />
            <StatCard
              label="심각 (3회+)"
              value={`${critical.length}명`}
              tone={critical.length > 0 ? "negative" : "default"}
            />
            <StatCard
              label="주의 (2회)"
              value={`${warning.length}명`}
              tone={warning.length > 0 ? "warning" : "default"}
            />
            <StatCard
              label="미납 합계"
              value={`${totalUnpaid.toLocaleString("ko-KR")}원`}
              tone={totalUnpaid > 0 ? "negative" : "default"}
            />
          </>
        }
      />
      <AtRiskList members={riskMembers} />
    </div>
  );
}

export type { ChurnRiskMember };
