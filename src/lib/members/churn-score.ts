import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * 이탈 예측 점수 (heuristic).
 *
 * 신호별 가중치 (합 100점):
 *   - 최근 90일 결제 실패: 25점 (1+회 실패면 만점)
 *   - 90일 활동 없음: 20점 (마지막 결제일 기준)
 *   - 약정 일시정지/해지 이력 (최근 1년): 15점
 *   - 결제액 감소 추세 (최근 3개월 vs 이전 3개월): 15점
 *   - 영수증 미발급/미동의: 10점
 *   - 이메일 disabled: 10점
 *   - cheer/문의 없음 (전 기간): 5점
 *
 * cron이 매주 실행해 모든 회원 점수 갱신.
 */
export interface ChurnFactors {
  recent_failed_payments?: number;
  no_activity_90d?: number;
  recent_status_change?: number;
  amount_decline?: number;
  no_receipt?: number;
  email_disabled?: number;
  no_engagement?: number;
}

export interface ChurnResult {
  score: number;
  factors: ChurnFactors;
}

interface MemberSignals {
  email_disabled: boolean;
  receipt_opt_in: boolean | null;
  // payments: 최근 1년치
  payments: Array<{ pay_date: string; amount: number; pay_status: string }>;
  // promise status changes 최근 1년
  recentStatusChanges: number;
  // cheer/inquiry 카운트
  engagementCount: number;
}

export function computeChurnScore(signals: MemberSignals): ChurnResult {
  const factors: ChurnFactors = {};
  let score = 0;
  const now = Date.now();
  const day90 = 90 * 86400_000;
  const day365 = 365 * 86400_000;

  // 1. 최근 90일 결제 실패 (25)
  const recentFailed = signals.payments.filter((p) =>
    p.pay_status === "failed" &&
    now - new Date(p.pay_date).getTime() <= day90
  ).length;
  if (recentFailed > 0) {
    factors.recent_failed_payments = 25;
    score += 25;
  }

  // 2. 90일 활동 없음 (20)
  const lastActivity = signals.payments
    .filter((p) => p.pay_status === "paid")
    .map((p) => new Date(p.pay_date).getTime())
    .sort((a, b) => b - a)[0];
  if (!lastActivity || (now - lastActivity > day90)) {
    factors.no_activity_90d = 20;
    score += 20;
  }

  // 3. 약정 상태 변경 이력 (15)
  if (signals.recentStatusChanges > 0) {
    const v = Math.min(15, signals.recentStatusChanges * 7);
    factors.recent_status_change = v;
    score += v;
  }

  // 4. 결제액 감소 추세 (15)
  const day180 = 180 * 86400_000;
  const recent3m = signals.payments
    .filter((p) => p.pay_status === "paid" && now - new Date(p.pay_date).getTime() <= day90)
    .reduce((acc, p) => acc + Number(p.amount), 0);
  const prev3m = signals.payments
    .filter((p) =>
      p.pay_status === "paid" &&
      now - new Date(p.pay_date).getTime() > day90 &&
      now - new Date(p.pay_date).getTime() <= day180
    )
    .reduce((acc, p) => acc + Number(p.amount), 0);
  if (prev3m > 0 && recent3m < prev3m * 0.5) {
    factors.amount_decline = 15;
    score += 15;
  }

  // 5. 영수증 미동의 (10)
  if (signals.receipt_opt_in === false) {
    factors.no_receipt = 10;
    score += 10;
  }

  // 6. 이메일 disabled (10)
  if (signals.email_disabled) {
    factors.email_disabled = 10;
    score += 10;
  }

  // 7. engagement 0 (5)
  if (signals.engagementCount === 0) {
    factors.no_engagement = 5;
    score += 5;
  }

  // 마지막 1년 활동 기록 보강
  void day365;

  return { score: Math.min(100, score), factors };
}

/**
 * org 단위 일괄 갱신.
 */
export async function recomputeChurnScores(
  supabase: SupabaseClient,
  orgId: string,
): Promise<{ updated: number }> {
  const { data: members } = await supabase
    .from("members")
    .select("id, email_disabled, receipt_opt_in")
    .eq("org_id", orgId)
    .eq("status", "active");
  if (!members?.length) return { updated: 0 };

  // 365일 결제 이력
  const since = new Date(Date.now() - 365 * 86400_000).toISOString().slice(0, 10);
  const { data: pays } = await supabase
    .from("payments")
    .select("member_id, pay_date, amount, pay_status")
    .eq("org_id", orgId)
    .gte("pay_date", since);

  const paysByMember = new Map<string, Array<{ pay_date: string; amount: number; pay_status: string }>>();
  for (const p of (pays ?? []) as Array<{ member_id: string | null; pay_date: string | null; amount: number | null; pay_status: string }>) {
    if (!p.member_id || !p.pay_date) continue;
    const arr = paysByMember.get(p.member_id) ?? [];
    arr.push({ pay_date: p.pay_date, amount: Number(p.amount ?? 0), pay_status: p.pay_status });
    paysByMember.set(p.member_id, arr);
  }

  // promise status changes
  const sinceIso = new Date(Date.now() - 365 * 86400_000).toISOString();
  const { data: changes } = await supabase
    .from("promise_amount_changes")
    .select("member_id")
    .eq("org_id", orgId)
    .gte("created_at", sinceIso);
  const changeCount = new Map<string, number>();
  for (const c of (changes ?? []) as Array<{ member_id: string | null }>) {
    if (!c.member_id) continue;
    changeCount.set(c.member_id, (changeCount.get(c.member_id) ?? 0) + 1);
  }

  // engagement (cheer + inquiries)
  const [cheerRes, inqRes] = await Promise.all([
    supabase.from("cheers").select("member_id").eq("org_id", orgId),
    supabase.from("inquiries").select("member_id").eq("org_id", orgId),
  ]);
  const engagement = new Map<string, number>();
  for (const c of [...((cheerRes.data ?? []) as Array<{ member_id: string | null }>),
                   ...((inqRes.data ?? []) as Array<{ member_id: string | null }>)]) {
    if (!c.member_id) continue;
    engagement.set(c.member_id, (engagement.get(c.member_id) ?? 0) + 1);
  }

  let updated = 0;
  const nowIso = new Date().toISOString();
  for (const m of members as Array<{ id: string; email_disabled: boolean | null; receipt_opt_in: boolean | null }>) {
    const result = computeChurnScore({
      email_disabled: !!m.email_disabled,
      receipt_opt_in: m.receipt_opt_in,
      payments: paysByMember.get(m.id) ?? [],
      recentStatusChanges: changeCount.get(m.id) ?? 0,
      engagementCount: engagement.get(m.id) ?? 0,
    });
    const { error } = await supabase
      .from("members")
      .update({
        churn_score: result.score,
        churn_factors: result.factors,
        churn_score_at: nowIso,
      })
      .eq("id", m.id);
    if (!error) updated++;
  }

  return { updated };
}
