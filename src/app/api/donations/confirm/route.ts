import { NextRequest, NextResponse } from "next/server";
import { confirmDonation } from "@/lib/donations/confirm";
import { getClientIp, rateLimit } from "@/lib/rate-limit";

/**
 * POST /api/donations/confirm
 *
 * Toss 결제 성공 리다이렉트 이후 클라이언트/서버페이지가 호출해 결제를 확정한다.
 * idempotency_key 기반이므로 tenant 헤더 없이 동작한다 (orderId 자체가 unique).
 */
export async function POST(req: NextRequest) {
  // Rate limit: IP 당 분당 20회 (confirm은 자동 재시도가 있을 수 있어 prepare보다 느슨)
  const ip = getClientIp(req.headers);
  const limit = rateLimit(`donations:confirm:${ip}`, 20, 60_000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요." },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil(limit.retryAfterMs / 1000)),
        },
      }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { paymentKey, orderId, amount } = body as {
    paymentKey?: string;
    orderId?: string;
    amount?: number;
  };

  if (
    !paymentKey ||
    !orderId ||
    typeof amount !== "number" ||
    !Number.isFinite(amount)
  ) {
    return NextResponse.json(
      { error: "paymentKey, orderId, amount는 필수입니다." },
      { status: 400 }
    );
  }

  try {
    const payment = await confirmDonation({ paymentKey, orderId, amount });
    return NextResponse.json({ payment });
  } catch (err) {
    const message = err instanceof Error ? err.message : "결제 승인 실패";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
