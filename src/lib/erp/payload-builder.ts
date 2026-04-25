import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * ERP push 웹훅용 풍부한 payload 빌더.
 *
 * 기존 webhook.ts가 최소 필드(paymentCode/memberCode/payPrice)만 보낸 것과 달리,
 * 회계 전표 자동 생성에 필요한 모든 정보를 포함:
 *   - 거래처 코드 (member.bp_code)
 *   - 차변 계정 (deposit bank → cash account)
 *   - 대변 계정 (campaign revenue account)
 *   - 사업 분배 (program allocations)
 *   - 단위 (unit)
 *   - 통화 / 환율
 */

export interface ErpPaymentPayload {
  event: string;                      // 'payment.paid', 'payment.refunded' 등
  occurredAt: string;
  // payment 기본
  payment: {
    id: string;
    code: string;
    amount: number;
    currency: string;
    amountLocal: number | null;
    fxRate: number | null;
    payDate: string;
    depositDate: string | null;
    payStatus: string;
    incomeStatus: string;
    pgMethod: string | null;
    payMethod: string | null;
  };
  // 거래처 (member)
  party: {
    memberId: string;
    memberCode: string | null;
    bpCode: string | null;
    name: string;
    memberType: string | null;
    businessRegNo: string | null;
    corpLegalName: string | null;
  };
  // 캠페인
  campaign: {
    id: string | null;
    slug: string | null;
    title: string | null;
    donationKind: string | null;
    revenueAccountId: string | null;
    revenueAccountCode: string | null;
    revenueAccountName: string | null;
  } | null;
  // 분개 계정
  accounts: {
    debitAccountId: string | null;
    debitAccountCode: string | null;
    debitAccountName: string | null;
    bankAccountId: string | null;
    bankAccountName: string | null;
  };
  // 사업 배분
  allocations: Array<{
    programId: string;
    programCode: string | null;
    programName: string;
    amount: number;
  }>;
  // 단위 (지부)
  unit: {
    id: string | null;
    code: string | null;
    name: string | null;
  } | null;
}

export async function buildErpPaymentPayload(
  supabase: SupabaseClient,
  orgId: string,
  paymentId: string,
  event: string,
): Promise<ErpPaymentPayload | null> {
  const { data: p } = await supabase
    .from("payments")
    .select(`
      id, payment_code, amount, currency, amount_local, fx_rate,
      pay_date, deposit_date, pay_status, income_status, pg_method, pay_method,
      member_id, campaign_id, unit_id, deposit_bank_account_id,
      members(member_code, bp_code, name, member_type, business_reg_no, corp_legal_name),
      campaigns(slug, title, donation_kind, revenue_account_id, chart_of_accounts:revenue_account_id(code, name)),
      org_units(code, name),
      bank_accounts:deposit_bank_account_id(bank_name, cash_account_id, chart_of_accounts:cash_account_id(code, name))
    `)
    .eq("id", paymentId)
    .eq("org_id", orgId)
    .maybeSingle();

  if (!p) return null;

  const member = (p as { members?: unknown }).members as
    | { member_code: string | null; bp_code: string | null; name: string;
        member_type: string | null; business_reg_no: string | null; corp_legal_name: string | null }
    | null;
  const campaign = (p as { campaigns?: unknown }).campaigns as
    | { slug: string | null; title: string | null; donation_kind: string | null;
        revenue_account_id: string | null;
        chart_of_accounts: { code: string; name: string } | null }
    | null;
  const unit = (p as { org_units?: unknown }).org_units as
    | { code: string; name: string } | null;
  const bankAccount = (p as { bank_accounts?: unknown }).bank_accounts as
    | { bank_name: string; cash_account_id: string | null;
        chart_of_accounts: { code: string; name: string } | null }
    | null;

  // 분배 조회
  const { data: allocs } = await supabase
    .from("payment_program_allocations")
    .select("program_id, amount, programs(code, name)")
    .eq("org_id", orgId)
    .eq("payment_id", paymentId);

  const allocations = ((allocs ?? []) as unknown as Array<{
    program_id: string; amount: number;
    programs: { code: string | null; name: string } | null;
  }>).map((a) => ({
    programId: a.program_id,
    programCode: a.programs?.code ?? null,
    programName: a.programs?.name ?? "",
    amount: Number(a.amount),
  }));

  return {
    event,
    occurredAt: new Date().toISOString(),
    payment: {
      id: p.id,
      code: p.payment_code,
      amount: Number(p.amount ?? 0),
      currency: p.currency ?? "KRW",
      amountLocal: p.amount_local != null ? Number(p.amount_local) : null,
      fxRate: p.fx_rate != null ? Number(p.fx_rate) : null,
      payDate: p.pay_date,
      depositDate: p.deposit_date,
      payStatus: p.pay_status,
      incomeStatus: p.income_status,
      pgMethod: p.pg_method,
      payMethod: p.pay_method,
    },
    party: {
      memberId: p.member_id,
      memberCode: member?.member_code ?? null,
      bpCode: member?.bp_code ?? null,
      name: member?.name ?? "",
      memberType: member?.member_type ?? null,
      businessRegNo: member?.business_reg_no ?? null,
      corpLegalName: member?.corp_legal_name ?? null,
    },
    campaign: campaign
      ? {
          id: p.campaign_id,
          slug: campaign.slug,
          title: campaign.title,
          donationKind: campaign.donation_kind,
          revenueAccountId: campaign.revenue_account_id,
          revenueAccountCode: campaign.chart_of_accounts?.code ?? null,
          revenueAccountName: campaign.chart_of_accounts?.name ?? null,
        }
      : null,
    accounts: {
      debitAccountId: bankAccount?.cash_account_id ?? null,
      debitAccountCode: bankAccount?.chart_of_accounts?.code ?? null,
      debitAccountName: bankAccount?.chart_of_accounts?.name ?? null,
      bankAccountId: p.deposit_bank_account_id,
      bankAccountName: bankAccount?.bank_name ?? null,
    },
    allocations,
    unit: unit
      ? { id: p.unit_id, code: unit.code, name: unit.name }
      : null,
  };
}
