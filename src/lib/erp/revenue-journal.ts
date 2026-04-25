import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * 수입결의 빌더.
 *
 * 사용:
 *   - 일자/기간으로 paid 상태 + income_status='confirmed' payments를 묶어 결의 1건 생성
 *   - status 흐름: draft → approved → posted (ERP 전송 완료)
 *
 * 결의번호 자동 생성: REV-YYYYMM-NNNN (org별 시퀀스)
 */

export interface BuildJournalParams {
  orgId: string;
  journalDate: string;          // YYYY-MM-DD
  periodStart?: string;         // 포함할 payment의 pay_date 시작 (기본 = journalDate)
  periodEnd?: string;           // 포함할 payment의 pay_date 종료 (기본 = journalDate)
  unitId?: string | null;       // 특정 unit만
  description?: string;
  createdBy?: string;
}

export interface BuildJournalResult {
  ok: true;
  journalId: string;
  journalNo: string;
  paymentCount: number;
  totalAmount: number;
}

export type BuildJournalError =
  | { ok: false; error: "NO_PAYMENTS" }
  | { ok: false; error: "PERIOD_CLOSED" }
  | { ok: false; error: "DB_FAILED"; message: string };

export async function buildRevenueJournal(
  supabase: SupabaseClient,
  params: BuildJournalParams,
): Promise<BuildJournalResult | BuildJournalError> {
  const { orgId, journalDate, unitId, description, createdBy } = params;
  const periodStart = params.periodStart ?? journalDate;
  const periodEnd = params.periodEnd ?? journalDate;

  // 마감 기간 검사
  const { data: isClosed } = await supabase.rpc("is_period_closed", {
    p_org_id: orgId, p_date: journalDate,
  });
  if (isClosed) return { ok: false, error: "PERIOD_CLOSED" };

  // 후보 payments: paid + income_status='confirmed', 아직 결의에 묶이지 않은 것
  const { data: existing } = await supabase
    .from("revenue_journal_lines")
    .select("payment_id")
    .eq("org_id", orgId);
  const usedSet = new Set(((existing ?? []) as Array<{ payment_id: string }>).map((r) => r.payment_id));

  let q = supabase
    .from("payments")
    .select("id, amount, member_id, campaign_id, unit_id, members(bp_code), campaigns(revenue_account_id), deposit_bank_account_id, bank_accounts:deposit_bank_account_id(cash_account_id)")
    .eq("org_id", orgId)
    .eq("pay_status", "paid")
    .eq("income_status", "confirmed")
    .gte("pay_date", periodStart)
    .lte("pay_date", periodEnd);
  if (unitId) q = q.eq("unit_id", unitId);

  const { data: payments } = await q;
  const candidate = ((payments ?? []) as unknown as Array<{
    id: string; amount: number; member_id: string;
    campaign_id: string | null; unit_id: string | null;
    members: { bp_code: string | null } | null;
    campaigns: { revenue_account_id: string | null } | null;
    bank_accounts: { cash_account_id: string | null } | null;
  }>).filter((p) => !usedSet.has(p.id));

  if (candidate.length === 0) return { ok: false, error: "NO_PAYMENTS" };

  const total = candidate.reduce((a, p) => a + Number(p.amount), 0);

  // 결의 번호 생성
  const yyyymm = journalDate.slice(0, 7).replace("-", "");
  const { count: monthCount } = await supabase
    .from("revenue_journals")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .gte("journal_date", `${journalDate.slice(0, 7)}-01`);
  const seq = String((monthCount ?? 0) + 1).padStart(4, "0");
  const journalNo = `REV-${yyyymm}-${seq}`;

  // 결의 INSERT
  const { data: journal, error: jErr } = await supabase
    .from("revenue_journals")
    .insert({
      org_id: orgId,
      journal_no: journalNo,
      journal_date: journalDate,
      description: description ?? `${periodStart}~${periodEnd} 수입결의`,
      total_amount: total,
      payment_count: candidate.length,
      status: "draft",
      created_by: createdBy ?? null,
    })
    .select("id")
    .maybeSingle();

  if (jErr || !journal) {
    return { ok: false, error: "DB_FAILED", message: jErr?.message ?? "insert failed" };
  }

  // 라인 일괄 INSERT
  const lines = candidate.map((p) => ({
    org_id: orgId,
    journal_id: journal.id,
    payment_id: p.id,
    amount: Number(p.amount),
    debit_account_id: p.bank_accounts?.cash_account_id ?? null,
    credit_account_id: p.campaigns?.revenue_account_id ?? null,
    bp_code: p.members?.bp_code ?? null,
    unit_id: p.unit_id,
  }));

  const { error: lErr } = await supabase.from("revenue_journal_lines").insert(lines);
  if (lErr) {
    // 결의 롤백
    await supabase.from("revenue_journals").delete().eq("id", journal.id);
    return { ok: false, error: "DB_FAILED", message: lErr.message };
  }

  return {
    ok: true,
    journalId: journal.id,
    journalNo,
    paymentCount: candidate.length,
    totalAmount: total,
  };
}
