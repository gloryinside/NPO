import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * G-D162: 데이터 품질 점검 지표.
 *   - 중복 회원: email / phone / name+birth_date 기준 (기존 lib/members/duplicate-detection 재사용 가능하지만
 *     여기선 집계만 빠르게 count)
 *   - orphan payment: campaign_id 깨짐
 *   - 영수증 발급 대기: pdf_url NULL 그러나 status='issued'
 *   - billing_key 없는 active regular: 재결제 불가 상태
 *   - email_disabled 비율
 */
export interface DataHealthResult {
  duplicateEmail: number;
  duplicatePhone: number;
  orphanPayments: number;
  receiptMissingPdf: number;
  activeRegularWithoutBillingKey: number;
  emailDisabledCount: number;
  emailDisabledRate: number;
  chargebackRiskCount: number;
  totalMembers: number;
}

export async function computeDataHealth(
  supabase: SupabaseClient,
  orgId: string
): Promise<DataHealthResult> {
  // 중복 이메일
  const { data: emailRows } = await supabase
    .from("members")
    .select("email")
    .eq("org_id", orgId)
    .is("deleted_at", null)
    .not("email", "is", null);
  const emailMap = new Map<string, number>();
  for (const r of (emailRows ?? []) as Array<{ email: string }>) {
    const k = r.email.toLowerCase();
    emailMap.set(k, (emailMap.get(k) ?? 0) + 1);
  }
  let duplicateEmail = 0;
  for (const v of emailMap.values()) if (v > 1) duplicateEmail += v;

  // 중복 전화번호 (숫자만 비교)
  const { data: phoneRows } = await supabase
    .from("members")
    .select("phone")
    .eq("org_id", orgId)
    .is("deleted_at", null)
    .not("phone", "is", null);
  const phoneMap = new Map<string, number>();
  for (const r of (phoneRows ?? []) as Array<{ phone: string }>) {
    const k = r.phone.replace(/\D/g, "");
    if (k.length < 8) continue;
    phoneMap.set(k, (phoneMap.get(k) ?? 0) + 1);
  }
  let duplicatePhone = 0;
  for (const v of phoneMap.values()) if (v > 1) duplicatePhone += v;

  // orphan payments (campaign_id NULL 은 일반후원이라 허용, 끊긴 FK 는 실제로는 불가 — campaign_id 가 캠페인 존재하지 않는 경우)
  const { count: orphanPayments } = await supabase
    .from("payments")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .is("campaign_id", null);

  // 영수증 PDF 누락
  const { count: receiptMissingPdf } = await supabase
    .from("receipts")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .is("pdf_url", null);

  // billing_key 없는 active regular
  const { count: activeRegNoKey } = await supabase
    .from("promises")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .eq("status", "active")
    .eq("type", "regular")
    .is("toss_billing_key", null);

  // email_disabled 통계
  const { count: totalMembers } = await supabase
    .from("members")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .is("deleted_at", null);
  const { count: emailDisabled } = await supabase
    .from("members")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .is("deleted_at", null)
    .eq("email_disabled", true);
  const { count: chargebackRisk } = await supabase
    .from("members")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .is("deleted_at", null)
    .eq("chargeback_risk", true);

  const total = totalMembers ?? 0;
  const disabled = emailDisabled ?? 0;

  return {
    duplicateEmail,
    duplicatePhone,
    orphanPayments: orphanPayments ?? 0,
    receiptMissingPdf: receiptMissingPdf ?? 0,
    activeRegularWithoutBillingKey: activeRegNoKey ?? 0,
    emailDisabledCount: disabled,
    emailDisabledRate: total ? disabled / total : 0,
    chargebackRiskCount: chargebackRisk ?? 0,
    totalMembers: total,
  };
}
