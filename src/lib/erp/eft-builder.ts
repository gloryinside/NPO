import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * CMS EFT 청구 파일 빌더.
 *
 * 형식: 금결원 표준 (간소화 버전)
 *   H 레코드 (헤더, 1줄):  H + 청구일(8) + 기관코드(10) + 계좌(14) + 예약(60) = 100
 *   D 레코드 (데이터, N줄): D + 일련(7) + 은행(3) + 계좌(14) + 예금주(20) + 금액(13) + CMS코드(20) + 예약(22) = 100
 *   T 레코드 (트레일러, 1줄): T + 건수(7) + 합계(13) + 예약(79) = 100
 *
 * 각 줄은 정확히 100바이트 (CR/LF 제외).
 * 인코딩: EUC-KR (한글 2바이트). 실제 출력 시 iconv-lite 사용.
 *
 * ⚠️ 실제 은행 제출 전 해당 은행 EFT 명세 최종 확인 필요.
 */

export interface EftBuildParams {
  orgId: string;
  claimDate: string;          // YYYY-MM-DD
  bankAccountId: string;      // 청구 대상 (자체) 계좌
  paymentIds?: string[];      // 명시적 지정 — 없으면 pay_date<=today, pending인 모든 건
}

export interface EftBuildResult {
  ok: true;
  claimFileId: string;
  filename: string;
  paymentCount: number;
  totalAmount: number;
  // 파일 내용 (텍스트 — 응용 단에서 EUC-KR 변환 + Storage 업로드)
  content: string;
}

export type EftBuildError =
  | { ok: false; error: "BANK_ACCOUNT_NOT_FOUND" }
  | { ok: false; error: "NO_PAYMENTS" };

function pad(s: string, n: number, fill: string = " "): string {
  s = s ?? "";
  if (s.length >= n) return s.slice(0, n);
  return s + fill.repeat(n - s.length);
}

function lpad(s: string | number, n: number, fill: string = "0"): string {
  const str = String(s);
  if (str.length >= n) return str.slice(-n);
  return fill.repeat(n - str.length) + str;
}

function ymd(date: string): string {
  return date.replace(/-/g, "");
}

export async function buildEftClaimFile(
  supabase: SupabaseClient,
  params: EftBuildParams,
): Promise<EftBuildResult | EftBuildError> {
  const { orgId, claimDate, bankAccountId, paymentIds } = params;

  // 1. 청구 계좌 조회
  const { data: bank } = await supabase
    .from("bank_accounts")
    .select("bank_name, account_no, account_holder")
    .eq("id", bankAccountId)
    .eq("org_id", orgId)
    .maybeSingle();
  if (!bank) return { ok: false, error: "BANK_ACCOUNT_NOT_FOUND" };

  // 2. 대상 결제 조회
  let q = supabase
    .from("payments")
    .select("id, amount, members(name), promises(toss_billing_key, customer_key)")
    .eq("org_id", orgId)
    .eq("pay_status", "pending")
    .lte("pay_date", claimDate);
  if (paymentIds?.length) q = q.in("id", paymentIds);
  const { data: payments } = await q;
  if (!payments?.length) return { ok: false, error: "NO_PAYMENTS" };

  // 3. 텍스트 라인 생성
  const lines: string[] = [];
  // H 레코드
  lines.push(
    "H" +
    ymd(claimDate) +                          // 8
    pad(orgId.slice(0, 10), 10) +             // 10
    pad(bank.account_no.replace(/-/g, ""), 14) + // 14
    pad("", 60) +                              // 60
    "" /* total 100 = 1+8+10+14+60+7? = use 67 -> ensure 100 */
  );
  // 정확히 100자로 보장 (간소화)
  lines[0] = pad(lines[0], 100);

  let total = 0;
  payments.forEach((p, i) => {
    const member = (p as { members?: unknown }).members;
    const m = (Array.isArray(member) ? member[0] : member) as { name?: string } | null;
    const amount = Number(p.amount);
    total += amount;
    let line =
      "D" +
      lpad(i + 1, 7) +                       // 일련번호 7
      pad("", 3) +                           // 은행코드 3 (실제 빌링키 기반 추출 필요)
      pad("", 14) +                          // 계좌 14 (마스킹 권장)
      pad(m?.name ?? "", 20) +               // 예금주 20
      lpad(amount, 13) +                     // 금액 13
      pad(p.id.slice(0, 20), 20);            // CMS코드 20 (payment id 일부 사용)
    line = pad(line, 100);
    lines.push(line);
  });

  // T 레코드
  let trailer =
    "T" +
    lpad(payments.length, 7) +
    lpad(Math.round(total), 13);
  trailer = pad(trailer, 100);
  lines.push(trailer);

  const content = lines.join("\r\n");
  const filename = `CMS_${ymd(claimDate)}_${orgId.slice(0, 6)}.txt`;

  // 4. claim_file + lines INSERT
  const { data: file, error: fErr } = await supabase
    .from("cms_claim_files")
    .insert({
      org_id: orgId,
      filename,
      file_format: "kftc",
      bank_account_id: bankAccountId,
      claim_date: claimDate,
      payment_count: payments.length,
      total_amount: total,
      status: "draft",
    })
    .select("id")
    .maybeSingle();
  if (fErr || !file) {
    return { ok: false, error: "NO_PAYMENTS" };
  }

  const lineRows = payments.map((p) => {
    const member = (p as { members?: unknown }).members;
    const m = (Array.isArray(member) ? member[0] : member) as { name?: string } | null;
    return {
      org_id: orgId,
      claim_file_id: file.id,
      payment_id: p.id,
      account_holder: m?.name ?? "",
      amount: Number(p.amount),
    };
  });
  await supabase.from("cms_claim_lines").insert(lineRows);

  return {
    ok: true,
    claimFileId: file.id,
    filename,
    paymentCount: payments.length,
    totalAmount: total,
    content,
  };
}
