import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { confirmTossPayment } from "@/lib/toss/client";
import { getOrgTossKeys } from "@/lib/toss/keys";
import { sendDonationConfirmed } from "@/lib/email";
import { pushErpWebhook, toWebhookIncomeStatus } from "@/lib/erp/webhook";

export type ConfirmDonationInput = {
  paymentKey: string;
  orderId: string;
  amount: number;
};

export type ConfirmedPayment = {
  id: string;
  payment_code: string;
  amount: number;
  pay_status: string;
  receipt_url: string | null;
  pg_method: string | null;
  approved_at: string | null;
  campaign_id: string;
  campaign_slug: string | null;
  org_id: string;
  member_id?: string;
};

/**
 * 결제 승인 실행 — prepare 시 발급한 idempotency_key(=orderId) 로 payments 행을 찾아
 * Toss 에 승인 요청 후 DB 에 반영한다. 이미 paid 상태라면 멱등 리턴.
 *
 * API 라우트와 서버 컴포넌트(donate/success) 에서 공유해 쓴다.
 */
export async function confirmDonation(
  input: ConfirmDonationInput
): Promise<ConfirmedPayment> {
  const { paymentKey, orderId, amount } = input;

  if (!paymentKey || !orderId || !Number.isFinite(amount) || amount <= 0) {
    throw new Error("잘못된 결제 파라미터입니다.");
  }

  const supabase = createSupabaseAdminClient();

  // idempotency_key(=orderId) 로 payment 를 조회 — org 단위 UNIQUE 이므로 단일 행
  const { data: payment, error: findError } = await supabase
    .from("payments")
    .select(
      "id, org_id, payment_code, amount, pay_status, receipt_url, pg_method, approved_at, campaign_id, campaigns(slug)"
    )
    .eq("idempotency_key", orderId)
    .maybeSingle();

  if (findError) {
    throw new Error(findError.message);
  }
  if (!payment) {
    throw new Error("결제 정보를 찾을 수 없습니다.");
  }

  // 이미 승인된 결제면 멱등 리턴
  if (payment.pay_status === "paid") {
    return {
      ...(payment as unknown as ConfirmedPayment),
      campaign_slug: (payment as unknown as { campaigns?: { slug?: string } }).campaigns?.slug ?? null,
    };
  }

  // 금액 검증 — prepare 시 저장한 amount 와 클라이언트 파라미터가 일치해야 함
  if (Number(payment.amount) !== Number(amount)) {
    throw new Error("결제 금액이 일치하지 않습니다.");
  }

  // 테넌트별 Toss 키 로드 (secret 없는 기관은 실패 처리)
  const { tossSecretKey } = await getOrgTossKeys(payment.org_id);
  if (!tossSecretKey) {
    throw new Error("결제 설정이 누락되었습니다.");
  }

  // Toss 승인 호출
  let tossResult;
  try {
    tossResult = await confirmTossPayment(tossSecretKey, {
      paymentKey,
      orderId,
      amount,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "결제 승인 실패";
    await supabase
      .from("payments")
      .update({
        pay_status: "failed",
        fail_reason: message,
        toss_payment_key: paymentKey,
        updated_at: new Date().toISOString(),
      })
      .eq("id", payment.id);
    throw new Error(message);
  }

  const approvedAt =
    tossResult.approvedAt ?? new Date().toISOString();

  const { data: updated, error: updateError } = await supabase
    .from("payments")
    .update({
      pay_status: "paid",
      toss_payment_key: tossResult.paymentKey,
      pg_tx_id: tossResult.transactionKey ?? null,
      pg_method: tossResult.method ?? null,
      receipt_url: tossResult.receipt?.url ?? null,
      approved_at: approvedAt,
      deposit_date: approvedAt,
      fail_reason: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", payment.id)
    .select(
      "id, org_id, payment_code, amount, pay_status, receipt_url, pg_method, approved_at, campaign_id, receipt_opt_in, rrn_pending_encrypted, member_id, campaigns(slug)"
    )
    .single();

  if (updateError || !updated) {
    throw new Error(updateError?.message ?? "결제 상태 업데이트 실패");
  }

  // Fire-and-forget: email + ERP webhook notifications
  const confirmedPayment: ConfirmedPayment = {
    ...(updated as unknown as ConfirmedPayment),
    campaign_slug: (updated as unknown as { campaigns?: { slug?: string } }).campaigns?.slug ?? null,
  };

  void sendDonationConfirmedEmail(supabase, confirmedPayment);
  void pushErpWebhookForPayment(supabase, confirmedPayment);

  // 기부금 영수증 신청 + RRN이 있으면 receipts 행 생성 (fire-and-forget)
  const updatedRow = updated as unknown as {
    receipt_opt_in?: boolean;
    rrn_pending_encrypted?: string | null;
    member_id?: string;
  };
  if (updatedRow.receipt_opt_in && updatedRow.rrn_pending_encrypted) {
    void createReceiptForPayment(supabase, confirmedPayment, updatedRow.member_id ?? null, updatedRow.rrn_pending_encrypted);
  }

  return confirmedPayment;
}

// ─── Internal helper ─────────────────────────────────────────────────────────

type SupabaseClient = ReturnType<typeof createSupabaseAdminClient>;

async function sendDonationConfirmedEmail(
  supabase: SupabaseClient,
  payment: ConfirmedPayment
): Promise<void> {
  try {
    // Fetch member email + name, org name, campaign title in parallel
    const [memberRes, orgRes, campaignRes] = await Promise.all([
      payment.member_id
        ? supabase
            .from("members")
            .select("name, email")
            .eq("org_id", payment.org_id)
            .eq("id", payment.member_id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      supabase
        .from("orgs")
        .select("name")
        .eq("id", payment.org_id)
        .maybeSingle(),
      payment.campaign_id
        ? supabase
            .from("campaigns")
            .select("title")
            .eq("id", payment.campaign_id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);

    const memberEmail = memberRes.data?.email;
    if (!memberEmail) return; // no email on file — skip

    sendDonationConfirmed({
      to: memberEmail,
      memberName: memberRes.data?.name ?? "후원자",
      orgName: orgRes.data?.name ?? "",
      campaignTitle: campaignRes.data?.title ?? null,
      amount: Number(payment.amount),
      paymentCode: payment.payment_code,
      approvedAt: payment.approved_at,
    });
  } catch (err) {
    console.error("[email] sendDonationConfirmedEmail lookup failed:", err);
  }
}

async function pushErpWebhookForPayment(
  supabase: SupabaseClient,
  payment: ConfirmedPayment
): Promise<void> {
  try {
    // member_code, payment_code, income_status 조회
    const { data: row } = await supabase
      .from("payments")
      .select(
        "payment_code, amount, pay_date, income_status, members!inner(id, name)"
      )
      .eq("id", payment.id)
      .maybeSingle();

    if (!row) return;

    type RowType = {
      payment_code: string;
      amount: number | null;
      pay_date: string | null;
      income_status: string | null;
      members: { id: string; name: string } | null;
    };

    const r = row as unknown as RowType;

    await pushErpWebhook(payment.org_id, {
      event: "payment.created",
      paymentIdx: payment.id,
      paymentCode: r.payment_code ?? "",
      memberCode: r.members?.id ?? "",
      memberName: r.members?.name ?? "",
      payPrice: Number(r.amount ?? 0),
      payDate: r.pay_date ?? null,
      incomeStatus: toWebhookIncomeStatus(r.income_status ?? "pending"),
      occurredAt: payment.approved_at ?? new Date().toISOString(),
    });
  } catch (err) {
    console.error("[erp-webhook] pushErpWebhookForPayment failed:", err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────

async function createReceiptForPayment(
  supabase: SupabaseClient,
  payment: ConfirmedPayment,
  memberId: string | null,
  rrnEncrypted: string,
): Promise<void> {
  try {
    if (!memberId) return;

    const year = new Date(payment.approved_at ?? Date.now()).getFullYear();

    // receipt_code: ORG 내 당해년도 순번
    const { count } = await supabase
      .from("receipts")
      .select("*", { count: "exact", head: true })
      .eq("org_id", payment.org_id);
    const seq = (count ?? 0) + 1;
    const receiptCode = `RC-${year}-${String(seq).padStart(5, "0")}`;

    const { data: receipt, error: receiptError } = await supabase
      .from("receipts")
      .insert({
        org_id: payment.org_id,
        receipt_code: receiptCode,
        member_id: memberId,
        year,
        total_amount: payment.amount,
        resident_no_encrypted: rrnEncrypted,
        rrn_retention_expires_at: new Date(
          Date.UTC(year + 5, 0, 1) // 5년 후 1월 1일 UTC
        ).toISOString(),
      })
      .select("id")
      .single();

    if (receiptError || !receipt) {
      console.error("[receipt] createReceiptForPayment insert failed:", receiptError?.message);
      return;
    }

    // payments.receipt_id 연결 + rrn_pending_encrypted 제거
    await supabase
      .from("payments")
      .update({
        receipt_id: receipt.id,
        rrn_pending_encrypted: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", payment.id);
  } catch (err) {
    console.error("[receipt] createReceiptForPayment failed:", err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * 결제 취소/실패 시 payment 행을 cancelled 로 마킹.
 * donate/fail 페이지에서 호출.
 */
export async function cancelDonation(orderId: string, reason: string): Promise<void> {
  if (!orderId) return;
  const supabase = createSupabaseAdminClient();

  // 이미 paid 인 건은 건드리지 않음
  await supabase
    .from("payments")
    .update({
      pay_status: "cancelled",
      fail_reason: reason,
      updated_at: new Date().toISOString(),
    })
    .eq("idempotency_key", orderId)
    .in("pay_status", ["pending", "unpaid"]);
}
