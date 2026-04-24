import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * 기념품 발송 큐 자동 채우기.
 *
 * - cumulative_amount: 회원의 paid 누적이 trigger_value 이상이면 추가
 * - years_active: 첫 paid 결제일로부터 N년 이상이면 추가
 * - single_payment: 단건 paid 결제 중 trigger_value 이상이 있으면 추가
 *
 * UNIQUE (member_id, rule_id) 제약으로 중복 방지 — 이미 큐/발송된 회원은 자동 스킵.
 */
export async function buildGiftQueue(
  supabase: SupabaseClient,
  orgId: string,
): Promise<{ queued: number }> {
  const { data: rules } = await supabase
    .from("gift_rules")
    .select("id, trigger_type, trigger_value, gift_name")
    .eq("org_id", orgId)
    .eq("active", true);

  if (!rules?.length) return { queued: 0 };

  // 기존 발송 이력 (중복 방지용 in-memory 캐시)
  const { data: existing } = await supabase
    .from("gift_shipments")
    .select("member_id, rule_id")
    .eq("org_id", orgId);
  const existingSet = new Set(
    (existing ?? []).map((r: { member_id: string; rule_id: string | null }) =>
      `${r.member_id}:${r.rule_id ?? ''}`,
    ),
  );

  // 회원별 paid 합계 + 단건 최대 + 첫 결제일
  const { data: pays } = await supabase
    .from("payments")
    .select("member_id, amount, pay_date")
    .eq("org_id", orgId)
    .eq("pay_status", "paid");

  type Stats = { total: number; max: number; firstDate: string | null };
  const stats = new Map<string, Stats>();
  for (const p of (pays ?? []) as Array<{
    member_id: string | null;
    amount: number | null;
    pay_date: string | null;
  }>) {
    if (!p.member_id) continue;
    const cur = stats.get(p.member_id) ?? { total: 0, max: 0, firstDate: null };
    cur.total += Number(p.amount ?? 0);
    cur.max = Math.max(cur.max, Number(p.amount ?? 0));
    if (p.pay_date && (!cur.firstDate || p.pay_date < cur.firstDate)) {
      cur.firstDate = p.pay_date;
    }
    stats.set(p.member_id, cur);
  }

  const today = new Date();
  const inserts: Array<Record<string, unknown>> = [];

  for (const rule of rules as Array<{
    id: string;
    trigger_type: 'cumulative_amount' | 'years_active' | 'single_payment';
    trigger_value: number;
    gift_name: string;
  }>) {
    for (const [memberId, s] of stats) {
      if (existingSet.has(`${memberId}:${rule.id}`)) continue;

      let triggered = false;
      let triggerValue: number = 0;

      if (rule.trigger_type === "cumulative_amount" && s.total >= rule.trigger_value) {
        triggered = true;
        triggerValue = s.total;
      } else if (rule.trigger_type === "single_payment" && s.max >= rule.trigger_value) {
        triggered = true;
        triggerValue = s.max;
      } else if (rule.trigger_type === "years_active" && s.firstDate) {
        const first = new Date(s.firstDate);
        const years = (today.getTime() - first.getTime()) / (365.25 * 86400_000);
        if (years >= rule.trigger_value) {
          triggered = true;
          triggerValue = years;
        }
      }

      if (triggered) {
        inserts.push({
          org_id: orgId,
          member_id: memberId,
          rule_id: rule.id,
          gift_name: rule.gift_name,
          trigger_value: triggerValue,
          status: "queued",
        });
      }
    }
  }

  if (!inserts.length) return { queued: 0 };

  // bulk insert (UNIQUE 위반은 무시)
  const { error } = await supabase.from("gift_shipments").insert(inserts);
  if (error && error.code !== "23505") {
    console.error(`[gift-queue] insert failed for ${orgId}:`, error.message);
  }
  return { queued: inserts.length };
}
