import { revalidateTag } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { confirmTossPayment } from "@/lib/toss/client";
import { getOrgTossKeys } from "@/lib/toss/keys";
import { notifyDonationThanks } from '@/lib/notifications/send';
import { pushErpWebhook, toWebhookIncomeStatus } from "@/lib/erp/webhook";
import { dispatchTrigger } from "@/lib/automation/dispatcher";
import { autoAllocateToPrograms } from "@/lib/erp/journal-builder";
import { dispatchExternalWebhooks } from "@/lib/notifications/external-webhook";
import { enqueueErpEvent } from "@/lib/erp/outbound-queue";
import { buildErpPaymentPayload } from "@/lib/erp/payload-builder";

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
      "id, org_id, payment_code, amount, pay_status, pay_method, receipt_url, pg_method, approved_at, campaign_id, campaigns(slug)"
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

  // pay_status 가 pending 이 아니면 (failed/cancelled) 승인 거부
  if (payment.pay_status !== "pending") {
    throw new Error(
      `결제를 승인할 수 없는 상태입니다. (status=${payment.pay_status})`
    );
  }

  // 오프라인 결제 수단(계좌이체·CMS·수기)은 Toss confirm을 거치지 않으므로
  // 본 엔드포인트로 승인 요청이 들어왔다면 변조 시도로 간주.
  const offlineMethods = ["transfer", "cms", "manual"];
  const paymentMethod = (payment as { pay_method?: string | null }).pay_method;
  if (paymentMethod && offlineMethods.includes(paymentMethod)) {
    throw new Error("오프라인 결제는 관리자 화면에서 확정해야 합니다.");
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
    .neq("pay_status", "paid") // race condition 방지: 이미 paid 면 update 0 행
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
  void dispatchPaymentPaidAutomation(supabase, confirmedPayment);
  void autoAllocateAndEnrichErp(supabase, confirmedPayment);
  void notifyExternalChannels(supabase, confirmedPayment);

  // 캠페인 progress ISR 캐시 즉시 무효화
  if (confirmedPayment.campaign_slug) {
    try {
      revalidateTag(`campaign:${confirmedPayment.campaign_slug}`, "default");
    } catch (err) {
      console.error("[cache] revalidateTag failed:", err);
    }
  }

  // 기부금 영수증 신청 + RRN이 있으면 후원자 정보로 옮긴다 (fire-and-forget).
  // 영수증은 연 1장(연말 일괄·관리자 발급) — 결제마다 영수증을 만들면 연말 일괄이 그 후원자를 건너뛰었다.
  const updatedRow = updated as unknown as {
    receipt_opt_in?: boolean;
    rrn_pending_encrypted?: string | null;
    member_id?: string;
  };
  if (updatedRow.receipt_opt_in && updatedRow.rrn_pending_encrypted) {
    void moveRrnToMember(supabase, confirmedPayment, updatedRow.member_id ?? null, updatedRow.rrn_pending_encrypted);
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
            .select("name, email, phone")
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

    const memberEmail = memberRes.data?.email ?? null;
    const memberPhone = memberRes.data?.phone ?? null;
    // 이메일·전화 모두 없으면 발송 채널이 없음
    if (!memberEmail && !memberPhone) return;

    const payType = (payment as unknown as { pay_method?: string | null }).pay_method === 'card_billing' ? 'regular' : 'onetime';
    notifyDonationThanks({
      orgId: payment.org_id,
      phone: memberPhone,
      email: memberEmail,
      name: memberRes.data?.name ?? '후원자',
      amount: Number(payment.amount),
      type: payType,
      orgName: orgRes.data?.name ?? '',
      campaignTitle: campaignRes.data?.title ?? null,
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

async function dispatchPaymentPaidAutomation(
  supabase: SupabaseClient,
  payment: ConfirmedPayment,
): Promise<void> {
  try {
    // member 정보 보강
    const { data: member } = await supabase
      .from("members")
      .select("id, name, email, tier")
      .eq("id", payment.member_id)
      .maybeSingle();
    await dispatchTrigger(
      supabase,
      payment.org_id,
      "payment_paid",
      {
        paymentId: payment.id,
        amount: Number(payment.amount ?? 0),
        memberId: payment.member_id,
        member: member ?? null,
        email: (member as { email?: string } | null)?.email ?? null,
        campaignSlug: payment.campaign_slug,
      },
      "payment",
      payment.id,
    );
  } catch (err) {
    console.error("[automation] payment_paid dispatch failed:", err);
  }
}

/**
 * 결제 확정 후:
 *   1. program_funding 룰을 적용해 payment_program_allocations 자동 생성
 *   2. 풍부한 payload로 erp_outbound_webhooks queue에 이벤트 적재
 *      (기존 webhook.ts의 단순 payload와 별개로, 회계 전표용 상세 정보)
 */
async function autoAllocateAndEnrichErp(
  supabase: SupabaseClient,
  payment: ConfirmedPayment,
): Promise<void> {
  try {
    await autoAllocateToPrograms(supabase, payment.org_id, payment.id);
    const payload = await buildErpPaymentPayload(supabase, payment.org_id, payment.id, "payment.paid");
    if (payload) {
      await enqueueErpEvent(supabase, payment.org_id, "payment.paid", payload as unknown as Record<string, unknown>);
    }
  } catch (err) {
    console.error("[erp] autoAllocateAndEnrichErp failed:", err);
  }
}

async function notifyExternalChannels(
  supabase: SupabaseClient,
  payment: ConfirmedPayment,
): Promise<void> {
  try {
    const { data: member } = await supabase
      .from("members").select("name").eq("id", payment.member_id).maybeSingle();
    await dispatchExternalWebhooks(supabase, payment.org_id, "payment.paid", {
      amount: Number(payment.amount ?? 0),
      donorName: (member as { name?: string } | null)?.name ?? null,
      campaignSlug: payment.campaign_slug,
      paymentId: payment.id,
    });
  } catch (err) {
    console.error("[external-webhook] notify failed:", err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────

async function moveRrnToMember(
  supabase: SupabaseClient,
  payment: ConfirmedPayment,
  memberId: string | null,
  rrnEncrypted: string,
): Promise<void> {
  try {
    if (!memberId) return;
    // 같은 키(RECEIPTS_ENCRYPTION_KEY)·같은 알고리즘이라 암호문을 그대로 옮긴다 — 평문을 만들지 않는다
    const nowIso = new Date().toISOString();
    const { error } = await supabase
      .from("members")
      .update({ id_number_encrypted: rrnEncrypted, rrn_consent_at: nowIso, updated_at: nowIso })
      .eq("id", memberId)
      .eq("org_id", payment.org_id);
    if (error) {
      console.error("[receipt] moveRrnToMember failed:", error.message);
      return;
    }
    await supabase
      .from("payments")
      .update({ rrn_pending_encrypted: null, updated_at: nowIso })
      .eq("id", payment.id)
      .eq("org_id", payment.org_id);
  } catch (err) {
    console.error("[receipt] moveRrnToMember failed:", err);
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
