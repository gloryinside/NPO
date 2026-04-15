import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { TOSS_WEBHOOK_SECRET } from "@/lib/toss/config";

/**
 * POST /api/webhooks/toss
 *
 * Toss Payments 웹훅 수신. 가상계좌 입금, 결제 상태 변경 등을 비동기 통지받는다.
 *
 * 서명 검증:
 *  - 현재는 우리 내부 `TOSS_WEBHOOK_SECRET` 기반 HMAC-SHA256 구조 (Phase 1 placeholder).
 *  - Toss 실제 서명 스펙은 Phase 2 에서 맞춰 정식 검증으로 교체 예정. (TODO)
 *  - 시크릿이 비어있으면 개발 모드로 간주, 경고만 남기고 통과.
 *
 * middleware 매처가 `api/webhooks` 를 제외하므로 tenant 헤더는 주입되지 않는다.
 * idempotency_key / paymentKey 만으로 payment 를 찾아 처리한다.
 */
export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  if (TOSS_WEBHOOK_SECRET) {
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

    const expected = crypto
      .createHmac("sha256", TOSS_WEBHOOK_SECRET)
      .update(rawBody)
      .digest("base64");

    // timingSafeEqual 은 길이가 같아야 함
    const a = Buffer.from(expected);
    const b = Buffer.from(signatureHeader);
    const valid =
      a.length === b.length && crypto.timingSafeEqual(a, b);

    if (!valid) {
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 401 }
      );
    }
  } else {
    console.warn(
      "[toss-webhook] TOSS_WEBHOOK_SECRET 미설정 — 서명 검증을 건너뜁니다."
    );
  }

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
    .select("id, pay_status, toss_payment_key, idempotency_key")
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

  const nowIso = new Date().toISOString();

  if (
    eventType === "VIRTUAL_ACCOUNT_DEPOSIT_CALLBACK" ||
    status === "DONE"
  ) {
    await supabase
      .from("payments")
      .update({
        pay_status: "paid",
        deposit_date: nowIso,
        updated_at: nowIso,
      })
      .eq("id", payment.id)
      .neq("pay_status", "paid");
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
  // 그 외 이벤트는 무시 (로깅만 할 수도 있음)

  return NextResponse.json({ ok: true });
}
