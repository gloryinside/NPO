import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * G-D144: LTV / CAC / cohort retention 계산.
 *
 * 범위:
 *   - LTV: 멤버별 paid 결제 누적 합계의 중앙값·평균
 *   - CAC: 캠페인별 지출(광고비 등)은 DB에 없음 → 신규 후원자 1인 당 "유입 비용" 계산은
 *          기관이 별도 입력해야 의미가 있다. 본 함수는 신규 후원자 수와 첫 후원 중앙값만 계산.
 *   - Cohort retention: 가입월 기준 cohort × N개월 후 유지율(= 해당 기간 내 추가 paid 1건+)
 *
 * 계산 편의상 전 org 단위(single tenant per call). 최대 24개월 범위.
 */

export interface LtvSummary {
  totalDonors: number;
  ltvAverage: number;
  ltvMedian: number;
  firstDonationMedian: number;
  newDonorsInWindow: number;
}

export interface CohortCell {
  cohort: string; // YYYY-MM
  size: number;
  retention: Record<string, number>; // '1m' | '3m' | '6m' | '12m' → 유지율(0~1)
}

export async function calcLtv(
  supabase: SupabaseClient,
  orgId: string,
  windowMonths = 24
): Promise<LtvSummary> {
  const since = new Date();
  since.setUTCMonth(since.getUTCMonth() - windowMonths);
  const sinceIso = since.toISOString();

  const { data: members } = await supabase
    .from("members")
    .select("id, created_at")
    .eq("org_id", orgId)
    .is("deleted_at", null);
  const memberRows = (members ?? []) as Array<{ id: string; created_at: string }>;

  const { data: payments } = await supabase
    .from("payments")
    .select("member_id, amount, pay_date")
    .eq("org_id", orgId)
    .eq("pay_status", "paid");
  const payRows = (payments ?? []) as Array<{
    member_id: string | null;
    amount: number | null;
    pay_date: string | null;
  }>;

  const sumByMember = new Map<string, number>();
  const firstByMember = new Map<string, number>();
  for (const p of payRows) {
    if (!p.member_id || !p.amount) continue;
    sumByMember.set(p.member_id, (sumByMember.get(p.member_id) ?? 0) + Number(p.amount));
    if (!firstByMember.has(p.member_id)) {
      firstByMember.set(p.member_id, Number(p.amount));
    }
  }

  const ltvValues = [...sumByMember.values()];
  const firstValues = [...firstByMember.values()];

  const ltvAverage =
    ltvValues.length > 0
      ? Math.round(ltvValues.reduce((s, v) => s + v, 0) / ltvValues.length)
      : 0;
  const ltvMedian = median(ltvValues);
  const firstDonationMedian = median(firstValues);

  const newDonors = memberRows.filter((m) => m.created_at >= sinceIso).length;

  return {
    totalDonors: sumByMember.size,
    ltvAverage,
    ltvMedian,
    firstDonationMedian,
    newDonorsInWindow: newDonors,
  };
}

export async function calcCohorts(
  supabase: SupabaseClient,
  orgId: string,
  windowMonths = 12
): Promise<CohortCell[]> {
  const since = new Date();
  since.setUTCMonth(since.getUTCMonth() - windowMonths);
  const sinceIso = since.toISOString();

  const { data: members } = await supabase
    .from("members")
    .select("id, created_at")
    .eq("org_id", orgId)
    .gte("created_at", sinceIso);
  const memberRows = (members ?? []) as Array<{ id: string; created_at: string }>;

  const memberIds = memberRows.map((m) => m.id);
  if (memberIds.length === 0) return [];

  const { data: payments } = await supabase
    .from("payments")
    .select("member_id, pay_date")
    .eq("org_id", orgId)
    .eq("pay_status", "paid")
    .in("member_id", memberIds);
  const payRows = (payments ?? []) as Array<{
    member_id: string | null;
    pay_date: string | null;
  }>;

  // cohort = gathered-by-month of created_at
  const byCohort = new Map<string, string[]>();
  const memberCohort = new Map<string, string>();
  for (const m of memberRows) {
    const key = m.created_at.slice(0, 7);
    memberCohort.set(m.id, key);
    const list = byCohort.get(key) ?? [];
    list.push(m.id);
    byCohort.set(key, list);
  }

  // paid 이벤트에서 member별 가장 먼 지점까지의 개월수
  const lastMonthByMember = new Map<string, number>();
  for (const p of payRows) {
    if (!p.member_id || !p.pay_date) continue;
    const cohort = memberCohort.get(p.member_id);
    if (!cohort) continue;
    const diff = monthsBetween(cohort, p.pay_date.slice(0, 7));
    const prev = lastMonthByMember.get(p.member_id) ?? 0;
    if (diff > prev) lastMonthByMember.set(p.member_id, diff);
  }

  const buckets = [1, 3, 6, 12];
  const cells: CohortCell[] = [];
  for (const [cohort, ids] of [...byCohort.entries()].sort()) {
    const retention: Record<string, number> = {};
    for (const b of buckets) {
      const retained = ids.filter(
        (id) => (lastMonthByMember.get(id) ?? 0) >= b
      ).length;
      retention[`${b}m`] = ids.length ? retained / ids.length : 0;
    }
    cells.push({ cohort, size: ids.length, retention });
  }
  return cells;
}

function median(vs: number[]): number {
  if (vs.length === 0) return 0;
  const sorted = [...vs].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1]! + sorted[mid]!) / 2)
    : sorted[mid]!;
}

function monthsBetween(a: string, b: string): number {
  // a, b = 'YYYY-MM'
  const [ya, ma] = a.split("-").map(Number);
  const [yb, mb] = b.split("-").map(Number);
  if (
    !ya ||
    !ma ||
    !yb ||
    !mb
  )
    return 0;
  return (yb - ya) * 12 + (mb - ma);
}
