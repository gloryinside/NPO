import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getOrgTossKeys } from "@/lib/toss/keys";
import { fetchTossPayment, type TossPayment } from "@/lib/toss/payments-api";
import { pushErpWebhook, toWebhookIncomeStatus } from "@/lib/erp/webhook";
import { getClientIp } from "@/lib/rate-limit";
import { isIpInAllowList } from "@/lib/security/ip-cidr";
import { reportEvent } from "@/lib/observability/report";

/**
 * POST /api/webhooks/toss — 토스페이먼츠 웹훅 수신 (규격: docs.tosspayments.com/guides/v2/webhook)
 *
 * 검증 모델(토스 표준):
 *   결제 상태 웹훅에는 서명이 없다. 본문은 "어떤 결제가 바뀌었는지" 힌트로만 쓰고,
 *   실제 상태·금액은 그 기관의 시크릿 키로 결제 조회 API를 불러 확인한다.
 *   → 위조 웹훅은 토스가 확인해 주지 않으므로 아무것도 바꾸지 못한다.
 *   (예전 구현은 토스가 보내지 않는 HMAC 헤더를 요구해 운영에서 모든 웹훅을 거부했다)
 *
 * 멀티테넌트: orderId(PMT-…)는 기관마다 겹칠 수 있다. 후보 기관 각각의 키로 토스에 물어
 *   실제로 그 결제를 가진 상점(기관)만 일치시킨다.
 *
 * 재전송: 10초 안에 200을 못 받으면 최대 7회 재전송 → transmission-id로 1회만 처리.
 */

type PaymentRow = {
  id: string;
  org_id: string;
  pay_status: string;
  amount: number;
  member_id: string | null;
  toss_payment_key: string | null;
};

const MAX_CANDIDATES = 5;

export async function POST(req: NextRequest) {
  // 선택: IP 화이트리스트 (TOSS_WEBHOOK_ALLOWED_IPS 설정 시)
  const clientIp = getClientIp(req.headers);
  if (!isIpInAllowList(clientIp, process.env.TOSS_WEBHOOK_ALLOWED_IPS)) {
    await reportEvent("webhook.toss.ip_rejected", { domain: "webhook", tags: { ip: clientIp } });
    return NextResponse.json({ error: "ip not allowed" }, { status: 403 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(await req.text());
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const eventType = typeof payload.eventType === "string" ? payload.eventType : "";
  const data = (payload.data as Record<string, unknown> | undefined) ?? {};
  const paymentKey = typeof data.paymentKey === "string" ? data.paymentKey : undefined;
  const orderId = typeof data.orderId === "string" ? data.orderId : undefined;
  if (!paymentKey && !orderId) return NextResponse.json({ ok: true, skipped: "no_reference" });

  const supabase = createSupabaseAdminClient();

  // 1) 중복 수신 차단 — 같은 전송 ID는 한 번만
  const transmissionId = req.headers.get("tosspayments-webhook-transmission-id");
  let eventRowId: string | null = null;
  if (transmissionId) {
    const { data: ev, error: evErr } = await supabase
      .from("webhook_events")
      .insert({ provider: "toss", transmission_id: transmissionId, event_type: eventType, payload })
      .select("id")
      .maybeSingle();
    if (evErr?.code === "23505") return NextResponse.json({ ok: true, duplicate: true });
    eventRowId = ev?.id ?? null;
  }

  // 2) 후보 결제 행 — paymentKey 우선, 없으면 orderId 계열(시도별 orderId·코드·멱등키)
  let candidates: PaymentRow[] = [];
  const cols = "id, org_id, pay_status, amount, member_id, toss_payment_key";
  if (paymentKey) {
    const { data: rows } = await supabase.from("payments").select(cols).eq("toss_payment_key", paymentKey).limit(MAX_CANDIDATES);
    candidates = (rows ?? []) as PaymentRow[];
  }
  if (candidates.length === 0 && orderId) {
    // [보안] 문자열로 조립한 .or() 필터는 쉼표·괄호로 조건을 주입할 수 있다 —
    // 토스 orderId 규칙(영문·숫자·-·_ 6~64자)으로 먼저 거르고, 컬럼별 매개변수 조회로 합친다.
    if (!/^[A-Za-z0-9_-]{6,64}$/.test(orderId)) {
      return NextResponse.json({ ok: true, skipped: "bad_order_id" });
    }
    const byColumn = await Promise.all(
      (["toss_order_id", "payment_code", "idempotency_key"] as const).map((col) =>
        supabase.from("payments").select(cols).eq(col, orderId).limit(MAX_CANDIDATES),
      ),
    );
    const seen = new Set<string>();
    for (const { data: rows } of byColumn) {
      for (const r of (rows ?? []) as PaymentRow[]) {
        if (!seen.has(r.id)) {
          seen.add(r.id);
          candidates.push(r);
        }
      }
    }
    candidates = candidates.slice(0, MAX_CANDIDATES);
  }
  if (candidates.length === 0) {
    await markEvent(supabase, eventRowId, "payment_not_found");
    return NextResponse.json({ ok: true, notFound: true }); // 200 — 토스 재전송 방지
  }

  // 3) 토스에 직접 확인 — 그 결제를 실제로 가진 기관 키로만 조회된다
  let payment: PaymentRow | null = null;
  let verified: TossPayment | null = null;
  for (const c of candidates) {
    const { tossSecretKey } = await getOrgTossKeys(c.org_id);
    if (!tossSecretKey) continue;
    const t = await fetchTossPayment(tossSecretKey, { paymentKey: paymentKey ?? c.toss_payment_key ?? undefined, orderId });
    if (t && (!paymentKey || t.paymentKey === paymentKey) && (!orderId || t.orderId === orderId)) {
      payment = c;
      verified = t;
      break;
    }
  }
  if (!payment || !verified) {
    await markEvent(supabase, eventRowId, "unverified");
    await reportEvent("webhook.toss.unverified", { domain: "webhook", tags: { eventType } });
    return NextResponse.json({ ok: true, unverified: true });
  }

  const nowIso = new Date().toISOString();

  // 4) 확인된 토스 상태로 반영(웹훅 본문 status는 쓰지 않는다)
  if (verified.status === "DONE") {
    if (verified.totalAmount !== Number(payment.amount)) {
      await markEvent(supabase, eventRowId, `amount_mismatch: db ${payment.amount}, toss ${verified.totalAmount}`);
      await reportEvent("webhook.toss.amount_mismatch", { domain: "webhook", tags: { paymentId: payment.id } });
      return NextResponse.json({ ok: true, review: "amount_mismatch" });
    }
    const { data: updatedRow } = await supabase
      .from("payments")
      .update({
        pay_status: "paid",
        toss_payment_key: verified.paymentKey,
        approved_at: verified.approvedAt ?? nowIso,
        deposit_date: (verified.approvedAt ?? nowIso).slice(0, 10),
        updated_at: nowIso,
      })
      .eq("id", payment.id)
      .eq("org_id", payment.org_id)
      .neq("pay_status", "paid")
      .select("id, org_id, payment_code, amount, pay_date, income_status, members!inner(id, name)")
      .maybeSingle();

    if (updatedRow) {
      const r = updatedRow as unknown as {
        id: string; org_id: string; payment_code: string; amount: number | null;
        pay_date: string | null; income_status: string | null; members: { id: string; name: string } | null;
      };
      void pushErpWebhook(r.org_id, {
        event: "payment.created",
        paymentIdx: r.id,
        paymentCode: r.payment_code ?? "",
        memberCode: r.members?.id ?? "",
        memberName: r.members?.name ?? "",
        payPrice: Number(r.amount ?? 0),
        payDate: r.pay_date ?? null,
        incomeStatus: toWebhookIncomeStatus(r.income_status ?? "pending"),
        occurredAt: nowIso,
      });
    }
  } else if (verified.status === "CANCELED") {
    await supabase
      .from("payments")
      .update({ pay_status: "cancelled", updated_at: nowIso })
      .eq("id", payment.id)
      .eq("org_id", payment.org_id)
      .not("pay_status", "in", "(cancelled,refunded)");
  } else if (verified.status === "ABORTED" || verified.status === "EXPIRED") {
    // 이미 결제 완료된 건은 되돌리지 않는다
    await supabase
      .from("payments")
      .update({ pay_status: "failed", fail_reason: verified.status.toLowerCase(), updated_at: nowIso })
      .eq("id", payment.id)
      .eq("org_id", payment.org_id)
      .in("pay_status", ["pending", "unpaid"]);
  }
  // PARTIAL_CANCELED는 환불 모듈(lib/payments/refund)이 금액을 관리 — 여기서 상태를 바꾸지 않는다

  if (eventType === "CHARGEBACK" || eventType === "DISPUTE_CREATED") {
    // 결제 소유 기관을 위에서 토스로 확인한 뒤에만 기록, 사건 번호로 1회만
    const caseId = typeof data.caseId === "string" ? data.caseId : typeof data.disputeId === "string" ? data.disputeId : null;
    await supabase.from("chargebacks").upsert(
      {
        org_id: payment.org_id,
        payment_id: payment.id,
        member_id: payment.member_id ?? null,
        amount: Number((data.amount as number | undefined) ?? payment.amount ?? 0),
        reason_code: typeof data.reasonCode === "string" ? data.reasonCode : null,
        reason_text: typeof data.reasonText === "string" ? data.reasonText : typeof data.message === "string" ? data.message : null,
        toss_case_id: caseId,
        evidence_json: data,
      },
      { onConflict: "org_id,toss_case_id", ignoreDuplicates: true },
    );
    if (payment.member_id) {
      await supabase.from("members").update({ chargeback_risk: true }).eq("id", payment.member_id).eq("org_id", payment.org_id);
    }
  }

  await markEvent(supabase, eventRowId, null);
  return NextResponse.json({ ok: true });
}

async function markEvent(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  id: string | null,
  note: string | null,
) {
  if (!id) return;
  await supabase
    .from("webhook_events")
    .update({ processed_at: new Date().toISOString(), last_error: note })
    .eq("id", id);
}
