import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { confirmTossPayment } from "@/lib/toss/client";
import { getOrgTossKeys } from "@/lib/toss/keys";
import { sendDonationConfirmed } from "@/lib/email";

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
  org_id: string;
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
      "id, org_id, payment_code, amount, pay_status, receipt_url, pg_method, approved_at, campaign_id"
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
    return payment as ConfirmedPayment;
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
      "id, org_id, payment_code, amount, pay_status, receipt_url, pg_method, approved_at, campaign_id"
    )
    .single();

  if (updateError || !updated) {
    throw new Error(updateError?.message ?? "결제 상태 업데이트 실패");
  }

  // Fire-and-forget: email notification after successful confirmation
  void sendDonationConfirmedEmail(supabase, updated as ConfirmedPayment);

  return updated as ConfirmedPayment;
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
      supabase
        .from("members")
        .select("name, email")
        .eq("org_id", payment.org_id)
        .maybeSingle(),
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
