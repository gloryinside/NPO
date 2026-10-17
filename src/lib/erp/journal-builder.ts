import type { SupabaseClient } from "@supabase/supabase-js";
import { allocateSplit, readSplit } from "@/lib/donations/designation-basket";

/**
 * 결제 한 건 → 분개(JournalLine) 미리보기 생성.
 *
 * 분개 룰 (단순):
 *   차변(Dr): bank_accounts.cash_account_id (어느 자체 계좌로 입금됐는지)
 *     - virtual_account_mappings 또는 payment.deposit_bank_account_id 로 결정
 *     - 매핑 없으면 첫 번째 main 계좌
 *   대변(Cr): campaigns.revenue_account_id
 *     - 캠페인에 매핑된 수익 계정
 *     - 없으면 org 기본 수익 계정 (donation_kind 기반)
 *
 * 분배 (program allocations):
 *   program_funding 룰을 적용해 amount를 N개 program으로 split.
 *   분배 결과는 payment_program_allocations에 저장.
 */

export interface JournalLine {
  side: "debit" | "credit";
  accountId: string | null;
  accountName?: string;
  accountCode?: string;
  amount: number;
  bpCode?: string | null;
  programId?: string | null;
  programName?: string;
  description?: string;
}

export interface JournalPreview {
  lines: JournalLine[];
  totalDebit: number;
  totalCredit: number;
  balanced: boolean;
  warnings: string[];
}

/**
 * 결제 한 건의 분개 미리보기.
 */
export async function buildJournalPreview(
  supabase: SupabaseClient,
  orgId: string,
  paymentId: string,
): Promise<JournalPreview> {
  const warnings: string[] = [];

  const { data: payment } = await supabase
    .from("payments")
    .select(
      "id, amount, pay_date, pg_method, deposit_bank_account_id, member_id, campaign_id, members(bp_code, name), campaigns(revenue_account_id, donation_kind, title)"
    )
    .eq("id", paymentId)
    .eq("org_id", orgId)
    .maybeSingle();

  if (!payment) {
    return { lines: [], totalDebit: 0, totalCredit: 0, balanced: false, warnings: ["payment not found"] };
  }

  const amount = Number(payment.amount ?? 0);
  const member = (payment as { members?: { bp_code?: string | null; name?: string } | null }).members;
  const campaign = (payment as { campaigns?: { revenue_account_id?: string | null; donation_kind?: string | null; title?: string } | null }).campaigns;

  // 1. 차변: 자체 은행계좌 → cash_account_id 결정
  let debitAccountId: string | null = null;
  let debitAccountInfo: { code: string; name: string } | null = null;

  if (payment.deposit_bank_account_id) {
    const { data: ba } = await supabase
      .from("bank_accounts")
      .select("cash_account_id, bank_name, account_no, chart_of_accounts:cash_account_id(code, name)")
      .eq("id", payment.deposit_bank_account_id)
      .eq("org_id", orgId)
      .maybeSingle();
    debitAccountId = (ba as { cash_account_id?: string | null } | null)?.cash_account_id ?? null;
    const coa = (ba as { chart_of_accounts?: { code: string; name: string } | null } | null)?.chart_of_accounts;
    if (coa) debitAccountInfo = { code: coa.code, name: coa.name };
  } else {
    // virtual_account_mappings 룰 매칭
    const { data: maps } = await supabase
      .from("virtual_account_mappings")
      .select("pg_method, virtual_account_pattern, bank_account_id, priority, bank_accounts:bank_account_id(cash_account_id, chart_of_accounts:cash_account_id(code, name))")
      .eq("org_id", orgId)
      .eq("active", true)
      .order("priority");
    for (const rawM of (maps ?? []) as unknown[]) {
      const m = rawM as {
        pg_method: string | null;
        virtual_account_pattern: string | null;
        bank_accounts: unknown;
      };
      if (m.pg_method && m.pg_method !== payment.pg_method) continue;
      if (m.virtual_account_pattern && payment.pg_method !== m.virtual_account_pattern) continue;
      const ba = (Array.isArray(m.bank_accounts) ? m.bank_accounts[0] : m.bank_accounts) as
        { cash_account_id: string | null; chart_of_accounts: unknown } | null;
      if (!ba) continue;
      debitAccountId = ba.cash_account_id ?? null;
      const coaRaw = ba.chart_of_accounts;
      const coa = (Array.isArray(coaRaw) ? coaRaw[0] : coaRaw) as { code: string; name: string } | null;
      if (coa) debitAccountInfo = { code: coa.code, name: coa.name };
      break;
    }
  }

  if (!debitAccountId) {
    warnings.push("입금 계좌 → 회계계정 매핑 없음. 기본 현금계정 사용.");
  }

  // 2. 대변: 캠페인의 수익 계정
  let creditAccountId: string | null = campaign?.revenue_account_id ?? null;
  let creditAccountInfo: { code: string; name: string } | null = null;

  if (creditAccountId) {
    const { data: rc } = await supabase
      .from("chart_of_accounts")
      .select("code, name")
      .eq("id", creditAccountId)
      .maybeSingle();
    if (rc) creditAccountInfo = rc as { code: string; name: string };
  } else {
    warnings.push("캠페인에 수익계정 미설정. 기본 기부금수익 계정 필요.");
  }

  // 3. 프로그램 분배 조회
  const { data: allocations } = await supabase
    .from("payment_program_allocations")
    .select("program_id, amount, programs(name)")
    .eq("payment_id", paymentId);

  const lines: JournalLine[] = [];

  // 차변 1줄
  lines.push({
    side: "debit",
    accountId: debitAccountId,
    accountCode: debitAccountInfo?.code,
    accountName: debitAccountInfo?.name ?? "(미매핑 자산계정)",
    amount,
    bpCode: member?.bp_code ?? null,
    description: `${campaign?.title ?? "기부"} - ${member?.name ?? ""}`,
  });

  // 대변: 분배가 있으면 programs별, 없으면 1줄
  if (allocations && allocations.length > 0) {
    for (const rawA of allocations as unknown[]) {
      const a = rawA as { program_id: string; amount: number; programs: unknown };
      const prog = (Array.isArray(a.programs) ? a.programs[0] : a.programs) as { name: string } | null;
      lines.push({
        side: "credit",
        accountId: creditAccountId,
        accountCode: creditAccountInfo?.code,
        accountName: creditAccountInfo?.name ?? "(미매핑 수익계정)",
        amount: Number(a.amount),
        bpCode: member?.bp_code ?? null,
        programId: a.program_id,
        programName: prog?.name ?? undefined,
        description: `${campaign?.title ?? "기부"} → ${prog?.name ?? ""}`,
      });
    }
    const allocSum = (allocations as Array<{ amount: number }>).reduce((acc, a) => acc + Number(a.amount), 0);
    if (Math.abs(allocSum - amount) > 0.01) {
      warnings.push(`프로그램 분배 합 ${allocSum} ≠ 결제액 ${amount}`);
    }
  } else {
    lines.push({
      side: "credit",
      accountId: creditAccountId,
      accountCode: creditAccountInfo?.code,
      accountName: creditAccountInfo?.name ?? "(미매핑 수익계정)",
      amount,
      bpCode: member?.bp_code ?? null,
      description: `${campaign?.title ?? "기부"} - ${member?.name ?? ""}`,
    });
  }

  const totalDebit = lines.filter((l) => l.side === "debit").reduce((a, l) => a + l.amount, 0);
  const totalCredit = lines.filter((l) => l.side === "credit").reduce((a, l) => a + l.amount, 0);
  const balanced = Math.abs(totalDebit - totalCredit) < 0.01;
  if (!balanced) warnings.push(`차대 불일치: Dr ${totalDebit} vs Cr ${totalCredit}`);

  return { lines, totalDebit, totalCredit, balanced, warnings };
}

/**
 * payment에 대해 program_funding 룰을 적용하고 payment_program_allocations에 INSERT.
 * 이미 분배가 있으면 skip (멱등).
 */
export async function autoAllocateToPrograms(
  supabase: SupabaseClient,
  orgId: string,
  paymentId: string,
): Promise<{ allocated: number; programs: number }> {
  // 이미 있으면 skip
  const { count: existing } = await supabase
    .from("payment_program_allocations")
    .select("id", { count: "exact", head: true })
    .eq("payment_id", paymentId);
  if ((existing ?? 0) > 0) return { allocated: 0, programs: 0 };

  const { data: payment } = await supabase
    .from("payments")
    .select("id, amount, campaign_id, designation_split")
    .eq("id", paymentId)
    .eq("org_id", orgId)
    .maybeSingle();
  if (!payment) return { allocated: 0, programs: 0 };

  const amount = Number(payment.amount ?? 0);
  if (amount <= 0) return { allocated: 0, programs: 0 };

  // 후원자가 사업을 직접 골랐으면(지정기부) 그 나눔이 캠페인 배분 규칙보다 먼저다
  const donorShares = allocateSplit(readSplit(payment.designation_split), amount);
  if (donorShares.length > 0) {
    const { error } = await supabase.from("payment_program_allocations").insert(
      donorShares.map((s) => ({
        org_id: orgId, payment_id: paymentId, program_id: s.programId, amount: s.amount,
        source: "auto", notes: "후원자 지정",
      })),
    );
    if (error) {
      console.error("[journal-builder] donor allocation failed:", error.message);
      return { allocated: 0, programs: 0 };
    }
    return { allocated: donorShares.reduce((a, s) => a + s.amount, 0), programs: donorShares.length };
  }
  if (!payment.campaign_id) return { allocated: 0, programs: 0 };

  // 해당 캠페인에 연결된 program_funding 룰
  const { data: fundings } = await supabase
    .from("program_funding")
    .select("program_id, allocation_type, allocation_value")
    .eq("org_id", orgId)
    .eq("campaign_id", payment.campaign_id);

  if (!fundings?.length) return { allocated: 0, programs: 0 };

  type F = { program_id: string; allocation_type: "percent" | "amount"; allocation_value: number };
  const list = fundings as F[];

  // amount type 먼저 차감 후, percent 비율로 잔액 분배
  let remaining = amount;
  const inserts: Array<{ org_id: string; payment_id: string; program_id: string; amount: number; source: string }> = [];

  for (const f of list.filter((f) => f.allocation_type === "amount")) {
    const v = Math.min(remaining, Number(f.allocation_value));
    if (v > 0) {
      inserts.push({ org_id: orgId, payment_id: paymentId, program_id: f.program_id, amount: v, source: "auto" });
      remaining -= v;
    }
  }

  const percents = list.filter((f) => f.allocation_type === "percent");
  if (percents.length > 0 && remaining > 0) {
    const totalPct = percents.reduce((acc, f) => acc + Number(f.allocation_value), 0);
    if (totalPct > 0) {
      let pctRemaining = remaining;
      for (let i = 0; i < percents.length; i++) {
        const f = percents[i]!;
        // 마지막 항목은 잔여 전부 (반올림 누적 방지)
        const v = i === percents.length - 1
          ? pctRemaining
          : Math.round((remaining * Number(f.allocation_value)) / totalPct);
        if (v > 0) {
          inserts.push({ org_id: orgId, payment_id: paymentId, program_id: f.program_id, amount: v, source: "auto" });
          pctRemaining -= v;
        }
      }
    }
  }

  if (inserts.length === 0) return { allocated: 0, programs: 0 };
  const { error } = await supabase.from("payment_program_allocations").insert(inserts);
  if (error) {
    console.error("[journal-builder] auto-allocate failed:", error.message);
    return { allocated: 0, programs: 0 };
  }
  return {
    allocated: inserts.reduce((a, i) => a + i.amount, 0),
    programs: inserts.length,
  };
}
