export type InsightSeverity = "danger" | "warning" | "positive" | "info";

export type Insight = {
  id: string;
  severity: InsightSeverity;
  title: string;
  message: string;
  actionLabel?: string;
  actionHref?: string;
};

export type InsightInput = {
  /** 이번 달 미납율 (%) */
  currentUnpaidRate: number;
  /** 전월 미납율 (%) */
  prevUnpaidRate: number;
  /** 이탈 위험 회원 수 */
  churnRiskCount: number;
  /** 전체 활성 회원 수 */
  activeMemberCount: number;
  /** 이번 달 신규 회원 수 */
  currentNewMembers: number;
  /** 전월 신규 회원 수 */
  prevNewMembers: number;
  /** 미발급 영수증 수 */
  pendingReceiptCount: number;
  /** 현재 월 (1-12) */
  currentMonth: number;
  /** CMS 처리 중 건수 */
  cmsProcessingCount: number;
  /** 수납율 1위 캠페인 */
  bestCampaign: { title: string; rate: number } | null;
};

export function computeInsights(input: InsightInput): Insight[] {
  const insights: Insight[] = [];

  // 1. 미납율 급등
  const unpaidDiff = input.currentUnpaidRate - input.prevUnpaidRate;
  if (unpaidDiff >= 5) {
    insights.push({
      id: "unpaid_spike",
      severity: "danger",
      title: "미납율 급등",
      message: `이번 달 미납율이 전월보다 ${unpaidDiff.toFixed(1)}%p 올랐습니다. 미납자 현황을 확인하세요.`,
      actionLabel: "미납자 현황 →",
      actionHref: "/admin/unpaid",
    });
  }

  // 2. 이탈 위험 후원자 비율
  if (input.activeMemberCount > 0) {
    const churnPct = (input.churnRiskCount / input.activeMemberCount) * 100;
    if (churnPct >= 5) {
      insights.push({
        id: "churn_risk_high",
        severity: "danger",
        title: "이탈 위험 후원자 증가",
        message: `이탈 위험 후원자가 전체의 ${churnPct.toFixed(1)}%입니다 (${input.churnRiskCount}명). 조기 상담을 권장합니다.`,
        actionLabel: "미납자 현황 →",
        actionHref: "/admin/unpaid",
      });
    }
  }

  // 3. 신규 회원 감소
  if (input.prevNewMembers > 0 && input.currentNewMembers < input.prevNewMembers * 0.7) {
    const dropPct = Math.round((1 - input.currentNewMembers / input.prevNewMembers) * 100);
    insights.push({
      id: "new_member_drop",
      severity: "warning",
      title: "신규 후원자 감소",
      message: `신규 후원자가 전월 대비 ${dropPct}% 감소했습니다. 캠페인 현황을 점검하세요.`,
      actionLabel: "캠페인 관리 →",
      actionHref: "/admin/campaigns",
    });
  }

  // 4. 연말정산 시즌 미발급 영수증
  if (input.pendingReceiptCount > 0 && input.currentMonth === 1) {
    insights.push({
      id: "receipt_pending",
      severity: "warning",
      title: "연말정산 시즌",
      message: `미발급 영수증이 ${input.pendingReceiptCount}명 있습니다. 일괄 발급을 진행하세요.`,
      actionLabel: "영수증 관리 →",
      actionHref: "/admin/receipts",
    });
  }

  // 5. CMS 처리 중
  if (input.cmsProcessingCount > 0) {
    insights.push({
      id: "cms_processing",
      severity: "info",
      title: "CMS 당월 처리 진행 중",
      message: `CMS 처리 대기 중인 건수: ${input.cmsProcessingCount}건`,
      actionLabel: "당월처리현황 →",
      actionHref: "/admin/payments?tab=monthly",
    });
  }

  // 6. 최고 수납율 캠페인
  if (input.bestCampaign && input.bestCampaign.rate >= 90) {
    insights.push({
      id: "best_campaign",
      severity: "positive",
      title: "이달 최고 성과 캠페인",
      message: `'${input.bestCampaign.title}' 수납율 ${input.bestCampaign.rate}% — 이달 최고 성과입니다.`,
      actionLabel: "캠페인 관리 →",
      actionHref: "/admin/campaigns",
    });
  }

  // 7. 모두 양호
  if (insights.length === 0) {
    insights.push({
      id: "all_good",
      severity: "positive",
      title: "후원 현황 안정",
      message: `이번 달 후원 현황이 안정적입니다. 미납율 ${input.currentUnpaidRate.toFixed(1)}%, 신규 후원자 ${input.currentNewMembers}명.`,
    });
  }

  return insights;
}
