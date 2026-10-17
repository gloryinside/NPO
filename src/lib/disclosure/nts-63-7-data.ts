/**
 * 별지 제63호의7서식 — 시스템 기록으로 초안 만들기, 작성본 저장·불러오기
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildDraft, type ExpenseRecord, type IncomeRecord, type Nts637Form } from "./nts-63-7";

const PAGE = 1000;

/** Supabase 한 번 조회 상한(1,000행)을 넘는 연간 자료를 끝까지 읽는다 */
async function readAll<T>(query: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await query(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if (!data || data.length < PAGE) return out;
  }
}

/**
 * 수입: 그해 결제 완료된 후원금(부분 환불은 뺀 금액). 지출: 그해 사업 집행 내역 — 지급목적은 사업명, 지급처는 집행 지급처.
 */
export async function buildDraftFromRecords(supabase: SupabaseClient, orgId: string, year: number, today: string): Promise<Nts637Form> {
  const from = `${year}-01-01`;
  const to = `${year}-12-31`;

  const [{ data: org }, payments, expenses] = await Promise.all([
    supabase
      .from("orgs")
      .select("name, business_no, representative_name, contact_email, contact_phone, address")
      .eq("id", orgId)
      .maybeSingle(),
    readAll<{ pay_date: string; amount: number; refund_amount: number | null }>((a, b) =>
      supabase
        .from("payments")
        .select("pay_date, amount, refund_amount")
        .eq("org_id", orgId)
        .eq("pay_status", "paid")
        .gte("pay_date", from)
        .lte("pay_date", to)
        .order("id")
        .range(a, b),
    ),
    readAll<{ expense_date: string; amount: number; vendor: string | null; programs: { name: string } | null }>((a, b) =>
      supabase
        .from("program_expenses")
        .select("expense_date, amount, vendor, programs(name)")
        .eq("org_id", orgId)
        .gte("expense_date", from)
        .lte("expense_date", to)
        .order("id")
        .range(a, b) as unknown as PromiseLike<{ data: { expense_date: string; amount: number; vendor: string | null; programs: { name: string } | null }[] | null; error: { message: string } | null }>,
    ),
  ]);

  const income: IncomeRecord[] = payments.map((p) => ({
    date: p.pay_date,
    amount: Number(p.amount ?? 0) - Number(p.refund_amount ?? 0),
  }));
  const expense: ExpenseRecord[] = expenses.map((e) => ({
    date: e.expense_date,
    purpose: e.programs?.name ?? "기타",
    payee: e.vendor?.trim() || null,
    amount: Number(e.amount ?? 0),
  }));

  const o = (org ?? {}) as Record<string, string | null>;
  return buildDraft({
    year,
    org: {
      name: o.name ?? "",
      businessNo: o.business_no ?? null,
      representative: o.representative_name ?? null,
      email: o.contact_email ?? null,
      phone: o.contact_phone ?? null,
      address: o.address ?? null,
    },
    income,
    expense,
    today,
  });
}

export async function loadSavedForm(
  supabase: SupabaseClient,
  orgId: string,
  year: number,
): Promise<{ form: Nts637Form; updatedAt: string | null } | null> {
  const { data } = await supabase
    .from("transparency_disclosures")
    .select("content, updated_at, created_at")
    .eq("org_id", orgId)
    .eq("fiscal_year", year)
    .eq("disclosure_type", "nts_donation_usage")
    .maybeSingle();
  if (!data?.content) return null;
  return { form: data.content as Nts637Form, updatedAt: (data.updated_at ?? data.created_at) as string | null };
}

export async function saveForm(supabase: SupabaseClient, orgId: string, year: number, form: Nts637Form, userId: string): Promise<string | null> {
  const now = new Date().toISOString();
  const { data: existing } = await supabase
    .from("transparency_disclosures")
    .select("id")
    .eq("org_id", orgId)
    .eq("fiscal_year", year)
    .eq("disclosure_type", "nts_donation_usage")
    .maybeSingle();
  const { error } = existing
    ? await supabase.from("transparency_disclosures").update({ content: form, updated_at: now }).eq("id", existing.id).eq("org_id", orgId)
    : await supabase.from("transparency_disclosures").insert({
        org_id: orgId,
        fiscal_year: year,
        disclosure_type: "nts_donation_usage",
        title: `${year}년 연간 기부금 모금액 및 활용실적 명세서`,
        content: form,
        status: "draft",
        created_by: userId,
        updated_at: now,
      });
  return error ? error.message : null;
}
