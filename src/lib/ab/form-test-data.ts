import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { assignVariant, compareVariants, isVisitorId, type AbResult, type AbVariant, type ActiveTest, type VariantSettings } from "./form-test";

export function hashVisitor(visitorId: string): string {
  return createHash("sha256").update(visitorId).digest("hex").slice(0, 32);
}

/** 이 캠페인에서 진행 중인 실험 */
export async function runningTest(supabase: SupabaseClient, orgId: string, campaignId: string): Promise<ActiveTest | null> {
  const { data } = await supabase
    .from("form_ab_tests")
    .select("id, variants")
    .eq("org_id", orgId)
    .eq("campaign_id", campaignId)
    .eq("status", "running")
    .maybeSingle();
  return data ? { id: data.id, variants: data.variants as VariantSettings[] } : null;
}

/**
 * 신청에 붙일 실험·안 — 안은 클라이언트가 보낸 값을 믿지 않고 방문자 id로 다시 정한다.
 * 실험이 끝났거나 다른 캠페인 것이면 붙이지 않는다(신청은 그대로 받는다).
 */
export async function resolveAbTag(
  supabase: SupabaseClient,
  orgId: string,
  campaignId: string,
  testId: unknown,
  visitorId: unknown,
): Promise<{ ab_test_id: string; ab_variant: AbVariant } | null> {
  if (typeof testId !== "string" || !isVisitorId(visitorId)) return null;
  const test = await runningTest(supabase, orgId, campaignId);
  if (!test || test.id !== testId) return null;
  return { ab_test_id: test.id, ab_variant: assignVariant(test.id, visitorId) };
}

export type AbStats = Record<AbVariant, {
  views: number;
  onetime: number;
  onetimeAmount: number;
  regular: number;
  regularMonthly: number;
}> & { result: AbResult };

/** 노출·신청 집계 — 일시후원은 결제 완료, 정기후원은 시작된 약정 */
export async function loadAbStats(supabase: SupabaseClient, orgId: string, testId: string): Promise<AbStats> {
  const count = async (variant: AbVariant) => {
    const { count: n } = await supabase
      .from("form_ab_views")
      .select("test_id", { count: "exact", head: true })
      .eq("org_id", orgId)
      .eq("test_id", testId)
      .eq("variant", variant);
    return n ?? 0;
  };
  const [viewsA, viewsB, { data: pays }, { data: proms }] = await Promise.all([
    count("A"),
    count("B"),
    supabase.from("payments").select("ab_variant, amount").eq("org_id", orgId).eq("ab_test_id", testId).eq("pay_status", "paid").is("promise_id", null).limit(10000),
    supabase.from("promises").select("ab_variant, amount").eq("org_id", orgId).eq("ab_test_id", testId).eq("status", "active").limit(10000),
  ]);
  const base = () => ({ views: 0, onetime: 0, onetimeAmount: 0, regular: 0, regularMonthly: 0 });
  const s = { A: { ...base(), views: viewsA }, B: { ...base(), views: viewsB } };
  for (const p of (pays ?? []) as { ab_variant: AbVariant; amount: number }[]) {
    s[p.ab_variant].onetime += 1;
    s[p.ab_variant].onetimeAmount += Number(p.amount ?? 0);
  }
  for (const p of (proms ?? []) as { ab_variant: AbVariant; amount: number }[]) {
    s[p.ab_variant].regular += 1;
    s[p.ab_variant].regularMonthly += Number(p.amount ?? 0);
  }
  const toStats = (v: AbVariant) => ({
    views: s[v].views,
    conversions: s[v].onetime + s[v].regular,
    amount: s[v].onetimeAmount + s[v].regularMonthly,
  });
  return { ...s, result: compareVariants(toStats("A"), toStats("B")) };
}
