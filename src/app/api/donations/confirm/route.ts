import { NextRequest, NextResponse } from "next/server";
import { confirmDonation } from "@/lib/donations/confirm";

/**
 * POST /api/donations/confirm
 *
 * Toss 결제 성공 리다이렉트 이후 클라이언트/서버페이지가 호출해 결제를 확정한다.
 * idempotency_key 기반이므로 tenant 헤더 없이 동작한다 (orderId 자체가 unique).
 */
export async function POST(req: NextRequest) {
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
