import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * G-D127: 후원자 lifecycle 단계 자동 분류.
 *
 * 기준 (기준일 = 오늘):
 *   - new:     created_at >= 기준일-30일
 *   - active:  최근 90일(기준일-90일) 내 paid payment 1건 이상
 *   - dormant: 최근 90~365일 paid 없음
 *   - churned: 365일 이상 paid 없음 + active 약정 없음
 *   - vip:     manual only (자동 분류 대상 아님)
 *
 * lifecycle_manual = true 인 회원은 자동 분류 대상에서 제외.
 */
export type LifecycleStage = "new" | "active" | "dormant" | "churned" | "vip";

export async function classifyMemberLifecycle(
  supabase: SupabaseClient,
  orgId: string,
  memberId: string,
  now: Date = new Date()
): Promise<Exclude<LifecycleStage, "vip"> | null> {
  const { data: member } = await supabase
    .from("members")
    .select("created_at, lifecycle_manual, deleted_at")
    .eq("id", memberId)
    .eq("org_id", orgId)
    .maybeSingle();

  if (!member || member.deleted_at || member.lifecycle_manual) return null;

  const createdMs = member.created_at
    ? new Date(member.created_at as string).getTime()
    : 0;
  const ageDays = Math.floor((now.getTime() - createdMs) / 86400000);
  if (ageDays <= 30) return "new";

  const since90 = new Date(now.getTime() - 90 * 86400000).toISOString();
  const { count: recentCount } = await supabase
    .from("payments")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .eq("member_id", memberId)
    .eq("pay_status", "paid")
    .gte("pay_date", since90.slice(0, 10));

  if ((recentCount ?? 0) > 0) return "active";

  const since365 = new Date(now.getTime() - 365 * 86400000).toISOString();
  const { count: midCount } = await supabase
    .from("payments")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .eq("member_id", memberId)
    .eq("pay_status", "paid")
    .gte("pay_date", since365.slice(0, 10));

  if ((midCount ?? 0) > 0) return "dormant";

  // 365일 이상 paid 없음 — active 약정 있으면 여전히 dormant
  const { count: activePromise } = await supabase
    .from("promises")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .eq("member_id", memberId)
    .in("status", ["active", "suspended", "pending_billing"]);

  if ((activePromise ?? 0) > 0) return "dormant";
  return "churned";
}

/**
 * org 전체에 대해 재분류. 한 번에 너무 많은 쿼리를 안 돌리도록 페이지 단위.
 * cron 에서 호출.
 */
export async function classifyAllForOrg(
  supabase: SupabaseClient,
  orgId: string,
  now: Date = new Date()
): Promise<{ scanned: number; updated: number }> {
  const { data } = await supabase
    .from("members")
    .select("id, lifecycle_stage, lifecycle_manual")
    .eq("org_id", orgId)
    .is("deleted_at", null);

  const rows = (data ?? []) as Array<{
    id: string;
    lifecycle_stage: LifecycleStage | null;
    lifecycle_manual: boolean;
  }>;

  let scanned = 0;
  let updated = 0;
  for (const row of rows) {
    scanned++;
    if (row.lifecycle_manual) continue;
    const next = await classifyMemberLifecycle(supabase, orgId, row.id, now);
    if (next && row.lifecycle_stage !== next) {
      await supabase
        .from("members")
        .update({
          lifecycle_stage: next,
          lifecycle_stage_updated_at: now.toISOString(),
        })
        .eq("id", row.id);
      updated++;
    }
  }
  return { scanned, updated };
}
