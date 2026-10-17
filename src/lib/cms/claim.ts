import type { SupabaseClient } from "@supabase/supabase-js";
import { toCsv } from "@/lib/csv";
import { queueErpPaymentEvent } from "@/lib/erp/outbound-queue";
import { promisesWithConsent } from "@/lib/cms/withdrawal-consent";
import { promotePendingIdNumber } from "@/lib/receipt/pending-id";

/**
 * 자동이체(CMS) 청구.
 *
 * 국내 NPO는 보통 효성CMS·금결원 대행 등 CMS 대행사 프로그램으로 출금한다. 후원자 계좌와 출금 동의는
 * 대행사가 갖고 있고, 우리는 "이번에 누구에게서 얼마를 출금할지" 명단을 넘긴 뒤 결과를 받아 반영한다.
 *  1) 청구 명단 만들기: 출금일이 된 CMS 결제를 묶어 기록하고 CSV(엑셀)로 내려준다
 *  2) 결과 반영: 대행사 결과를 보고 실패한 사람만 고르면 나머지는 출금 완료로 처리한다
 *
 * 은행에 직접 내는 고정길이(EFT) 파일은 후원자 계좌 정보가 필요해 여기서 만들지 않는다.
 */

export type ClaimablePayment = {
  id: string;
  paymentCode: string;
  amount: number;
  payDate: string | null;
  memberName: string;
  memberCode: string | null;
  /** 정기 약정인데 유효한 출금동의 기록이 없다 — 일시 자동이체(약정 없음)는 false */
  consentMissing: boolean;
};

type PaymentJoin = {
  id: string;
  payment_code: string;
  amount: number;
  pay_date: string | null;
  promise_id: string | null;
  members: { name: string | null; member_code: string | null } | { name: string | null; member_code: string | null }[] | null;
};

function one<T>(v: T | T[] | null): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

/** 출금일(claimDate)까지 도래했고 아직 다른 청구 명단에 들어가 결과를 기다리지 않는 CMS 결제 */
export async function listClaimablePayments(
  supabase: SupabaseClient,
  orgId: string,
  claimDate: string,
): Promise<ClaimablePayment[]> {
  const { data } = await supabase
    .from("payments")
    .select("id, payment_code, amount, pay_date, promise_id, members(name, member_code)")
    .eq("org_id", orgId)
    .eq("pay_method", "cms")
    .in("pay_status", ["pending", "unpaid"])
    .lte("pay_date", claimDate)
    .order("pay_date", { ascending: true })
    .limit(2000);
  const rows = (data ?? []) as unknown as PaymentJoin[];
  if (rows.length === 0) return [];

  // 결과를 아직 받지 않은 청구 줄에 들어 있는 결제는 빼서 두 번 출금되지 않게 한다
  const ids = rows.map((r) => r.id);
  const inFlight = new Set<string>();
  for (let i = 0; i < ids.length; i += 500) {
    const { data: lines } = await supabase
      .from("cms_claim_lines")
      .select("payment_id")
      .eq("org_id", orgId)
      .is("result_code", null)
      .in("payment_id", ids.slice(i, i + 500));
    for (const l of lines ?? []) if (l.payment_id) inFlight.add(l.payment_id as string);
  }

  const promiseIds = [...new Set(rows.map((r) => r.promise_id).filter((v): v is string => !!v))];
  const consented = promiseIds.length ? await promisesWithConsent(supabase, orgId, promiseIds) : new Set<string>();

  return rows
    .filter((r) => !inFlight.has(r.id))
    .map((r) => {
      const m = one(r.members);
      return {
        id: r.id,
        paymentCode: r.payment_code,
        amount: Number(r.amount),
        payDate: r.pay_date,
        memberName: m?.name ?? "",
        memberCode: m?.member_code ?? null,
        consentMissing: !!r.promise_id && !consented.has(r.promise_id),
      };
    });
}

/** 엑셀에서 수식으로 실행되지 않게(=, +, -, @ 로 시작하는 값) */
function safeText(s: string): string {
  return /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
}

export function buildClaimCsv(items: ClaimablePayment[], claimDate: string): string {
  return toCsv(
    ["순번", "후원자번호", "이름", "출금금액", "출금일", "결제번호"],
    items.map((p, i) => [i + 1, p.memberCode ?? "", safeText(p.memberName), p.amount, claimDate, p.paymentCode]),
  );
}

export type CreateClaimResult =
  | { ok: true; claimFileId: string; filename: string; paymentCount: number; totalAmount: number; csv: string }
  | { ok: false; error: string };

export async function createClaim(
  supabase: SupabaseClient,
  params: { orgId: string; claimDate: string; paymentIds: string[]; bankAccountId?: string | null; createdBy: string },
): Promise<CreateClaimResult> {
  const { orgId, claimDate, paymentIds, createdBy } = params;
  if (paymentIds.length === 0) return { ok: false, error: "청구할 결제를 하나 이상 골라 주세요." };

  // 화면에서 넘어온 id는 다시 확인한다(다른 기관 것·이미 청구 중인 것·이미 처리된 것 제외)
  const claimable = await listClaimablePayments(supabase, orgId, claimDate);
  const wanted = new Set(paymentIds);
  const items = claimable.filter((p) => wanted.has(p.id));
  if (items.length === 0) return { ok: false, error: "청구할 수 있는 결제가 없습니다. 화면을 새로고침해 주세요." };
  if (items.length !== wanted.size) {
    return { ok: false, error: "그사이 처리된 결제가 있습니다. 화면을 새로고침한 뒤 다시 만들어 주세요." };
  }

  const totalAmount = items.reduce((s, p) => s + p.amount, 0);
  const ymd = claimDate.replace(/-/g, "");
  const filename = `자동이체청구_${ymd}.csv`;

  const { data: file, error: fErr } = await supabase
    .from("cms_claim_files")
    .insert({
      org_id: orgId,
      filename,
      file_format: "custom",
      bank_account_id: params.bankAccountId ?? null,
      claim_date: claimDate,
      payment_count: items.length,
      total_amount: totalAmount,
      status: "submitted",
      submitted_at: new Date().toISOString(),
      created_by: createdBy,
    })
    .select("id")
    .single();
  if (fErr || !file) return { ok: false, error: "청구 명단을 저장하지 못했습니다." };

  const { error: lErr } = await supabase.from("cms_claim_lines").insert(
    items.map((p) => ({
      org_id: orgId,
      claim_file_id: file.id,
      payment_id: p.id,
      account_holder: p.memberName,
      amount: p.amount,
    })),
  );
  if (lErr) {
    // 줄 저장이 실패하면 빈 명단을 남기지 않는다. 23505 = 동시에 만든 다른 명단이 같은 결제를 먼저 담음(이중 출금 방지 인덱스)
    await supabase.from("cms_claim_files").delete().eq("id", file.id).eq("org_id", orgId);
    return {
      ok: false,
      error:
        lErr.code === "23505"
          ? "그사이 다른 명단에 들어간 결제가 있습니다. 화면을 새로고침한 뒤 다시 만들어 주세요."
          : "청구 명단을 저장하지 못했습니다.",
    };
  }

  return { ok: true, claimFileId: file.id, filename, paymentCount: items.length, totalAmount, csv: buildClaimCsv(items, claimDate) };
}

/** 저장된 청구 명단을 다시 CSV로(다시 내려받기) */
export async function claimCsvFor(supabase: SupabaseClient, orgId: string, fileId: string) {
  const { data: file } = await supabase
    .from("cms_claim_files")
    .select("id, filename, claim_date")
    .eq("id", fileId)
    .eq("org_id", orgId)
    .maybeSingle();
  if (!file) return null;
  const lines = await claimLines(supabase, orgId, fileId);
  const items: ClaimablePayment[] = lines.map((l) => ({
    id: l.paymentId ?? "",
    paymentCode: l.paymentCode ?? "",
    amount: l.amount,
    payDate: null,
    memberName: l.memberName,
    memberCode: l.memberCode,
    consentMissing: false,
  }));
  return { filename: file.filename as string, csv: buildClaimCsv(items, file.claim_date as string) };
}

export type ClaimLine = {
  id: string;
  paymentId: string | null;
  paymentCode: string | null;
  memberName: string;
  memberCode: string | null;
  amount: number;
  resultCode: string | null;
  resultMessage: string | null;
};

export async function claimLines(supabase: SupabaseClient, orgId: string, fileId: string): Promise<ClaimLine[]> {
  const { data } = await supabase
    .from("cms_claim_lines")
    .select("id, payment_id, account_holder, amount, result_code, result_message, payments(payment_code, members(member_code))")
    .eq("org_id", orgId)
    .eq("claim_file_id", fileId)
    .order("id", { ascending: true });
  type Row = {
    id: string;
    payment_id: string | null;
    account_holder: string;
    amount: number;
    result_code: string | null;
    result_message: string | null;
    payments: { payment_code: string; members: { member_code: string | null } | { member_code: string | null }[] | null } | null;
  };
  return ((data ?? []) as unknown as Row[]).map((r) => {
    const pay = one(r.payments);
    return {
      id: r.id,
      paymentId: r.payment_id,
      paymentCode: pay?.payment_code ?? null,
      memberName: r.account_holder,
      memberCode: one(pay?.members ?? null)?.member_code ?? null,
      amount: Number(r.amount),
      resultCode: r.result_code,
      resultMessage: r.result_message,
    };
  });
}

export type ApplyResult = { ok: true; paid: number; failed: number } | { ok: false; error: string };

/**
 * 대행사 출금 결과 반영 — failedLineIds에 든 줄은 실패, 나머지(결과 미반영 줄)는 출금 완료.
 * 완료된 결제는 ERP로 보낼 전표 이벤트를 큐에 넣는다.
 */
export async function applyClaimResult(
  supabase: SupabaseClient,
  params: { orgId: string; fileId: string; failedLineIds: string[]; failReason?: string | null; depositDate: string },
): Promise<ApplyResult> {
  const { orgId, fileId, depositDate } = params;
  const { data: file } = await supabase
    .from("cms_claim_files")
    .select("id, status")
    .eq("id", fileId)
    .eq("org_id", orgId)
    .maybeSingle();
  if (!file) return { ok: false, error: "청구 명단을 찾을 수 없습니다." };
  if (file.status === "completed") return { ok: false, error: "이미 결과를 반영한 명단입니다." };

  const lines = (await claimLines(supabase, orgId, fileId)).filter((l) => l.resultCode === null);
  if (lines.length === 0) return { ok: false, error: "반영할 줄이 없습니다." };
  const failedSet = new Set(params.failedLineIds);
  const reason = params.failReason?.trim().slice(0, 200) || "출금 실패";
  const nowIso = new Date().toISOString();

  let paid = 0;
  let failed = 0;
  for (const l of lines) {
    const isFail = failedSet.has(l.id);
    // 결과 줄 기록이 먼저 성공해야 결제를 바꾼다(같은 줄을 두 번 반영하지 않게 result_code is null 조건)
    const { data: marked } = await supabase
      .from("cms_claim_lines")
      .update({ result_code: isFail ? "XX" : "00", result_message: isFail ? reason : "출금 완료" })
      .eq("id", l.id)
      .eq("org_id", orgId)
      .is("result_code", null)
      .select("id");
    if (!marked?.length || !l.paymentId) continue;

    const { data: changed } = await supabase
      .from("payments")
      .update(
        isFail
          ? { pay_status: "failed", fail_reason: reason, updated_at: nowIso }
          : { pay_status: "paid", deposit_date: depositDate, updated_at: nowIso },
      )
      .eq("id", l.paymentId)
      .eq("org_id", orgId)
      .in("pay_status", ["pending", "unpaid"])
      .select("id");
    if (!changed?.length) continue;
    if (isFail) failed++;
    else paid++;
    await queueErpPaymentEvent(supabase, orgId, l.paymentId, isFail ? "payment.failed" : "payment.paid");
    if (!isFail) await promotePendingIdNumber(supabase, orgId, l.paymentId);
  }

  const { data: all } = await supabase
    .from("cms_claim_lines")
    .select("result_code")
    .eq("org_id", orgId)
    .eq("claim_file_id", fileId);
  const codes = (all ?? []).map((r) => r.result_code as string | null);
  await supabase
    .from("cms_claim_files")
    .update({
      status: codes.every((c) => c !== null) ? "completed" : "result_received",
      result_received_at: nowIso,
      success_count: codes.filter((c) => c === "00").length,
      fail_count: codes.filter((c) => c === "XX").length,
    })
    .eq("id", fileId)
    .eq("org_id", orgId);

  return { ok: true, paid, failed };
}
