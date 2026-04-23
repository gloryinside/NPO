import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * G-D130: 수기결제 ↔ 은행 입금 자동 매칭.
 *
 * 알고리즘(단순 규칙 기반):
 *   1. 은행 거래 금액 == payments.amount 동일
 *   2. 거래일 (statement_date) 이 payments.requested_at ±7일
 *   3. payments.pay_status in ('unpaid', 'pending')
 *   4. counterparty 이름이 member 이름과 정확 일치 OR 부분 일치 (공백 무시)
 *
 * 다중 후보가 나오면 매칭하지 않고 수동 선택에 맡긴다 (보수적).
 * 매칭 성공 시:
 *   - bank_statements.matched_payment_id, matched_at 갱신
 *   - payments.pay_status='paid', deposit_date=statement_date, approved_at=now
 */
export async function reconcileBankBatch(
  supabase: SupabaseClient,
  orgId: string,
  batchId: string
): Promise<{ matched: number; unmatched: number; ambiguous: number }> {
  const { data: stmts } = await supabase
    .from("bank_statements")
    .select("id, statement_date, counterparty, amount")
    .eq("org_id", orgId)
    .eq("import_batch_id", batchId)
    .is("matched_at", null)
    .gt("amount", 0);

  const rows = (stmts ?? []) as Array<{
    id: string;
    statement_date: string;
    counterparty: string | null;
    amount: number;
  }>;

  let matched = 0;
  let unmatched = 0;
  let ambiguous = 0;

  for (const s of rows) {
    const lo = offsetDays(s.statement_date, -7);
    const hi = offsetDays(s.statement_date, 7);
    const { data: candidates } = await supabase
      .from("payments")
      .select(
        "id, amount, requested_at, pay_status, members(name)"
      )
      .eq("org_id", orgId)
      .eq("amount", s.amount)
      .in("pay_status", ["unpaid", "pending"])
      .gte("requested_at", lo)
      .lte("requested_at", `${hi}T23:59:59.999Z`);

    const list = (candidates ?? []) as unknown as Array<{
      id: string;
      amount: number;
      requested_at: string;
      pay_status: string;
      members?: { name: string } | null;
    }>;

    const counter = (s.counterparty ?? "").replace(/\s+/g, "");
    const narrowed = counter
      ? list.filter((p) => {
          const n = (p.members?.name ?? "").replace(/\s+/g, "");
          return n && (n === counter || counter.includes(n) || n.includes(counter));
        })
      : list;

    if (narrowed.length === 1) {
      const pick = narrowed[0]!;
      const nowIso = new Date().toISOString();
      await supabase
        .from("bank_statements")
        .update({ matched_payment_id: pick.id, matched_at: nowIso })
        .eq("id", s.id);
      await supabase
        .from("payments")
        .update({
          pay_status: "paid",
          deposit_date: s.statement_date,
          approved_at: nowIso,
        })
        .eq("id", pick.id);
      matched++;
    } else if (narrowed.length === 0) {
      unmatched++;
    } else {
      ambiguous++;
    }
  }

  return { matched, unmatched, ambiguous };
}

function offsetDays(dateStr: string, delta: number): string {
  const d = new Date(dateStr);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}
