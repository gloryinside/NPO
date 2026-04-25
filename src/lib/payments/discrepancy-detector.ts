import type { SupabaseClient } from "@supabase/supabase-js";
import crypto from "node:crypto";

/**
 * 정산 차이 감지기.
 *
 * 검사 항목:
 *   1. 중복결제: 같은 (member_id, amount, campaign_id) 가 60초 이내 paid 2건 이상
 *   2. 누락정산: paid + income_status='confirmed' 인데 deposit_date NULL
 *   3. 정체불명입금: bank_statements 인데 matched_payment_id NULL이고 7일 경과
 *
 * 결과는 settlement_discrepancies 테이블에 INSERT.
 */

export function computeDedupHash(memberId: string, amount: number, campaignId: string | null, bucketMinutes: number = 1): string {
  // 1분 버킷에 같은 (member, amount, campaign) 이면 같은 hash
  const bucket = Math.floor(Date.now() / (bucketMinutes * 60_000));
  return crypto
    .createHash("sha256")
    .update(`${memberId}:${amount}:${campaignId ?? ""}:${bucket}`)
    .digest("hex")
    .slice(0, 16);
}

export async function detectDiscrepancies(
  supabase: SupabaseClient,
  orgId: string,
): Promise<{ duplicates: number; missing: number; orphans: number }> {
  const today = new Date().toISOString().slice(0, 10);
  let duplicates = 0; let missing = 0; let orphans = 0;

  // 1. 중복결제 — 최근 24시간 내 같은 member_id + amount + campaign_id 가 2건 이상
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { data: recent } = await supabase
    .from("payments")
    .select("id, member_id, amount, campaign_id, pay_status, created_at")
    .eq("org_id", orgId)
    .eq("pay_status", "paid")
    .gte("created_at", since);

  type R = { id: string; member_id: string; amount: number; campaign_id: string | null; created_at: string };
  const list = (recent ?? []) as R[];

  // 그룹핑
  const groups = new Map<string, R[]>();
  for (const r of list) {
    const k = `${r.member_id}:${r.amount}:${r.campaign_id ?? ""}`;
    const arr = groups.get(k) ?? [];
    arr.push(r);
    groups.set(k, arr);
  }

  for (const [, arr] of groups) {
    if (arr.length < 2) continue;
    // 같은 그룹 안에서 60초 이내 결제가 있는지
    arr.sort((a, b) => a.created_at.localeCompare(b.created_at));
    for (let i = 0; i < arr.length - 1; i++) {
      const t1 = new Date(arr[i]!.created_at).getTime();
      const t2 = new Date(arr[i + 1]!.created_at).getTime();
      if (t2 - t1 <= 60_000) {
        // 이미 등록된 discrepancy 가 있는지 확인
        const ids = arr.slice(i, i + 2).map((p) => p.id);
        const { data: existing } = await supabase
          .from("settlement_discrepancies")
          .select("id")
          .eq("org_id", orgId)
          .eq("discrepancy_type", "duplicate_payment")
          .contains("related_payment_ids", ids)
          .maybeSingle();
        if (existing) continue;
        await supabase.from("settlement_discrepancies").insert({
          org_id: orgId,
          discrepancy_type: "duplicate_payment",
          related_payment_ids: ids,
          amount_expected: arr[i]!.amount,
          amount_actual: arr[i]!.amount * 2,
          detected_date: today,
        });
        duplicates++;
        break; // 그룹당 한 번만
      }
    }
  }

  // 2. 누락정산: confirmed 7일 전 인데 deposit_date NULL
  const cutoff = new Date(Date.now() - 7 * 86400_000).toISOString().slice(0, 10);
  const { data: missingRows } = await supabase
    .from("payments")
    .select("id, amount, pay_date")
    .eq("org_id", orgId)
    .eq("pay_status", "paid")
    .eq("income_status", "confirmed")
    .is("deposit_date", null)
    .lte("pay_date", cutoff)
    .limit(100);
  for (const m of (missingRows ?? []) as Array<{ id: string; amount: number }>) {
    const { data: ex } = await supabase
      .from("settlement_discrepancies")
      .select("id").eq("org_id", orgId)
      .eq("discrepancy_type", "missing_settlement")
      .contains("related_payment_ids", [m.id])
      .maybeSingle();
    if (ex) continue;
    await supabase.from("settlement_discrepancies").insert({
      org_id: orgId,
      discrepancy_type: "missing_settlement",
      related_payment_ids: [m.id],
      amount_expected: m.amount,
      detected_date: today,
    });
    missing++;
  }

  // 3. 정체불명 입금: bank_statements 7일 경과 매칭 X
  const { data: unmatchedDeposits } = await supabase
    .from("bank_statements")
    .select("id, amount, statement_date, counterparty")
    .eq("org_id", orgId)
    .is("matched_payment_id", null)
    .lte("statement_date", cutoff)
    .gt("amount", 0)
    .limit(50);
  for (const d of (unmatchedDeposits ?? []) as Array<{ id: string; amount: number }>) {
    const { data: ex } = await supabase
      .from("settlement_discrepancies")
      .select("id").eq("org_id", orgId)
      .eq("discrepancy_type", "unmatched_deposit")
      .contains("related_payment_ids", [d.id])
      .maybeSingle();
    if (ex) continue;
    await supabase.from("settlement_discrepancies").insert({
      org_id: orgId,
      discrepancy_type: "unmatched_deposit",
      related_payment_ids: [d.id],
      amount_actual: d.amount,
      detected_date: today,
    });
    orphans++;
  }

  return { duplicates, missing, orphans };
}
