import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getOrgTossKeys } from "@/lib/toss/keys";
import { pushErpWebhook, toWebhookIncomeStatus } from "@/lib/erp/webhook";

/**
 * POST /api/webhooks/toss
 *
 * Toss Payments 웹훅 수신. 가상계좌 입금, 결제 상태 변경 등을 비동기 통지받는다.
 *
 * 멀티테넌트 특성상 웹훅 자체에는 tenant 컨텍스트가 없으므로
 * (1) paymentKey/orderId 로 payments 행을 찾아 org_id 를 확정하고
 * (2) 그 org 의 webhook secret 으로 HMAC 서명을 검증한다.
 * 즉, 검증 이전에 DB 조회를 한다는 tradeoff 가 있다 — 대상 org 가 존재하지 않으면
 * 서명 검증 없이도 그냥 200 으로 흘려보낸다 (Toss 재시도 방지).
 *
 * 서명 스펙: org_secrets.toss_webhook_secret 기반 HMAC-SHA256.
 *   - 헤더 이름: TossPayments-Signature / tosspayments-signature / x-toss-signature
 *   - 값 형식: base64(hmac_sha256(rawBody, secret)) 또는 "sha256=<hex>"
 *   - 비교: timingSafeEqual
 *   - secret 미설정 시: 프로덕션은 401 거부 / 개발은 경고 후 통과
 *
 * 주의: Toss 공식 Webhook은 현재 서명 헤더를 제공하지 않고 IP 화이트리스트를 권장.
 * 본 구현은 자체 proxy/relay를 통과하는 webhook을 HMAC 으로 보호하는 용도.
 */
export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const eventType =
    typeof payload.eventType === "string" ? payload.eventType : "";
  const data =
    (payload.data as Record<string, unknown> | undefined) ?? undefined;

  const paymentKey =
    data && typeof data.paymentKey === "string"
      ? (data.paymentKey as string)
      : undefined;
  const orderId =
    data && typeof data.orderId === "string"
      ? (data.orderId as string)
      : undefined;
  const status =
    data && typeof data.status === "string"
      ? (data.status as string)
      : undefined;

  if (!paymentKey && !orderId) {
    // 참조 키가 없는 이벤트는 그냥 200 으로 흘려보냄
    return NextResponse.json({ ok: true, skipped: true });
  }

  const supabase = createSupabaseAdminClient();

  // paymentKey 우선, 없으면 orderId(idempotency_key) 로 조회
  let query = supabase
    .from("payments")
    .select("id, org_id, pay_status, toss_payment_key, idempotency_key")
    .limit(1);

  if (paymentKey) {
    query = query.eq("toss_payment_key", paymentKey);
  } else if (orderId) {
    query = query.eq("idempotency_key", orderId);
  }

  const { data: rows, error: findError } = await query;
  if (findError) {
    return NextResponse.json({ error: findError.message }, { status: 500 });
  }

  const payment = rows?.[0];
  if (!payment) {
    // 아직 DB 에 없는 경우도 200 으로 응답 (Toss 재시도 방지)
    return NextResponse.json({ ok: true, notFound: true });
  }

  // 해당 org 의 webhook secret 으로 서명 검증
  const { tossWebhookSecret } = await getOrgTossKeys(payment.org_id as string);

  if (tossWebhookSecret) {
    const signatureHeader =
      req.headers.get("TossPayments-Signature") ??
      req.headers.get("tosspayments-signature") ??
      req.headers.get("x-toss-signature") ??
      "";

    if (!signatureHeader) {
      return NextResponse.json(
        { error: "Missing signature" },
        { status: 401 }
      );
    }

    // 허용 형식 1: base64(hmac_sha256)
    // 허용 형식 2: "sha256=<hex>" (GitHub/Stripe 스타일)
    const digestBuffer = crypto
      .createHmac("sha256", tossWebhookSecret)
      .update(rawBody)
      .digest();
    const expectedBase64 = digestBuffer.toString("base64");
    const expectedHex = digestBuffer.toString("hex");

    const normalized = signatureHeader.startsWith("sha256=")
      ? signatureHeader.slice(7)
      : signatureHeader;

    const candidates = [expectedBase64, expectedHex];
    const receivedBuf = Buffer.from(normalized);
    const valid = candidates.some((expected) => {
      const expBuf = Buffer.from(expected);
      return (
        expBuf.length === receivedBuf.length &&
        crypto.timingSafeEqual(expBuf, receivedBuf)
      );
    });

    if (!valid) {
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 401 }
      );
    }
  } else if (process.env.NODE_ENV === "production") {
    // 프로덕션에서 webhook secret 미설정 시 거부 (보안 강화)
    return NextResponse.json(
      { error: "Webhook secret not configured" },
      { status: 401 }
    );
  } else {
    console.warn(
      `[toss-webhook] org ${payment.org_id} 에 webhook secret 이 없어 서명 검증을 건너뜁니다 (개발 환경).`
    );
  }

  const nowIso = new Date().toISOString();

  if (
    eventType === "VIRTUAL_ACCOUNT_DEPOSIT_CALLBACK" ||
    status === "DONE"
  ) {
    const { data: updatedRow } = await supabase
      .from("payments")
      .update({
        pay_status: "paid",
        deposit_date: nowIso,
        updated_at: nowIso,
      })
      .eq("id", payment.id)
      .neq("pay_status", "paid")
      .select(
        "id, org_id, payment_code, amount, pay_date, income_status, members!inner(id, name)"
      )
      .maybeSingle();

    // Fire-and-forget ERP webhook push
    if (updatedRow) {
      type UpdatedRow = {
        id: string;
        org_id: string;
        payment_code: string;
        amount: number | null;
        pay_date: string | null;
        income_status: string | null;
        members: { id: string; name: string } | null;
      };
      const r = updatedRow as unknown as UpdatedRow;
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
  } else if (status === "CANCELED" || status === "ABORTED") {
    await supabase
      .from("payments")
      .update({
        pay_status: "cancelled",
        updated_at: nowIso,
      })
      .eq("id", payment.id);
  } else if (status === "EXPIRED") {
    await supabase
      .from("payments")
      .update({
        pay_status: "failed",
        fail_reason: "expired",
        updated_at: nowIso,
      })
      .eq("id", payment.id);
  }

  return NextResponse.json({ ok: true });
}
